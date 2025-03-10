import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import FileUploadMultiple from './components/FileUploadMultiple';
import FileUpload from './components/FileUpload';
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

const NavButton = styled(Link)`
  background-color: #4a4a4a;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  margin-bottom: 1rem;

  &:hover {
    background-color: #5a5a5a;
  }
`;

const MainContent = () => {
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const location = useLocation();
  const isUploadSingleView = location.pathname === '/upload-single-document';

  return (
    <AppContainer>
      <MainContentWrapper>
        <ChatWrapper>
          <NavButton to={isUploadSingleView ? '/' : '/upload-single-document'}>
            Switch to {isUploadSingleView ? 'Multiple' : 'Single'} Upload
          </NavButton>

          <Routes>
            <Route
              path="/upload-single-document"
              element={<FileUpload onUploadSuccess={(id) => setCurrentDocumentId(id)} />}
            />
            <Route
              path="/"
              element={<FileUploadMultiple onUploadSuccess={(id) => setCurrentDocumentId(id)} />}
            />
          </Routes>

          <ChatInterface documentId={currentDocumentId} />
        </ChatWrapper>
        {isUploadSingleView && (
          <SidebarWrapper>
            <DocumentList onDocumentSelect={(id) => setCurrentDocumentId(id)} />
          </SidebarWrapper>
        )}
      </MainContentWrapper>
    </AppContainer>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <MainContent />
    </BrowserRouter>
  );
};

export default App;
