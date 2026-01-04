const axios = require('axios');
const sourceAuthorityResolver = require('./sourceAuthorityResolver');

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
   * Main authoritative search method
   */
  async searchWithAuthority(question, statute, questionType, allDocuments) {
    const startTime = Date.now();
    console.log(`\n🤖 [Python Integration] Searching with authority...`);
    console.log(`   Question: "${question.substring(0, 60)}..."`);
    console.log(`   Statute: ${statute}, Type: ${questionType}`);
    
    try {
      // Step 1: Get authoritative sources
      const authorityResult = sourceAuthorityResolver.resolve(
        question,
        statute,
        questionType,
        allDocuments
      );
      
      // Step 2: Check if we have authoritative sources
      if (authorityResult.allowed_documents.length === 0) {
        console.log(`❌ [Python Integration] No authoritative sources for ${statute}`);
        return this.handleNoAuthoritativeSources(question, statute, authorityResult);
      }
      
      // Step 3: Prepare documents for Python
      const pythonDocuments = this.prepareForPython(authorityResult.allowed_documents);
      
      // Step 4: Prepare authority constraints
      const authorityConstraints = {
        statute: statute,
        question_type: questionType,
        allowed_source_types: this.getAllowedSourceTypes(questionType, statute),
        min_authority_rank: this.getMinAuthorityRank(questionType),
        language_priority: this.getLanguagePriority(statute, questionType),
        require_normative_content: ['NORMATIVE', 'OFFENSE'].includes(questionType)
      };
      
      // Step 5: Build Python request
      const pythonRequest = {
        query: {
          text: question,
          statute: statute,
          question_type: questionType,
          language: this.detectQueryLanguage(question)
        },
        authority_constraints: authorityConstraints,
        documents: pythonDocuments,
        options: {
          similarity_threshold: 0.15,
          max_results: 30,
          include_embeddings: true,
          boost_statute: true,
          diversity_penalty: 0.1
        }
      };
      
      // Step 6: Call Python service
      console.log(`📤 [Python Integration] Sending ${pythonDocuments.length} documents to Python...`);
      const pythonResponse = await this.callPythonService('/api/v1/search/authoritative', pythonRequest);
      
      // Step 7: Annotate results with authority info
      const annotatedResults = this.annotateResultsWithAuthority(
        pythonResponse.results || [],
        authorityResult.allowed_documents
      );
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ [Python Integration] Success! Found ${annotatedResults.length} results`);
      console.log(`   Processing time: ${processingTime}ms`);
      
      return {
        success: true,
        results: annotatedResults,
        authority_summary: authorityResult.authority_summary,
        python_response: {
          processing_time: pythonResponse.processing_time || 0,
          total_chunks_searched: pythonResponse.total_chunks_searched || 0
        },
        metadata: {
          query: question,
          statute: statute,
          question_type: questionType,
          total_documents: allDocuments.length,
          authoritative_documents: authorityResult.allowed_documents.length,
          processing_time_ms: processingTime,
          python_service_used: true
        }
      };
      
    } catch (error) {
      console.error(`❌ [Python Integration] Error:`, error.message);
      return this.handlePythonError(error, question, statute);
    }
  }
  
  /**
   * Authoritative search by statute and paragraph - STATUTE-FIRST
   */
  async authoritativeSearch(question, statute, paragraph, k = 5) {
    console.log(`🔍 [Python Authoritative] Searching for ${statute} §${paragraph}: "${question.substring(0, 50)}..."`);
    
    try {
      const response = await this.axiosInstance.post('/api/search/authoritative', {
        query: question,
        statute: statute,
        paragraph: paragraph,
        k: k
      });
      
      if (!response.data) {
        throw new Error('Empty response from Python authoritative search');
      }
      
      console.log(`✅ [Python Authoritative] Found ${response.data.results?.length || 0} results`);
      
      // Transform to match expected format
      const results = (response.data.results || []).map(result => ({
        content: result.content || '',
        statute: result.statute || statute,
        paragraph: result.paragraph || paragraph,
        document_id: result.document_id || 'unknown',
        similarity: result.score || result.similarity || 0.8,
        is_authoritative: result.is_authoritative || false,
        match_type: result.match_type || 'semantic',
        authority_info: {
          source_type: result.authority_info?.source_type || 'statute',
          authority_rank: 1,
          is_authoritative: result.is_authoritative || false
        },
        confidence: result.score || 0.8,
        metadata: {
          has_paragraph: true,
          is_normative: true
        }
      }));
      
      return {
        success: true,
        results: results,
        authoritative_found: response.data.authoritative_found || false,
        statute: statute,
        paragraph: paragraph,
        count: results.length
      };
      
    } catch (error) {
      console.error(`❌ [Python Authoritative] Error: ${error.message}`);
      
      // Return fallback structure
      return {
        success: false,
        error: error.message,
        results: [],
        authoritative_found: false,
        fallback_reason: 'python_service_error'
      };
    }
  }
  
  /**
   * Simple search for backward compatibility
   */
  async search(query, statute, k = 10) {
    console.log(`🔍 [Python Search] Searching ${statute}: "${query.substring(0, 50)}..."`);
    
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
   * Authoritative search with full request object (for backward compatibility)
   */
  async authoritativeSearchFull(request) {
    console.log(`🔍 [Python Full Auth] Searching with full request...`);
    
    try {
      // Extract query components
      const queryText = request.query?.text || '';
      const statute = request.query?.statute || request.statute;
      const questionType = request.query?.question_type || 'NORMATIVE';
      
      // Extract paragraph from query text if available
      const paragraphMatch = queryText.match(/§\s*(\d+[a-z]?)/i);
      const paragraph = paragraphMatch ? paragraphMatch[1] : null;
      
      if (paragraph) {
        // Use paragraph-based search
        return await this.authoritativeSearch(queryText, statute, paragraph, request.options?.max_results || 5);
      } else {
        // Use general search
        return await this.search(queryText, statute, request.options?.max_results || 10);
      }
      
    } catch (error) {
      console.error(`❌ [Python Full Auth] Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results: [],
        count: 0
      };
    }
  }
  
  /**
   * Prepare documents for Python consumption
   */
  prepareForPython(documents) {
    return documents.map(doc => ({
      id: doc.id || doc.filename,
      filename: doc.filename,
      content: doc.content || '',
      metadata: {
        title: doc.metadata?.title || doc.filename,
        statute: doc.metadata?.statute || 'unknown',
        language: doc.metadata?.language || doc.authority_metadata?.language || 'unknown',
        pages: doc.metadata?.pages || 0,
        word_count: doc.metadata?.word_count || 0,
        // Include authority metadata
        authority_metadata: doc.authority_metadata || {
          source_type: 'unknown',
          authority_rank: 100,
          is_authoritative: false
        }
      },
      chunks: doc.chunks || this.createDefaultChunks(doc.content || '')
    }));
  }
  
  createDefaultChunks(content) {
    if (!content) return [];
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 30);
    return paragraphs.map((para, idx) => ({
      content: para.trim(),
      chunk_index: idx,
      word_count: para.split(/\s+/).length
    }));
  }
  
  /**
   * Authority constraint rules
   */
  getAllowedSourceTypes(questionType, statute) {
    const rules = {
      'NORMATIVE': {
        'BGB': ['official_statute_de'],
        'StGB': ['official_statute_de'],
        'HGB': ['official_statute_de', 'consolidated_translation'],
        'GG': ['official_statute_de'],
        'EU-GDPR': ['official_eu_en', 'official_statute_de']
      },
      'DEFINITION': {
        'default': ['official_statute_de', 'official_statute_en', 'consolidated_translation']
      },
      'OFFENSE': {
        'default': ['official_statute_de']
      },
      'GENERAL': {
        'default': ['official_statute_de', 'official_statute_en', 'consolidated_translation']
      }
    };
    
    const typeRules = rules[questionType] || rules['GENERAL'];
    return typeRules[statute] || typeRules['default'] || ['official_statute_de'];
  }
  
  getMinAuthorityRank(questionType) {
    const ranks = {
      'NORMATIVE': 1,
      'OFFENSE': 1,
      'DEFINITION': 3,
      'DOCTRINE': 4,
      'GENERAL': 3,
      'SYSTEM': 7
    };
    return ranks[questionType] || 3;
  }
  
  getLanguagePriority(statute, questionType) {
    // For normative questions, prefer original language
    if (questionType === 'NORMATIVE') {
      if (['BGB', 'StGB', 'HGB', 'GG'].includes(statute)) return ['de'];
      if (statute === 'EU-GDPR') return ['en'];
    }
    
    // For general questions, use statute defaults
    const priority = {
      'BGB': ['de', 'en'],
      'StGB': ['de', 'en'],
      'HGB': ['de', 'en'],
      'GG': ['de', 'en'],
      'EU-GDPR': ['en', 'de']
    };
    
    return priority[statute] || ['de', 'en'];
  }
  
  detectQueryLanguage(question) {
    const lowerQuestion = question.toLowerCase();
    const germanWords = ['der', 'die', 'das', 'und', 'für', 'mit', 'von', 'zu'];
    const englishWords = ['the', 'and', 'for', 'with', 'from', 'to', 'in', 'of'];
    
    let de = 0, en = 0;
    germanWords.forEach(word => {
      if (lowerQuestion.includes(word)) de++;
    });
    englishWords.forEach(word => {
      if (lowerQuestion.includes(word)) en++;
    });
    
    return de > en ? 'de' : 'en';
  }
  
  /**
   * Annotate Python results with authority info
   */
  annotateResultsWithAuthority(pythonResults, authorityDocuments) {
    return pythonResults.map(result => {
      // Find the source document
      const sourceDoc = authorityDocuments.find(doc => 
        doc.id === result.document_id || doc.filename === result.document_id
      );
      
      const authorityMetadata = sourceDoc?.authority_metadata || {
        source_type: 'unknown',
        authority_rank: 100,
        is_authoritative: false
      };
      
      return {
        ...result,
        authority_info: {
          source_type: authorityMetadata.source_type,
          authority_rank: authorityMetadata.authority_rank,
          is_authoritative: authorityMetadata.is_authoritative,
          classification_reason: authorityMetadata.classification_reason,
          language: authorityMetadata.language,
          source_document: sourceDoc?.filename || result.document_id
        },
        confidence: this.adjustConfidenceWithAuthority(
          result.similarity || 0.5,
          authorityMetadata.authority_rank
        )
      };
    }).sort((a, b) => {
      // Sort by authority rank first, then similarity
      if (a.authority_info.authority_rank !== b.authority_info.authority_rank) {
        return a.authority_info.authority_rank - b.authority_info.authority_rank;
      }
      return (b.similarity || 0) - (a.similarity || 0);
    });
  }
  
  adjustConfidenceWithAuthority(similarity, authorityRank) {
    // Adjust confidence based on authority rank
    let adjusted = similarity;
    
    if (authorityRank <= 2) {
      // Official sources get confidence boost
      adjusted = Math.min(similarity * 1.1, 0.95);
    } else if (authorityRank >= 5) {
      // Lower authority sources get penalty
      adjusted = similarity * 0.8;
    }
    
    return Number(adjusted.toFixed(3));
  }
  
  /**
   * Python service communication
   */
  async callPythonService(endpoint, data) {
    try {
      console.log(`📡 [Python] Calling ${endpoint}...`);
      const response = await this.axiosInstance.post(endpoint, data);
      
      if (!response.data) {
        throw new Error('Empty response from Python service');
      }
      
      console.log(`✅ [Python] Response received`);
      return response.data;
      
    } catch (error) {
      console.error(`❌ [Python] Service call failed:`, error.message);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Python service unavailable at ${this.pythonServiceUrl}. Is it running?`);
      }
      
      if (error.response) {
        // Python service returned error
        throw new Error(`Python service error (${error.response.status}): ${error.response.data?.detail || 'Unknown error'}`);
      }
      
      if (error.code === 'ETIMEDOUT') {
        throw new Error(`Python service timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }
  
  /**
   * Error handling
   */
  handleNoAuthoritativeSources(question, statute, authorityResult) {
    return {
      success: false,
      error: 'NO_AUTHORITATIVE_SOURCES',
      message: `No authoritative sources available for ${statute}. Please load official ${statute} documents.`,
      authority_summary: authorityResult.authority_summary,
      results: [],
      metadata: {
        query: question,
        statute: statute,
        python_service_used: false
      }
    };
  }
  
  handlePythonError(error, question, statute) {
    return {
      success: false,
      error: 'PYTHON_SERVICE_ERROR',
      message: `Python service failed: ${error.message}`,
      results: [],
      fallback_used: true,
      metadata: {
        query: question,
        statute: statute,
        python_service_used: false,
        error_details: error.message
      }
    };
  }
  
  /**
   * Health check for Python service
   */
  async healthCheck() {
    try {
      const response = await this.axiosInstance.get('/api/health', { timeout: 5000 });
      return {
        status: 'healthy',
        python_service: true,
        response_time: response.headers['x-response-time'] || 'unknown',
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
   * Test connection
   */
  async testConnection() {
    console.log(`🔌 [Python Integration] Testing connection to ${this.pythonServiceUrl}...`);
    
    try {
      const health = await this.healthCheck();
      if (health.status === 'healthy') {
        console.log(`✅ [Python Integration] Connection successful`);
        return { success: true, ...health };
      } else {
        console.log(`❌ [Python Integration] Connection failed: ${health.error}`);
        return { success: false, error: health.error };
      }
    } catch (error) {
      console.log(`❌ [Python Integration] Connection failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get endpoint URL for logging
   */
  getEndpoint() {
    return this.pythonServiceUrl;
  }
}

module.exports = new PythonIntegrationService();