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

  async upsert(vectors) {
    try {
      console.log(`PineconeService: Upserting ${vectors.length} vectors`);

      await this.index.upsert(vectors);

      console.log(`PineconeService: Successfully upserted ${vectors.length} vectors`);
      return true;
    } catch (error) {
      console.error('Pinecone upsert error:', error);
      throw new Error('Failed to store vectors in Pinecone');
    }
  }

  async describeIndex() {
    try {
      return await this.index.describeIndexStats();
    } catch (error) {
      console.error('Error describing Pinecone index:', error);
      throw error;
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

  async queryEmbeddings(embedding, documentId, topK = 3) {
    try {
      console.log(`PineconeService: Querying for document ${documentId}`);
      const response = await this.index.query({
        vector: embedding,
        filter: { document_id: documentId },
        topK,
        includeMetadata: true
      });
      console.log(`PineconeService: Found ${response.matches.length} matches`);
      return response.matches;
    } catch (error) {
      console.error('Pinecone query error:', error);
      throw new Error('Failed to query vectors from Pinecone');
    }
  }
}