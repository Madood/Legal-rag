const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ChatSchema = new mongoose.Schema({
  // Basic Information
  chatId: {
    type: String,
    default: () => uuidv4(),
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  // Ownership
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Conversation
  messages: [{
    messageId: {
      type: String,
      default: () => uuidv4()
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    question: {
      type: String,
      required: function() { return this.role === 'user'; }
    },
    answer: {
      type: String,
      required: function() { return this.role === 'assistant'; }
    },
    citations: [{
      documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
      },
      chunkId: String,
      content: String,
      page: Number,
      section: String,
      similarity: {
        type: Number,
        min: 0,
        max: 1
      },
      relevance: {
        type: Number,
        min: 0,
        max: 1
      }
    }],
    metadata: {
      processingTime: Number,
      tokensUsed: Number,
      model: String,
      confidence: {
        type: Number,
        min: 0,
        max: 1
      }
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Context
  context: {
    documents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document'
    }],
    language: {
      type: String,
      enum: ['german', 'english'],
      default: 'german'
    },
    legalDomain: {
      type: String,
      default: 'general'
    },
    searchParameters: {
      similarityThreshold: {
        type: Number,
        default: 0.7
      },
      maxCitations: {
        type: Number,
        default: 5
      }
    }
  },
  
  // Statistics
  stats: {
    totalMessages: {
      type: Number,
      default: 0
    },
    totalCitations: {
      type: Number,
      default: 0
    },
    averageConfidence: {
      type: Number,
      default: 0
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  
  // Settings
  settings: {
    isActive: {
      type: Boolean,
      default: true
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    allowSharing: {
      type: Boolean,
      default: false
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals
ChatSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

ChatSchema.virtual('userMessages').get(function() {
  return this.messages.filter(msg => msg.role === 'user');
});

ChatSchema.virtual('assistantMessages').get(function() {
  return this.messages.filter(msg => msg.role === 'assistant');
});

ChatSchema.virtual('lastMessage').get(function() {
  return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
});

// Methods
ChatSchema.methods.addMessage = function(message) {
  this.messages.push(message);
  this.stats.totalMessages = this.messages.length;
  this.stats.lastActivity = new Date();
  
  // Update average confidence
  const assistantMessages = this.messages.filter(msg => msg.role === 'assistant');
  if (assistantMessages.length > 0) {
    const totalConfidence = assistantMessages.reduce((sum, msg) => sum + (msg.metadata?.confidence || 0), 0);
    this.stats.averageConfidence = totalConfidence / assistantMessages.length;
  }
  
  // Update citations count
  this.stats.totalCitations = this.messages.reduce((sum, msg) => sum + (msg.citations?.length || 0), 0);
  
  return this.save();
};

ChatSchema.methods.getRecentMessages = function(count = 10) {
  return this.messages.slice(-count);
};

ChatSchema.methods.clearMessages = function() {
  this.messages = [];
  this.stats.totalMessages = 0;
  this.stats.totalCitations = 0;
  this.stats.averageConfidence = 0;
  return this.save();
};

// Pre-save middleware
ChatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Update title from first question if not set
  if (!this.title || this.title === 'New Chat') {
    const firstUserMessage = this.messages.find(msg => msg.role === 'user');
    if (firstUserMessage && firstUserMessage.question) {
      this.title = firstUserMessage.question.substring(0, 50) + 
                   (firstUserMessage.question.length > 50 ? '...' : '');
    }
  }
  
  next();
});

// Indexes for efficient queries
ChatSchema.index({ userId: 1, updatedAt: -1 });
ChatSchema.index({ 'settings.isActive': 1 });
ChatSchema.index({ createdAt: -1 });
ChatSchema.index({ 'context.language': 1 });
ChatSchema.index({ 'messages.timestamp': -1 });

module.exports = mongoose.model('Chat', ChatSchema);