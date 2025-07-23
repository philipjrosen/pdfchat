# PDFChat

A web application that allows you to upload PDF documents and chat with them using AI. The system processes PDFs, creates embeddings, and uses retrieval-augmented generation (RAG) to answer questions about the document content.

## Features

- **PDF Upload**: Upload single or multiple PDF documents
- **Document Processing**: Automatic text extraction and chunking
- **Vector Storage**: Document embeddings stored in Pinecone for semantic search
- **AI Chat**: Chat with your documents using OpenAI's language models
- **Document Management**: View and manage uploaded documents
- **Real-time Processing**: Background processing with Redis queue system

## Architecture

The application consists of several components:

- **Frontend**: React application built with Vite
- **Backend**: Node.js Express server with SQLite database
- **Python Service**: Flask service for generating document embeddings using SentenceTransformers
- **Vector Database**: Pinecone for storing and searching document embeddings
- **Queue System**: Redis with BullMQ for background processing
- **AI Integration**: OpenAI API for chat completions

## Technology Stack

### Backend
- Node.js with Express
- SQLite for document metadata
- Redis for queue management
- BullMQ for background job processing
- Pinecone for vector storage
- OpenAI API for chat

### Frontend
- React 19
- Vite for development and building
- Styled Components for styling
- React Router for navigation

### Python Service
- Flask web framework
- SentenceTransformers for embeddings
- NumPy for numerical operations

## Prerequisites

- Node.js (v16 or higher)
- Python 3.8+
- Redis server
- Pinecone account and API key
- OpenAI API key

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pdfchat
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Install Python dependencies**
   ```bash
   cd python_service
   pip install -r requirements.txt
   cd ..
   ```

5. **Set up environment variables**
   Create a `.env` file in the root directory with:
   ```env
   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_INDEX_NAME=your_pinecone_index_name
   OPENAI_API_KEY=your_openai_api_key
   FLASK_SERVICE_URL=http://localhost:8000
   DB_NAME=pdfs.db
   ```

6. **Start Redis server**
   ```bash
   redis-server
   ```

## Running the Application

The application requires three services to be running:

1. **Start the Python embedding service**
   ```bash
   cd python_service
   python app.py
   ```

2. **Start the Node.js backend**
   ```bash
   npm start
   ```

3. **Start the React frontend** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Python service: http://localhost:8000

## Usage

1. **Upload Documents**: Use the upload interface to add PDF documents to your corpus
2. **Process Documents**: Documents are automatically processed and indexed in the background
3. **Chat**: Once processed, you can ask questions about your documents in the chat interface
4. **Manage Documents**: View and manage your uploaded documents in the document list

## API Endpoints

### Document Management
- `POST /upload-single-document` - Upload a single PDF document
- `POST /upload-multiple-documents` - Upload multiple PDF documents
- `GET /documents` - Get list of uploaded documents
- `DELETE /documents/:id` - Delete a document

### Chat
- `POST /ask-question` - Ask a question about the documents

### Corpus Management
- `GET /corpus` - Get corpus information
- `POST /corpus` - Create a new corpus

## Testing

Run the test suite:
```bash
npm test
```

For watch mode:
```bash
npm run test:watch
```

## Project Structure

```
pdfchat/
├── config/           # Configuration files
├── database/         # Database setup and migrations
├── frontend/         # React frontend application
├── python_service/   # Flask service for embeddings
├── repositories/     # Data access layer
├── routes/          # Express route handlers
├── services/        # Business logic services
├── tests/           # Test files and fixtures
├── server.js        # Main server entry point
└── package.json     # Node.js dependencies and scripts
```

## Development

### Adding New Features
1. Backend logic goes in the `services/` directory
2. Database queries in `repositories/`
3. API routes in `routes/`
4. Frontend components in `frontend/src/components/`

### Running Tests
The project includes comprehensive tests for all major components. Tests are located in the `tests/` directory and can be run with `npm test`.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

ISC License

## Author

Philip Rosen