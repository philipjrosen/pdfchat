import { OpenAIService } from '../services/openai-service.js';
import { jest } from '@jest/globals';
import { config } from '../config/config.js';

describe('OpenAIService', () => {
  let openaiService;
  let mockCreateCompletion;

  beforeEach(() => {
    // Save original API key
    const originalApiKey = config.openai.apiKey;

    // Ensure we have a mock API key for tests
    config.openai.apiKey = 'mock-api-key';

    // Mock OpenAI chat completion
    mockCreateCompletion = jest.fn();

    // Mock the OpenAI client
    openaiService = new OpenAIService();
    openaiService.client = {
      chat: {
        completions: {
          create: mockCreateCompletion
        }
      }
    };

    // Cleanup
    return () => {
      config.openai.apiKey = originalApiKey;
    };
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', () => {
      config.openai.apiKey = undefined;
      expect(() => new OpenAIService()).toThrow('OpenAI API key not found in configuration');
    });
  });

  describe('generateResponse', () => {
    const mockQuestion = 'What is the capital of France?';
    const mockContext = 'Paris is the capital of France.';
    const mockResponse = 'Paris is the capital of France.';

    it('should generate response successfully', async () => {
      mockCreateCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: mockResponse
            }
          }
        ]
      });

      const response = await openaiService.generateResponse(mockQuestion, mockContext);

      expect(response).toBe(mockResponse);
      expect(mockCreateCompletion).toHaveBeenCalledWith({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: expect.stringContaining(mockQuestion)
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
    });

    it('should include context in the prompt', async () => {
      mockCreateCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: mockResponse
            }
          }
        ]
      });

      await openaiService.generateResponse(mockQuestion, mockContext);

      const callArgs = mockCreateCompletion.mock.calls[0][0];
      const prompt = callArgs.messages[0].content;

      expect(prompt).toContain(mockContext);
      expect(prompt).toContain(mockQuestion);
    });

    it('should throw error on API failure', async () => {
      mockCreateCompletion.mockRejectedValue(new Error('API Error'));

      await expect(openaiService.generateResponse(mockQuestion, mockContext))
        .rejects
        .toThrow('Failed to generate response from OpenAI');
    });

    it('should handle empty response from API', async () => {
      mockCreateCompletion.mockResolvedValue({
        choices: []
      });

      await expect(openaiService.generateResponse(mockQuestion, mockContext))
        .rejects
        .toThrow('Failed to generate response from OpenAI');
    });
  });
});