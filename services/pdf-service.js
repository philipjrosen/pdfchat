import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { documentQueue } from '../services/queue.js';

// Disable worker for Node environment
pdfjsLib.GlobalWorkerOptions.disableWorker = true;

// Configure font data path
pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = `node_modules/pdfjs-dist/standard_fonts/`;

export class PdfService {
  constructor(repository) {
    this.repository = repository;
  }

  async extractText(buffer) {
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

  async processUpload(file, shouldExtractText = true, corpusId = null) {
    const { originalname, buffer } = file;
    let textContent = null;

    if (shouldExtractText) {
      textContent = await this.extractText(new Uint8Array(buffer));
    }

    let result;

    if (corpusId) {
      // Handle corpus document creation
      result = await this.repository.createDocument(
        corpusId,
        originalname,
        textContent
      );

      return {
        id: result.id,
        filename: originalname,
        status: 'PENDING',
        text_content: textContent
      };
    } else {
      // Handle PDF document creation/update (existing logic)
      const existing = await this.repository.findByFilename(originalname);

      if (existing) {
        result = await this.repository.update(
          existing.id,
          shouldExtractText ? null : buffer,
          textContent
        );
      } else {
        result = await this.repository.create(
          originalname,
          shouldExtractText ? null : buffer,
          textContent
        );
      }

      if (textContent) {
        try {
          await documentQueue.add('process-document', {
            documentId: result.id || existing.id,
            filename: originalname,
            text: textContent
          });
        } catch (queueError) {
          console.error('Error adding job to queue:', queueError);
        }
      }

      return {
        id: result.id || existing.id,
        filename: originalname,
        status: 'PENDING',
        text_content: textContent || (existing ? existing.text_content : null)
      };
    }
  }
}