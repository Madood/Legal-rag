// src/services/chatService.ts
import { apiClient, ApiResponse, ChatResponse, Citation } from './client';

export class ChatService {
  // Chat/RAG - Regular endpoint
  async askQuestion(question: string): Promise<ApiResponse<ChatResponse>> {
    try {
      const response = await apiClient.post('/chat/query', { question });
      return response.data;
    } catch (error) {
      console.error('Failed to process question:', error);
      return {
        success: false,
        error: 'Failed to process your question',
        data: {
          answer: 'Unable to process your request. Please try again later.',
          sources: [],
          confidence: 0,
          documentsUsed: 0,
        },
      };
    }
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
            citations: response.data.sources.map((source, index) => ({
              documentId: `doc-${index}`,
              documentName: source.document,
              chunkId: `chunk-${index}`,
              page: 1,
              excerpt: source.excerpt,
              confidence: (() => { const r = parseFloat(source.relevance); return isNaN(r) ? 0 : r; })(),
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
    } catch (error) {
      console.error('Streaming failed, using fallback:', error);
      
      // Fallback: return an error response
      yield { 
        type: 'error', 
        error: 'Streaming not available. Using regular response.',
        timestamp: new Date().toISOString()
      };
      
      // Provide a basic response
      yield { 
        type: 'token', 
        token: 'Note: Streaming not available. Here is the regular response: ',
        progress: 50
      };
      
      const fallbackResponse = `I received your question: "${question}". Since the streaming endpoint is not available, I'm providing a regular response. Please check that your backend is running correctly.`;
      
      const words = fallbackResponse.split(' ');
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        yield { 
          type: 'token', 
          token: words[i] + (i < words.length - 1 ? ' ' : ''),
          progress: Math.round((i + 1) / words.length * 100)
        };
      }
      
      yield { 
        type: 'end', 
        timestamp: new Date().toISOString(),
        chatId: `fallback-${Date.now()}`
      };
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