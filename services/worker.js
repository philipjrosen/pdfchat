import { Worker } from 'bullmq';
import { connection } from './queue.js';
import { PdfRepository } from '../repositories/pdf-repository.js';

const FLASK_SERVICE_URL = 'http://localhost:8000';
const pdfRepository = new PdfRepository();

// Test-aware loggers that maintain console.log vs console.error
const log = {
  info: (...args) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(...args);
    }
  },
  error: (...args) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(...args);
    }
  }
};

async function generateEmbeddings(text) {
  try {
    const response = await fetch(`${FLASK_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.embeddings;
  } catch (error) {
    log.error('Error generating embeddings:', error.message);
    throw new Error('Failed to generate embeddings');
  }
}

export const worker = new Worker('document-processing', async (job) => {
  const { documentId, filename, text } = job.data;
  log.info(`Processing document ${documentId} (${filename})`);

  try {
    if (!text) {
      throw new Error('No text content provided in job data');
    }

    // Generate embeddings
    const embeddings = await generateEmbeddings(text);
    log.info(`Generated embeddings for document ${documentId}`);

    // Update status to COMPLETED
    await pdfRepository.updateStatus(documentId, 'COMPLETED');

    return { success: true, documentId, embeddings };
  } catch (error) {
    // Update status to FAILED on error
    await pdfRepository.updateStatus(documentId, 'FAILED');
    log.error(`Error processing document ${documentId}:`, error);
    throw error;
  }
}, {
  connection,
  concurrency: 1
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.close();
});
