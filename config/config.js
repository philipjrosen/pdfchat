import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: 3000,
    upload: {
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['application/pdf']
    },
    database: {
      filename: process.env.DB_NAME || 'pdfs.db'
    },
    redis: {
      host: 'localhost',
      port: 6379
    },
    pdf: {
      standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/'
    },
    services: {
      flask: {
        url: process.env.FLASK_SERVICE_URL || 'http://localhost:8000'
      }
    },
    pinecone: {
      apiKey: process.env.PINECONE_API_KEY,
      indexName: process.env.PINECONE_INDEX_NAME
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY
    }
  };