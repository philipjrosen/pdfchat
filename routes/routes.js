import express from 'express';
import multer from 'multer';
import { config } from '../config/config.js';
import { documentQueue } from '../services/queue.js';
import { PineconeService } from '../services/pinecone-service.js';

export default function createRoutes(pdfService, pdfRepository) {
  const router = express.Router();

  // Configure multer for PDF uploads with error handling
  const upload = multer({
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

  // Wrap upload middleware to handle errors
  const handleUpload = (req, res, next) => {
    upload(req, res, (err) => {
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

  // Schema endpoint
  router.get('/schema', async (req, res) => {
    try {
      const schema = await pdfRepository.getSchema();
      res.json(schema);
    } catch (err) {
      console.error('Error retrieving schema:', err);
      res.status(500).json({ error: 'Failed to retrieve schema' });
    }
  });

  // Reset endpoint
  router.post('/reset', async (req, res) => {
    try {
      await pdfRepository.reset();
      res.json({ message: 'Database reset successfully' });
    } catch (err) {
      console.error('Error resetting database:', err);
      res.status(500).json({ error: 'Failed to reset database' });
    }
  });

  // Upload endpoint with proper error handling
  router.post('/upload', handleUpload, async (req, res) => {
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
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message });
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
      console.error('Error retrieving PDF:', error);
      res.status(500).json({ error: 'Failed to retrieve PDF' });
    }
  });

  // List all PDFs
  router.get('/pdfs', async (req, res) => {
    try {
      const pdfs = await pdfRepository.list();
      res.json(pdfs);
    } catch (error) {
      console.error('Error retrieving PDFs:', error);
      res.status(500).json({ error: 'Failed to retrieve PDF list' });
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
      console.error('Error retrieving text:', error);
      res.status(500).json({ error: 'Failed to retrieve text content' });
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
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/queue/reset', async (req, res) => {
    try {
      await documentQueue.obliterate();
      res.json({ message: 'Queue reset' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/pinecone/stats', async (req, res) => {
    try {
      const pineconeService = new PineconeService();
      const stats = await pineconeService.describeIndex();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/pinecone/delete-all', async (req, res) => {
    try {
      const pineconeService = new PineconeService();
      await pineconeService.deleteAll();
      res.json({ message: 'All vectors deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}