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
import { useTranslation } from '../../../../i18n';
import { GuestBanner } from '../../../Auth/GuestBanner';
import { LoginModal } from '../../../Auth/LoginModal';
import { useAuth } from '../../../../context/AuthContext';
import './ChatScreen.css';

// Local Message interface that matches what MessageCard expects
interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

type TokenErrorCode = 'TOKEN_EXHAUSTED' | 'SESSION_LIMIT' | 'AUTH_REQUIRED';

export function ChatScreen() {
  const [input, setInput] = useState('');
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tokenModalReason, setTokenModalReason] = useState<TokenErrorCode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { refreshUser } = useAuth();

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
    setErrorMessage(null);

    try {
      await askQuestion(input, true);
      setInput('');
      // Refresh token balance after a successful query
      refreshUser();
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code as TokenErrorCode | undefined;
      if (status === 402 && code) {
        setTokenModalReason(code);
      } else if (status === 401) {
        setTokenModalReason('AUTH_REQUIRED');
      } else {
        setErrorMessage(err.message || 'Failed to send message');
      }
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
    <>
    {tokenModalReason && (
      <LoginModal
        reason={tokenModalReason}
        onClose={() => setTokenModalReason(null)}
      />
    )}
    <div className="chat-screen">
      <GuestBanner />
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
              {t('chat.newChat')}
            </Button>
            {documents.length > 0 && (
              <span className="text-xs text-gray-500">
                {documents.length} {t('chat.docsLoaded')}
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
              {t('chat.dismiss')}
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
                <h3 className="empty-chat-title">{t('chat.welcome')}</h3>
                <p className="empty-chat-subtitle">
                  {t('chat.welcomeSubtitle')}
                </p>
                <div className="empty-chat-stats">
                  <p>{documents.length} {t('chat.docsLoaded')}</p>
                  <p>{isStreaming ? t('chat.streaming') : t('chat.ready')}</p>
                </div>
                {documents.length === 0 && (
                  <div className="empty-chat-warning">
                    <AlertCircle className="h-4 w-4" />
                    <p>{t('chat.noDocumentsWarning')}</p>
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
                  <span>{t('chat.streaming')}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelStream}
                    disabled={!isStreaming}
                  >
                    {t('chat.stop')}
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
              placeholder={t('chat.placeholder')}
              className="chat-textarea"
              disabled={isLoading || isStreaming}
              rows={3}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isStreaming}
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
              {t('chat.enterToSend')}
            </p>
            <p className="text-xs text-gray-500">
              {documents.length > 0
                ? `${documents.length} ${t('chat.docsAvailable')}`
                : t('chat.noDocumentsWarning')}
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}