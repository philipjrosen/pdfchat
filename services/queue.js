import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config/config.js';

// Redis connection
export const connection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null
});

// Create document processing queue
export const documentQueue = new Queue('document-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});

// Clean up connection when server shuts down
process.on('SIGINT', async () => {
  await documentQueue.close();
  await connection.quit();
});