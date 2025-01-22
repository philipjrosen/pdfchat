import sqlite3 from 'sqlite3';
import { config } from '../config/config.js';

// Initialize SQLite database
export const db = new sqlite3.Database(config.database.filename, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
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

// Promisify database operations for easier use
export const dbAsync = {
  get: (sql, params) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  }),

  run: (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  }),

  all: (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  })
};