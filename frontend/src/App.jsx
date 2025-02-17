import { useState } from 'react';
import styled from 'styled-components';
import FileUpload from './components/FileUpload';
import ChatInterface from './components/ChatInterface';

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: #1a1a1a;
  color: #ffffff;
  padding: 2rem;
`;

const App = () => {
  const [currentDocumentId, setCurrentDocumentId] = useState(null);

  return (
    <AppContainer>
      <FileUpload onUploadSuccess={(id) => setCurrentDocumentId(id)} />
      <ChatInterface documentId={currentDocumentId} />
    </AppContainer>
  );
};

export default App;
