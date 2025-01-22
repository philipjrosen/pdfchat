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

  async update(id, pdfContent, textContent) {
    return await dbAsync.run(
      `UPDATE pdfs 
       SET pdf_content = COALESCE(?, pdf_content),
           text_content = COALESCE(?, text_content),
           status = 'PENDING'
       WHERE id = ?`,
      [pdfContent, textContent, id]
    );
  }

  async getById(id) {
    return await dbAsync.get('SELECT * FROM pdfs WHERE id = ?', [id]);
  }

  async getTextById(id) {
    return await dbAsync.get('SELECT text_content FROM pdfs WHERE id = ?', [id]);
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

  async reset() {
    await dbAsync.run('DROP TABLE IF EXISTS pdfs');
    
    return await dbAsync.run(`
      CREATE TABLE pdfs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        pdf_content BLOB,
        text_content TEXT,
        status TEXT DEFAULT 'PENDING',
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}