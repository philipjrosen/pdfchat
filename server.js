import express from 'express';
import multer from 'multer';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { documentQueue } from './queue.js';
import { config } from './config/config.js';
import { db } from './database/db.js';
import { PdfRepository } from './repositories/pdf-repository.js';
const pdfRepository = new PdfRepository();

// Disable worker for Node environment
pdfjsLib.GlobalWorkerOptions.disableWorker = true;

// Configure font data path
pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = config.pdf.standardFontDataUrl;


export const app = express();
const port = config.port;


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
    fileSize: config.upload.maxFileSize // 5MB limit
  }
});

async function extractPdfText(buffer) {
  try {
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    let fullText = '';

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText.trim();
  } catch (error) {
    throw new Error('Failed to extract text from PDF: ' + error.message);
  }
}

// Middleware for parsing JSON
app.use(express.json());

// POST endpoint to reset database
app.post('/reset', async (req, res) => {
  try {
		await pdfRepository.reset();
    res.json({ message: 'Database reset successfully' });
  } catch (err) {
    console.error('Error resetting database:', err);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

// POST endpoint for uploading PDFs
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { originalname, buffer } = req.file;
    const shouldExtractText = req.query.extractText === 'true';
    let text_content = null;

    if (shouldExtractText) {
      try {
        text_content = await extractPdfText(new Uint8Array(buffer));
      } catch (parseError) {
        console.error('Error parsing PDF:', parseError);
        return res.status(400).json({ error: 'Failed to parse PDF text content' });
      }
    }

    // Get existing file if it exists
    const existing = await pdfRepository.findByFilename(originalname);

    let result;
    if (existing) {
      // Update existing record
			result = await pdfRepository.update(
        existing.id,
        shouldExtractText ? null : buffer,
        text_content
      );

      // Add to queue if text was extracted
      if (text_content) {
        try {
          await documentQueue.add('process-document', {
            documentId: existing.id,
            filename: originalname
          });
        } catch (queueError) {
          console.error('Error adding job to queue:', queueError);
        }
      }

      res.json({
        message: 'Document updated successfully',
        id: existing.id,
        filename: originalname,
        status: 'PENDING',
        text_content: text_content || existing.text_content
      });
    } else {
      // Insert new record
      result = await pdfRepository.create(
        originalname,
        shouldExtractText ? null : buffer,
        text_content
      );

      // Add to queue if text was extracted
      if (text_content) {
        try {
          await documentQueue.add('process-document', {
            documentId: result.id,
            filename: originalname
          });
        } catch (queueError) {
          console.error('Error adding job to queue:', queueError);
        }
      }

      res.json({
        message: 'Document uploaded successfully',
        id: result.id,
        filename: originalname,
        status: 'PENDING',
        text_content: text_content
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint to fetch database schema
app.get('/schema', async (req, res) => {
  try {
    const schema = await pdfRepository.getSchema();
    res.json(schema);
  } catch (err) {
    console.error('Error retrieving schema:', err);
    res.status(500).json({ error: 'Failed to retrieve schema' });
  }
});

// GET endpoint to list all PDFs
app.get('/pdfs', async (req, res) => {
  try {
		const pdfs = await pdfRepository.list();
    res.json(pdfs);
  } catch (err) {
    console.error('Error retrieving PDFs:', err);
    res.status(500).json({ error: 'Failed to retrieve PDF list' });
  }
});

// Get PDF content by ID
app.get('/pdf/:id', async (req, res) => {
  try {
    const { id } = req.params;
		const pdf = await pdfRepository.getById(req.params.id);

    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    if (!pdf.pdf_content) {
      return res.status(404).json({
        error: 'No PDF content available for this document. It may only have text content.'
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

// Get text content by ID
app.get('/text/:id', async (req, res) => {
  try {
    const { id } = req.params;
		const pdf = await pdfRepository.getTextById(req.params.id);

    if (!pdf) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!pdf.text_content) {
      return res.status(404).json({
        error: 'No text content available for this document. It may only have PDF content.'
      });
    }

    res.json({ text_content: pdf.text_content });
  } catch (error) {
    console.error('Error retrieving text:', error);
    res.status(500).json({ error: 'Failed to retrieve text content' });
  }
});
// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }
    return res.status(400).json({ error: err.message });
  }

  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
export let server
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

// Clean up database connection on server shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});