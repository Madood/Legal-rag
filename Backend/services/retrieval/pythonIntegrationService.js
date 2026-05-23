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
   * 🟢 FIXED: Main method: Get authority resolution from Python - TRANSPORT ONLY
   * Uses the correct API contract: { query: { text: "...", type: "..." } }
   */
  async resolveAuthority(question, questionType = 'GENERAL') {
    console.log(`\n🤖 [Python Authority] Resolving: "${question.substring(0, 60)}..."`);
    
    try {
      const response = await this.axiosInstance.post(
        '/api/query/search/authoritative',
        {
          query: {
            text: question,
            type: questionType
          },
          k: 3
        }
      );

      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid authority response from Python');
      }

      const pythonData = response.data;
      
      console.log(`✅ [Python Authority] Received ${pythonData.results?.length || 0} results`);
      
      // 🟢 FIXED: Return Python's response directly
      return {
        success: true,
        authority: pythonData.authority_metadata || pythonData,
        results: pythonData.results || [],
        requires_clarification: pythonData.requires_clarification || false,
        clarification: pythonData.clarification,
        python_response: pythonData
      };
      
    } catch (error) {
      console.error(`❌ [Python Authority] Error: ${error.message}`);
      return this.handlePythonError(error, question, 'authority');
    }
  }

  /**
   * 🟢 FIXED: Get authoritative sources - SIMPLIFIED with correct contract
   */
  async getAuthoritativeSources(question, statute, questionType = 'GENERAL', allDocuments = []) {
    console.log(`\n🤖 [Python Sources] Getting authoritative sources for ${statute}...`);
    
    try {
      // 🔥 CRITICAL FIX: Use correct API contract
      const response = await this.axiosInstance.post('/api/query/search/authoritative', {
        query: {
          text: question,
          statute: statute,
          type: questionType
        },
        k: 3
      });
      
      const pythonData = response.data;
      
      // 🟢 FIXED: Extract results directly from Python response
      const documents = pythonData.results || [];
      const isAuthorityFinal = pythonData.authority_final || 
                               pythonData.authority_metadata?.authority_final ||
                               false;
      
      console.log(`✅ [Python Sources] Found ${documents.length} authoritative sources`);
      
      return {
        success: true,
        authority_final: isAuthorityFinal,
        allowed_documents: documents,
        authority_summary: {
          statute: statute,
          document_count: documents.length,
          authority_final: isAuthorityFinal,
          search_metadata: pythonData.metadata || {}
        }
      };
      
    } catch (error) {
      console.error(`❌ [Python Sources] Error: ${error.message}`);
      return {
        success: false,
        authority_final: false,
        allowed_documents: allDocuments,
        authority_summary: { error: 'python_service_unavailable', fallback: true }
      };
    }
  }

  /**
   * Complete RAG pipeline with Python authority - FIXED contract
   */
  async completeRAGWithAuthority(question, allDocuments = [], questionType = 'GENERAL') {
    const startTime = Date.now();
    
    console.log(`\n🚀 [Python Complete] Full RAG pipeline for: "${question.substring(0, 60)}..."`);
    
    try {
      // Step 1: Resolve legal authority with correct contract
      const authorityResult = await this.resolveAuthority(question, questionType);
      
      if (!authorityResult.success) {
        return this.handleAuthorityResolutionFailure(question, authorityResult);
      }
      
      const authority = authorityResult.authority;
      const results = authorityResult.results || [];
      
      // 🟢 FIXED: Check authority_final from Python response
      if (authority.authority_final) {
        console.log(`🚫 AUTHORITY_FINAL DETECTED: ${authority.statute || 'unknown'} §${authority.paragraph || 'unknown'}`);
        
        // Handle authority_final case
        if (authority.requires_ingestion || authority.authority_final_corpus_missing) {
          return {
            success: false,
            authority_final: true,
            requires_ingestion: true,
            authority_final_corpus_missing: true,
            requires_clarification: false,
            authority: authority,
            retrieval: {
              success: false,
              results: [],
              count: 0,
              error: 'authority_final_no_chunks',
              authority_mode: authority.authority_mode || 'exact'
            },
            metadata: {
              total_processing_time: Date.now() - startTime,
              statute: authority.statute,
              paragraph: authority.paragraph,
              confidence: authority.confidence,
              authority_mode: authority.authority_mode || 'exact',
              rag_execution_skipped: true,
              reason: 'authority_final_no_chunks'
            }
          };
        }
      }
      
      // Step 2: Check if clarification is needed
      if (authorityResult.requires_clarification) {
        console.log(`❌ [Python] Clarification required: ${authorityResult.clarification || 'Unknown reason'}`);
        return {
          success: false,
          requires_clarification: true,
          clarification: authorityResult.clarification,
          authority: authority
        };
      }
      
      // Step 3: Get statute from authority or use default
      const statute = authority.statute || 'BGB';
      
      // Step 4: Get authoritative sources
      const sourcesResult = await this.getAuthoritativeSources(
        question, 
        statute, 
        questionType, 
        allDocuments
      );
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ [Python Complete] Pipeline complete in ${processingTime}ms`);
      
      return {
        success: true,
        authority_final: authority.authority_final || false,
        authority: authority,
        results: results,
        sources: sourcesResult,
        metadata: {
          total_processing_time: processingTime,
          statute: authority.statute,
          paragraph: authority.paragraph,
          confidence: authority.confidence,
          authority_mode: authority.authority_mode,
          authority_final: authority.authority_final || false,
          document_count: results.length
        }
      };
      
    } catch (error) {
      console.error(`❌ [Python Complete] Error: ${error.message}`);
      return this.handlePythonError(error, question, 'complete_pipeline');
    }
  }

  /**
   * 🔥 NEW: Simple authoritative search (direct replacement for old method)
   */
  async authoritativeSearch(question, options = {}) {
    try {
      const response = await this.axiosInstance.post('/api/query/search/authoritative', {
        query: {
          text: question,
          type: options.questionType || 'GENERAL',
          statute: options.statute || null
        },
        k: 3
      });
      
      return {
        success: true,
        ...response.data
      };
      
    } catch (error) {
      console.error(`❌ [Authoritative Search] Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /**
   * Call doctrine inductor endpoint for doctrinal questions.
   * Called by chatService when classification.type === 'DOCTRINE'.
   * Returns null on any error so chatService can fall back gracefully.
   */
  async callDoctrineInductor(payload) {
    console.log(`\n🎓 [Doctrine Inductor] Calling Python doctrine endpoint...`);
    try {
      const response = await this.axiosInstance.post('/api/query/doctrine', payload);
      const data = response.data;
      console.log(`✅ [Doctrine Inductor] Received doctrine response`);
      return data;
    } catch (error) {
      console.error(`❌ [Doctrine Inductor] Error: ${error.message}`);
      return null;
    }
  }

  /**
   * Simple search for backward compatibility
   */
  async search(query, statute = null, k = 10) {
    try {
      // Use authoritative search endpoint with legacy format
      const response = await this.axiosInstance.post('/api/query/search', {
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
   * Enhanced health check
   */
  async healthCheck() {
    try {
      const response = await this.axiosInstance.get('/api/query/health', { timeout: 5000 });
      
      return {
        status: 'healthy',
        python_service: true,
        version: response.data?.version || 'unknown',
        ...response.data
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
   * Test all endpoints
   */
  async testAllEndpoints() {
    const endpoints = [
      { 
        name: 'Health', 
        method: 'GET', 
        path: '/api/query/health' 
      },
      { 
        name: 'Status', 
        method: 'GET', 
        path: '/api/query/status' 
      },
      { 
        name: 'Authoritative Search (New Contract)', 
        method: 'POST', 
        path: '/api/query/search/authoritative', 
        data: { 
          query: { 
            text: "Test question about § 37 BGB",
            type: "GENERAL"
          }
        }
      },
      { 
        name: 'Authoritative Search (Legacy)', 
        method: 'POST', 
        path: '/api/query/search/authoritative', 
        data: { 
          query: "Test question about § 37 BGB",
          question_type: "GENERAL"
        }
      },
      { 
        name: 'Legacy Search', 
        method: 'POST', 
        path: '/api/query/search', 
        data: { 
          query: "Test", 
          statute: null, 
          k: 5 
        }
      }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        let response;
        
        if (endpoint.method === 'GET') {
          response = await this.axiosInstance.get(endpoint.path, { timeout: 3000 });
        } else {
          response = await this.axiosInstance.post(endpoint.path, endpoint.data, { timeout: 3000 });
        }
        
        results.push({
          name: endpoint.name,
          path: endpoint.path,
          status: response.status,
          time: Date.now() - start,
          success: true,
          contract_used: endpoint.data ? JSON.stringify(endpoint.data).substring(0, 100) : 'GET'
        });
      } catch (error) {
        results.push({
          name: endpoint.name,
          path: endpoint.path,
          error: error.message,
          success: false,
          contract_used: endpoint.data ? JSON.stringify(endpoint.data).substring(0, 100) : 'GET'
        });
      }
    }
    
    return results;
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
   * Enhanced test connection with endpoint validation
   */
  async testConnection() {
    try {
      const endpointTest = await this.testAllEndpoints();
      const successfulEndpoints = endpointTest.filter(r => r.success);
      const failedEndpoints = endpointTest.filter(r => !r.success);
      
      console.log(`\n📊 [Python Connection Test Results]`);
      console.log(`✅ Successful (${successfulEndpoints.length}):`);
      successfulEndpoints.forEach(r => {
        console.log(`  ✓ ${r.name}: ${r.time}ms (${r.contract_used})`);
      });
      
      if (failedEndpoints.length > 0) {
        console.log(`\n❌ Failed (${failedEndpoints.length}):`);
        failedEndpoints.forEach(r => {
          console.log(`  ✗ ${r.name}: ${r.error}`);
        });
      }
      
      return { 
        success: failedEndpoints.length === 0,
        successful: successfulEndpoints,
        failed: failedEndpoints,
        total: endpointTest.length,
        service_url: this.pythonServiceUrl
      };
    } catch (error) {
      console.log(`❌ [Python] Connection test failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Quick test with sample query
   */
  async quickTest() {
    try {
      console.log(`\n🧪 [Python Quick Test]`);
      
      // Test 1: Health check
      console.log(`  1. Testing health endpoint...`);
      const health = await this.healthCheck();
      console.log(`     ${health.python_service ? '✅' : '❌'} Health: ${health.status}`);
      
      if (!health.python_service) {
        return false;
      }
      
      // Test 2: Authoritative search with new contract
      console.log(`  2. Testing authoritative search (new contract)...`);
      const authSearch = await this.authoritativeSearch("§ 37 BGB Berufung auf Verlangen einer Minderheit");
      console.log(`     ${authSearch.success ? '✅' : '❌'} Results: ${authSearch.results?.length || 0} documents`);
      
      // Test 3: Legacy search
      console.log(`  3. Testing legacy search...`);
      const legacySearch = await this.search("Test query");
      console.log(`     ${legacySearch.success ? '✅' : '❌'} Legacy results: ${legacySearch.results?.length || 0} documents`);
      
      return health.python_service;
      
    } catch (error) {
      console.log(`❌ Quick test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get endpoint URL
   */
  getEndpoint() {
    return this.pythonServiceUrl;
  }

  /**
   * Get complete endpoint map
   */
  getEndpoints() {
    return {
      authority_resolve: `${this.pythonServiceUrl}/api/query/search/authoritative`,
      authoritative_search: `${this.pythonServiceUrl}/api/query/search/authoritative`,
      search: `${this.pythonServiceUrl}/api/query/search`,
      health: `${this.pythonServiceUrl}/api/query/health`,
      status: `${this.pythonServiceUrl}/api/query/status`
    };
  }

  /**
   * Get API contract documentation
   */
  getContract() {
    return {
      authoritative_search: {
        description: "Primary authoritative search endpoint",
        method: "POST",
        url: "/api/query/search/authoritative",
        request_format: {
          query: {
            text: "string (required) - The query text",
            type: "string (optional) - Question type (GENERAL, LEGAL_ANALYSIS, DOCTRINE)",
            statute: "string (optional) - Specific statute (BGB, StGB, etc.)"
          }
        },
        alternative_formats: [
          {
            description: "Flattened format (legacy)",
            format: {
              query: "string (required)",
              question_type: "string (optional)"
            }
          },
          {
            description: "Direct text parameter",
            format: {
              text: "string (required)",
              question_type: "string (optional)"
            }
          }
        ]
      },
      legacy_search: {
        description: "Backward compatibility search",
        method: "POST",
        url: "/api/query/search",
        request_format: {
          query: "string (required)",
          statute: "string (optional)",
          k: "number (optional, default: 10)"
        }
      }
    };
  }
}

module.exports = new PythonIntegrationService();