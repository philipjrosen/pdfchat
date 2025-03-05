import sqlite3 from 'sqlite3';
import { config } from '../config/config.js';

export async function initializeDb(dbFilename = config.database.filename) {
  const db = new sqlite3.Database(dbFilename, (err) => {
    if (err) {
      console.error('Error opening database:', err);
      process.exit(1);
    }
    if (process.env.NODE_ENV !== 'test') {
      console.log('Connected to SQLite database');
    }
  });

  // Create tables
  await new Promise((resolve, reject) => {
    // Enable foreign keys first
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Create tables sequentially
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS pdfs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            pdf_content BLOB,
            text_content TEXT,
            status TEXT DEFAULT 'PENDING',
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS corpus (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'PENDING'
          );
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            corpus_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            text_content TEXT,
            status TEXT DEFAULT 'PENDING',
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (corpus_id) REFERENCES corpus(id)
          );
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });

  return {
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
    }),

    close: () => new Promise((resolve, reject) => {
      db.close(err => {
        if (err) reject(err);
        else resolve();
      });
    })
  };
}

// Initialize the default database instance
export const dbAsync = await initializeDb();