import { dbAsync } from '../database/db.js';

export class PdfRepository {
  async findByFilename(filename) {
    return await dbAsync.get(
      'SELECT id, pdf_content, text_content FROM pdfs WHERE filename = ?',
      [filename]
    );
  }

  async create(filename, pdfContent, textContent) {
    return await dbAsync.run(
      'INSERT INTO pdfs (filename, pdf_content, text_content, status) VALUES (?, ?, ?, ?)',
      [filename, pdfContent, textContent, 'PENDING']
    );
  }

  async update(id, pdfContent, textContent, status = 'PENDING') {
    return await dbAsync.run(
      `UPDATE pdfs
       SET pdf_content = COALESCE(?, pdf_content),
           text_content = COALESCE(?, text_content),
           status = ?
       WHERE id = ?`,
      [pdfContent, textContent, status, id]
    );
  }

  async getById(id) {
    return await dbAsync.get('SELECT * FROM pdfs WHERE id = ?', [id]);
  }

  async getTextById(id) {
    return await dbAsync.get(
      'SELECT id, text_content, status FROM pdfs WHERE id = ?',
      [id]
    );
  }

  async list() {
    return await dbAsync.all(
      `SELECT
        id,
        filename,
        upload_date,
        status,
        CASE
          WHEN pdf_content IS NOT NULL AND text_content IS NOT NULL THEN 'both'
          WHEN pdf_content IS NOT NULL THEN 'pdf'
          WHEN text_content IS NOT NULL THEN 'text'
          ELSE 'none'
        END as content_type
       FROM pdfs
       ORDER BY upload_date ASC`
    );
  }

  async getSchema() {
    return await dbAsync.all(
      `SELECT name, type
       FROM pragma_table_info('pdfs')`
    );
  }

  // In pdfRepository.js
  async reset() {
    // Create table if it doesn't exist
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS pdfs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        status TEXT NOT NULL,
        pdf_content BLOB,
        text_content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Clear existing data
    await dbAsync.run('DELETE FROM pdfs;');
  }

  async updateStatus(id, status) {
    return await dbAsync.run(
      'UPDATE pdfs SET status = ? WHERE id = ?',
      [status, id]
    );
  }
}