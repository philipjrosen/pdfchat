import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { documentQueue } from '../services/queue.js';

// Configure PDF.js
pdfjsLib.GlobalWorkerOptions.disableWorker = true;
pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = `node_modules/pdfjs-dist/standard_fonts/`;

export class PdfService {
  constructor(pdfRepository) {
    this.pdfRepository = pdfRepository;
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

  async processUpload(file, shouldExtractText) {
    const { originalname, buffer } = file;
    let textContent = null;

    if (shouldExtractText) {
      textContent = await this.extractText(new Uint8Array(buffer));
    }

    const existing = await this.pdfRepository.findByFilename(originalname);
    let result;

    if (existing) {
      result = await this.pdfRepository.update(
        existing.id,
        shouldExtractText ? null : buffer,
        textContent
      );
    } else {
      result = await this.pdfRepository.create(
        originalname,
        shouldExtractText ? null : buffer,
        textContent
      );
    }

    if (textContent) {
      try {
        await documentQueue.add('process-document', {
          documentId: result.id || existing.id,
          filename: originalname
        });
      } catch (queueError) {
        console.error('Error adding job to queue:', queueError);
      }
    }

    return {
      id: result.id || existing.id,
      filename: originalname,
      status: 'PENDING',
      text_content: textContent
    };
  }
}