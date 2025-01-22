import express from 'express';
import multer from 'multer';
import { config } from '../config/config.js';

const router = express.Router();

// Configure multer for PDF uploads
const upload = multer({
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: config.upload.maxFileSize
  }
});

export default function createRoutes(pdfService, pdfRepository) {
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

  // Upload endpoint
  router.post('/upload', upload.single('pdf'), async (req, res) => {
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
      next(error);
    }
  });

  // List all PDFs
  router.get('/pdfs', async (req, res) => {
    try {
      const pdfs = await pdfRepository.list();
      res.json(pdfs);
    } catch (error) {
      next(error);
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
      next(error);
    }
  });

  return router;
}