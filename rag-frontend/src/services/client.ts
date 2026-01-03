// src/services/client.ts
import axios, { AxiosInstance } from 'axios';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
export const createApiClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor for auth token
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('API Error:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        window.location.href = '/login';
      }
      
      return Promise.reject(error);
    }
  );

  return instance;
};

// Export the client instance
export const apiClient = createApiClient();

// Common types that are shared across services
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Document {
  id: string;
  filename: string;
  title: string;
  type: string;
  language: string;
  pages: number;
  words?: number;
  chunks?: number;
  filepath?: string;
}

export interface SearchResult {
  document: Document;
  score: number;
  relevantChunk: string;
  excerpt: string;
}

export interface Citation {
  documentId: string;
  documentName: string;
  chunkId: string;
  page: number;
  excerpt: string;
  confidence: number;
  content?: string;
  similarity?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
  question?: string;
  answer?: string;
}

export interface ChatResponse {
  answer: string;
  sources: Array<{
    document: string;
    type: string;
    relevance: string;
    excerpt: string;
  }>;
  confidence: number;
  documentsUsed: number;
  conversationId?: string;
  metadata?: {
    processingTime: number;
    chunksRetrieved: number;
    documentsUsed: number;
    confidence: number;
  };
}

export interface UploadResponse {
  filename: string;
  originalName: string;
  size: number;
  path: string;
  message: string;
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  environment: string;
  port: number;
  documents: {
    count: number;
    loaded: boolean;
  };
}