import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json['status'] == 'healthy'

def test_embed_text(client):
    response = client.post('/embed', 
                         json={'text': 'This is a test.'})
    assert response.status_code == 200
    assert 'chunks' in response.json
    assert len(response.json['chunks']) > 0
    assert 'embedding' in response.json['chunks'][0]
    assert 'text' in response.json['chunks'][0]
    assert 'chunk_index' in response.json['chunks'][0]
    # Verify embedding dimension for each chunk
    assert len(response.json['chunks'][0]['embedding']) == 384 

def test_embed_text_endpoint(client):
    # Test successful embedding
    response = client.post('/embed-text', 
                         json={'text': 'This is a test question.'})
    assert response.status_code == 200
    assert 'embedding' in response.json
    assert isinstance(response.json['embedding'], list)
    # Verify embedding dimension (should match your model's output dimension)
    assert len(response.json['embedding']) == 384  

def test_embed_text_missing_json(client):
    # Test missing Content-Type header
    response = client.post('/embed-text', 
                         data='not json')
    assert response.status_code == 400
    assert response.json['error'] == 'Content-Type must be application/json'

def test_embed_text_missing_text(client):
    # Test missing text field
    response = client.post('/embed-text', 
                         json={'wrong_field': 'some value'})
    assert response.status_code == 400
    assert response.json['error'] == 'Missing \'text\' field'

def test_embed_text_empty_string(client):
    # Test empty string
    response = client.post('/embed-text', 
                         json={'text': ''})
    assert response.status_code == 200
    assert 'embedding' in response.json
    assert isinstance(response.json['embedding'], list)
    assert len(response.json['embedding']) == 384