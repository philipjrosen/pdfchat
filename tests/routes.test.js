import { jest } from '@jest/globals';
import request from 'supertest';
import { app, server } from '../server.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { documentQueue, connection } from '../services/queue.js';
import { worker } from '../services/worker.js';
import createRoutes from '../routes/routes.js';
import express from 'express';
import { PdfService } from '../services/pdf-service.js';
import { PdfRepository } from '../repositories/pdf-repository.js';

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

// Create a mock getAnswer function
const mockGetAnswer = jest.fn();

// Mock the QuestionService
const mockQuestionService = {
  getAnswer: mockGetAnswer
};

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

  describe('Ask Endpoint', () => {
    let app;

    beforeEach(async () => {
      // Create a fresh Express app for each test
      app = express();
      app.use(express.json());

      // Create mock services
      const mockPdfService = new PdfService(new PdfRepository());
      const mockPdfRepository = new PdfRepository();

      // Create routes with mocked services
      const routes = createRoutes(mockPdfService, mockPdfRepository, mockQuestionService);
      app.use(routes);

      // Clear all mocks
      jest.clearAllMocks();
    });

    it('should return answer for valid question', async () => {
      const documentId = '123';
      const question = 'What is the capital of France?';
      const expectedAnswer = 'Paris is the capital of France.';

      mockGetAnswer.mockResolvedValue(expectedAnswer);

      const response = await request(app)
        .post(`/ask/${documentId}`)
        .send({ question });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ answer: expectedAnswer });
      expect(mockGetAnswer).toHaveBeenCalledWith(documentId, question);
    });

    it('should return 400 if question is missing', async () => {
      const documentId = '123';

      const response = await request(app)
        .post(`/ask/${documentId}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Question is required' });
      expect(mockGetAnswer).not.toHaveBeenCalled();
    });

    it('should return 500 if question service fails', async () => {
      const documentId = '123';
      const question = 'What is the capital of France?';
      const error = new Error('Service error');

      mockGetAnswer.mockRejectedValue(error);

      const response = await request(app)
        .post(`/ask/${documentId}`)
        .send({ question });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: error.message });
    });

    it('should handle non-existent document', async () => {
      const documentId = '999';
      const question = 'What is the capital of France?';

      mockGetAnswer.mockResolvedValue(
        'No relevant content found in the document to answer this question.'
      );

      const response = await request(app)
        .post(`/ask/${documentId}`)
        .send({ question });

      expect(response.status).toBe(200);
      expect(response.body.answer).toBe(
        'No relevant content found in the document to answer this question.'
      );
    });
  });
});

describe('Corpus Routes', () => {
  let app;
  let mockCorpusRepository;

  beforeEach(() => {
    mockCorpusRepository = {
      create: jest.fn(),
      createDocument: jest.fn(),
      list: jest.fn(),
      reset: jest.fn(),
      getSchema: jest.fn()
    };

    const router = createRoutes(
      null,  // pdf service not needed for these tests
      null,  // pdf repository not needed for these tests
      null,  // question service not needed for these tests
      mockCorpusRepository
    );

    app = express();
    app.use(router);
  });

  describe('POST /corpus', () => {
    it('should create a new corpus with documents', async () => {
      mockCorpusRepository.create.mockResolvedValue({
        id: 1,
        title: 'Test Corpus',
        status: 'PENDING'
      });

      mockCorpusRepository.createDocument.mockResolvedValue({
        id: 1,
        filename: 'test.pdf',
        status: 'PENDING'
      });

      const response = await request(app)
        .post('/corpus')
        .field('title', 'Test Corpus')
        .attach('documents', Buffer.from('fake pdf content'), 'test.pdf');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 1,
        title: 'Test Corpus',
        status: 'PENDING',
        documentCount: 1
      });
    });

    it('should require a title', async () => {
      const response = await request(app)
        .post('/corpus')
        .attach('documents', Buffer.from('fake pdf content'), 'test.pdf');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title and at least one document required');
    });

    it('should require at least one document', async () => {
      const response = await request(app)
        .post('/corpus')
        .field('title', 'Test Corpus');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title and at least one document required');
    });
  });

  describe('GET /corpus', () => {
    it('should list all corpora', async () => {
      mockCorpusRepository.list.mockResolvedValue([
        { id: 1, title: 'Test Corpus 1', status: 'PENDING' },
        { id: 2, title: 'Test Corpus 2', status: 'PENDING' }
      ]);

      const response = await request(app).get('/corpus');
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body.map(c => c.title)).toEqual(['Test Corpus 1', 'Test Corpus 2']);
    });
  });

  describe('POST /corpus/reset', () => {
    it('should reset all corpus data', async () => {
      const response = await request(app).post('/corpus/reset');
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Corpus database reset successfully');
    });
  });

  describe('GET /corpus/schema', () => {
    it('should return corpus and documents schema', async () => {
      mockCorpusRepository.getSchema.mockResolvedValue({
        corpus: [{ name: 'title', type: 'TEXT' }],
        documents: [{ name: 'corpus_id', type: 'INTEGER' }]
      });

      const response = await request(app).get('/corpus/schema');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('corpus');
      expect(response.body).toHaveProperty('documents');
    });
  });
});