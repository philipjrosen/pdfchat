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
    assert 'embeddings' in response.json
    assert len(response.json['embeddings']) == 384  # Verify dimension 