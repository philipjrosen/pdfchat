import { dbAsync } from '../database/db.js';

export class CorpusRepository {
  async create(title) {
    const result = await dbAsync.run(
      'INSERT INTO corpus (title, status) VALUES (?, ?)',
      [title, 'PENDING']
    );
    return { id: result.id, title, status: 'PENDING' };
  }

  async getById(id) {
    return await dbAsync.get('SELECT * FROM corpus WHERE id = ?', [id]);
  }

  async updateStatus(id, status) {
    await dbAsync.run(
      'UPDATE corpus SET status = ? WHERE id = ?',
      [status, id]
    );
  }

  async createDocument(corpusId, filename, pdfContent) {
    const result = await dbAsync.run(
      'INSERT INTO documents (corpus_id, filename, pdf_content, status) VALUES (?, ?, ?, ?)',
      [corpusId, filename, pdfContent, 'PENDING']
    );
    return {
      id: result.id,
      filename,
      status: 'PENDING'
    };
  }

  async list() {
    return await dbAsync.all('SELECT * FROM corpus ORDER BY created_at DESC');
  }

  async reset() {
    await dbAsync.run('DELETE FROM documents');
    await dbAsync.run('DELETE FROM corpus');
    // Reset the autoincrement counters
    await dbAsync.run('DELETE FROM sqlite_sequence WHERE name IN ("documents", "corpus")');
  }

  async getSchema() {
    const corpus = await dbAsync.all("PRAGMA table_info('corpus')");
    const documents = await dbAsync.all("PRAGMA table_info('documents')");
    return {
      corpus: corpus.map(col => ({
        name: col.name,
        type: col.type
      })),
      documents: documents.map(col => ({
        name: col.name,
        type: col.type
      }))
    };
  }
}