import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Redis connection
const connection = new Redis({
  host: 'localhost',
  port: 6379
});

// Create document processing queue
export const documentQueue = new Queue('document-processing', {
  connection
});

// Clean up connection when server shuts down
process.on('SIGINT', async () => {
  await documentQueue.close();
  await connection.quit();
});