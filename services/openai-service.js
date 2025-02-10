import OpenAI from 'openai';
import { config } from '../config/config.js';

export class OpenAIService {
  constructor() {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key not found in configuration');
    }

    this.client = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }

  async generateResponse(question, context) {
    const prompt = `Answer the following question based on the provided context.
    If you cannot answer this question based on the context, say "I cannot answer this based on the available information."

    Context: ${context}

    Question: ${question}`;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate response from OpenAI');
    }
  }
}