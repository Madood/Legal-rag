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
   * Normalize authority mode from Python to JS standard format
   */
  normalizeAuthorityMode(pythonMode, statute, paragraph, hasAnchorNorm = false) {
    // If Python already provides standard mode, use it
    if (pythonMode && ['none', 'overview', 'exact'].includes(pythonMode)) {
      return pythonMode;
    }
    
    // Determine mode based on resolution characteristics
    if (!statute) {
      return 'none';
    }
    
    if (statute && paragraph) {
      return 'exact';
    }
    
    // Statute locked but paragraph open (with or without anchor norm)
    if (statute && !paragraph) {
      return 'overview';
    }
    
    // Fallback
    return 'none';
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
      
      const pythonData = response.data;
      
      // Normalize authority mode
      const authorityMode = this.normalizeAuthorityMode(
        pythonData.authority_mode,
        pythonData.statute,
        pythonData.reference,
        pythonData.has_anchor_norm
      );
      
      console.log(`✅ [Python Authority] Resolved: ${pythonData.statute || 'NO_STATUTE'} ${pythonData.reference ? '§' + pythonData.reference : ''} (mode: ${authorityMode})`);
      
      return {
        success: true,
        authority: {
          statute: pythonData.statute,
          paragraph: pythonData.reference,
          isArticle: pythonData.referenceType === 'ARTICLE',
          requiresClarification: pythonData.requiresClarification || false,
          clarification: pythonData.clarification,
          confidence: pythonData.confidence || 0.8,
          referenceSource: pythonData.referenceSource || 'none',
          authority_mode: authorityMode, // ✅ NORMALIZED
          has_anchor_norm: pythonData.has_anchor_norm || false,
          statute_locked: !!pythonData.statute,
          paragraph_locked: !!pythonData.reference
        },
        metadata: {
          processingTime: pythonData.processingTime || 0,
          statuteLocked: !!pythonData.statute,
          python_raw_mode: pythonData.authority_mode || 'unknown',
          normalized_mode: authorityMode
        }
      };
      
    } catch (error) {
      console.error(`❌ [Python Authority] Error: ${error.message}`);
      return this.handlePythonError(error, question, 'authority');
    }
  }

  /**
   * Get authoritative sources from Python via search/authoritative endpoint
   */
  async getAuthoritativeSources(question, statute, questionType, allDocuments) {
    console.log(`\n🤖 [Python Sources] Getting authoritative sources for ${statute}...`);
    
    try {
      // ✅ FIX 1: Correct endpoint and payload
      const response = await this.axiosInstance.post('/query/search/authoritative', {
        query: question,
        statute: statute,
        k: 20
      });
      
      console.log(`✅ [Python Sources] Found ${response.data.results?.length || 0} authoritative sources`);
      
      return {
        success: true,
        allowed_documents: response.data.results || [],
        authority_summary: {
          statute: statute,
          document_count: response.data.results?.length || 0,
          search_metadata: response.data.metadata || {}
        }
        // ✅ Removed authority_mode override
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
          confidence: authority.confidence,
          authority_mode: authority.authority_mode // ✅ Propagate mode
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
      // ✅ FIX 2: Correct endpoint and minimal payload
      const response = await this.axiosInstance.post('/query/search', {
        query: question,
        statute: statute,
        k: 10
      });
      
      return {
        success: true,
        results: response.data.results || [],
        count: response.data.results?.length || 0,
        metadata: response.data.metadata || {},
        authority_mode: paragraph ? 'exact' : 'overview' // ✅ Add mode
      };
      
    } catch (error) {
      console.error(`❌ [Python Retrieval] Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results: [],
        count: 0,
        authority_mode: 'none' // Default mode on error
      };
    }
  }

  /**
   * Simple search for backward compatibility
   */
  async search(query, statute, k = 10) {
    try {
      // ✅ FIX 3: Correct endpoint
      const response = await this.axiosInstance.post('/query/search', {
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
// 🔴 CRITICAL FIX: Add this method to the PythonIntegrationService class
/**
 * Call Python's doctrine inductor for doctrinal analysis
 */
async callDoctrineInductor(question, authority) {
  console.log(`🧠 [Python Doctrine] Calling doctrine inductor for ${authority.statute} §${authority.paragraph}`);
  
  try {
    const response = await this.axiosInstance.post('/api/doctrine/induct', {
      question: question,
      authority: {
        statute: authority.statute,
        paragraph: authority.paragraph,
        authority_mode: authority.authority_mode,
        normFunction: authority.normFunction || 'OPERATIVE'
      }
    }, {
      timeout: 5000 // Fast timeout for doctrine calls
    });
    
    return response.data;
  } catch (error) {
    console.log(`⚠️ [Python Doctrine] Call failed: ${error.message}`);
    return null;
  }
}
  /**
   * Enhanced health check with mode validation
   */
  async healthCheck() {
    try {
      const response = await this.axiosInstance.get('/api/health', { timeout: 5000 });
      
      // Test mode normalization
      const testModes = [
        { mode: 'concise', statute: 'BGB', paragraph: null, expected: 'overview' },
        { mode: 'detailed', statute: 'BGB', paragraph: '903', expected: 'exact' },
        { mode: 'unknown', statute: null, paragraph: null, expected: 'none' }
      ];
      
      const modeValidation = testModes.map(test => ({
        input: test.mode,
        expected: test.expected,
        actual: this.normalizeAuthorityMode(test.mode, test.statute, test.paragraph),
        valid: this.normalizeAuthorityMode(test.mode, test.statute, test.paragraph) === test.expected
      }));
      
      return {
        status: 'healthy',
        python_service: true,
        version: response.data?.version || 'unknown',
        mode_normalization: {
          operational: true,
          test_results: modeValidation,
          all_valid: modeValidation.every(m => m.valid)
        }
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
   * Enhanced test connection with mode checks
   */
  async testConnection() {
    try {
      const health = await this.healthCheck();
      if (health.status === 'healthy') {
        console.log(`✅ [Python] Connection successful`);
        console.log(`📊 [Python] Mode normalization: ${health.mode_normalization?.all_valid ? 'PASS' : 'FAIL'}`);
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

  /**
   * Debug: Simulate Python responses for testing
   */
  simulatePythonResponse(question) {
    // Simulate different Python responses for testing
    const scenarios = {
      'Was ist Eigentum?': {
        statute: 'BGB',
        reference: null,
        authority_mode: 'concise',
        has_anchor_norm: true,
        confidence: 0.85
      },
      'Wie lautet § 903 BGB?': {
        statute: 'BGB',
        reference: '903',
        authority_mode: 'detailed',
        has_anchor_norm: true,
        confidence: 0.95
      },
      'Was bedeutet Vertragsfreiheit?': {
        statute: null,
        reference: null,
        authority_mode: 'none',
        requiresClarification: true,
        confidence: 0.3
      }
    };
    
    const match = Object.keys(scenarios).find(key => question.includes(key));
    return scenarios[match] || scenarios['Was ist Eigentum?'];
  }
}

module.exports = new PythonIntegrationService();