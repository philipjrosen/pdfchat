// tests/pdf-repository.test.js
import { PdfRepository } from '../repositories/pdf-repository.js';
import { db } from '../database/db.js';

describe('PdfRepository', () => {
  let repository;

  beforeEach(async () => {
    repository = new PdfRepository();
    await repository.reset();  // Clear database before each test
  });

  afterAll(done => {
    db.close(done);
  });

  it('should create a new PDF record', async () => {
    const result = await repository.create(
      'test.pdf',
      Buffer.from('fake pdf content'),
      'fake text content'
    );

    expect(result.id).toBeTruthy();

    const saved = await repository.getById(result.id);
    expect(saved.filename).toBe('test.pdf');
  });

  it('should list all PDFs', async () => {
    await repository.create('test1.pdf', Buffer.from('content1'), 'text1');
    await repository.create('test2.pdf', Buffer.from('content2'), 'text2');

    const list = await repository.list();
    expect(list.length).toBe(2);
    expect(list[0].filename).toBe('test1.pdf');
    expect(list[1].filename).toBe('test2.pdf');
  });

  it('should find PDF by filename', async () => {
    await repository.create('test1.pdf', Buffer.from('content1'), 'text1');
    await repository.create('test2.pdf', Buffer.from('content2'), 'text2');

    const found = await repository.findByFilename('test2.pdf');
    expect(found.text_content).toBe('text2');
  });

  it('should return null when finding non-existent filename', async () => {
    const found = await repository.findByFilename('nonexistent.pdf');
    expect(found).toBeUndefined();
  });

  it('should get text content by id', async () => {
    const result = await repository.create(
      'test.pdf',
      Buffer.from('pdf content'),
      'sample text content'
    );

    const textContent = await repository.getTextById(result.id);
    expect(textContent.text_content).toBe('sample text content');
  });

  it('should update existing record', async () => {
    const result = await repository.create(
      'test.pdf',
      Buffer.from('initial content'),
      'initial text'
    );

    await repository.update(
      result.id,
      Buffer.from('updated content'),
      'updated text'
    );

    const updated = await repository.getById(result.id);
    expect(updated.text_content).toBe('updated text');
  });

  it('should maintain existing content when updating with null values', async () => {
    const result = await repository.create(
      'test.pdf',
      Buffer.from('initial content'),
      'initial text'
    );

    await repository.update(result.id, null, null);

    const updated = await repository.getById(result.id);
    expect(updated.text_content).toBe('initial text');
    expect(updated.pdf_content).toEqual(Buffer.from('initial content'));
  });

  it('should get schema information', async () => {
    const schema = await repository.getSchema();

    expect(Array.isArray(schema)).toBe(true);
    expect(schema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'id',
          type: 'INTEGER'
        }),
        expect.objectContaining({
          name: 'filename',
          type: 'TEXT'
        }),
        expect.objectContaining({
          name: 'text_content',
          type: 'TEXT'
        })
      ])
    );
  });

  it('should handle reset operation', async () => {
    // First add some data
    await repository.create('test1.pdf', Buffer.from('content1'), 'text1');
    await repository.create('test2.pdf', Buffer.from('content2'), 'text2');

    // Reset the database
    await repository.reset();

    // Check that the table is empty but exists
    const list = await repository.list();
    expect(list.length).toBe(0);

    // Verify we can still add new records after reset
    const result = await repository.create(
      'new.pdf',
      Buffer.from('new content'),
      'new text'
    );
    expect(result.id).toBeTruthy();
  });

  it('should include correct content type in list results', async () => {
    await repository.create('pdf-only.pdf', Buffer.from('content'), null);
    await repository.create('text-only.pdf', null, 'text content');
    await repository.create('both.pdf', Buffer.from('content'), 'text content');

    const list = await repository.list();

    const pdfOnly = list.find(item => item.filename === 'pdf-only.pdf');
    const textOnly = list.find(item => item.filename === 'text-only.pdf');
    const both = list.find(item => item.filename === 'both.pdf');

    expect(pdfOnly.content_type).toBe('pdf');
    expect(textOnly.content_type).toBe('text');
    expect(both.content_type).toBe('both');
  });
});