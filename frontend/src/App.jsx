import { useState } from 'react';
import styled from 'styled-components';
import FileUpload from './components/FileUpload';
import ChatInterface from './components/ChatInterface';

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: #1a1a1a;
  color: #ffffff;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem;
`;

const ContentWrapper = styled.div`
  width: 100%;
  max-width: 800px;
  min-width: 320px;
  background-color: #2a2a2a;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const App = () => {
  const [currentDocumentId, setCurrentDocumentId] = useState(null);

  return (
    <AppContainer>
      <ContentWrapper>
        <FileUpload onUploadSuccess={(id) => setCurrentDocumentId(id)} />
        <ChatInterface documentId={currentDocumentId} />
      </ContentWrapper>
    </AppContainer>
  );
};

export default App;
