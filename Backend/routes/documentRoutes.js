const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Mock auth middleware
const mockAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }
  
  req.user = {
    id: "mock-user-1",
    username: "testuser",
  };
  
  next();
};

router.use(mockAuth);

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./documents";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  },
});

// Upload document
router.post("/upload", upload.single("document"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    res.json({
      success: true,
      data: {
        document: {
          id: "mock-doc-" + Date.now(),
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          fileType: path.extname(req.file.originalname).slice(1),
          status: "uploaded",
          uploadedAt: new Date().toISOString(),
        },
        message: "Document uploaded successfully",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Upload failed: " + error.message,
    });
  }
});

// Get all documents
router.get("/", (req, res) => {
  const mockDocuments = [
    {
      id: "mock-doc-1",
      filename: "Basic Law Excerpt.pdf",
      originalName: "grundgesetz.pdf",
      size: 102400,
      fileType: "pdf",
      status: "processed",
      uploadedAt: new Date(Date.now() - 86400000).toISOString(),
      metadata: {
        title: "German Basic Law Excerpt",
        documentType: "constitution",
        language: "german",
      },
    },
    {
      id: "mock-doc-2",
      filename: "Civil Code Section.pdf",
      originalName: "bgb.pdf",
      size: 204800,
      fileType: "pdf",
      status: "uploaded",
      uploadedAt: new Date().toISOString(),
    },
  ];

  res.json({
    success: true,
    data: {
      documents: mockDocuments,
      count: mockDocuments.length,
    },
  });
});

// Process document
router.post("/:id/process", (req, res) => {
  const { id } = req.params;

  res.json({
    success: true,
    data: {
      documentId: id,
      status: "processing",
      message: "Document processing started (mock)",
      estimatedTime: "30 seconds",
    },
  });
});

module.exports = router;
