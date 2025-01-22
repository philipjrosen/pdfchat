import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'url';
import { app, db, server } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PDF Upload API', () => {
  beforeEach(async () => {
    // Reset database before each test
    await request(app).post('/reset');
  });

  afterAll(done => {
    db.close(() => {
      if (server) {
        server.close(done);
      } else {
        done();
      }
    });
  });

  describe('POST /upload', () => {
    it('should upload a PDF file and store it', async () => {
      const testPdfPath = path.join(__dirname, 'fixtures/test.pdf');
      const response = await request(app)
        .post('/upload')
        .attach('pdf', testPdfPath);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('PENDING');
    });

    it('should extract text when extractText=true', async () => {
      const testPdfPath = path.join(__dirname, 'fixtures/test.pdf');
      const response = await request(app)
        .post('/upload?extractText=true')
        .attach('pdf', testPdfPath);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('text_content');
      expect(response.body.text_content).toBeTruthy();
    });
  });

  describe('GET /pdfs', () => {
    it('should list uploaded PDFs', async () => {
      // First upload a PDF
      const testPdfPath = path.join(__dirname, 'fixtures/test.pdf');
      await request(app)
        .post('/upload')
        .attach('pdf', testPdfPath);

      // Then get the list
      const response = await request(app).get('/pdfs');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
    });
  });

  describe('GET /schema', () => {
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
});