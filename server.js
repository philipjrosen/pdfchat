import express from 'express';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BLOB NOT NULL,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Middleware for parsing JSON
app.use(express.json());

// POST endpoint for uploading PDFs
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { originalname, mimetype, buffer, size } = req.file;
    const filename = Date.now() + '-' + path.basename(originalname);

    // Insert PDF into database
    const stmt = db.prepare(`
      INSERT INTO pdfs (filename, original_name, mime_type, size, data)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      filename,
      originalname,
      mimetype,
      size,
      buffer,
      function(err) {
        if (err) {
          console.error('Error inserting PDF:', err);
          return res.status(500).json({ error: 'Failed to store PDF' });
        }

        res.json({
          message: 'PDF uploaded successfully',
          id: this.lastID,
          filename,
          originalname,
          size
        });
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
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

    res.set({
      'Content-Type': row.mime_type,
      'Content-Disposition': `inline; filename="${row.original_name}"`,
      'Content-Length': row.size
    });

    res.send(row.data);
  });
});

// GET endpoint to retrieve table schema
app.get('/schema', (req, res) => {
  db.all("PRAGMA table_info(pdfs)", [], (err, rows) => {
    if (err) {
      console.error('Error retrieving schema:', err);
      return res.status(500).json({ error: 'Failed to retrieve schema' });
    }
    res.json(rows);
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