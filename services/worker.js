import { Worker } from 'bullmq';
import { connection } from './queue.js';
import { PdfRepository } from '../repositories/pdf-repository.js';
import { PineconeService } from './pinecone-service.js';


const FLASK_SERVICE_URL = 'http://localhost:8000';
const pdfRepository = new PdfRepository();
const pineconeService = new PineconeService();

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

    if (!data.chunks || !Array.isArray(data.chunks)) {
      throw new Error('No chunks found in response');
    }

    return data.chunks;
  } catch (error) {
    log.error('Error generating embeddings:', error.message);
    if (error.response) {
      log.error('Response:', await error.response.text());
    }
    throw new Error(`Failed to generate embeddings: ${error.message}`);
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
    const chunks = await generateEmbeddings(text);
    log.info(`Generated ${chunks.length} chunks for document ${documentId}`);

    // Store embeddings in Pinecone
    try {
      const pineconeId = documentId.toString();
      // Create vectors with metadata for each chunk
      const vectors = chunks.map(chunk => ({
        id: `${pineconeId}_${chunk.chunk_index}`,
        values: chunk.embedding,
        metadata: {
          text: chunk.text,
          document_id: pineconeId
        }
      }));

      await pineconeService.upsert(vectors);
      log.info(`Successfully stored ${vectors.length} chunks in Pinecone for document ${pineconeId}`);
    } catch (error) {
      log.error('Pinecone upsert error:', error);
      throw error;
    }

    // Update status to COMPLETED
    await pdfRepository.updateStatus(documentId, 'COMPLETED');

    return { success: true, documentId };
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
