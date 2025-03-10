import { useState } from 'react';
import styled from 'styled-components';
import FileUploadMultiple from './components/FileUploadMultiple';
import ChatInterface from './components/ChatInterface';
import DocumentList from './components/DocumentList';

const AppContainer = styled.div`
  min-height: 100vh;
  background-color: #1a1a1a;
  color: #ffffff;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem;
`;

const MainContentWrapper = styled.div`
  display: flex;
  gap: 2rem;
  width: 100%;
  max-width: 1200px;
`;

const ChatWrapper = styled.div`
  flex: 1;
  background-color: #2a2a2a;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  min-width: 320px;
`;

const SidebarWrapper = styled.div`
  width: 300px;
  background-color: #2a2a2a;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const App = () => {
  const [currentDocumentId, setCurrentDocumentId] = useState(null);

  return (
    <AppContainer>
      <MainContentWrapper>
        <ChatWrapper>
          <FileUploadMultiple onUploadSuccess={(id) => setCurrentDocumentId(id)} />
          <ChatInterface documentId={currentDocumentId} />
        </ChatWrapper>
        <SidebarWrapper>
          <DocumentList onDocumentSelect={(id) => setCurrentDocumentId(id)} />
        </SidebarWrapper>
      </MainContentWrapper>
    </AppContainer>
  );
};

export default App;
