// src/hooks/useDocuments.ts
import { useState, useCallback, useEffect } from 'react';
import { documentService, Document, SearchResult, UploadResponse } from '../services/api';

interface UseDocumentsOptions {
  autoLoad?: boolean;
  onUploadSuccess?: (response: UploadResponse) => void;
  onUploadError?: (error: string) => void;
}

interface DocumentFilters {
  documentType?: string;
  language?: string;
  searchQuery?: string;
}

export function useDocuments(options: UseDocumentsOptions = {}) {
  const {
    autoLoad = true,
    onUploadSuccess,
    onUploadError,
  } = options;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // Load documents
  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await documentService.getDocuments();
      if (response.success && response.data) {
        setDocuments(response.data.documents);
      } else {
        throw new Error(response.error || 'Failed to load documents');
      }
    } catch (err: any) {
      setError(err);
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Search documents
  const search = useCallback(async (query: string, limit = 5) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    
    try {
      const response = await documentService.searchDocuments(query, limit);
      if (response.success && response.data) {
        setSearchResults(response.data.results);
      } else {
        throw new Error(response.error || 'Search failed');
      }
    } catch (err: any) {
      setError(err);
      setSearchResults([]);
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Upload document
  const uploadDocument = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    
    try {
      const response = await documentService.uploadDocument(file);
      if (response.success && response.data) {
        // Reload documents after successful upload
        await loadDocuments();
        onUploadSuccess?.(response.data);
        return { success: true, data: response.data };
      } else {
        throw new Error(response.error || 'Upload failed');
      }
    } catch (err: any) {
      setError(err);
      onUploadError?.(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsUploading(false);
    }
  }, [loadDocuments, onUploadSuccess, onUploadError]);

  // Get document content
  const getDocumentContent = useCallback(async (filename: string) => {
    try {
      const response = await documentService.getDocumentContent(filename);
      if (response.success && response.data) {
        return response.data.content;
      } else {
        throw new Error(response.error || 'Failed to load document content');
      }
    } catch (err: any) {
      setError(err);
      console.error('Failed to get document content:', err);
      return null;
    }
  }, []);

  // Delete document (placeholder - needs backend endpoint)
  const deleteDocument = useCallback(async (documentId: string) => {
    console.log('Delete document:', documentId);
    // TODO: Implement delete API call
    // For now, just reload documents
    await loadDocuments();
  }, [loadDocuments]);

  // Toggle document selection
  const toggleDocumentSelection = useCallback((documentId: string) => {
    setSelectedDocuments(prev => {
      if (prev.includes(documentId)) {
        return prev.filter(id => id !== documentId);
      } else {
        return [...prev, documentId];
      }
    });
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedDocuments([]);
  }, []);

  // Select all documents
  const selectAllDocuments = useCallback(() => {
    setSelectedDocuments(documents.map(doc => doc.id));
  }, [documents]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<DocumentFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Get filtered documents
  const getFilteredDocuments = useCallback(() => {
    let filtered = documents;
    
    if (filters.documentType) {
      filtered = filtered.filter(doc => doc.type === filters.documentType);
    }
    
    if (filters.language) {
      filtered = filtered.filter(doc => doc.language === filters.language);
    }
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(query) ||
        doc.filename.toLowerCase().includes(query) ||
        doc.type.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [documents, filters]);

  // Get document statistics
  const getStatistics = useCallback(() => {
    const filteredDocs = getFilteredDocuments();
    
    return {
      total: filteredDocs.length,
      byType: filteredDocs.reduce((acc, doc) => {
        acc[doc.type] = (acc[doc.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byLanguage: filteredDocs.reduce((acc, doc) => {
        acc[doc.language] = (acc[doc.language] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      totalPages: filteredDocs.reduce((sum, doc) => sum + doc.pages, 0),
      avgPages: filteredDocs.length > 0 
        ? Math.round(filteredDocs.reduce((sum, doc) => sum + doc.pages, 0) / filteredDocs.length)
        : 0,
    };
  }, [getFilteredDocuments]);

  // Load documents on mount
  useEffect(() => {
    if (autoLoad) {
      loadDocuments();
    }
  }, [autoLoad, loadDocuments]);

  // Auto-refresh documents every 30 seconds
  useEffect(() => {
    if (!autoLoad) return;
    
    const interval = setInterval(() => {
      loadDocuments();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoLoad, loadDocuments]);

  return {
    // State
    documents: getFilteredDocuments(),
    allDocuments: documents, // All documents without filters
    searchResults,
    selectedDocuments,
    filters,
    
    // Loading states
    isLoading,
    isSearching,
    isUploading,
    
    // Errors
    error,
    
    // Actions
    loadDocuments,
    search,
    uploadDocument,
    deleteDocument,
    getDocumentContent,
    toggleDocumentSelection,
    clearSelection,
    selectAllDocuments,
    updateFilters,
    clearFilters,
    
    // Utilities
    hasDocuments: documents.length > 0,
    totalDocuments: documents.length,
    selectedCount: selectedDocuments.length,
    statistics: getStatistics(),
  };
}