const Document = require('../models/Document');
const Chat = require('../models/Chat');
const ragService = require('../services/ragService');

// Process user query and generate RAG response
exports.processQuery = async (req, res, next) => {
  try {
    const { question, documentIds, chatId, language = 'german' } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!question || question.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Question is required' 
      });
    }

    // Trim and clean question
    const cleanQuestion = question.trim();

    // Determine which documents to search in
    let searchDocuments;
    if (documentIds && documentIds.length > 0) {
      searchDocuments = await Document.find({
        _id: { $in: documentIds },
        uploadedBy: userId,
        status: 'processed'
      });
    } else {
      // Search in all user's processed documents
      searchDocuments = await Document.find({ 
        uploadedBy: userId, 
        status: 'processed' 
      });
    }

    if (searchDocuments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No processed documents available. Please upload and process documents first.'
      });
    }

    // Generate RAG response
    const response = await ragService.generateResponse(
      cleanQuestion, 
      searchDocuments,
      {
        language: language,
        similarityThreshold: process.env.SIMILARITY_THRESHOLD || 0.7,
        maxCitations: process.env.MAX_CITATIONS || 5
      }
    );

    // Save to chat history
    let chat;
    if (chatId) {
      // Find existing chat
      chat = await Chat.findOne({
        chatId: chatId,
        userId: userId
      });

      if (chat) {
        await chat.addMessage({
          role: 'user',
          content: cleanQuestion,
          question: cleanQuestion,
          timestamp: new Date()
        });

        await chat.addMessage({
          role: 'assistant',
          content: response.answer,
          answer: response.answer,
          citations: response.citations,
          metadata: {
            processingTime: response.metadata.processingTime,
            confidence: response.metadata.confidence,
            model: 'RAG-German-Legal'
          },
          timestamp: new Date()
        });

        // Update chat context with used documents
        const usedDocumentIds = [...new Set(response.citations.map(c => c.documentId))];
        chat.context.documents = [...new Set([...chat.context.documents, ...usedDocumentIds])];
        await chat.save();
      }
    }

    // If no chatId or chat not found, create new chat
    if (!chat) {
      chat = await Chat.create({
        userId: userId,
        title: cleanQuestion.substring(0, 50) + (cleanQuestion.length > 50 ? '...' : ''),
        messages: [
          {
            role: 'user',
            content: cleanQuestion,
            question: cleanQuestion,
            timestamp: new Date()
          },
          {
            role: 'assistant',
            content: response.answer,
            answer: response.answer,
            citations: response.citations,
            metadata: {
              processingTime: response.metadata.processingTime,
              confidence: response.metadata.confidence,
              model: 'RAG-German-Legal'
            },
            timestamp: new Date()
          }
        ],
        context: {
          documents: [...new Set(response.citations.map(c => c.documentId))],
          language: language,
          legalDomain: 'general',
          searchParameters: {
            similarityThreshold: process.env.SIMILARITY_THRESHOLD || 0.7,
            maxCitations: process.env.MAX_CITATIONS || 5
          }
        }
      });
    }

    // Prepare response
    const responseData = {
      answer: response.answer,
      citations: response.citations,
      chatId: chat.chatId,
      messageId: chat.messages[chat.messages.length - 1].messageId,
      metadata: {
        ...response.metadata,
        language: language,
        chatTitle: chat.title
      }
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error processing query:', error);
    next(error);
  }
};

