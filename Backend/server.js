// server.js
process.on('uncaughtException', err => console.error('UNCAUGHT:', err.message, err.stack));
process.on('unhandledRejection', err => console.error('UNHANDLED:', err?.message, err?.stack));

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const pdfDocumentService = require("./services/ingestion/pdfDocumentService");
// Load environment variables
dotenv.config();

// Connect to MongoDB
const { connectDB } = require("./config/db");
connectDB();

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

// Security: HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.PYTHON_SERVICE_URL || "http://localhost:8000"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Security: CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Language", "X-Session-ID"],
}));

// Security: Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.AUTH_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_RATE_LIMIT_MAX) : 500,
  message: { error: "Too many auth attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || "";
    return process.env.NODE_ENV !== "production" &&
      (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1");
  },
});
app.use("/api/", generalLimiter);
app.use("/api/auth/", authLimiter);

// Body parsing with safe limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb", parameterLimit: 100 }));

// Security: Sanitize MongoDB query operators from request body
// (req.query is read-only in newer Node.js, so only sanitize body)
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = mongoSanitize.sanitize(req.body, { replaceWith: '_' });
  }
  next();
});

// Serve static files
app.use("/documents", express.static(path.join(__dirname, "documents")));

// Import services through the centralized registry
const services = require("./services/index");
console.log("✅ All services loaded through service registry");

// Create convenient aliases for commonly used services
const documentService = services.ingestion.pdfDocumentService;
const chatService = services.orchestration.chatService;

// ==================== RAG SYSTEM INITIALIZATION ====================
async function initializeRAGSystem() {
  try {
    console.log('\n🔨 Initializing RAG system...');
    
    // ✅ NEW: Load and parse PDF documents
    await documentService.loadDocuments();
    
    // Get all documents
    const documents = documentService.getAllDocuments();
    console.log(`📚 Found ${documents.length} parsed documents`);
    
    if (documents.length > 0) {
      console.log(`✅ PDF parsing complete. TF-IDF ready for lexical precision.`);
      
      // Document statistics
      const statuteCounts = {};
      documents.forEach(doc => {
        const statute = doc.metadata?.statute || 'UNKNOWN';
        statuteCounts[statute] = (statuteCounts[statute] || 0) + 1;
      });
      
      console.log('📊 Statute distribution:');
      Object.entries(statuteCounts).forEach(([statute, count]) => {
        console.log(`  ${statute}: ${count} documents`);
      });
      
      // Check for content
      const documentsWithContent = documents.filter(doc => 
        doc.content && doc.content.length > 100
      );
      console.log(`📝 ${documentsWithContent.length} documents have substantial content`);
      
    } else {
      console.log('⚠️  No documents available for RAG initialization');
      console.log('📁 Please place PDF files in the /documents folder');
    }
    
    console.log('🚀 RAG system ready (Node-owned text, TF-IDF enhanced)');
  } catch (error) {
    console.error('❌ Failed to initialize RAG system:', error);
  }
}

// Call initialization
setTimeout(() => {
  initializeRAGSystem();
}, 1000);

// ==================== ROUTES ====================

// Auth routes
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// Token middleware
const { authenticate, checkTokens, deductTokens } = require("./middleware/tokenMiddleware");

// Health check
app.get("/api/health", async (req, res) => {
  const docs = documentService.getAllDocuments();
  
  // Get system health from chat service
  let systemHealth = {};
  try {
    systemHealth = await chatService.healthCheck();
  } catch (error) {
    systemHealth = { status: 'unknown', error: error.message };
  }

  res.json({
    status: "OK",
    service: "German Legal RAG Backend",
    version: "2.1.0", // ✅ UPDATED VERSION
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: process.env.PORT || 5000,
    system: systemHealth,
    documents: {
      count: docs.length,
      loaded: docs.length > 0,
      parsed: docs.filter(d => d.content).length,
      statutes: [...new Set(docs.map(d => d.metadata?.statute).filter(Boolean))],
      totalContent: docs.reduce((sum, d) => sum + (d.content?.length || 0), 0)
    },
    features: {
      pdf_parsing: true,
      tfidf_reranking: true,
      python_authority: true,
      doctrine_enforcement: true,
      paragraph_anchoring: false // Will be added next
    },
    services: {
      ingestion: Object.keys(services.ingestion),
      retrieval: Object.keys(services.retrieval),
      validation: Object.keys(services.validation),
      orchestration: Object.keys(services.orchestration)
    }
  });
});

