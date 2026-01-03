// server.js

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Load environment variables
dotenv.config();

console.log("🚀 Starting German Legal RAG Backend...");
console.log(`🌐 Environment: ${process.env.NODE_ENV}`);
console.log(`🔧 Port: ${process.env.PORT || 5000}`);

// Create necessary directories
const directories = ["./documents", "./chunks", "./embeddings", "./logs"];
directories.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files
app.use("/documents", express.static(path.join(__dirname, "documents")));

// Import services
let documentService, chatService, embeddingService;
try {
  documentService = require("./services/pdfDocumentService");
  chatService = require("./services/chatService");
  embeddingService = require("./services/embeddingService");
  console.log("✅ All services loaded");
} catch (error) {
  console.log("⚠️  Services not found:", error.message);
  documentService = null;
  chatService = null;
  embeddingService = null;
}

// ==================== RAG SYSTEM INITIALIZATION ====================
async function initializeRAGSystem() {
  try {
    console.log('\n🔨 Initializing RAG system...');
    
    // Get all documents
    const documents = documentService ? documentService.getAllDocuments() : [];
    console.log(`📚 Found ${documents.length} documents`);
    
    if (documents.length > 0 && embeddingService) {
      // Build TF-IDF index once with proper document format
      const allChunks = [];
      documents.forEach(doc => {
        if (doc.content) {
          // Create document objects for TF-IDF
          allChunks.push({
            content: doc.content || '',
            metadata: doc.metadata || {}
          });
        }
      });
      
      if (allChunks.length > 0) {
        await embeddingService.buildIndex(allChunks);
        const indexStatus = embeddingService.getIndexStatus();
        console.log(`✅ TF-IDF index built with ${indexStatus.documentsIndexed} documents`);
      } else {
        console.log('⚠️  No document content available for TF-IDF');
      }
    } else {
      console.log('⚠️  No documents or embedding service available');
    }
    
    console.log('🚀 RAG system ready');
  } catch (error) {
    console.error('❌ Failed to initialize RAG system:', error);
  }
}

// Call initialization AFTER services are loaded but BEFORE server starts listening
setTimeout(() => {
  if (documentService && embeddingService) {
    initializeRAGSystem();
  } else {
    console.log('⚠️  Skipping RAG initialization: services not available');
  }
}, 2000); // 2 second delay to ensure all services are loaded

// ==================== ROUTES ====================

// Health check
app.get("/api/health", async (req, res) => {
  const docs = documentService ? documentService.getAllDocuments() : [];
  const indexStatus = embeddingService ? embeddingService.getIndexStatus() : null;
  
  // Get system health from chat service if available
  let systemHealth = {};
  if (chatService && typeof chatService.healthCheck === 'function') {
    try {
      systemHealth = await chatService.healthCheck();
    } catch (error) {
      systemHealth = { status: 'unknown', error: error.message };
    }
  }

  res.json({
    status: "OK",
    service: "German Legal RAG Backend",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: process.env.PORT || 5000,
    system: systemHealth,
    documents: {
      count: docs.length,
      loaded: !!documentService,
    },
    embeddings: indexStatus ? {
      indexBuilt: indexStatus.isIndexBuilt,
      documentsIndexed: indexStatus.documentsIndexed,
      indexSize: indexStatus.indexSize
    } : null,
  });
});

// List all documents
app.get("/api/documents", (req, res) => {
  if (!documentService) {
    return res.json({
      success: true,
      data: {
        documents: [],
        count: 0,
        message: "Document service not loaded",
      },
    });
  }

  const documents = documentService.getAllDocuments();

  res.json({
    success: true,
    data: {
      documents: documents,
      count: documents.length,
      message: `Found ${documents.length} German legal documents`,
    },
  });
});

// Get specific document content
app.get("/api/documents/:filename", (req, res) => {
  const { filename } = req.params;

  if (!documentService) {
    return res.status(404).json({
      success: false,
      error: "Document service not available",
    });
  }

  const content = documentService.getDocumentContent(filename);

  if (!content) {
    return res.status(404).json({
      success: false,
      error: "Document not found",
    });
  }

  res.json({
    success: true,
    data: {
      filename: filename,
      content: content,
      length: content.length,
      wordCount: content.split(/\s+/).length,
    },
  });
});

// Search in documents
app.post("/api/documents/search", (req, res) => {
  const { query, limit = 5 } = req.body;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Search query is required",
    });
  }

  if (!documentService) {
    return res.json({
      success: true,
      data: {
        results: [],
        count: 0,
        message: "Document service not loaded",
      },
    });
  }

  try {
    const results = documentService.searchDocuments(query, { limit });

    res.json({
      success: true,
      data: {
        results: results,
        count: results.length,
        query: query,
        message: `Found ${results.length} relevant results`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Search failed",
      details: error.message,
    });
  }
});

// Chat endpoint - ask questions about documents
app.post("/api/chat/query", async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({
      success: false,
      error: "Question is required",
    });
  }

  if (!chatService || !documentService) {
    return res.json({
      success: true,
      data: {
        answer: `The RAG system would search through German legal documents to answer: "${question}"`,
        sources: [],
        confidence: 0.5,
        conversationId: "mock-" + Date.now(),
        metadata: {
          documentsUsed: 0,
          processingTime: "instant",
          language: "german",
        },
      },
    });
  }

  try {
    const response = await chatService.processQuestion(question);

    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to process question",
      details: error.message,
    });
  }
});

