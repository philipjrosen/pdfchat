import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../config/config.js';

export class PineconeService {
  constructor() {
    // Debug log config when service is instantiated
    console.log('Initializing PineconeService with config:', {
      apiKey: config.pinecone.apiKey ? 'Set' : 'Not Set',
      indexName: config.pinecone.indexName
    });

    if (!config.pinecone.apiKey) {
      throw new Error('Pinecone API key not found in configuration');
    }

    this.pinecone = new Pinecone({
      apiKey: config.pinecone.apiKey
    });

    this.index = this.pinecone.index(config.pinecone.indexName);
  }

  async upsert(documentId, embeddings) {
    try {
      console.log(`PineconeService: Upserting document ${documentId}`);
      await this.index.upsert([{
        id: documentId,
        values: embeddings,
        metadata: {
          documentId: documentId
        }
      }]);
      console.log(`PineconeService: Successfully upserted document ${documentId}`);
      return true;
    } catch (error) {
      console.error('Pinecone upsert error:', error);
      throw new Error('Failed to store embeddings in Pinecone');
    }
  }

  async describeIndex() {
    try {
      const description = await this.index.describeStats();
      return {
        totalVectorCount: description.totalVectorCount,
        indexFullness: description.indexFullness,
        dimensions: description.dimension
      };
    } catch (error) {
      console.error('Pinecone stats error:', error);
      throw new Error('Failed to get Pinecone stats');
    }
  }

  async deleteAll() {
    try {
      await this.index.deleteAll();
      console.log('PineconeService: Successfully deleted all vectors');
      return true;
    } catch (error) {
      console.error('Pinecone deleteAll error:', error);
      throw new Error('Failed to delete vectors from Pinecone');
    }
  }
}