from flask import Flask, request, jsonify
import logging
from sentence_transformers import SentenceTransformer

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

logger.info("Loading model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
logger.info("Model loaded successfully")

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
    logger.info(f"Received data: {data}")

    if 'text' not in data:
        logger.error("Missing 'text' field")
        return jsonify({"error": "Missing 'text' field"}), 400

    try:
        embeddings = model.encode([data['text']])
        logger.info(f"Generated embeddings of shape: {embeddings.shape}")
        return jsonify({
            "embeddings": embeddings[0].tolist()
        })
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    app.run(port=8000, debug=True) 