// Get chat history
app.get("/api/chat/history", (req, res) => {
  if (!chatService) {
    return res.json({
      success: true,
      data: {
        conversations: [],
        count: 0,
        message: "Chat service not loaded",
      },
    });
  }

  const limit = parseInt(req.query.limit) || 10;
  const history = chatService.getConversationHistory(limit);

  res.json({
    success: true,
    data: {
      conversations: history,
      count: history.length,
      totalHistory: chatService.conversationHistory.length,
    },
  });
});

// Get statistics
app.get("/api/stats", (req, res) => {
  if (!chatService || !documentService) {
    return res.json({
      success: true,
      data: {
        message: "Services not loaded",
      },
    });
  }

  const stats = chatService.getStats();

  res.json({
    success: true,
    data: {
      statistics: stats,
      timestamp: new Date().toISOString(),
    },
  });
});

// Simple file upload endpoint
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "documents/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

app.post("/api/documents/upload", upload.single("document"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "No file uploaded",
    });
  }

  res.json({
    success: true,
    data: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: req.file.path,
      message: "Document uploaded. Restart server to load it.",
    },
  });
});

// RAG system status endpoint
app.get("/api/rag/status", (req, res) => {
  if (!embeddingService) {
    return res.json({
      success: false,
      error: "Embedding service not available",
    });
  }

  const indexStatus = embeddingService.getIndexStatus();
  
  res.json({
    success: true,
    data: {
      indexBuilt: indexStatus.isIndexBuilt,
      documentsIndexed: indexStatus.documentsIndexed,
      indexSize: indexStatus.indexSize,
      timestamp: new Date().toISOString(),
      message: indexStatus.isIndexBuilt 
        ? "RAG system is fully initialized" 
        : "RAG system is initializing..."
    }
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  const docs = documentService ? documentService.getAllDocuments() : [];
  const indexStatus = embeddingService ? embeddingService.getIndexStatus() : null;

  res.json({
    success: true,
    message: "German Legal RAG Backend is working! 🎉",
    version: "2.0.0",
    data: {
      service: "German Legal RAG System",
      features: [
        "Document upload and storage",
        "German legal text processing",
        "Semantic search in documents",
        "Question answering with citations",
        "Conversation history",
        "TF-IDF based embeddings",
        "Legal domain routing",
        "Safety checks and validation"
      ],
      currentStatus: {
        documentsLoaded: docs.length,
        tfidfIndexBuilt: indexStatus ? indexStatus.isIndexBuilt : false,
        servicesActive: !!documentService && !!chatService && !!embeddingService,
        environment: process.env.NODE_ENV,
      },
      endpoints: {
        "GET /api/health": "Health check with system status",
        "GET /api/documents": "List all documents",
        "GET /api/documents/:filename": "Get document content",
        "POST /api/documents/search": "Search in documents",
        "POST /api/chat/query": "Ask questions about documents",
        "GET /api/chat/history": "Get conversation history",
        "GET /api/stats": "Get statistics",
        "POST /api/documents/upload": "Upload new document",
        "GET /api/rag/status": "RAG system status",
      },
    },
  });
});

// Test RAG questions endpoint
app.get("/api/test/rag", async (req, res) => {
  if (!chatService || !documentService) {
    return res.status(500).json({
      success: false,
      error: "Services not available",
    });
  }

  const testQuestions = [
    "§433 BGB Kaufvertrag",
    "Strafe bei Diebstahl",
    "Grundrecht Religionsfreiheit",
    "Handelsregister Eintragung",
    "Was ist das Wetter?"
  ];

  const results = [];

  for (const question of testQuestions) {
    try {
      const response = await chatService.processQuestion(question);
      results.push({
        question,
        success: response.success,
        statute: response.data?.statute || response.data?.legalDomain || 'unknown',
        confidence: response.data?.confidence,
        hasCitations: response.data?.sources && response.data.sources.length > 0,
        safetyScore: response.data?.safetyCheck?.score || 0
      });
    } catch (error) {
      results.push({
        question,
        success: false,
        error: error.message
      });
    }
  }

  res.json({
    success: true,
    data: {
      testResults: results,
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        passed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    }
  });
});

// Main endpoint
app.get("/", (req, res) => {
  const docs = documentService ? documentService.getAllDocuments() : [];
  const indexStatus = embeddingService ? embeddingService.getIndexStatus() : null;

  res.json({
    message: "Welcome to German Legal RAG Backend",
    version: "2.0.0",
    status: "running",
    system: {
      documents: {
        count: docs.length,
        types: docs.reduce((types, doc) => {
          const type = doc.type || doc.metadata?.documentType || 'unknown';
          types[type] = (types[type] || 0) + 1;
          return types;
        }, {}),
      },
      embeddings: indexStatus ? {
        indexBuilt: indexStatus.isIndexBuilt,
        ready: indexStatus.isIndexBuilt
      } : { ready: false }
    },
    quickLinks: {
      health: "/api/health",
      documents: "/api/documents",
      test: "/api/test",
      ragStatus: "/api/rag/status",
      ragTest: "/api/test/rag",
      chatExample: 'curl -X POST http://localhost:5000/api/chat/query -H "Content-Type: application/json" -d \'{"question": "What is human dignity?"}\'',
    },
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
🚀 Server running on port ${PORT}
🔗 http://localhost:${PORT}
💚 Health: http://localhost:${PORT}/api/health
🧪 Test: http://localhost:${PORT}/api/test
📚 Documents: http://localhost:${PORT}/api/documents
🤖 RAG Status: http://localhost:${PORT}/api/rag/status

📖 German Legal RAG Backend Ready!
===================================`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down...");
  process.exit(0);
});