// List all documents
app.get("/api/documents", (req, res) => {
  const documents = documentService.getAllDocuments();
  
  const enhancedDocs = documents.map(doc => ({
    filename: doc.filename,
    statute: doc.metadata?.statute || "UNKNOWN",
    contentLength: doc.content?.length || 0,
    chunkCount: doc.chunks?.length || 0,
    metadata: doc.metadata,
    hasContent: !!(doc.content && doc.content.length > 100)
  }));

  res.json({
    success: true,
    data: {
      documents: enhancedDocs,
      count: documents.length,
      message: `Found ${documents.length} German legal documents (parsed: ${documents.filter(d => d.content).length})`,
    },
  });
});

// Get specific document content
app.get("/api/documents/:filename", (req, res) => {
  const { filename } = req.params;

  const doc = documentService.getAllDocuments().find(d => 
    d.filename === filename || d.id === filename
  );

  if (!doc) {
    return res.status(404).json({
      success: false,
      error: "Document not found",
    });
  }

  res.json({
    success: true,
    data: {
      filename: doc.filename,
      content: doc.content,
      length: doc.content?.length || 0,
      wordCount: doc.content?.split(/\s+/).length || 0,
      chunks: doc.chunks?.length || 0,
      statute: doc.metadata?.statute,
      metadata: doc.metadata
    },
  });
});

