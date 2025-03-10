import { useState } from 'react';
import styled from 'styled-components';

const UploadContainer = styled.div`
  margin-bottom: 2rem;
`;

const UploadButton = styled.button`
  background-color: #4a4a4a;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.disabled ? 0.5 : 1};

  &:hover {
    background-color: ${props => props.disabled ? '#4a4a4a' : '#5a5a5a'};
  }
`;

const TitleInput = styled.input`
  background-color: #2a2a2a;
  color: white;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 0.5rem;
  margin-bottom: 1rem;
  width: 100%;
`;

const FileUploadMultiple = ({ onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files?.length || !title.trim()) return;

    const formData = new FormData();
    formData.append('title', title);
    for (let i = 0; i < files.length; i++) {
      formData.append('documents', files[i]);
    }

    setUploading(true);
    try {
      const response = await fetch('http://localhost:3000/corpus', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      onUploadSuccess(data.id);
      setTitle('');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <UploadContainer>
      <TitleInput
        type="text"
        placeholder="Enter corpus title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={uploading}
      />
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="file-upload-multiple"
        multiple
        disabled={!title.trim()}
      />
      <UploadButton
        as="label"
        htmlFor="file-upload-multiple"
        disabled={!title.trim()}
      >
        {uploading ? 'Uploading...' : 'Upload Multiple PDFs'}
      </UploadButton>
    </UploadContainer>
  );
};

export default FileUploadMultiple;