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

def get_document_embeddings(text: str, model, chunk_size: int = 256, overlap: int = 20) -> list:
    # Split text into overlapping chunks
    tokens = model.tokenizer.tokenize(text)
    chunks = []

    # Log token count
    logger.info("Total tokens in document: %d", len(tokens))

    for i in range(0, len(tokens), chunk_size - overlap):
        chunk = tokens[i:i + chunk_size]
        chunk_text = model.tokenizer.convert_tokens_to_string(chunk)
        chunks.append({"text": chunk_text, "chunk_index": i // (chunk_size - overlap)})

    # Log chunk information
    logger.info("Document split into %d chunks", len(chunks))

    # Get embeddings for all chunks
    chunk_embeddings = model.encode([chunk["text"] for chunk in chunks])

    # Prepare chunks with their embeddings
    chunk_data = []
    for i, (chunk, embedding) in enumerate(zip(chunks, chunk_embeddings)):
        chunk_data.append({
            "text": chunk["text"],
            "chunk_index": chunk["chunk_index"],
            "embedding": embedding
        })

    return chunk_data

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
    logger.info("Received text: %.100s%s", data['text'], "..." if len(data['text']) > 100 else "")

    if 'text' not in data:
        logger.error("Missing 'text' field")
        return jsonify({"error": "Missing 'text' field"}), 400

    try:
        chunk_data = get_document_embeddings(data['text'], model)
        logger.info("Generated embeddings for %d chunks", len(chunk_data))
        return jsonify({
            "chunks": [{
                "text": chunk["text"],
                "chunk_index": chunk["chunk_index"],
                "embedding": chunk["embedding"].tolist()
            } for chunk in chunk_data]
        })
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/embed-text', methods=['POST'])
def embed_single_text():
    logger.info("Embed single text endpoint called")

    if not request.is_json:
        logger.error("Request is not JSON")
        return jsonify({"error": "Content-Type must be application/json"}), 400

    data = request.get_json()

    if 'text' not in data:
        logger.error("Missing 'text' field")
        return jsonify({"error": "Missing 'text' field"}), 400

    try:
        # Get embedding directly without chunking
        embedding = model.encode(data['text'])

        return jsonify({
            "embedding": embedding.tolist()
        })
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    app.run(port=8000, debug=True) 