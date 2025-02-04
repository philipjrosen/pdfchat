import request from 'supertest';
import { app, server } from '../server.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { documentQueue, connection } from '../services/queue.js';
import { worker } from '../services/worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Waits for the queue to become idle by checking active and waiting jobs.
 */
async function waitForQueueToBeIdle(queue) {
  let isIdle = false;
  while (!isIdle) {
    const active = await queue.getActive();
    const waiting = await queue.getWaiting();
    if (active.length === 0 && waiting.length === 0 && !queue.paused) {
      isIdle = true;
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

describe('PDF Routes', () => {
  beforeEach(async () => {
    // Reset database before each test
    await request(app).post('/reset');
    // Clean the queue to ensure no leftover jobs
    await documentQueue.clean(0, 'completed');
    await documentQueue.clean(0, 'failed');
    await documentQueue.clean(0, 'waiting');
    await documentQueue.clean(0, 'active');
  });

  // Add afterAll to clean up connections
  afterAll(async () => {
    // Close worker and queue
    await worker.close();
    await documentQueue.close();

    // Close Redis connection
    await connection.quit();

    // Close Express server
    await new Promise((resolve) => {
      if (server) {
        server.close(resolve);
      } else {
        resolve();
      }
    });

    // Add a small delay to ensure all connections are closed
    await new Promise(resolve => setTimeout(resolve, 100));
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

      // Wait for the queue to process the upload
      await waitForQueueToBeIdle(documentQueue);
    });

    it('should extract text when requested', async () => {
      const response = await request(app)
        .post('/upload?extractText=true')
        .attach('pdf', path.join(__dirname, 'fixtures/test.pdf'));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('text_content');
      expect(response.body.text_content).toBeTruthy();

      // Wait for the queue to process the upload
      await waitForQueueToBeIdle(documentQueue);
    });
  });

  describe('List Endpoint', () => {
    it('should list uploaded PDFs', async () => {
      // First upload a PDF
      await request(app)
        .post('/upload')
        .attach('pdf', path.join(__dirname, 'fixtures/test.pdf'));

      // Wait for the queue to process the upload
      await waitForQueueToBeIdle(documentQueue);

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

      // Wait for the queue to process the upload
      await waitForQueueToBeIdle(documentQueue);

      const response = await request(app).get(`/text/${uploadResponse.body.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('text_content');
      expect(response.body.text_content).toBeTruthy();
    });
  });
});