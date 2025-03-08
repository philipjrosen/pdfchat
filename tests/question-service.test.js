import { QuestionService } from '../services/question-service.js';
import { jest } from '@jest/globals';
import { config } from '../config/config.js';

// Mock fetch globally
global.fetch = jest.fn();

describe('QuestionService', () => {
  let questionService;
  let mockOpenAIService;
  let mockPineconeService;

  beforeEach(() => {
    // Mock OpenAI service
    mockOpenAIService = {
      generateResponse: jest.fn()
    };

    // Mock Pinecone service
    mockPineconeService = {
      queryEmbeddings: jest.fn()
    };

    // Create service with mocked dependencies
    questionService = new QuestionService();
    questionService.openaiService = mockOpenAIService;
    questionService.pineconeService = mockPineconeService;
  });

  describe('getQuestionEmbedding', () => {
    it('should fetch embedding successfully', async () => {
      const mockEmbedding = new Array(384).fill(0.1);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ embedding: mockEmbedding })
      });

      const result = await questionService.getQuestionEmbedding('test question');

      expect(fetch).toHaveBeenCalledWith(
        `${config.services.flask.url}/embed-text`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'test question' })
        })
      );
      expect(result).toEqual(mockEmbedding);
    });

    it('should throw error when fetch fails', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false
      });

      await expect(questionService.getQuestionEmbedding('test question'))
        .rejects
        .toThrow('Failed to get question embedding');
    });
  });

  describe('getAnswer', () => {
    const mockDocumentId = '123';
    const mockQuestion = 'What is the capital of France?';
    const mockEmbedding = new Array(384).fill(0.1);
    const mockMatches = [
      {
        metadata: { text: 'Paris is the capital of France.' }
      },
      {
        metadata: { text: 'It has been since the 17th century.' }
      }
    ];

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();

      // Setup default successful response for fetch
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: mockEmbedding })
      });

      // Setup default successful response for Pinecone
      mockPineconeService.queryEmbeddings.mockResolvedValue(mockMatches);
    });

    it('should return answer successfully', async () => {
      mockOpenAIService.generateResponse.mockResolvedValue('Paris is the capital of France.');

      const answer = await questionService.getAnswer(mockDocumentId, mockQuestion);

      expect(mockPineconeService.queryEmbeddings).toHaveBeenCalledWith(
        mockEmbedding,
        mockDocumentId,
        false
      );
      expect(mockOpenAIService.generateResponse).toHaveBeenCalledWith(
        mockQuestion,
        expect.stringContaining('Paris is the capital of France.')
      );
      expect(answer).toBe('Paris is the capital of France.');
    });

    it('should handle no matches found', async () => {
      mockPineconeService.queryEmbeddings.mockResolvedValue([]);

      const answer = await questionService.getAnswer(mockDocumentId, mockQuestion);

      expect(answer).toBe('No relevant content found in the document to answer this question.');
      expect(mockOpenAIService.generateResponse).not.toHaveBeenCalled();
    });

    it('should throw error when embedding fails', async () => {
      const expectedError = new Error('Embedding failed');
      global.fetch.mockRejectedValue(expectedError);

      await expect(questionService.getAnswer(mockDocumentId, mockQuestion))
        .rejects
        .toThrow('Embedding failed');
    });

    it('should throw error when Pinecone query fails', async () => {
      // Ensure embedding succeeds first
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ embedding: mockEmbedding })
      });

      const expectedError = new Error('Pinecone error');
      mockPineconeService.queryEmbeddings.mockRejectedValue(expectedError);

      await expect(questionService.getAnswer(mockDocumentId, mockQuestion))
        .rejects
        .toThrow('Pinecone error');
    });

    it('should throw error when OpenAI fails', async () => {
      mockPineconeService.queryEmbeddings.mockResolvedValue(mockMatches);
      const expectedError = new Error('OpenAI error');
      mockOpenAIService.generateResponse.mockRejectedValue(expectedError);

      await expect(questionService.getAnswer(mockDocumentId, mockQuestion))
        .rejects
        .toThrow(expectedError);
    });
  });
});