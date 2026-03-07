const Document = require('../models/Document');
const User = require('../models/User');
const fileProcessor = require('../utils/fileProcessor');
const embeddingService = require('../services/embeddingService');
const fs = require('fs').promises;
const path = require('path');

// ========== CRITICAL RAG BRIDGE ==========

// 🔥 NEW: Load processed documents into RAG memory (runtime)
exports.loadDocumentsToMemory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    console.log('🔄 Loading processed documents into RAG memory...');
    
    // Get processed documents from MongoDB
    const documents = await Document.find({ 
      uploadedBy: userId,
      status: 'processed' 
    }).lean();

    // Load into pdfDocumentService (RAG runtime memory)
    const pdfService = require('../services/ingestion/pdfDocumentService'); // FIXED: lowercase 'p'
    pdfService.clearDocuments();

    let loadedCount = 0;
    documents.forEach(doc => {
      if (doc.content) {
        pdfService.addDocument({
          id: doc._id.toString(),
          filename: doc.filename,
          originalName: doc.originalName,
          content: doc.content || '',
          chunks: doc.chunks || [],
          metadata: doc.metadata || {},
          status: doc.status,
          source: 'mongodb',
          processedAt: doc.processedAt,
          embeddings: doc.chunks?.some(chunk => chunk.embeddings?.length > 0) || false
        });
        loadedCount++;
      }
    });

    console.log(`📥 Loaded ${loadedCount} documents from MongoDB to RAG memory`);

    res.json({
      success: true,
      data: {
        loaded: loadedCount,
        totalProcessed: documents.length,
        message: `Successfully loaded ${loadedCount} processed documents into RAG memory`,
        memoryCount: pdfService.getAllDocuments().length
      }
    });
  } catch (error) {
    next(error);
  }
};

// 🔥 NEW: Check memory vs MongoDB sync status
exports.getMemorySyncStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // MongoDB documents
    const mongoDocs = await Document.find({ uploadedBy: userId });
    const processedDocs = mongoDocs.filter(d => d.status === 'processed');
    
    // Memory documents (RAG runtime)
    const pdfService = require('../services/ingestion/pdfDocumentService'); // FIXED: lowercase 'p'
    const memoryDocs = pdfService.getAllDocuments();
    
    // Find mismatches
    const missingInMemory = processedDocs.filter(mongoDoc => 
      !memoryDocs.some(memDoc => memDoc.id === mongoDoc._id.toString())
    );
    
    res.json({
      success: true,
      data: {
        mongodb: {
          total: mongoDocs.length,
          processed: processedDocs.length,
          uploaded: mongoDocs.filter(d => d.status === 'uploaded').length,
          failed: mongoDocs.filter(d => d.status === 'failed').length
        },
        memory: {
          total: memoryDocs.length,
          sources: memoryDocs.reduce((acc, doc) => {
            acc[doc.source] = (acc[doc.source] || 0) + 1;
            return acc;
          }, {})
        },
        syncStatus: {
          inSync: missingInMemory.length === 0,
          missingInMemory: missingInMemory.length,
          missingDocuments: missingInMemory.map(d => ({
            id: d._id,
            filename: d.filename,
            status: d.status
          }))
        },
        recommendations: missingInMemory.length > 0 ? [
          `Call POST /api/documents/${missingInMemory[0]._id}/process to process documents`,
          `Call POST /api/documents/load-to-memory to sync to RAG system`
        ] : ['✅ System is fully synchronized']
      }
    });
  } catch (error) {
    next(error);
  }
};

