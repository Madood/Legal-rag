const express = require("express");
const router = express.Router();

// Mock auth middleware
const mockAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Authentication required",
    });
  }
  
  // Add mock user to request
  req.user = {
    id: "mock-user-1",
    username: "testuser",
    email: "test@example.com",
  };
  
  next();
};

router.use(mockAuth);

// Process query
router.post("/query", (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: "Question is required",
      });
    }

    // Mock RAG response
    const mockResponse = {
      answer: `Based on German legal documents, here's what I found regarding "${question}":\n\nIn German law, particularly in the Basic Law (Grundgesetz), there are provisions that address various legal principles. The specific answer would depend on which documents have been uploaded and processed.\n\nFor a detailed answer, please upload German legal documents first.`,
      citations: [
        {
          documentId: "mock-doc-1",
          documentName: "Basic Law Excerpt.pdf",
          content: "Human dignity shall be inviolable. To respect and protect it shall be the duty of all state authority.",
          similarity: 0.85,
        },
      ],
      confidence: 0.78,
    };

    res.json({
      success: true,
      data: mockResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to process query",
    });
  }
});

// Get chat history
router.get("/history", (req, res) => {
  const mockHistory = [
    {
      id: "chat-1",
      title: "Question about German law",
      messages: [
        {
          role: "user",
          content: "What is human dignity in German law?",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          role: "assistant",
          content: "Human dignity is protected under Article 1 of the German Basic Law...",
          timestamp: new Date().toISOString(),
        },
      ],
    },
  ];

  res.json({
    success: true,
    data: {
      chats: mockHistory,
      count: mockHistory.length,
    },
  });
});

module.exports = router;