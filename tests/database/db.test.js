import { initializeDb } from '../../database/db.js';

describe('Database Schema', () => {
  let testDb;

  beforeAll(async () => {
    // Use in-memory database for testing
    testDb = await initializeDb(':memory:');
    // Enable foreign keys
    await testDb.run('PRAGMA foreign_keys = ON');
  });

  afterAll(async () => {
    await testDb.close();
  });

  beforeEach(async () => {
    // Verify tables exist before each test
    const tables = await testDb.all(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    if (tables.length === 0) {
      throw new Error('Tables were not created during initialization');
    }
  });

  it('should create corpus table with correct schema', async () => {
    const tableInfo = await testDb.all("PRAGMA table_info('corpus')");
    const columnNames = tableInfo.map(col => col.name);
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'id', 'title', 'created_at', 'status'
      ])
    );
  });

  it('should create documents table with correct schema', async () => {
    const tableInfo = await testDb.all("PRAGMA table_info('documents')");
    const columnNames = tableInfo.map(col => col.name);
    expect(columnNames).toEqual(
      expect.arrayContaining([
        'id', 'corpus_id', 'filename',
        'text_content', 'status', 'upload_date'
      ])
    );
  });

  it('should enforce foreign key constraint', async () => {
    await expect(
      testDb.run(
        'INSERT INTO documents (corpus_id, filename) VALUES (?, ?)',
        [999, 'test.pdf']
      )
    ).rejects.toThrow('FOREIGN KEY');
  });
});
