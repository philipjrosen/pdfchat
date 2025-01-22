import jest from 'jest-mock';
import { PdfService } from '../services/pdf-service.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PdfService', () => {
 let service;
 let mockRepository;
 let testPdfBuffer;

 beforeEach(async () => {
   // Create mock repository
   mockRepository = {
     create: jest.fn(),
     update: jest.fn(),
     findByFilename: jest.fn(),
     getById: jest.fn(),
     getTextById: jest.fn()
   };
   service = new PdfService(mockRepository);

   const buffer = await fs.promises.readFile(
     path.join(__dirname, 'fixtures/test.pdf')
   );
   testPdfBuffer = new Uint8Array(buffer);

   // Suppress PDF.js warnings
   jest.spyOn(console, 'log').mockImplementation((message) => {
     if (!message?.includes?.('Warning: Indexing all PDF objects')) {
       console.log(message);
     }
   });
 });

 describe('extractText', () => {
   it('should extract text from PDF', async () => {
     const text = await service.extractText(testPdfBuffer);
     expect(text).toBeTruthy();
     expect(typeof text).toBe('string');
   });

   it('should handle PDF extraction errors', async () => {
     const invalidBuffer = new Uint8Array(Buffer.from('not a pdf'));

     await expect(service.extractText(invalidBuffer))
       .rejects
       .toThrow('Failed to extract text from PDF');
   });
 });

 describe('processUpload', () => {
   it('should process new upload with text extraction', async () => {
     const mockFile = {
       originalname: 'test.pdf',
       buffer: Buffer.from(testPdfBuffer)
     };

     mockRepository.findByFilename.mockResolvedValue(null);
     mockRepository.create.mockResolvedValue({ id: 1 });

     const result = await service.processUpload(mockFile, true);

     expect(result.id).toBe(1);
     expect(result.text_content).toBeTruthy();
     expect(mockRepository.create).toHaveBeenCalled();
   });

   it('should process new upload without text extraction', async () => {
     const mockFile = {
       originalname: 'test.pdf',
       buffer: Buffer.from(testPdfBuffer)
     };

     mockRepository.findByFilename.mockResolvedValue(null);
     mockRepository.create.mockResolvedValue({ id: 1 });

     const result = await service.processUpload(mockFile, false);

     expect(result.id).toBe(1);
     expect(result.text_content).toBeNull();
     expect(mockRepository.create).toHaveBeenCalledWith(
       'test.pdf',
       Buffer.from(testPdfBuffer),
       null
     );
   });

   it('should update existing file with text extraction', async () => {
     const mockFile = {
       originalname: 'existing.pdf',
       buffer: Buffer.from(testPdfBuffer)
     };

     const existingDoc = {
       id: 1,
       filename: 'existing.pdf',
       text_content: 'old text'
     };

     mockRepository.findByFilename.mockResolvedValue(existingDoc);
     mockRepository.update.mockResolvedValue({ changes: 1 });

     const result = await service.processUpload(mockFile, true);

     expect(result.id).toBe(1);
     expect(result.text_content).toBeTruthy();
     expect(mockRepository.update).toHaveBeenCalled();
     expect(mockRepository.create).not.toHaveBeenCalled();
   });

   it('should update existing file without text extraction', async () => {
     const mockFile = {
       originalname: 'existing.pdf',
       buffer: Buffer.from(testPdfBuffer)
     };

     const existingDoc = {
       id: 1,
       filename: 'existing.pdf',
       text_content: 'old text'
     };

     mockRepository.findByFilename.mockResolvedValue(existingDoc);
     mockRepository.update.mockResolvedValue({ changes: 1 });

     const result = await service.processUpload(mockFile, false);

     expect(result.id).toBe(1);
     expect(result.text_content).toBe('old text');
     expect(mockRepository.update).toHaveBeenCalledWith(
       1,
       Buffer.from(testPdfBuffer),
       null
     );
   });

   it('should handle text extraction errors', async () => {
     const mockFile = {
       originalname: 'test.pdf',
       buffer: Buffer.from('not a pdf')
     };

     await expect(service.processUpload(mockFile, true))
       .rejects
       .toThrow('Failed to extract text from PDF');
   });
 });
});