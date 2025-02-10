import { PineconeService } from '../services/pinecone-service.js';
import { jest } from '@jest/globals';

describe('PineconeService', () => {
  let pineconeService;
  let mockIndex;

  beforeEach(() => {
    // Mock the Pinecone index query method
    mockIndex = {
      query: jest.fn(),
      upsert: jest.fn(),
      deleteAll: jest.fn(),
      describeStats: jest.fn()
    };

    // Mock the Pinecone constructor
    const mockPinecone = function() {
      return {
        index: () => mockIndex
      };
    };

    // Setup the service with mocked dependencies
    pineconeService = new PineconeService();
    pineconeService.index = mockIndex;
  });

  describe('queryEmbeddings', () => {
    const mockEmbedding = new Array(384).fill(0.1);
    const documentId = '123';

    it('should successfully query embeddings', async () => {
      const mockMatches = [
        {
          id: '123_0',
          score: 0.9,
          metadata: {
            text: 'Sample text 1',
            document_id: '123'
          }
        },
        {
          id: '123_1',
          score: 0.8,
          metadata: {
            text: 'Sample text 2',
            document_id: '123'
          }
        }
      ];

      mockIndex.query.mockResolvedValue({ matches: mockMatches });

      const result = await pineconeService.queryEmbeddings(mockEmbedding, documentId);

      expect(mockIndex.query).toHaveBeenCalledWith({
        vector: mockEmbedding,
        filter: { document_id: documentId },
        topK: 3,
        includeMetadata: true
      });

      expect(result).toEqual(mockMatches);
      expect(result.length).toBe(2);
      expect(result[0].metadata.text).toBe('Sample text 1');
    });

    it('should handle empty results', async () => {
      mockIndex.query.mockResolvedValue({ matches: [] });

      const result = await pineconeService.queryEmbeddings(mockEmbedding, documentId);

      expect(result).toEqual([]);
    });

    it('should throw error on Pinecone query failure', async () => {
      mockIndex.query.mockRejectedValue(new Error('Pinecone query failed'));

      await expect(pineconeService.queryEmbeddings(mockEmbedding, documentId))
        .rejects
        .toThrow('Failed to query vectors from Pinecone');
    });

    it('should use correct topK parameter when provided', async () => {
      mockIndex.query.mockResolvedValue({ matches: [] });
      const customTopK = 5;

      await pineconeService.queryEmbeddings(mockEmbedding, documentId, customTopK);

      expect(mockIndex.query).toHaveBeenCalledWith({
        vector: mockEmbedding,
        filter: { document_id: documentId },
        topK: customTopK,
        includeMetadata: true
      });
    });
  });
});