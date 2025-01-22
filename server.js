import express from 'express';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { documentQueue } from './queue.js';

// Disable worker for Node environment
pdfjsLib.GlobalWorkerOptions.disableWorker = true;

// Configure font data path
pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = `node_modules/pdfjs-dist/standard_fonts/`;

export const app = express();
const port = 3000;

// Configure multer for PDF uploads
const upload = multer({
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

async function extractPdfText(buffer) {
  try {
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    let fullText = '';

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText.trim();
  } catch (error) {
    throw new Error('Failed to extract text from PDF: ' + error.message);
  }
}

// Initialize SQLite database
export const db = new sqlite3.Database('pdfs.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  if (process.env.NODE_ENV !== 'test') {
    console.log('Connected to SQLite database');
  }

  // Create pdfs table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS pdfs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      pdf_content BLOB,
			text_content TEXT,
			status TEXT DEFAULT 'PENDING',
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Middleware for parsing JSON
app.use(express.json());

// POST endpoint to reset database
app.post('/reset', (req, res) => {
  db.run('DROP TABLE IF EXISTS pdfs', (err) => {
    if (err) {
      console.error('Error dropping table:', err);
      return res.status(500).json({ error: 'Failed to reset database' });
    }

    db.run(`
      CREATE TABLE pdfs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        pdf_content BLOB,
        text_content TEXT,
        status TEXT DEFAULT 'PENDING',
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error recreating table:', err);
        return res.status(500).json({ error: 'Failed to recreate table' });
      }

      res.json({ message: 'Database reset successfully' });
    });
  });
});

// POST endpoint for uploading PDFs
// Modified upload endpoint
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { originalname, buffer } = req.file;
    const shouldExtractText = req.query.extractText === 'true';
    let text_content = null;

    if (shouldExtractText) {
      try {
        text_content = await extractPdfText(new Uint8Array(buffer));
      } catch (parseError) {
        console.error('Error parsing PDF:', parseError);
        return res.status(400).json({ error: 'Failed to parse PDF text content' });
      }
    }

    // Check if file already exists
    db.get('SELECT id, pdf_content, text_content FROM pdfs WHERE filename = ?', [originalname], async (err, existing) => {
      if (err) {
        console.error('Error checking for existing file:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (existing) {
        // Update existing record
        const stmt = db.prepare(`
          UPDATE pdfs
          SET pdf_content = COALESCE(?, pdf_content),
              text_content = COALESCE(?, text_content),
              status = 'PENDING'
          WHERE id = ?
        `);

        stmt.run(
          shouldExtractText ? null : buffer,
          text_content,
          existing.id,
          async function(err) {
            if (err) {
              console.error('Error updating record:', err);
              return res.status(500).json({ error: 'Failed to update record' });
            }

            // Add job to queue if text content exists
            if (text_content) {
              try {
                await documentQueue.add('process-document', {
                  documentId: existing.id,
                  filename: originalname
                });
              } catch (queueError) {
                console.error('Error adding job to queue:', queueError);
                // Continue with response even if queuing fails
              }
            }

            res.json({
              message: 'Document updated successfully',
              id: existing.id,
              filename: originalname,
              status: 'PENDING',
              text_content: text_content || existing.text_content
            });
          }
        );
      } else {
        // Insert new record
        const stmt = db.prepare(`
          INSERT INTO pdfs (filename, pdf_content, text_content, status)
          VALUES (?, ?, ?, 'PENDING')
        `);

        stmt.run(
          originalname,
          shouldExtractText ? null : buffer,
          text_content,
          async function(err) {
            if (err) {
              console.error('Error inserting record:', err);
              return res.status(500).json({ error: 'Failed to store record' });
            }

            // Add job to queue if text content exists
            if (text_content) {
              try {
                await documentQueue.add('process-document', {
                  documentId: this.lastID,
                  filename: originalname
                });
              } catch (queueError) {
                console.error('Error adding job to queue:', queueError);
                // Continue with response even if queuing fails
              }
            }

            res.json({
              message: 'Document uploaded successfully',
              id: this.lastID,
              filename: originalname,
              status: 'PENDING',
              text_content: text_content
            });
          }
        );
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint to fetch database schema
app.get('/schema', (req, res) => {
  db.all(
    `SELECT name, type
     FROM pragma_table_info('pdfs')`,
    (err, rows) => {
      if (err) {
        console.error('Error retrieving schema:', err);
        return res.status(500).json({ error: 'Failed to retrieve schema' });
      }

      res.json(rows);
    }
  );
});

// GET endpoint to list all PDFs
app.get('/pdfs', (req, res) => {
  db.all(
    `SELECT
      id,
      filename,
      upload_date,
      CASE
        WHEN pdf_content IS NOT NULL AND text_content IS NOT NULL THEN 'both'
        WHEN pdf_content IS NOT NULL THEN 'pdf'
        WHEN text_content IS NOT NULL THEN 'text'
        ELSE 'none'
      END as content_type
     FROM pdfs
     ORDER BY upload_date ASC`,
    (err, rows) => {
      if (err) {
        console.error('Error retrieving PDFs:', err);
        return res.status(500).json({ error: 'Failed to retrieve PDF list' });
      }

      res.json(rows);
    }
  );
});

// GET endpoint to retrieve PDF by ID
app.get('/pdf/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM pdfs WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error retrieving PDF:', err);
      return res.status(500).json({ error: 'Failed to retrieve PDF' });
    }

    if (!row) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    if (!row.pdf_content) {
      return res.status(404).json({
        error: 'No PDF content available for this document. It may only have text content.'
      });
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${row.filename}"`,
      'Content-Length': Buffer.byteLength(row.pdf_content)
    });

    res.send(row.pdf_content);
  });
});

// GET endpoint to retrieve text content by ID
app.get('/text/:id', (req, res) => {
  const { id } = req.params;

  db.get('SELECT text_content FROM pdfs WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error retrieving text:', err);
      return res.status(500).json({ error: 'Failed to retrieve text content' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!row.text_content) {
      return res.status(404).json({
        error: 'No text content available for this document. It may only have PDF content.'
      });
    }

    res.json({ text_content: row.text_content });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }
    return res.status(400).json({ error: err.message });
  }

  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
export let server
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

// Clean up database connection on server shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});