// Stream response for real-time updates
exports.streamResponse = async (req, res, next) => {
  try {
    const { question, documentIds, language = 'german' } = req.body;
    const userId = req.user._id;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Question is required' 
      });
    }

    // Determine which documents to search in
    let searchDocuments;
    if (documentIds && documentIds.length > 0) {
      searchDocuments = await Document.find({
        _id: { $in: documentIds },
        uploadedBy: userId,
        status: 'processed'
      });
    } else {
      searchDocuments = await Document.find({ 
        uploadedBy: userId, 
        status: 'processed' 
      });
    }

    if (searchDocuments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No processed documents available'
      });
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Start stream
    sendEvent({ 
      type: 'start', 
      timestamp: new Date().toISOString(),
      question: question
    });

    // Create new chat for this stream
    const chat = await Chat.create({
      userId: userId,
      title: question.substring(0, 50) + (question.length > 50 ? '...' : ''),
      messages: [{
        role: 'user',
        content: question,
        question: question,
        timestamp: new Date()
      }],
      context: {
        language: language,
        legalDomain: 'general'
      }
    });

    // Generate and stream response
    const streamGenerator = ragService.streamResponse(
      question,
      searchDocuments,
      { language: language }
    );

    let fullAnswer = '';
    let citations = [];
    let metadata = {};

    try {
      for await (const event of streamGenerator) {
        switch (event.type) {
          case 'token':
            fullAnswer += event.token;
            sendEvent({
              type: 'token',
              token: event.token,
              progress: event.progress,
              chatId: chat.chatId
            });
            break;

          case 'citations':
            citations = event.citations;
            sendEvent({
              type: 'citations',
              citations: event.citations,
              chatId: chat.chatId
            });
            break;

          case 'metadata':
            metadata = event.metadata;
            break;

          case 'error':
            sendEvent({
              type: 'error',
              error: event.error,
              timestamp: event.timestamp
            });
            res.end();
            return;

          case 'end':
            // Save assistant message to chat
            await chat.addMessage({
              role: 'assistant',
              content: fullAnswer,
              answer: fullAnswer,
              citations: citations,
              metadata: {
                processingTime: metadata.processingTime || 0,
                confidence: metadata.confidence || 0,
                model: 'RAG-German-Legal'
              },
              timestamp: new Date()
            });

            // Update chat context with used documents
            const usedDocumentIds = [...new Set(citations.map(c => c.documentId))];
            chat.context.documents = [...new Set([...chat.context.documents, ...usedDocumentIds])];
            await chat.save();

            sendEvent({
              type: 'end',
              timestamp: event.timestamp,
              chatId: chat.chatId,
              messageId: chat.messages[chat.messages.length - 1].messageId,
              metadata: metadata
            });
            break;
        }
      }
    } catch (streamError) {
      sendEvent({
        type: 'error',
        error: 'Stream processing failed',
        details: streamError.message,
        timestamp: new Date().toISOString()
      });
    }

    res.end();

  } catch (error) {
    console.error('Error streaming response:', error);
    
    // Try to send error via SSE before ending
    try {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Stream initialization failed',
        details: error.message,
        timestamp: new Date().toISOString()
      })}\n\n`);
    } catch (e) {
      // Ignore if connection is already closed
    }
    
    res.end();
  }
};

// Get chat history for user
exports.getChatHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { 
      page = 1, 
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get chats with pagination
    const chats = await Chat.find({ 
      userId: userId,
      'settings.isActive': true 
    })
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .select('-messages') // Don't include full messages in list
    .lean();

    // Add virtual fields
    const enhancedChats = chats.map(chat => ({
      ...chat,
      messageCount: chat.messages?.length || 0,
      lastMessage: chat.messages?.length > 0 ? chat.messages[chat.messages.length - 1] : null,
      documentCount: chat.context?.documents?.length || 0
    }));

    const total = await Chat.countDocuments({ 
      userId: userId,
      'settings.isActive': true 
    });

    res.json({
      success: true,
      data: {
        chats: enhancedChats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get specific chat session with messages
exports.getChatSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({
      chatId: id,
      userId: userId
    }).lean();

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }

    // Update last activity
    await Chat.updateOne(
      { chatId: id },
      { $set: { 'stats.lastActivity': new Date() } }
    );

    // Enhance chat data
    const enhancedChat = {
      ...chat,
      messageCount: chat.messages?.length || 0,
      userMessages: chat.messages?.filter(msg => msg.role === 'user') || [],
      assistantMessages: chat.messages?.filter(msg => msg.role === 'assistant') || [],
      documentCount: chat.context?.documents?.length || 0
    };

    res.json({
      success: true,
      data: {
        chat: enhancedChat
      }
    });
  } catch (error) {
    next(error);
  }
};

// Delete chat session
exports.deleteChatSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOneAndDelete({
      chatId: id,
      userId: userId
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Chat session deleted successfully',
        chatId: id
      }
    });
  } catch (error) {
    next(error);
  }
};

// Clear chat messages (keep chat session)
exports.clearChatMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({
      chatId: id,
      userId: userId
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }

    // Clear messages but keep chat metadata
    await chat.clearMessages();

    res.json({
      success: true,
      data: {
        message: 'Chat messages cleared successfully',
        chatId: id,
        title: chat.title
      }
    });
  } catch (error) {
    next(error);
  }
};

// Verify a citation
exports.verifyCitation = async (req, res, next) => {
  try {
    const { documentId, chunkId, page } = req.body;
    const userId = req.user._id;

    // Find document
    const document = await Document.findOne({
      _id: documentId,
      uploadedBy: userId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Find chunk
    const chunk = document.chunks.find(c => c.chunkId === chunkId);
    if (!chunk) {
      return res.status(404).json({
        success: false,
        error: 'Chunk not found in document'
      });
    }

    // Get surrounding context for better verification
    const chunkIndex = document.chunks.findIndex(c => c.chunkId === chunkId);
    const context = {
      previous: chunkIndex > 0 ? document.chunks[chunkIndex - 1].content : null,
      current: chunk.content,
      next: chunkIndex < document.chunks.length - 1 ? document.chunks[chunkIndex + 1].content : null
    };

    // Get document metadata
    const documentInfo = {
      id: document._id,
      filename: document.filename,
      originalName: document.originalName,
      title: document.metadata?.title,
      documentType: document.metadata?.documentType,
      jurisdiction: document.metadata?.jurisdiction,
      year: document.metadata?.year
    };

    res.json({
      success: true,
      data: {
        document: documentInfo,
        chunk: {
          id: chunk.chunkId,
          content: chunk.content,
          page: chunk.page,
          section: chunk.section,
          keywords: chunk.keywords,
          wordCount: chunk.content.split(/\s+/).length
        },
        context: context,
        verification: {
          verifiedAt: new Date(),
          confidence: 1.0, // For now, assume full confidence
          source: 'document_database',
          status: 'verified'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get chat statistics
exports.getChatStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get all active chats for user
    const chats = await Chat.find({
      userId: userId,
      'settings.isActive': true
    });

    // Calculate statistics
    const stats = {
      totalChats: chats.length,
      totalMessages: chats.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0),
      totalCitations: chats.reduce((sum, chat) => {
        return sum + (chat.messages?.reduce((msgSum, msg) => msgSum + (msg.citations?.length || 0), 0) || 0);
      }, 0),
      averageConfidence: 0,
      mostUsedDocuments: {},
      byLanguage: {},
      byTime: {
        last24h: 0,
        last7d: 0,
        last30d: 0
      }
    };

    // Calculate average confidence
    const allAssistantMessages = chats.flatMap(chat => 
      chat.messages?.filter(msg => msg.role === 'assistant') || []
    );
    
    if (allAssistantMessages.length > 0) {
      const totalConfidence = allAssistantMessages.reduce((sum, msg) => 
        sum + (msg.metadata?.confidence || 0), 0
      );
      stats.averageConfidence = totalConfidence / allAssistantMessages.length;
    }

    // Count document usage
    chats.forEach(chat => {
      chat.context?.documents?.forEach(docId => {
        stats.mostUsedDocuments[docId] = (stats.mostUsedDocuments[docId] || 0) + 1;
      });

      // Count by language
      const lang = chat.context?.language || 'german';
      stats.byLanguage[lang] = (stats.byLanguage[lang] || 0) + 1;
    });

    // Sort most used documents
    stats.mostUsedDocuments = Object.entries(stats.mostUsedDocuments)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

    res.json({
      success: true,
      data: {
        stats,
        userId: userId
      }
    });
  } catch (error) {
    next(error);
  }
};