// Search in documents
app.post("/api/documents/search", (req, res) => {
  const { query, limit = 5, statute = null } = req.body;

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Search query is required",
    });
  }

  try {
    const results = documentService.searchDocuments(query, { limit, statute });

    res.json({
      success: true,
      data: {
        results: results,
        count: results.length,
        query: query,
        statute: statute,
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
app.post("/api/chat/query", authenticate, checkTokens, async (req, res) => {
  const { question } = req.body;
  const lang = req.headers['x-language'] || 'de';

  if (!question) {
    return res.status(400).json({
      success: false,
      error: "Question is required",
    });
  }

  // Hard wall covers processQuestion + quality-gate DeepSeek fallback combined.
  // processQuestion has internal 18s synthesis caps; quality gate gets 7s.
  // Total budget: 28s → always responds before any client 30s timeout.
  const _deadline = Date.now() + 28000;
  const _withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);

  try {
    let response = await _withTimeout(
      chatService.processQuestion(question, { language: lang }),
      26000,
      'processQuestion'
    );

    // ── Quality gate ────────────────────────────────────────────────────────────
    // Runs here (after processQuestion) so it catches EVERY exit path, including
    // early clarification returns that bypass STEP 15 inside chatService.
    // Budget: whatever remains before the 28s deadline, capped at 7s.
    const _gateMs = Math.min(7000, Math.max(1000, _deadline - Date.now()));
    if (response.success && process.env.DEEPSEEK_API_KEY) {
      const answerText = response.data?.answer || '';
      const isClarification = !!response.data?.clarification_required;

      const isTableOfContents = (text) => {
        if (!text) return false;
        const tocPattern = /§\s*\d+\s*\n\s*§\s*\d+\s*\n\s*§\s*\d+/;
        const shortContent = text.length < 300;
        const manyParagraphRefs = (text.match(/§\s*\d+/g) || []).length > 5;
        const noSentences = !text.match(/[.!?]\s+[A-ZÄÖÜ]/);
        return tocPattern.test(text) || (manyParagraphRefs && noSentences && shortContent);
      };

      const THEORY_TERMS = [
        'kausalität','zurechenbarkeit','objektive zurechnung',
        'materielle rechtswidrigkeit','formelle rechtswidrigkeit',
        'begehungsdelikt','unterlassungsdelikt','garantenstellung',
        'tatbestandsirrtum','verbotsirrtum','schuldprinzip',
        'strafzweck','generalprävention','spezialprävention',
        'subsumtion','gutachtenstil','fallprüfung',
      ];
      const isPureTheory = THEORY_TERMS.some(t => question.toLowerCase().includes(t));

      const isWrongParagraph = (() => {
        const text = answerText.toLowerCase();
        const hasTheoryTerm = THEORY_TERMS.some(t => question.toLowerCase().includes(t));
        const answerMentionsTerm = THEORY_TERMS.some(t => text.includes(t));
        return hasTheoryTerm && !answerMentionsTerm;
      })();

      const answerConfidence = response.data?.confidence ?? 1;
      const _isTOC = isTableOfContents(answerText);
      const _lowConf = answerConfidence < 0.3 && answerText.length < 400;
      const isLowQuality =
        isClarification ||
        _isTOC ||
        _lowConf ||
        isPureTheory ||
        isWrongParagraph;

      console.log('[Quality]', {
        isTOC: _isTOC,
        isPureTheory,
        isWrongParagraph,
        isClarification,
        needsFallback: isLowQuality,
        confidence: answerConfidence,
        length: answerText.length,
      });

      if (isLowQuality) {
        try {
          console.log('[Doctrine Fallback] Triggering DeepSeek for question:', question.substring(0, 60));
          const fallbackRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              max_tokens: 800,
              messages: [
                {
                  role: 'system',
                  content: 'Du bist ein deutscher Rechtsdozent. Beantworte die Frage präzise auf Deutsch. ' +
                    'Strukturiere die Antwort mit: Definition, Bedeutung, Prüfungsschema. ' +
                    'Zitiere relevante Paragraphen wo möglich. Max 400 Wörter.'
                },
                { role: 'user', content: question }
              ]
            }),
            signal: AbortSignal.timeout(_gateMs)
          });
          const fallbackData = await fallbackRes.json();
          const fallbackAnswer = fallbackData.choices?.[0]?.message?.content;
          if (fallbackAnswer && fallbackAnswer.length > 100) {
            console.log('[Doctrine Fallback] Answer received, length:', fallbackAnswer.length);
            const disclaimer = '\n\n---\n*⚠️ Diese Antwort basiert auf allgemeinem Rechtswissen, nicht auf einem spezifischen Gesetzestext aus unserem Korpus.*';
            response = {
              success: true,
              data: {
                answer: fallbackAnswer + disclaimer,
                confidence: 0.7,
                statute: null,
                sources: [],
                metadata: { doctrine_fallback: true, comparison_mode: false }
              }
            };
          }
        } catch (err) {
          console.error('[Doctrine Fallback] DeepSeek failed:', err.message);
          // Keep original response — better than nothing
        }
      }
    }
    // ───────────────────────────────────────────────────────────────────────────

    if (response.success) {
      console.log('[SERVER] Sending response | answer length:', response.data?.answer?.length ?? 'NO ANSWER', '| comparison_mode:', !!response.data?.metadata?.comparison_mode);
      // Deduct tokens after successful response (fire-and-forget, skip if DB unavailable)
      if (req.user) {
        deductTokens(req.user, req._tokenCost || 1, {
          statute: response.data?.statute || null,
          doctrineLevel: response.data?.doctrineLevel || null,
          aiUsed: response.data?.aiUsed || false,
          crossStatute: response.data?.crossStatute || false,
        });
      }
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
    // Sanitize filename: allow only safe characters
    const safeExt = path.extname(file.originalname).replace(/[^.a-zA-Z0-9]/g, "");
    cb(null, file.fieldname + "-" + uniqueSuffix + safeExt);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 1,
    fields: 10,
    fieldSize: 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"), false);
    }
    cb(null, true);
  },
});

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
  const documents = documentService.getAllDocuments();
  
  const status = {
    pdfParsing: {
      enabled: true,
      documentsParsed: documents.filter(d => d.content).length,
      totalDocuments: documents.length
    },
    tfidf: {
      enabled: true,
      library: "natural",
      status: "ready"
    },
    pythonIntegration: {
      enabled: true,
      service: process.env.PYTHON_SERVICE_URL || "http://localhost:8000"
    },
    doctrineEnforcement: {
      enabled: true,
      statutes: ["BGB", "StGB", "GG", "HGB", "EU-GDPR"],
      excludedStatutes: ["BDSG", "Entgeltfortzahlungsgesetz"]
    }
  };
  
  res.json({
    success: true,
    data: status,
    timestamp: new Date().toISOString(),
    message: "RAG system is fully initialized with PDF parsing and TF-IDF"
  });
});

// Test PDF parsing endpoint
app.get("/api/test/pdf", (req, res) => {
  const documents = documentService.getAllDocuments();
  
  const testResults = documents.slice(0, 3).map(doc => ({
    filename: doc.filename,
    statute: doc.metadata?.statute || "UNKNOWN",
    contentPreview: doc.content?.substring(0, 200) + "...",
    contentLength: doc.content?.length || 0,
    chunkCount: doc.chunks?.length || 0,
    paragraphs: doc.metadata?.detectedParagraphs?.slice(0, 5) || [],
    hasNormParagraphs: doc.chunks?.some(chunk => 
      chunk.metadata?.isNormParagraph
    ) || false
  }));
  
  res.json({
    success: true,
    data: {
      testResults,
      summary: {
        totalDocuments: documents.length,
        hasContent: documents.filter(d => d.content).length,
        avgContentLength: documents.reduce((sum, d) => sum + (d.content?.length || 0), 0) / Math.max(1, documents.length),
        statutesFound: [...new Set(documents.map(d => d.metadata?.statute).filter(Boolean))]
      }
    }
  });
});

