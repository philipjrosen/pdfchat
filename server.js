import express from 'express';
import { config } from './config/config.js';
import { PdfRepository } from './repositories/pdf-repository.js';
import { PdfService } from './services/pdf-service.js';
import createRoutes from './routes/routes.js';
import './services/queue.js';  // Import for side effects (queue setup)
import { worker } from './services/worker.js';  // Import the worker
import cors from 'cors';
import { CorpusRepository } from './repositories/corpus-repository.js';

// Debug log raw environment variables
console.log('Raw Environment Variables:', {
  PINECONE_API_KEY: process.env.PINECONE_API_KEY ? 'Set' : 'Not Set',
  PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME || 'Not Set'
});

export const app = express();

// Initialize repositories and services
const pdfRepository = new PdfRepository();
const pdfService = new PdfService(pdfRepository);
const corpusRepository = new CorpusRepository();

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173', // Your React app's URL
  methods: ['GET', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Routes
const router = createRoutes(
  pdfService,
  pdfRepository,
  null,  // no question service needed
  corpusRepository
);
app.use('/', router);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

// Start server
export let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(config.port, () => {
    console.log(`Server running at http://localhost:${config.port}`);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await worker.close();  // Close worker
    server.close(() => {
      console.log('Server successfully shut down');
      process.exit(0);
    });
  });
}

