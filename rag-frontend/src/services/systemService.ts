// src/services/systemService.ts
import { apiClient, ApiResponse, HealthStatus } from './client';

export class SystemService {
  // Health Check
  async getHealth(): Promise<ApiResponse<HealthStatus>> {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        success: false,
        error: 'Service unavailable',
      };
    }
  }

  // Statistics
  async getStats(): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get('/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
      return {
        success: false,
        error: 'Failed to load statistics',
      };
    }
  }

  // Test endpoint
  async testConnection(): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get('/test');
      return response.data;
    } catch (error) {
      console.error('Test connection failed:', error);
      return {
        success: false,
        error: 'Backend connection failed',
      };
    }
  }
}

// Export singleton instance
export const systemService = new SystemService();