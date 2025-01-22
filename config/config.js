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
    }
  };