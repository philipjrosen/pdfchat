import { useState } from 'react';
import styled from 'styled-components';

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(100vh - 200px);
`;

const ChatHistory = styled.div`
  flex-grow: 1;
  background-color: #2a2a2a;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
  overflow-y: auto;
`;

const MessageInput = styled.textarea`
  background-color: #2a2a2a;
  color: white;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 0.5rem;
  height: 100px;
  resize: none;
  margin-bottom: 1rem;
`;

const SendButton = styled.button`
  background-color: #4a4a4a;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  
  &:hover {
    background-color: #5a5a5a;
  }
`;

const Message = styled.div`
  margin-bottom: 1rem;
  
  .question {
    color: #a0a0a0;
  }
  
  .answer {
    color: white;
  }
`;

const ChatInterface = ({ documentId }) => {
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!documentId || !currentQuestion.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3000/ask/${documentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: currentQuestion }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get answer: ${response.statusText}`);
      }

      const data = await response.json();
      setMessages([...messages, {
        question: currentQuestion,
        answer: data.answer
      }]);
      setCurrentQuestion('');
    } catch (error) {
      console.error('Failed to get answer:', error);
      alert('Failed to get answer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ChatContainer>
      <ChatHistory>
        {messages.map((message, index) => (
          <Message key={index}>
            <div className="question">Q: {message.question}</div>
            <div className="answer">A: {message.answer}</div>
          </Message>
        ))}
      </ChatHistory>
      <MessageInput
        value={currentQuestion}
        onChange={(e) => setCurrentQuestion(e.target.value)}
        placeholder="Ask a question about the PDF..."
        disabled={!documentId || loading}
      />
      <SendButton
        onClick={handleSubmit}
        disabled={!documentId || loading || !currentQuestion.trim()}
      >
        {loading ? 'Sending...' : 'Send'}
      </SendButton>
    </ChatContainer>
  );
};

export default ChatInterface; 