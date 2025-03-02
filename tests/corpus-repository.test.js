import { CorpusRepository } from '../repositories/corpus-repository.js';
import { dbAsync } from '../database/db.js';

describe('CorpusRepository', () => {
  let repository;

  beforeAll(() => {
    repository = new CorpusRepository();
  });

  afterAll(async () => {
    await dbAsync.close();
  });

  beforeEach(async () => {
    // Clear existing data
    await dbAsync.run('DELETE FROM documents');
    await dbAsync.run('DELETE FROM corpus');
  });

  it('should create a new corpus', async () => {
    const title = 'Test Corpus';
    const result = await repository.create(title);

    expect(result).toEqual({
      id: expect.any(Number),
      title: title,
      status: 'PENDING'
    });
  });

  it('should get corpus by id', async () => {
    const created = await repository.create('Test Corpus');
    const result = await repository.getById(created.id);

    expect(result).toEqual({
      id: created.id,
      title: 'Test Corpus',
      status: 'PENDING',
      created_at: expect.any(String)
    });
  });

  it('should update corpus status', async () => {
    const created = await repository.create('Test Corpus');
    await repository.updateStatus(created.id, 'COMPLETED');

    const updated = await repository.getById(created.id);
    expect(updated.status).toBe('COMPLETED');
  });
});