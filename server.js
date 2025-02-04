import express from 'express';
import { config } from './config/config.js';
import { PdfRepository } from './repositories/pdf-repository.js';
import { PdfService } from './services/pdf-service.js';
import createRoutes from './routes/routes.js';
import './services/queue.js';  // Import for side effects (queue setup)
import { worker } from './services/worker.js';  // Import the worker

export const app = express();

// Initialize repositories and services
const pdfRepository = new PdfRepository();
const pdfService = new PdfService(pdfRepository);

// Middleware
app.use(express.json());

// Routes
app.use('/', createRoutes(pdfService, pdfRepository));

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

