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

  it('should create a document in a corpus', async () => {
    const corpus = await repository.create('Test Corpus');
    const doc = await repository.createDocument(
      corpus.id,
      'test.pdf',
      Buffer.from('fake pdf content')
    );

    expect(doc).toEqual({
      id: expect.any(Number),
      filename: 'test.pdf',
      status: 'PENDING'
    });
  });

  it('should list all corpora', async () => {
    await repository.create('First Corpus');
    await repository.create('Second Corpus');

    const results = await repository.list();
    expect(results).toHaveLength(2);
    expect(results.map(c => c.title)).toEqual(['First Corpus', 'Second Corpus']);
  });

  it('should reset all data', async () => {
    const corpus = await repository.create('Test Corpus');
    await repository.createDocument(
      corpus.id,
      'test.pdf',
      Buffer.from('fake pdf content')
    );

    await repository.reset();
    const results = await repository.list();
    expect(results).toHaveLength(0);
  });

  it('should return schema for corpus and documents tables', async () => {
    const schema = await repository.getSchema();

    expect(schema).toHaveProperty('corpus');
    expect(schema).toHaveProperty('documents');
    expect(schema.corpus.some(col => col.name === 'title')).toBe(true);
    expect(schema.documents.some(col => col.name === 'corpus_id')).toBe(true);
  });
});