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