// Test endpoint

app.get("/api/test", (req, res) => {
  const docs = documentService.getAllDocuments();

  res.json({
    success: true,
    message: "German Legal RAG Backend is working! 🎉",
    version: "2.1.0",
    data: {
      service: "German Legal RAG System",
      features: [
        "PDF text extraction (Node-owned)",
        "German legal text processing",
        "Semantic search via Python",
        "TF-IDF lexical precision",
        "Question answering with citations",
        "Doctrine enforcement gates",
        "Legal domain routing",
        "Safety checks and validation"
      ],
      currentStatus: {
        documentsLoaded: docs.length,
        documentsParsed: docs.filter(d => d.content).length,
        pdfParsing: true,
        tfidfReady: true,
        environment: process.env.NODE_ENV,
      },
      architecture: {
        principle: "Epistemic separation",
        nodeResponsibility: "Textual truth, TF-IDF, doctrine gates",
        pythonResponsibility: "Semantic meaning, authority resolution",
        doctrineEnforcement: "Pre-retrieval gates, domain anchoring"
      },
      endpoints: {
        "GET /api/health": "Health check with system status",
        "GET /api/documents": "List all parsed documents",
        "GET /api/documents/:filename": "Get document content",
        "POST /api/documents/search": "Search in documents",
        "POST /api/chat/query": "Ask questions about documents",
        "GET /api/chat/history": "Get conversation history",
        "GET /api/stats": "Get statistics",
        "POST /api/documents/upload": "Upload new document",
        "GET /api/rag/status": "RAG system status",
        "GET /api/test/pdf": "Test PDF parsing results",
      },
    },
  });
});

// Service details endpoint
app.get("/api/services", (req, res) => {
  const serviceDetails = {};

  Object.entries(services).forEach(([groupName, group]) => {
    serviceDetails[groupName] = {};
    Object.entries(group).forEach(([serviceName, service]) => {
      serviceDetails[groupName][serviceName] = {
        type: typeof service,
        hasHealthCheck: typeof service.healthCheck === 'function',
        methods: Object.getOwnPropertyNames(service.constructor.prototype).filter(
          name => name !== 'constructor'
        )
      };
    });
  });

  res.json({
    success: true,
    data: {
      services: serviceDetails,
      timestamp: new Date().toISOString()
    }
  });
});

// Main endpoint
app.get("/", (req, res) => {
  const docs = documentService.getAllDocuments();

  res.json({
    message: "Welcome to German Legal RAG Backend",
    version: "2.1.0",
    status: "running",
    system: {
      documents: {
        count: docs.length,
        parsed: docs.filter(d => d.content).length,
        statutes: docs.reduce((statutes, doc) => {
          const statute = doc.metadata?.statute || 'UNKNOWN';
          statutes[statute] = (statutes[statute] || 0) + 1;
          return statutes;
        }, {}),
      },
      features: {
        pdf_parsing: "active",
        tfidf_reranking: "ready",
        python_authority: "integrated",
        doctrine_gates: "enabled"
      },
      serviceGroups: Object.keys(services).length
    },
    quickLinks: {
      health: "/api/health",
      documents: "/api/documents",
      services: "/api/services",
      test: "/api/test",
      ragStatus: "/api/rag/status",
      pdfTest: "/api/test/pdf",
      chatExample: 'curl -X POST http://localhost:5000/api/chat/query -H "Content-Type: application/json" -d \'{"question": "Was ist Eigentum gemäß BGB?"}\'',
    },
  });
});

// Error handler for multer and general errors
app.use((err, req, res, next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, error: "File too large. Maximum 50MB allowed." });
  }
  if (err && err.message === "Only PDF files are allowed") {
    return res.status(400).json({ success: false, error: err.message });
  }
  next(err);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
🚀 Server running on port ${PORT}
🔗 http://localhost:${PORT}
💚 Health: http://localhost:${PORT}/api/health
🧪 Test: http://localhost:${PORT}/api/test
📚 Documents: http://localhost:${PORT}/api/documents
⚙️  Services: http://localhost:${PORT}/api/services
🤖 RAG Status: http://localhost:${PORT}/api/rag/status
📄 PDF Test: http://localhost:${PORT}/api/test/pdf

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