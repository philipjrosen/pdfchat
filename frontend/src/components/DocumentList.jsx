import { useState, useEffect } from 'react';
import styled from 'styled-components';

const ListContainer = styled.div`
  margin-bottom: 2rem;
`;

const DocumentListWrapper = styled.div`
  background-color: #2a2a2a;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
`;

const DocumentItem = styled.div`
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  background-color: ${props => props.active ? '#4a4a4a' : '#3a3a3a'};
  border-radius: 4px;
  
  &:hover {
    background-color: #4a4a4a;
  }
`;

const ActiveDocument = styled.div`
  color: #a0a0a0;
  font-size: 0.9rem;
  margin-bottom: 1rem;
`;

const DocumentList = ({ onDocumentSelect }) => {
  const [documents, setDocuments] = useState([]);
  const [activeDocument, setActiveDocument] = useState(null);

  // Fetch documents on component mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch('http://localhost:3000/pdfs');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      // Filter for completed documents only
      setDocuments(data.filter(doc => doc.status === 'COMPLETED'));
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleDocumentClick = (document) => {
    setActiveDocument(document);
    onDocumentSelect(document.id);
  };

  return (
    <ListContainer>
      {activeDocument && (
        <ActiveDocument>
          Current document: {activeDocument.filename}
        </ActiveDocument>
      )}
      <DocumentListWrapper>
        {documents.map((doc) => (
          <DocumentItem
            key={doc.id}
            active={activeDocument?.id === doc.id}
            onClick={() => handleDocumentClick(doc)}
          >
            {doc.filename}
          </DocumentItem>
        ))}
      </DocumentListWrapper>
    </ListContainer>
  );
};

export default DocumentList; 