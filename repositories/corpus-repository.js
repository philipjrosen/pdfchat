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
}