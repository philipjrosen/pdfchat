from flask import Flask, request, jsonify
import logging
from sentence_transformers import SentenceTransformer
import numpy as np

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

logger.info("Loading model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
logger.info("Model loaded successfully")

def get_document_embedding(text: str, model, chunk_size: int = 256, overlap: int = 20) -> np.ndarray:
    # Split text into overlapping chunks
    tokens = model.tokenizer.tokenize(text)
    chunks = []

    # Log token count
    logger.info("Total tokens in document: %d", len(tokens))

    for i in range(0, len(tokens), chunk_size - overlap):
        chunk = tokens[i:i + chunk_size]
        chunk_text = model.tokenizer.convert_tokens_to_string(chunk)
        chunks.append(chunk_text)

    # Log chunk information
    logger.info("Document split into %d chunks", len(chunks))

    # Get embeddings for all chunks
    chunk_embeddings = model.encode(chunks)

    # Log embeddings information
    logger.info("Chunk embeddings shape: %s", chunk_embeddings.shape)

    # Average the embeddings
    document_embedding = np.mean(chunk_embeddings, axis=0)

    # Log final embedding
    logger.info("Final embedding shape: %s", document_embedding.shape)
    logger.info("Embedding values summary - Mean: %.4f, Min: %.4f, Max: %.4f",
               document_embedding.mean(), document_embedding.min(), document_embedding.max())

    # For detailed inspection (be careful with large embeddings)
    # logger.debug(f"Full embedding: {document_embedding.tolist()}")

    return document_embedding

@app.route('/health', methods=['GET'])
def health_check():
    logger.info("Health check endpoint called")
    return jsonify({"status": "healthy"})

@app.route('/embed', methods=['POST'])
def embed_text():
    logger.info("Embed endpoint called")

    if not request.is_json:
        logger.error("Request is not JSON")
        return jsonify({"error": "Content-Type must be application/json"}), 400

    data = request.get_json()
    logger.info("Received data: %s", data)

    if 'text' not in data:
        logger.error("Missing 'text' field")
        return jsonify({"error": "Missing 'text' field"}), 400

    try:
        embeddings = get_document_embedding(data['text'], model)
        logger.info("Generated embeddings of shape: %s", embeddings.shape)
        return jsonify({
            "embeddings": embeddings.tolist()
        })
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    app.run(port=8000, debug=True) 