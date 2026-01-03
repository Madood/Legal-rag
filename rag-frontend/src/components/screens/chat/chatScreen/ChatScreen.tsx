// src/components/ChatScreen/ChatScreen.tsx
import { useState, useEffect, useRef } from 'react';
import { DocumentSidebar } from '../DocumentSidebar/DocumentSidebar';
import { MessageCard } from '../MessageCard/MessageCard';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Textarea } from '../../../ui/textarea';
import { useChat } from '../../../../hooks/useChat';
import { useDocuments } from '../../../../hooks/useDocuments';
import { Citation } from '../../../../services/api';
import './ChatScreen.css';

// Local Message interface that matches what MessageCard expects
interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

export function ChatScreen() {
  const [input, setInput] = useState('');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { 
    messages: chatMessages,
    askQuestion, 
    isLoading, 
    isStreaming, 
    error, 
    cancelStream,
    conversationId,
    startNewConversation,
    clearConversation
  } = useChat({
    autoScroll: true,
    onError: (errorMsg) => {
      console.error('Chat error:', errorMsg);
      setErrorMessage(errorMsg);
    },
  });

  const { documents, isLoading: docsLoading } = useDocuments();

  // Convert chatMessages to MessageCard format
  const formattedMessages: Message[] = chatMessages.map(msg => ({
    id: msg.id,
    type: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
    citations: msg.citations,
    timestamp: msg.timestamp,
  }));

  const handleSend = async () => {
    if (!input.trim() || isLoading || isStreaming) return;

    // Clear any previous errors
    setErrorMessage(null);

    try {
      // Ask question with streaming
      await askQuestion(input, true);
      setInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [formattedMessages]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Handle new conversation
  const handleNewConversation = () => {
    clearConversation();
    startNewConversation();
  };

  return (
    <div className="chat-screen">
      {/* Sidebar - 30% */}
      <div className="chat-sidebar">
        <DocumentSidebar 
          onCitationClick={setSelectedCitation} 
          documents={documents}
          isLoading={docsLoading}
        />
      </div>

      {/* Main Chat Area - 70% */}
      <div className="chat-main-area">
        {/* Header with conversation info */}
        <div className="chat-header">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">German Legal RAG</h2>
            {conversationId && (
              <span className="text-xs text-gray-500">
                ID: {conversationId.substring(0, 8)}...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewConversation}
              disabled={isStreaming}
            >
              New Chat
            </Button>
            {documents.length > 0 && (
              <span className="text-xs text-gray-500">
                {documents.length} docs loaded
              </span>
            )}
          </div>
        </div>

        {/* Error Display */}
        {(errorMessage || error) && (
          <div className="error-banner">
            <AlertCircle className="h-4 w-4" />
            <p>{errorMessage || (error as Error)?.message || 'An error occurred'}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setErrorMessage(null);
              }}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Messages */}
        <div className="messages-container">
          {formattedMessages.length === 0 ? (
            <div className="empty-chat-state">
              <div className="empty-chat-content">
                <div className="empty-chat-logo">
                  <span className="logo-text">LR</span>
                </div>
                <h3 className="empty-chat-title">Willkommen bei LegalRAG</h3>
                <p className="empty-chat-subtitle">
                  Stellen Sie Ihre rechtliche Frage und erhalten Sie präzise Antworten mit zitierten Quellen.
                </p>
                <div className="empty-chat-stats">
                  <p>{documents.length} Dokumente geladen</p>
                  <p>{isStreaming ? 'Antwort wird generiert...' : 'Bereit für Ihre Frage'}</p>
                </div>
                {documents.length === 0 && (
                  <div className="empty-chat-warning">
                    <AlertCircle className="h-4 w-4" />
                    <p>Keine Dokumente geladen. Bitte laden Sie Dokumente hoch, um Fragen zu stellen.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {formattedMessages.map((message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  onCitationClick={setSelectedCitation}
                />
              ))}
              
              {/* Loading indicator during streaming */}
              {isStreaming && (
                <div className="streaming-indicator">
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>Antwort wird generiert...</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={cancelStream}
                    disabled={!isStreaming}
                  >
                    Stop
                  </Button>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <div className="input-container">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Stellen Sie Ihre rechtliche Frage..."
              className="chat-textarea"
              disabled={isLoading || isStreaming || documents.length === 0}
              rows={3}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isStreaming || documents.length === 0}
              className="send-button"
              size="icon"
            >
              {isLoading || isStreaming ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="input-hint">
            <p className="text-xs text-gray-500">
              Drücken Sie Enter zum Senden, Shift+Enter für neue Zeile
            </p>
            <p className="text-xs text-gray-500">
              {documents.length > 0 
                ? `${documents.length} Dokumente stehen für die Suche zur Verfügung`
                : 'Keine Dokumente geladen. Bitte laden Sie zuerst Dokumente hoch.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}