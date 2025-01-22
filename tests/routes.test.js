import request from 'supertest';
import { app } from '../server.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PDF Routes', () => {
  beforeEach(async () => {
    // Reset database before each test
    await request(app).post('/reset');
  });

  describe('Upload Endpoint', () => {
    it('should return 400 when no file is uploaded', async () => {
      const response = await request(app)
        .post('/upload');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No PDF file uploaded');
    });

    it('should reject non-PDF files', async () => {
      const response = await request(app)
        .post('/upload')
        .attach('pdf', path.join(__dirname, 'fixtures/not-a-pdf.txt'));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Only PDF files are allowed');
    });

    it('should upload PDF successfully', async () => {
      const response = await request(app)
        .post('/upload')
        .attach('pdf', path.join(__dirname, 'fixtures/test.pdf'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('PENDING');
    });

    it('should extract text when requested', async () => {
      const response = await request(app)
        .post('/upload?extractText=true')
        .attach('pdf', path.join(__dirname, 'fixtures/test.pdf'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('text_content');
      expect(response.body.text_content).toBeTruthy();
    });
  });

  describe('List Endpoint', () => {
    it('should list uploaded PDFs', async () => {
      // First upload a PDF
      await request(app)
        .post('/upload')
        .attach('pdf', path.join(__dirname, 'fixtures/test.pdf'));

      const response = await request(app).get('/pdfs');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });
  });

  describe('Schema Endpoint', () => {
    it('should return database schema', async () => {
      const response = await request(app).get('/schema');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'id',
            type: 'INTEGER'
          })
        ])
      );
    });
  });

  describe('Text Content Endpoint', () => {
    it('should return 404 for non-existent document', async () => {
      const response = await request(app).get('/text/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Document not found');
    });

    it('should return text content for existing document', async () => {
      // First upload a PDF with text extraction
      const uploadResponse = await request(app)
        .post('/upload?extractText=true')
        .attach('pdf', path.join(__dirname, 'fixtures/test.pdf'));

      const response = await request(app).get(`/text/${uploadResponse.body.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('text_content');
      expect(response.body.text_content).toBeTruthy();
    });
  });
});