// src/services/chatService.ts
import { apiClient, ApiResponse, ChatResponse, Citation } from './client';

export class ChatService {
  // Chat/RAG - Regular endpoint
  // NOTE: 401 and 402 errors are intentionally NOT caught here so they propagate
  // to useChat.ts → ChatScreen.tsx where the LoginModal / token-exhausted modal is shown.
  async askQuestion(question: string): Promise<ApiResponse<ChatResponse>> {
    const response = await apiClient.post('/chat/query', { question });
    return response.data;
  }

  // Chat with streaming (Server-Sent Events) - Fallback to regular chat
  async *streamQuestion(question: string, documentIds?: string[]): AsyncGenerator<any, void, unknown> {
    try {
      // First, try to use regular chat endpoint since streaming endpoint doesn't exist
      console.log('Streaming endpoint not available, using regular chat endpoint');
      
      // Simulate streaming by returning the regular response as a single chunk
      const response = await this.askQuestion(question);
      
      if (response.success && response.data) {
        // Simulate streaming start
        yield { type: 'start', timestamp: new Date().toISOString() };
        
        // Simulate token-by-token streaming
        const words = response.data.answer.split(' ');
        for (let i = 0; i < words.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 30));
          yield { 
            type: 'token', 
            token: words[i] + (i < words.length - 1 ? ' ' : ''),
            progress: Math.round((i + 1) / words.length * 100)
          };
        }
        
        // Send citations
        if (response.data.sources) {
          yield {
            type: 'citations',
            citations: response.data.sources.map((source: any, index: number) => ({
              documentId: `doc-${index}`,
              documentName: (source as any).documentName || (source as any).filename || (source as any).document || ((source as any).statute ? `${(source as any).statute}.pdf` : ''),
              chunkId: `chunk-${index}`,
              page: (source as any).page || (source as any).metadata?.page || 1,
              excerpt: source.excerpt,
              confidence: (() => { const r = parseFloat(source.relevance); return isNaN(r) ? 0 : r; })(),
              statute: (source as any).statute || null,
              paragraph: (source as any).paragraph || null,
            }))
          };
        }
        
        // Send metadata
        yield { 
          type: 'metadata', 
          metadata: response.data.metadata || {
            processingTime: 1000,
            chunksRetrieved: 0,
            documentsUsed: response.data.documentsUsed || 0,
            confidence: response.data.confidence || 0,
          }
        };
        
        // End stream
        yield { 
          type: 'end', 
          timestamp: new Date().toISOString(),
          chatId: response.data.conversationId || `chat-${Date.now()}`
        };
      } else {
        throw new Error(response.error || 'Failed to get response');
      }
    } catch (error: any) {
      // Re-throw auth/token errors so LoginModal fires in ChatScreen
      const status = error?.response?.status;
      if (status === 401 || status === 402) {
        throw error;
      }
      console.error('Streaming failed:', error);
      yield { type: 'error', error: error?.message || 'Request failed', timestamp: new Date().toISOString() };
      yield { type: 'end', timestamp: new Date().toISOString(), chatId: `error-${Date.now()}` };
    }
  }

  // Chat History
  async getChatHistory(limit: number = 10): Promise<ApiResponse<{ conversations: any[]; count: number }>> {
    try {
      const response = await apiClient.get(`/chat/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
      return {
        success: false,
        error: 'Failed to load chat history',
        data: { conversations: [], count: 0 },
      };
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();