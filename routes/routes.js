import express from 'express';
import multer from 'multer';
import { config } from '../config/config.js';
import { documentQueue } from '../services/queue.js';
import { PineconeService } from '../services/pinecone-service.js';
import { QuestionService } from '../services/question-service.js';

export default function createRoutes(
  pdfService,
  pdfRepository,
  questionServiceOverride,
  corpusRepository
) {
  const router = express.Router();
  const questionService = questionServiceOverride || new QuestionService();

  // Change single upload configuration name
  const singleUpload = multer({
    fileFilter: (req, file, cb) => {
      if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const error = new Error('Only PDF files are allowed');
        error.code = 'INVALID_FILE_TYPE';
        cb(error);
      }
    },
    limits: {
      fileSize: config.upload.maxFileSize
    }
  }).single('pdf');

  // Add multiple upload configuration
  const multipleUpload = multer({
    fileFilter: (req, file, cb) => {
      if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const error = new Error('Only PDF files are allowed');
        error.code = 'INVALID_FILE_TYPE';
        cb(error);
      }
    },
    limits: {
      fileSize: config.upload.maxFileSize
    }
  }).array('documents');

  // Rename existing upload handler
  const handleSingleFileUpload = (req, res, next) => {
    singleUpload(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds limit' });
        }
        if (err.code === 'INVALID_FILE_TYPE') {
          return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: 'Invalid file upload' });
      }
      next();
    });
  };

  // Add multiple upload handler
  const handleMultipleUpload = (req, res, next) => {
    multipleUpload(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds limit' });
        }
        if (err.code === 'INVALID_FILE_TYPE') {
          return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: 'Invalid file upload' });
      }
      next();
    });
  };

  const handleError = (res, error, message) => {
    console.error(message, error);
    res.status(500).json({ error: error.message });
  };

  // Schema endpoint
  router.get('/schema', async (req, res) => {
    try {
      const schema = await pdfRepository.getSchema();
      res.json(schema);
    } catch (err) {
      handleError(res, err, 'Error retrieving schema:');
    }
  });

  // Reset endpoint
  router.post('/reset', async (req, res) => {
    try {
      await pdfRepository.reset();
      res.json({ message: 'Database reset successfully' });
    } catch (err) {
      handleError(res, err, 'Error resetting database:');
    }
  });

  // Update existing upload route to use new name
  router.post('/upload', handleSingleFileUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
      }

      const result = await pdfService.processUpload(
        req.file,
        req.query.extractText === 'true'
      );

      res.json(result);
    } catch (error) {
      handleError(res, error, 'Upload error:');
    }
  });

  // Get PDF content
  router.get('/pdf/:id', async (req, res) => {
    try {
      const pdf = await pdfRepository.getById(req.params.id);

      if (!pdf) {
        return res.status(404).json({ error: 'PDF not found' });
      }

      if (!pdf.pdf_content) {
        return res.status(404).json({
          error: 'No PDF content available for this document'
        });
      }

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${pdf.filename}"`,
        'Content-Length': Buffer.byteLength(pdf.pdf_content)
      });

      res.send(pdf.pdf_content);
    } catch (error) {
      handleError(res, error, 'Error retrieving PDF:');
    }
  });

  // List all PDFs
  router.get('/pdfs', async (req, res) => {
    try {
      const pdfs = await pdfRepository.list();
      res.json(pdfs);
    } catch (error) {
      handleError(res, error, 'Error retrieving PDFs:');
    }
  });

  // Get text content
  router.get('/text/:id', async (req, res) => {
    try {
      const pdf = await pdfRepository.getTextById(req.params.id);

      if (!pdf) {
        return res.status(404).json({ error: 'Document not found' });
      }

      if (!pdf.text_content) {
        return res.status(404).json({
          error: 'No text content available for this document'
        });
      }

      res.json({ text_content: pdf.text_content });
    } catch (error) {
      handleError(res, error, 'Error retrieving text:');
    }
  });

  // Add these routes
  router.get('/queue/jobs', async (req, res) => {
    try {
      const waiting = await documentQueue.getWaiting();
      const active = await documentQueue.getActive();
      const completed = await documentQueue.getCompleted();
      const failed = await documentQueue.getFailed();

      res.json({
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      });
    } catch (error) {
      handleError(res, error, 'Error retrieving queue jobs:');
    }
  });

  router.post('/queue/clean', async (req, res) => {
    try {
      await documentQueue.clean(0, 'completed');
      await documentQueue.clean(0, 'failed');
      await documentQueue.clean(0, 'wait');
      await documentQueue.clean(0, 'active');
      res.json({ message: 'Queue cleaned' });
    } catch (error) {
      handleError(res, error, 'Error cleaning queue:');
    }
  });

  router.post('/queue/reset', async (req, res) => {
    try {
      await documentQueue.obliterate();
      res.json({ message: 'Queue reset' });
    } catch (error) {
      handleError(res, error, 'Error resetting queue:');
    }
  });

  router.get('/pinecone/stats', async (req, res) => {
    try {
      const pineconeService = new PineconeService();
      const stats = await pineconeService.describeIndex();
      res.json(stats);
    } catch (error) {
      handleError(res, error, 'Error retrieving Pinecone stats:');
    }
  });

  router.delete('/pinecone/delete-all', async (req, res) => {
    try {
      const pineconeService = new PineconeService();
      await pineconeService.deleteAll();
      res.json({ message: 'All vectors deleted successfully' });
    } catch (error) {
      handleError(res, error, 'Error deleting all vectors:');
    }
  });

  router.post('/ask/:documentId', async (req, res) => {
    try {
      const { documentId } = req.params;
      const { question } = req.body;

      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      const answer = await questionService.getAnswer(documentId, question);
      res.json({ answer });
    } catch (error) {
      handleError(res, error, 'Error processing question:');
    }
  });

  // Add new corpus route
  router.post('/corpus', handleMultipleUpload, async (req, res) => {
    try {
      const { title } = req.body;
      if (!title || !req.files?.length) {
        return res.status(400).json({ 
          error: 'Title and at least one document required' 
        });
      }

      // Create new corpus
      const corpus = await corpusRepository.create(title);

      // Process each file
      const documents = [];
      for (const file of req.files) {
        const doc = await corpusRepository.createDocument(
          corpus.id,
          file.originalname,
          file.buffer
        );
        documents.push({
          id: doc.id,
          filename: file.originalname,
          status: 'PENDING'
        });
      }

      res.json({
        id: corpus.id,
        title,
        status: 'PENDING',
        documentCount: documents.length
      });
    } catch (error) {
      handleError(res, error, 'Upload error:');
    }
  });

  // Add this route
  router.get('/corpus', async (req, res) => {
    try {
      const corpora = await corpusRepository.list();
      res.json(corpora);
    } catch (error) {
      handleError(res, error, 'Error retrieving corpora:');
    }
  });

  // Add this route with the other corpus routes
  router.post('/corpus/reset', async (req, res) => {
    try {
      await corpusRepository.reset();
      res.json({ message: 'Corpus database reset successfully' });
    } catch (error) {
      handleError(res, error, 'Error resetting corpus database:');
    }
  });

  router.get('/corpus/schema', async (req, res) => {
    try {
      const schema = await corpusRepository.getSchema();
      res.json(schema);
    } catch (error) {
      handleError(res, error, 'Error retrieving corpus schema:');
    }
  });

  return router;
}