/**
 * Central Service Registry
 * ------------------------
 * This file exposes services grouped strictly by responsibility.
 * 
 * Rule:
 * - Import ONLY from this file outside /services
 * - Do NOT add business logic here
 * - This is a wiring layer, not an execution layer
 */

// ==============================
// INGESTION – documents & text
// ==============================
const pdfDocumentService = require('./ingestion/pdfDocumentService');
const pdfStructureExtractor = require('./ingestion/pdfStructureExtractor');

// ==============================
// CLASSIFICATION – question analysis
// ==============================
const legalFieldDetector = require('./classification/legalFieldDetector');
const questionClassifier = require('./classification/questionClassifier');

// ==============================
// RETRIEVAL – finding relevant law
// ==============================
const ragService = require('./retrieval/ragService');
const embeddingService = require('./retrieval/embeddingService');
const pythonIntegrationService = require('./retrieval/pythonIntegrationService');

// ==============================
// VALIDATION – legal safety & constraints
// ==============================
const safetyCheck = require('./validation/safetyCheck');

// ==============================
// CLARIFICATION – missing user intent
// ==============================
const clarificationService = require('./clarification/clarificationService');

// ==============================
// ORCHESTRATION – system conductor
// ==============================
const chatService = require('./orchestration/chatService');

module.exports = {
  ingestion: {
    pdfDocumentService,
    pdfStructureExtractor
  },

  classification: {
    legalFieldDetector,
    questionClassifier
  },

  retrieval: {
    ragService,
    embeddingService,
    pythonIntegrationService
  },

  validation: {
    safetyCheck
  },

  clarification: {
    clarificationService
  },

  orchestration: {
    chatService
  }
};