// 🔥 NEW: Startup initialization function (for server.js)
exports.initializeRAGDocuments = async () => {
  try {
    console.log('🚀 Initializing RAG document bridge...');
    
    // Get ALL processed documents from MongoDB
    const documents = await Document.find({ status: 'processed' }).lean();
    
    // Load into memory service
    const pdfService = require('../services/ingestion/pdfDocumentService'); // FIXED: lowercase 'p'
    pdfService.clearDocuments();
    
    let loadedCount = 0;
    documents.forEach(doc => {
      if (doc.content) {
        pdfService.addDocument({
          id: doc._id.toString(),
          filename: doc.filename,
          originalName: doc.originalName,
          content: doc.content || '',
          chunks: doc.chunks || [],
          metadata: doc.metadata || {},
          status: doc.status,
          source: 'mongodb',
          processedAt: doc.processedAt
        });
        loadedCount++;
      }
    });
    
    console.log(`✅ RAG bridge initialized: ${loadedCount} documents loaded`);
    
    return {
      success: true,
      loaded: loadedCount,
      totalProcessed: documents.length,
      message: `Loaded ${loadedCount} processed documents into RAG memory`
    };
  } catch (error) {
    console.error('❌ Failed to initialize RAG documents:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ========== ORIGINAL CONTROLLER METHODS (UPDATED) ==========

// Upload a single document
exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const userId = req.user._id;
    const { originalname, filename, size, path: filePath, fileType } = req.file;

    // Create document record
    const document = new Document({
      filename,
      originalName: originalname,
      filePath,
      fileType,
      size,
      uploadedBy: userId,
      status: 'uploaded'
    });

    await document.save();

    // Add document reference to user
    await User.findByIdAndUpdate(userId, {
      $push: { documents: document._id }
    });

    res.status(201).json({
      success: true,
      data: {
        document: {
          id: document._id,
          filename: document.filename,
          originalName: document.originalName,
          size: document.size,
          fileType: document.fileType,
          status: document.status,
          uploadedAt: document.uploadedAt
        },
        message: 'Document uploaded successfully',
        nextSteps: [
          `Process this document: POST /api/documents/${document._id}/process`,
          `Load all processed documents to RAG: POST /api/documents/load-to-memory`
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

// Upload multiple documents
exports.uploadMultipleDocuments = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const userId = req.user._id;
    const results = [];

    for (const file of req.files) {
      try {
        const { originalname, filename, size, path: filePath, fileType } = file;

        // Create document record
        const document = new Document({
          filename,
          originalName: originalname,
          filePath,
          fileType,
          size,
          uploadedBy: userId,
          status: 'uploaded'
        });

        await document.save();

        // Add document reference to user
        await User.findByIdAndUpdate(userId, {
          $push: { documents: document._id }
        });

        results.push({
          success: true,
          filename: originalname,
          documentId: document._id,
          status: 'uploaded'
        });
      } catch (error) {
        results.push({
          success: false,
          filename: file.originalname,
          error: error.message
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        results,
        total: req.files.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        nextSteps: [
          `Process documents: POST /api/documents/{id}/process for each`,
          `Load to RAG: POST /api/documents/load-to-memory`
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

// Process a document (extract text, chunk, and embed)
exports.processDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Find document
    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Check if already processed
    if (document.status === 'processed') {
      return res.status(400).json({
        success: false,
        error: 'Document already processed'
      });
    }

    // Update status to processing
    document.status = 'processing';
    await document.save();

    try {
      // Extract text from file
      const extractionResult = await fileProcessor.extractText(
        document.filePath,
        document.fileType
      );

      // Clean and process German legal text
      const cleanedText = fileProcessor.cleanGermanLegalText(extractionResult.text);
      
      // Create chunks
      const chunks = fileProcessor.createLegalChunks(
        cleanedText,
        parseInt(process.env.CHUNK_SIZE) || 1000,
        parseInt(process.env.CHUNK_OVERLAP) || 200
      );

      // Generate enhanced legal metadata
      const metadata = this.extractEnhancedLegalMetadata(
        cleanedText,
        document.originalName,
        document.filename
      );

      // Generate embeddings for each chunk
      const chunksWithEmbeddings = await Promise.all(
        chunks.map(async (chunkContent, index) => {
          const embedding = await embeddingService.generateEmbeddings(chunkContent, document._id);
          const keywords = fileProcessor.extractGermanKeywords(chunkContent, 10);
          const section = this.extractSectionFromChunk(chunkContent);

          return {
            chunkId: `${document._id}_chunk_${index}`,
            content: chunkContent,
            page: this.extractPageNumber(chunkContent, index, chunks.length),
            section: section,
            embeddings: embedding,
            keywords: keywords,
            metadata: {
              wordCount: chunkContent.split(/\s+/).length,
              charCount: chunkContent.length,
              containsLegalCitation: this.containsLegalCitation(chunkContent),
              isStatuteText: this.isStatuteText(chunkContent, section)
            }
          };
        })
      );

      // Update document with enhanced metadata
      document.content = cleanedText;
      document.chunks = chunksWithEmbeddings;
      document.metadata = {
        ...metadata,
        summary: fileProcessor.generateSummary(cleanedText, 200),
        wordCount: cleanedText.split(/\s+/).length,
        charCount: cleanedText.length,
        chunksCount: chunksWithEmbeddings.length,
        statutes: this.extractStatutesFromText(cleanedText),
        legalTopics: this.extractLegalTopics(cleanedText)
      };
      document.status = 'processed';
      document.processedAt = new Date();
      document.processingStats = {
        chunksCreated: chunksWithEmbeddings.length,
        processingTime: Date.now() - document.uploadedAt,
        wordCount: cleanedText.split(/\s+/).length,
        legalCitationsFound: this.countLegalCitations(cleanedText)
      };

      await document.save();

      // 🔥 CRITICAL: Auto-load processed document into RAG memory
      try {
        const pdfService = require('../services/ingestion/pdfDocumentService'); // FIXED: lowercase 'p'
        pdfService.addDocument({
          id: document._id.toString(),
          filename: document.filename,
          originalName: document.originalName,
          content: document.content || '',
          chunks: document.chunks || [],
          metadata: document.metadata || {},
          status: document.status,
          source: 'mongodb',
          processedAt: document.processedAt,
          embeddings: true
        });
        console.log(`📄 Auto-loaded document ${document.filename} into RAG memory`);
      } catch (loadError) {
        console.warn(`⚠️ Could not auto-load document to memory:`, loadError.message);
      }

      res.json({
        success: true,
        data: {
          document: {
            id: document._id,
            filename: document.filename,
            status: document.status,
            processedAt: document.processedAt,
            chunksCount: document.chunks.length,
            metadata: document.metadata,
            processingStats: document.processingStats,
            loadedToRAG: true
          }
        }
      });
    } catch (processingError) {
      // Update document with error status
      document.status = 'failed';
      document.processingError = processingError.message;
      await document.save();

      throw processingError;
    }
  } catch (error) {
    next(error);
  }
};

// Get all documents for user
exports.getAllDocuments = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      sortOrder = 'desc'
    } = req.query;

    // Whitelist to prevent NoSQL injection via sort key or filter value
    const ALLOWED_SORT_FIELDS = ['uploadedAt', 'updatedAt', 'filename', 'size'];
    const ALLOWED_STATUSES = ['uploaded', 'processing', 'processed', 'failed'];
    const ALLOWED_DOC_TYPES = ['civil_code', 'commercial_code', 'constitution', 'data_protection', 'legal_code', 'legal_document'];

    const sortBy = ALLOWED_SORT_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : 'uploadedAt';
    const status = ALLOWED_STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const documentType = ALLOWED_DOC_TYPES.includes(req.query.documentType) ? req.query.documentType : undefined;

    // Build query
    const query = { uploadedBy: userId };

    if (status) {
      query.status = status;
    }

    if (documentType) {
      query['metadata.documentType'] = documentType;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const documents = await Document.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-chunks -content') // Exclude large fields
      .lean();

    const total = await Document.countDocuments(query);

    // Check which documents are in RAG memory
    const pdfService = require('../services/ingestion/pdfDocumentService'); // FIXED: lowercase 'p'
    const memoryDocs = pdfService.getAllDocuments();

    // Add virtual fields
    const enhancedDocuments = documents.map(doc => {
      const inMemory = memoryDocs.some(md => md.id === doc._id.toString());
      
      return {
        ...doc,
        totalChunks: doc.chunks?.length || 0,
        isProcessed: doc.status === 'processed',
        hasEmbeddings: doc.chunks?.some(chunk => chunk.embeddings?.length > 0) || false,
        inRAGMemory: inMemory,
        // Enhanced metadata access
        jurisdiction: doc.metadata?.jurisdiction,
        statute: doc.metadata?.statute,
        documentType: doc.metadata?.documentType,
        legalTopics: doc.metadata?.legalTopics || []
      };
    });

    res.json({
      success: true,
      data: {
        documents: enhancedDocuments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        memoryStatus: {
          totalInMemory: memoryDocs.length,
          processedInMemory: memoryDocs.filter(d => d.status === 'processed').length
        },
        filters: {
          status,
          documentType
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get specific document
exports.getDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId
    }).lean();

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Update last accessed
    await Document.findByIdAndUpdate(id, {
      lastAccessed: new Date()
    });

    // Check if in RAG memory
    const pdfService = require('../services/ingestion/pdfDocumentService'); // FIXED: lowercase 'p'
    const memoryDocs = pdfService.getAllDocuments();
    const inMemory = memoryDocs.some(md => md.id === document._id.toString());

    // Add virtual fields
    const enhancedDocument = {
      ...document,
      totalChunks: document.chunks?.length || 0,
      isProcessed: document.status === 'processed',
      hasEmbeddings: document.chunks?.some(chunk => chunk.embeddings?.length > 0) || false,
      inRAGMemory: inMemory,
      legalInfo: {
        jurisdiction: document.metadata?.jurisdiction,
        statute: document.metadata?.statute,
        documentType: document.metadata?.documentType,
        topics: document.metadata?.legalTopics || []
      }
    };

    res.json({
      success: true,
      data: {
        document: enhancedDocument
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get document chunks
exports.getDocumentChunks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { page, section } = req.query;

    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId
    }).select('chunks filename metadata');

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    let chunks = document.chunks;

    // Filter chunks if query parameters provided
    if (page) {
      chunks = chunks.filter(chunk => chunk.page === parseInt(page));
    }
    
    if (section) {
      chunks = chunks.filter(chunk => chunk.section === section);
    }

    // Remove embeddings from response to reduce size
    const chunksWithoutEmbeddings = chunks.map(chunk => ({
      chunkId: chunk.chunkId,
      content: chunk.content,
      page: chunk.page,
      section: chunk.section,
      keywords: chunk.keywords,
      metadata: chunk.metadata,
      hasLegalCitation: chunk.metadata?.containsLegalCitation || false,
      isStatuteText: chunk.metadata?.isStatuteText || false
    }));

    res.json({
      success: true,
      data: {
        documentId: document._id,
        filename: document.filename,
        title: document.metadata?.title,
        jurisdiction: document.metadata?.jurisdiction,
        statute: document.metadata?.statute,
        documentType: document.metadata?.documentType,
        chunks: chunksWithoutEmbeddings,
        totalChunks: chunksWithoutEmbeddings.length,
        filters: { page, section }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get document content
exports.getDocumentContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { format = 'text' } = req.query;

    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId
    }).select('content filename metadata');

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    let content = document.content;

    // Format content based on request
    if (format === 'html') {
      content = this.formatAsHTML(content);
    } else if (format === 'markdown') {
      content = this.formatAsMarkdown(content);
    }

    res.json({
      success: true,
      data: {
        documentId: document._id,
        filename: document.filename,
        title: document.metadata?.title,
        jurisdiction: document.metadata?.jurisdiction,
        statute: document.metadata?.statute,
        documentType: document.metadata?.documentType,
        content: content,
        format: format,
        length: content.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Search in documents with legal filtering
exports.searchDocuments = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { 
      query, 
      documentIds, 
      semantic = true,
      limit = 20,
      jurisdiction,
      statute,
      documentType
    } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Build document filter
    const documentFilter = { 
      uploadedBy: userId,
      status: 'processed'
    };
    
    if (documentIds && documentIds.length > 0) {
      documentFilter._id = { $in: documentIds };
    }

    // Whitelist legal filter values to prevent NoSQL injection
    const ALLOWED_JURISDICTIONS = ['DE', 'EU', 'Germany (Federal)', 'European Union', 'Germany'];
    const ALLOWED_STATUTES = ['BGB', 'HGB', 'GG', 'STGB', 'StGB', 'ZPO', 'StPO', 'AO', 'VwVfG', 'EU-GDPR', 'DSGVO'];
    const ALLOWED_DOC_TYPES_SEARCH = ['civil_code', 'commercial_code', 'constitution', 'data_protection', 'legal_code', 'legal_document'];

    if (jurisdiction && ALLOWED_JURISDICTIONS.includes(String(jurisdiction))) {
      documentFilter['metadata.jurisdiction'] = jurisdiction;
    }

    if (statute && ALLOWED_STATUTES.includes(String(statute).toUpperCase())) {
      documentFilter['metadata.statute'] = String(statute).toUpperCase();
    }

    if (documentType && ALLOWED_DOC_TYPES_SEARCH.includes(String(documentType))) {
      documentFilter['metadata.documentType'] = documentType;
    }

    const documents = await Document.find(documentFilter);

    if (documents.length === 0) {
      return res.json({
        success: true,
        data: {
          results: [],
          total: 0,
          query: query,
          filtersApplied: { jurisdiction, statute, documentType }
        }
      });
    }

    let results = [];

    if (semantic) {
      // Semantic search using embeddings
      const queryEmbedding = await embeddingService.generateEmbeddings(query);
      
      // Collect all chunks
      const allChunks = [];
      documents.forEach(doc => {
        doc.chunks.forEach(chunk => {
          allChunks.push({
            ...chunk.toObject(),
            documentId: doc._id,
            documentName: doc.filename,
            documentTitle: doc.metadata?.title || doc.filename,
            documentJurisdiction: doc.metadata?.jurisdiction,
            documentStatute: doc.metadata?.statute,
            documentType: doc.metadata?.documentType
          });
        });
      });

      // Find similar chunks
      const similarChunks = await embeddingService.findSimilarChunks(
        queryEmbedding,
        allChunks,
        { 
          similarityThreshold: 0.4, // Slightly higher threshold for legal search
          maxResults: limit 
        }
      );

      // Boost results from matching jurisdiction/statute
      const enhancedChunks = similarChunks.map(chunk => {
        let score = chunk.similarity || 0;
        
        // Boost for jurisdiction match if specified
        if (jurisdiction && chunk.documentJurisdiction === jurisdiction) {
          score += 0.2;
        }
        
        // Boost for statute match if specified
        if (statute && chunk.documentStatute === statute) {
          score += 0.3;
        }
        
        // Boost for legal citations
        if (chunk.content.includes('§')) {
          score += 0.1;
        }
        
        return {
          ...chunk,
          enhancedSimilarity: score
        };
      });

      // Sort by enhanced similarity
      enhancedChunks.sort((a, b) => b.enhancedSimilarity - a.enhancedSimilarity);

      // Format results
      results = enhancedChunks.map(chunk => ({
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        documentTitle: chunk.documentTitle,
        jurisdiction: chunk.documentJurisdiction,
        statute: chunk.documentStatute,
        documentType: chunk.documentType,
        chunkId: chunk.chunkId,
        content: chunk.content.substring(0, 300) + (chunk.content.length > 300 ? '...' : ''),
        preview: this.extractPreview(chunk.content, query),
        page: chunk.page,
        section: chunk.section,
        similarity: chunk.similarity,
        enhancedSimilarity: chunk.enhancedSimilarity,
        metadata: {
          containsLegalCitation: chunk.metadata?.containsLegalCitation || false,
          isStatuteText: chunk.metadata?.isStatuteText || false
        }
      }));
    } else {
      // Text-based search
      for (const doc of documents) {
        const matchingChunks = doc.chunks.filter(chunk => 
          chunk.content.toLowerCase().includes(query.toLowerCase())
        );
        
        matchingChunks.forEach(chunk => {
          results.push({
            documentId: doc._id,
            documentName: doc.filename,
            documentTitle: doc.metadata?.title || doc.filename,
            jurisdiction: doc.metadata?.jurisdiction,
            statute: doc.metadata?.statute,
            documentType: doc.metadata?.documentType,
            chunkId: chunk.chunkId,
            content: chunk.content.substring(0, 300) + (chunk.content.length > 300 ? '...' : ''),
            preview: this.extractPreview(chunk.content, query),
            page: chunk.page,
            section: chunk.section,
            similarity: 1.0, // Exact match
            enhancedSimilarity: 1.0,
            metadata: {
              containsLegalCitation: chunk.metadata?.containsLegalCitation || false,
              isStatuteText: chunk.metadata?.isStatuteText || false
            }
          });
        });
      }
      
      // Sort by relevance (simple length-based)
      results.sort((a, b) => b.content.length - a.content.length);
      results = results.slice(0, limit);
    }

    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        query: query,
        searchType: semantic ? 'semantic' : 'text',
        documentsSearched: documents.length,
        filtersApplied: { jurisdiction, statute, documentType }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete document
exports.deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    try {
      // Delete physical file
      await fs.unlink(document.filePath);
    } catch (fileError) {
      console.warn(`Could not delete file: ${document.filePath}`, fileError);
    }

    // Remove document reference from user
    await User.findByIdAndUpdate(userId, {
      $pull: { documents: document._id }
    });

    // Remove from RAG memory if present
    try {
      const pdfService = require('../services/ingestion/pdfDocumentService'); // FIXED: lowercase 'p'
      const memoryDocs = pdfService.getAllDocuments();
      const index = memoryDocs.findIndex(d => d.id === document._id.toString());
      if (index !== -1) {
        memoryDocs.splice(index, 1);
        console.log(`🗑️ Removed document ${document.filename} from RAG memory`);
      }
    } catch (memoryError) {
      console.warn('Could not remove from memory:', memoryError.message);
    }

    // Delete document from database
    await Document.findByIdAndDelete(id);

    res.json({
      success: true,
      data: {
        message: 'Document deleted successfully',
        documentId: id
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========== ENHANCED LEGAL METADATA HELPER METHODS ==========

// Enhanced legal metadata extraction
exports.extractEnhancedLegalMetadata = (content, originalName, filename) => {
  const contentLower = content.toLowerCase();
  const filenameLower = filename.toLowerCase();
  const originalNameLower = originalName.toLowerCase();

  let metadata = {
    title: originalName.replace(/\.[^/.]+$/, ""), // Default to filename without extension
    documentType: 'legal_document', // Default
    jurisdiction: 'DE', // Default to Germany
    statute: null,
    year: this.extractYearFromText(content),
    source: this.detectSource(content),
    isOfficialText: this.isOfficialText(content)
  };

  // Detect BGB (German Civil Code)
  if (filenameLower.includes('bgb') || 
      originalNameLower.includes('bgb') || 
      contentLower.includes('bürgerliches gesetzbuch') ||
      content.includes('BGB') ||
      content.match(/§\s*\d+\s*BGB/)) {
    
    metadata.documentType = 'civil_code';
    metadata.statute = 'BGB';
    metadata.title = this.extractBGBTitle(content) || 'Bürgerliches Gesetzbuch (BGB)';
    metadata.jurisdiction = 'DE';
  }

  // Detect HGB (German Commercial Code)
  else if (filenameLower.includes('hgb') || 
           originalNameLower.includes('hgb') || 
           contentLower.includes('handelsgesetzbuch') ||
           content.includes('HGB') ||
           content.match(/§\s*\d+\s*HGB/)) {
    
    metadata.documentType = 'commercial_code';
    metadata.statute = 'HGB';
    metadata.title = 'Handelsgesetzbuch (HGB)';
    metadata.jurisdiction = 'DE';
  }

  // Detect GG (German Constitution)
  else if (filenameLower.includes('gg') || 
           originalNameLower.includes('gg') || 
           contentLower.includes('grundgesetz') ||
           content.match(/Artikel\s*\d+\s*GG/)) {
    
    metadata.documentType = 'constitution';
    metadata.statute = 'GG';
    metadata.title = 'Grundgesetz (GG)';
    metadata.jurisdiction = 'DE';
  }

  // Detect GDPR
  else if (filenameLower.includes('gdpr') || 
           filenameLower.includes('dsgvo') ||
           originalNameLower.includes('gdpr') ||
           originalNameLower.includes('dsgvo') ||
           contentLower.includes('regulation (eu) 2016/679') ||
           contentLower.includes('datenschutz-grundverordnung') ||
           content.match(/Artikel\s*\d+\s*DSGVO/)) {
    
    metadata.documentType = 'data_protection';
    metadata.statute = 'EU-GDPR';
    metadata.title = 'EU-Datenschutz-Grundverordnung (GDPR)';
    metadata.jurisdiction = 'EU';
  }

  // Detect other legal codes
  else if (content.match(/§\s*\d+\s*(StGB|ZPO|StPO|AO|VwVfG)/)) {
    const statuteMatch = content.match(/§\s*\d+\s*(StGB|ZPO|StPO|AO|VwVfG)/);
    if (statuteMatch && statuteMatch[1]) {
      metadata.documentType = 'legal_code';
      metadata.statute = statuteMatch[1];
      metadata.title = `${this.getStatuteFullName(statuteMatch[1])} (${statuteMatch[1]})`;
      metadata.jurisdiction = 'DE';
    }
  }

  // Extract title from content if not set
  if (!metadata.title || metadata.title === originalName.replace(/\.[^/.]+$/, "")) {
    metadata.title = this.extractTitleFromContent(content);
  }

  return metadata;
};

// Extract BGB-specific title
exports.extractBGBTitle = (content) => {
  const lines = content.split('\n');
  for (const line of lines.slice(0, 10)) {
    const trimmed = line.trim();
    if (trimmed.includes('Bürgerliches Gesetzbuch') || 
        trimmed.includes('BGB')) {
      return trimmed;
    }
  }
  return 'Bürgerliches Gesetzbuch (BGB)';
};

// Extract year from text
exports.extractYearFromText = (content) => {
  const yearMatch = content.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
};

// Detect source of document
exports.detectSource = (content) => {
  if (content.includes('Bundesministerium') || 
      content.includes('gesetze-im-internet.de')) {
    return 'Federal Ministry of Justice (Germany)';
  }
  if (content.includes('Official Journal of the European Union')) {
    return 'European Union';
  }
  if (content.includes('BGBl.') || content.includes('Bundesgesetzblatt')) {
    return 'German Federal Law Gazette';
  }
  return 'Unknown';
};

// Check if official text
exports.isOfficialText = (content) => {
  return content.includes('Bundesgesetzblatt') ||
         content.includes('BGBl.') ||
         content.includes('Amtsblatt') ||
         content.includes('Official Journal');
};

// Extract statutes mentioned in text
exports.extractStatutesFromText = (content) => {
  const statutes = new Set();
  const statutePattern = /\b(BGB|HGB|GG|StGB|ZPO|StPO|AO|VwVfG|DSGVO|GDPR)\b/gi;
  let match;
  
  while ((match = statutePattern.exec(content)) !== null) {
    statutes.add(match[0].toUpperCase());
  }
  
  return Array.from(statutes);
};

// Extract legal topics
exports.extractLegalTopics = (content) => {
  const topics = new Set();
  const contentLower = content.toLowerCase();
  
  // German legal topics
  if (contentLower.includes('miete') || contentLower.includes('mieter')) {
    topics.add('Mietrecht');
  }
  if (contentLower.includes('kauf') || contentLower.includes('käufer')) {
    topics.add('Kaufrecht');
  }
  if (contentLower.includes('vertrag')) {
    topics.add('Vertragsrecht');
  }
  if (contentLower.includes('schaden') || contentLower.includes('haftung')) {
    topics.add('Schadensersatz');
  }
  if (contentLower.includes('urheber') || contentLower.includes('copyright')) {
    topics.add('Urheberrecht');
  }
  if (contentLower.includes('datenschutz') || contentLower.includes('gdpr')) {
    topics.add('Datenschutz');
  }
  if (contentLower.includes('handel') || contentLower.includes('kaufmann')) {
    topics.add('Handelsrecht');
  }
  if (contentLower.includes('straf') || contentLower.includes('strafbar')) {
    topics.add('Strafrecht');
  }
  if (contentLower.includes('verfassung') || contentLower.includes('grundrecht')) {
    topics.add('Verfassungsrecht');
  }
  
  return Array.from(topics);
};

// Extract title from content
exports.extractTitleFromContent = (content) => {
  const lines = content.split('\n').filter(line => line.trim().length > 10);
  
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    // Look for meaningful titles (not too long, not boilerplate)
    if (trimmed.length > 20 && trimmed.length < 200 && 
        /[A-ZÄÖÜ]/.test(trimmed[0]) &&
        !trimmed.includes('www.') &&
        !trimmed.includes('http') &&
        !trimmed.includes('Ein Service') &&
        !trimmed.includes('Service provided')) {
      return trimmed;
    }
  }
  
  return null;
};

// Get full name of statute
exports.getStatuteFullName = (abbreviation) => {
  const statuteMap = {
    'BGB': 'Bürgerliches Gesetzbuch',
    'HGB': 'Handelsgesetzbuch',
    'GG': 'Grundgesetz',
    'StGB': 'Strafgesetzbuch',
    'ZPO': 'Zivilprozessordnung',
    'StPO': 'Strafprozessordnung',
    'AO': 'Abgabenordnung',
    'VwVfG': 'Verwaltungsverfahrensgesetz',
    'DSGVO': 'Datenschutz-Grundverordnung',
    'GDPR': 'General Data Protection Regulation'
  };
  
  return statuteMap[abbreviation] || abbreviation;
};

// Extract page number from chunk
exports.extractPageNumber = (chunkContent, index, totalChunks) => {
  // Try to extract page number from content
  const pageMatch = chunkContent.match(/[Ss]eite\s*(\d+)/);
  if (pageMatch) {
    return parseInt(pageMatch[1]);
  }
  
  // Estimate page number based on position
  return Math.ceil((index + 1) / 5); // Assuming ~5 chunks per page
};

// Check if chunk contains legal citation
exports.containsLegalCitation = (chunkContent) => {
  return /(§\s*\d+[a-z]?|Artikel\s*\d+|Art\.\s*\d+)/.test(chunkContent);
};

// Check if chunk is statute text
exports.isStatuteText = (chunkContent, section) => {
  if (!section) return false;
  
  // Check if it starts with a legal citation
  return /^(§|Artikel|Art\.)/.test(section.trim());
};

// Count legal citations in text
exports.countLegalCitations = (content) => {
  const paragraphMatches = (content.match(/§\s*\d+[a-z]?/g) || []).length;
  const articleMatches = (content.match(/(Artikel|Art\.)\s*\d+/g) || []).length;
  return paragraphMatches + articleMatches;
};

// Original helper methods
exports.extractSectionFromChunk = (chunkContent) => {
  const sectionMatch = chunkContent.match(/^(§\s*\d+[a-z]?|Artikel\s*\d+|Art\.\s*\d+)/);
  return sectionMatch ? sectionMatch[0] : '';
};

exports.formatAsHTML = (text) => {
  return text
    .replace(/\n/g, '<br>')
    .replace(/§\s*(\d+[a-z]?)/g, '<strong>§$1</strong>')
    .replace(/Artikel\s*(\d+)/gi, '<strong>Artikel $1</strong>')
    .replace(/Art\.\s*(\d+)/gi, '<strong>Art. $1</strong>');
};

exports.formatAsMarkdown = (text) => {
  return text
    .replace(/§\s*(\d+[a-z]?)/g, '**§$1**')
    .replace(/Artikel\s*(\d+)/gi, '**Artikel $1**')
    .replace(/Art\.\s*(\d+)/gi, '**Art. $1**');
};

exports.extractPreview = (content, query, contextLength = 100) => {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  const queryIndex = lowerContent.indexOf(lowerQuery);
  
  if (queryIndex === -1) {
    return content.substring(0, contextLength) + '...';
  }
  
  const start = Math.max(0, queryIndex - contextLength / 2);
  const end = Math.min(content.length, queryIndex + query.length + contextLength / 2);
  
  let preview = content.substring(start, end);
  
  if (start > 0) {
    preview = '...' + preview;
  }
  
  if (end < content.length) {
    preview = preview + '...';
  }
  
  // Highlight query
  preview = preview.replace(new RegExp(query, 'gi'), match => `**${match}**`);
  
  return preview;
};

// Add a test endpoint to verify metadata extraction
exports.testMetadataExtraction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Test metadata extraction on existing content
    const metadata = this.extractEnhancedLegalMetadata(
      document.content || 'No content',
      document.originalName,
      document.filename
    );

    const statutes = this.extractStatutesFromText(document.content || '');
    const topics = this.extractLegalTopics(document.content || '');
    const citations = this.countLegalCitations(document.content || '');

    res.json({
      success: true,
      data: {
        filename: document.filename,
        originalName: document.originalName,
        extractedMetadata: metadata,
        detectedStatutes: statutes,
        legalTopics: topics,
        legalCitations: citations,
        currentMetadata: document.metadata || {}
      }
    });
  } catch (error) {
    next(error);
  }
};

// Reprocess documents with new metadata
exports.reprocessDocumentMetadata = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const document = await Document.findOne({
      _id: id,
      uploadedBy: userId,
      status: 'processed'
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Processed document not found'
      });
    }

    // Extract enhanced metadata
    const enhancedMetadata = this.extractEnhancedLegalMetadata(
      document.content,
      document.originalName,
      document.filename
    );

    // Update document with enhanced metadata
    document.metadata = {
      ...document.metadata,
      ...enhancedMetadata,
      statutes: this.extractStatutesFromText(document.content),
      legalTopics: this.extractLegalTopics(document.content)
    };

    await document.save();

    res.json({
      success: true,
      data: {
        documentId: document._id,
        filename: document.filename,
        updatedMetadata: document.metadata,
        message: 'Document metadata reprocessed successfully'
      }
    });
  } catch (error) {
    next(error);
  }
};