// src/hooks/useChat.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { chatService, ChatResponse, Citation, ChatMessage } from '../services/api';

interface UseChatOptions {
  initialConversationId?: string;
  autoScroll?: boolean;
  onMessageReceived?: (message: ChatMessage) => void;
  onError?: (error: string) => void;
  onStreamStart?: () => void;
  onStreamEnd?: (response: ChatResponse) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const {
    initialConversationId,
    autoScroll = true,
    onMessageReceived,
    onError,
    onStreamStart,
    onStreamEnd,
  } = options;

  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load chat history
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadChatHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await chatService.getChatHistory(50);
      if (response.success && response.data) {
        setChatHistory(response.data.conversations);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Regular question function
  const askQuestionRegular = useCallback(async (question: string): Promise<ChatResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: question,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage]);

      const response = await chatService.askQuestion(question);
      
      if (response.success && response.data) {
        // Add assistant message
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data.answer,
          citations: response.data.sources?.map((source, index) => ({
            documentId: `doc-${index}`,
            documentName: source.document,
            chunkId: `chunk-${index}`,
            page: 1,
            excerpt: source.excerpt,
            confidence: parseFloat(source.relevance),
          })),
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        onMessageReceived?.(assistantMessage);
        
        // Update conversation ID if provided
        if (response.data.conversationId && !conversationId) {
          setConversationId(response.data.conversationId);
        }
        
        // Load updated history
        await loadChatHistory();
        
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to get response');
      }
    } catch (error: any) {
      const status = error?.response?.status;
      // 402 (token exhausted) and 401 (auth) should bubble up to the caller
      if (status === 402 || status === 401) {
        setIsLoading(false);
        throw error;
      }
      const errorMessage = error.message || 'An error occurred while processing your question';
      setError(error);
      onError?.(errorMessage);

      const errorMessageObj: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessageObj]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, onMessageReceived, onError, loadChatHistory]);

  // Streaming question function
  const askQuestionWithStreaming = useCallback(async (question: string): Promise<ChatResponse | null> => {
    setIsLoading(true);
    setIsStreaming(true);
    setError(null);
    abortControllerRef.current = new AbortController();
    
    let fullAnswer = '';
    let citations: Citation[] = [];
    let metadata: any = {};
    let newConversationId = conversationId;
    
    try {
      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: question,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage]);
      onStreamStart?.();

      // Add placeholder assistant message for streaming
      const placeholderMessage: ChatMessage = {
        id: `streaming-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, placeholderMessage]);
      
      // Start streaming with fallback
      try {
        const stream = chatService.streamQuestion(question);
        
        for await (const event of stream) {
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }
          
          switch (event.type) {
            case 'start':
              break;
              
            case 'token':
              fullAnswer += event.token;
              
              // Update the streaming message with current content
              setMessages(prev => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id.startsWith('streaming-')) {
                  updated[updated.length - 1] = {
                    ...lastMessage,
                    content: fullAnswer,
                  };
                }
                return updated;
              });
              break;
              
            case 'citations':
              citations = event.citations;
              break;
              
            case 'metadata':
              metadata = event.metadata;
              if (event.chatId) {
                newConversationId = event.chatId;
                setConversationId(event.chatId);
              }
              break;
              
            case 'error':
              console.warn('Stream error:', event.error);
              break;
              
            case 'end':
              // Finalize the message with citations
              const finalMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: fullAnswer,
                citations: citations,
                timestamp: new Date(),
              };
              
              // Replace placeholder with final message
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = finalMessage;
                return updated;
              });
              
              onMessageReceived?.(finalMessage);
              
              const streamResponse: ChatResponse = {
                answer: fullAnswer,
                sources: citations.map(cit => ({
                  document: cit.documentName,
                  type: 'legal_document',
                  relevance: cit.confidence?.toFixed(2) || '0.00',
                  excerpt: cit.excerpt,
                })),
                confidence: metadata.confidence || 0,
                documentsUsed: metadata.documentsUsed || 0,
                conversationId: newConversationId,
                metadata,
              };
              
              onStreamEnd?.(streamResponse);
              
              // Load updated history
              await loadChatHistory();
              
              setIsStreaming(false);
              setIsLoading(false);
              return streamResponse;
          }
        }
      } catch (streamError: any) {
        console.warn('Streaming failed, falling back to regular chat:', streamError);
        
        // Fallback to regular chat
        const regularResponse = await askQuestionRegular(question);
        return regularResponse;
      }
      
      throw new Error('Stream was interrupted');
    } catch (error: any) {
      setIsStreaming(false);
      setIsLoading(false);
      setError(error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
      onError?.(error.message);
      return null;
    }
  }, [conversationId, onMessageReceived, onError, onStreamStart, onStreamEnd, loadChatHistory, askQuestionRegular]);

  const askQuestion = useCallback(async (question: string, useStreaming = false) => {
    if (useStreaming) {
      return await askQuestionWithStreaming(question);
    } else {
      return await askQuestionRegular(question);
    }
  }, [askQuestionRegular, askQuestionWithStreaming]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setIsLoading(false);
    }
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setIsStreaming(false);
    setIsLoading(false);
    setError(null);
  }, []);

  const startNewConversation = useCallback(() => {
    clearConversation();
    const newId = `conv-${Date.now()}`;
    setConversationId(newId);
    return newId;
  }, [clearConversation]);

  const loadConversation = useCallback((conversationId: string) => {
    setConversationId(conversationId);
    // For now, just set empty messages
    setMessages([]);
  }, []);

  const scrollToBottom = () => {
    const chatContainer = document.querySelector('.messages-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  };

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (autoScroll && messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [messages, autoScroll]);

  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    messages,
    conversationId,
    isLoading,
    isStreaming,
    error,
    chatHistory,
    isLoadingHistory,
    
    // Actions
    askQuestion,
    cancelStream,
    clearConversation,
    startNewConversation,
    loadConversation,
    loadChatHistory,
    
    // Utilities
    hasMessages: messages.length > 0,
    lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
    messageCount: messages.length,
  };
}