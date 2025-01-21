import express from 'express';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Disable worker for Node environment
pdfjsLib.GlobalWorkerOptions.disableWorker = true;

// Configure font data path
pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = `node_modules/pdfjs-dist/standard_fonts/`;

const app = express();
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
const db = new sqlite3.Database('pdfs.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  console.log('Connected to SQLite database');

  // Create pdfs table if it doesn't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS pdfs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      pdf_content BLOB,
			text_content TEXT,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Middleware for parsing JSON
app.use(express.json());

// POST endpoint to reset database
app.post('/reset', (req, res) => {
  // Drop the table if it exists
  db.run('DROP TABLE IF EXISTS pdfs', (err) => {
    if (err) {
      console.error('Error dropping table:', err);
      return res.status(500).json({ error: 'Failed to reset database' });
    }

    // Recreate the table
    db.run(`
      CREATE TABLE pdfs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        pdf_content BLOB,
				text_content TEXT,
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
// POST endpoint for uploading PDFs
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

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO pdfs (filename, pdf_content, text_content)
      VALUES (?, ?, ?)
    `);

    stmt.run(
      originalname,
      shouldExtractText ? null : buffer,
      text_content,
      function(err) {
        if (err) {
          console.error('Error inserting PDF:', err);
          return res.status(500).json({ error: 'Failed to store PDF' });
        }

        const response = {
          message: 'PDF processed successfully',
          id: this.lastID,
          filename: originalname
        };

        if (text_content) {
          response.text_content = text_content;
        }

        res.json(response);
      }
    );
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

// GET endpoint to list all PDFs (without binary data)
app.get('/pdfs', (req, res) => {
  db.all(
    `SELECT id, filename, upload_date
     FROM pdfs
     ORDER BY upload_date DESC`,
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
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

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