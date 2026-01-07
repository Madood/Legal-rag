const axios = require('axios');

class PythonIntegrationService {
  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    this.timeout = parseInt(process.env.PYTHON_TIMEOUT) || 30000;
    
    this.axiosInstance = axios.create({
      baseURL: this.pythonServiceUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Node-Service': 'Legal-RAG-Authority'
      }
    });
    
    console.log(`✅ PythonIntegrationService initialized - Target: ${this.pythonServiceUrl}`);
  }

  /**
   * Main method: Get authority resolution from Python
   */
  async resolveAuthority(question) {
    console.log(`\n🤖 [Python Authority] Resolving: "${question.substring(0, 60)}..."`);
    
    try {
      const response = await this.axiosInstance.post('/api/authority/resolve', {
        question: question
      });
      
      if (!response.data) {
        throw new Error('Empty response from Python authority service');
      }
      
      console.log(`✅ [Python Authority] Resolved: ${response.data.statute || 'NO_STATUTE'} ${response.data.reference ? '§' + response.data.reference : ''}`);
      
      return {
        success: true,
        authority: {
          statute: response.data.statute,
          paragraph: response.data.reference,
          isArticle: response.data.referenceType === 'ARTICLE',
          requiresClarification: response.data.requiresClarification || false,
          clarification: response.data.clarification,
          confidence: response.data.confidence || 0.8,
          referenceSource: response.data.referenceSource || 'none'
        },
        metadata: {
          processingTime: response.data.processingTime || 0,
          statuteLocked: !!response.data.statute
        }
      };
      
    } catch (error) {
      console.error(`❌ [Python Authority] Error: ${error.message}`);
      return this.handlePythonError(error, question, 'authority');
    }
  }

  /**
   * Get authoritative sources from Python (source authority)
   */
  async getAuthoritativeSources(question, statute, questionType, allDocuments) {
    console.log(`\n🤖 [Python Sources] Getting authoritative sources...`);
    
    try {
      const response = await this.axiosInstance.post('/api/source-authority/resolve', {
        question: question,
        statute: statute,
        questionType: questionType,
        documents: allDocuments
      });
      
      console.log(`✅ [Python Sources] Found ${response.data.allowed_documents?.length || 0} authoritative sources`);
      
      return {
        success: true,
        allowed_documents: response.data.allowed_documents || [],
        authority_summary: response.data.authority_summary || {}
      };
      
    } catch (error) {
      console.error(`❌ [Python Sources] Error: ${error.message}`);
      // Fallback: return all documents
      return {
        success: false,
        allowed_documents: allDocuments, // Fallback to all
        authority_summary: { error: 'python_service_unavailable', fallback: true }
      };
    }
  }

  /**
   * Complete RAG pipeline with Python authority
   */
  async completeRAGWithAuthority(question, allDocuments, questionType = 'GENERAL') {
    const startTime = Date.now();
    
    console.log(`\n🚀 [Python Complete] Full RAG pipeline for: "${question.substring(0, 60)}..."`);
    
    try {
      // Step 1: Resolve legal authority
      const authorityResult = await this.resolveAuthority(question);
      
      if (!authorityResult.success || !authorityResult.authority.statute) {
        return this.handleAuthorityResolutionFailure(question, authorityResult);
      }
      
      const authority = authorityResult.authority;
      
      // Step 2: Check if clarification is needed
      if (authority.requiresClarification) {
        console.log(`❌ [Python] Clarification required: ${authority.clarification?.english || 'Unknown reason'}`);
        return {
          success: false,
          requires_clarification: true,
          clarification: authority.clarification,
          authority: authority
        };
      }
      
      // Step 3: Get authoritative sources
      const sourcesResult = await this.getAuthoritativeSources(
        question, 
        authority.statute, 
        questionType, 
        allDocuments
      );
      
      // Step 4: Perform retrieval
      const retrievalResult = await this.retrieveWithStatute(
        question,
        authority.statute,
        authority.paragraph,
        authority.isArticle,
        sourcesResult.allowed_documents
      );
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ [Python Complete] Pipeline complete in ${processingTime}ms`);
      
      return {
        success: true,
        authority: authority,
        sources: sourcesResult,
        retrieval: retrievalResult,
        metadata: {
          total_processing_time: processingTime,
          statute: authority.statute,
          paragraph: authority.paragraph,
          confidence: authority.confidence
        }
      };
      
    } catch (error) {
      console.error(`❌ [Python Complete] Error: ${error.message}`);
      return this.handlePythonError(error, question, 'complete_pipeline');
    }
  }

  /**
   * Retrieve with statute lock (Python-side retrieval)
   */
  async retrieveWithStatute(question, statute, paragraph, isArticle, documents) {
    console.log(`🔍 [Python Retrieval] Searching ${statute} ${paragraph ? '§' + paragraph : ''}`);
    
    try {
      const response = await this.axiosInstance.post('/api/search', {
        query: question,
        statute: statute,
        paragraph: paragraph,
        documents: documents,
        options: {
          k: 10,
          similarity_threshold: 0.15
        }
      });
      
      return {
        success: true,
        results: response.data.results || [],
        count: response.data.results?.length || 0,
        metadata: response.data.metadata || {}
      };
      
    } catch (error) {
      console.error(`❌ [Python Retrieval] Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results: [],
        count: 0
      };
    }
  }

  /**
   * Simple search for backward compatibility
   */
  async search(query, statute, k = 10) {
    try {
      const response = await this.axiosInstance.post('/api/search', {
        query: query,
        statute: statute,
        k: k
      });
      
      return {
        success: true,
        results: response.data.results || [],
        count: response.data.count || 0
      };
    } catch (error) {
      console.error(`❌ [Python Search] Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results: [],
        count: 0
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this.axiosInstance.get('/api/health', { timeout: 5000 });
      return {
        status: 'healthy',
        python_service: true,
        version: response.data?.version || 'unknown'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        python_service: false,
        error: error.message
      };
    }
  }

  /**
   * Error handling
   */
  handleAuthorityResolutionFailure(question, authorityResult) {
    return {
      success: false,
      error: 'AUTHORITY_RESOLUTION_FAILED',
      message: 'Could not determine applicable statute',
      question: question,
      authority_result: authorityResult,
      fallback_needed: true
    };
  }

  handlePythonError(error, context, endpoint) {
    return {
      success: false,
      error: 'PYTHON_SERVICE_ERROR',
      message: `Python service failed (${endpoint}): ${error.message}`,
      context: context,
      fallback_needed: true
    };
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      const health = await this.healthCheck();
      if (health.status === 'healthy') {
        console.log(`✅ [Python] Connection successful`);
        return { success: true, ...health };
      } else {
        console.log(`❌ [Python] Connection failed: ${health.error}`);
        return { success: false, error: health.error };
      }
    } catch (error) {
      console.log(`❌ [Python] Connection failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get endpoint URL
   */
  getEndpoint() {
    return this.pythonServiceUrl;
  }
}

module.exports = new PythonIntegrationService();