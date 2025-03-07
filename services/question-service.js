import { OpenAIService } from './openai-service.js';
import { PineconeService } from './pinecone-service.js';
import { config } from '../config/config.js';

export class QuestionService {
  constructor() {
    this.openaiService = new OpenAIService();
    this.pineconeService = new PineconeService();
  }

  async getAnswer(documentOrCorpusId, question, isCorpus = false) {
    try {
      // Get embeddings for the question
      const embedding = await this.getQuestionEmbedding(question);

      // Query Pinecone
      const matches = await this.pineconeService.queryEmbeddings(embedding, documentOrCorpusId, isCorpus);
      console.log(`QuestionService: Found ${matches.length} matches`);
      if (!matches || !matches.length) {
        return "No relevant content found in the document to answer this question.";
      }

      // Extract and combine relevant text
      const context = matches.map(match => match.metadata.text).join('\n\n');

      // Generate answer using OpenAI
      return await this.openaiService.generateResponse(question, context);
    } catch (error) {
      console.error('Error in getAnswer:', error);
      throw error;
    }
  }

  async getQuestionEmbedding(question) {
    try {
      const response = await fetch(`${config.services.flask.url}/embed-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: question })
      });

      if (!response.ok) {
        throw new Error('Failed to get question embedding');
      }

      const data = await response.json();
      if (!data.embedding) {
        throw new Error('No embedding returned from service');
      }

      return data.embedding;
    } catch (error) {
      throw error; // Propagate the error up
    }
  }
}