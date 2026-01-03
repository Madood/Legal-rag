// src/services/documentService.ts
import { apiClient, ApiResponse, Document, SearchResult, UploadResponse } from './client';

export class DocumentService {
  // Get all documents
  async getDocuments(): Promise<ApiResponse<{ documents: Document[]; count: number }>> {
    try {
      const response = await apiClient.get('/documents');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      return {
        success: false,
        error: 'Failed to load documents',
      };
    }
  }

  // Get specific document content
  async getDocumentContent(filename: string): Promise<ApiResponse<{ content: string; filename: string; wordCount: number }>> {
    try {
      const response = await apiClient.get(`/documents/${filename}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch document content:', error);
      return {
        success: false,
        error: 'Failed to load document content',
      };
    }
  }

  // Search documents
  async searchDocuments(query: string, limit: number = 5): Promise<ApiResponse<{ results: SearchResult[]; count: number; query: string }>> {
    try {
      const response = await apiClient.post('/documents/search', { query, limit });
      return response.data;
    } catch (error) {
      console.error('Search failed:', error);
      return {
        success: false,
        error: 'Search failed',
        data: { results: [], count: 0, query },
      };
    }
  }

  // Upload document
  async uploadDocument(file: File): Promise<ApiResponse<UploadResponse>> {
    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await apiClient.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    } catch (error) {
      console.error('Upload failed:', error);
      return {
        success: false,
        error: 'Failed to upload document',
      };
    }
  }
}

// Export singleton instance
export const documentService = new DocumentService();