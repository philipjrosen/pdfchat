import express from 'express';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import path from 'path';

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
      original_name TEXT NOT NULL,
      data BLOB NOT NULL,
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
        original_name TEXT NOT NULL,
        data BLOB NOT NULL,
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
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { originalname, buffer } = req.file;
		console.log(originalname);

    // Insert PDF into database
    const stmt = db.prepare(`
      INSERT INTO pdfs (original_name, data)
      VALUES (?, ?)
    `);

    stmt.run(
      originalname,
      buffer,
      function(err) {
        if (err) {
          console.error('Error inserting PDF:', err);
          return res.status(500).json({ error: 'Failed to store PDF' });
        }

        res.json({
          message: 'PDF uploaded successfully',
          id: this.lastID,
          originalname
        });
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
    `SELECT id, original_name, upload_date
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

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${row.original_name}"`,
      'Content-Length': Buffer.byteLength(row.data)
    });

    res.send(row.data);
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