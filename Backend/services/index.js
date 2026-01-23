/**
 * Central Service Registry
 * ------------------------
 * This file exposes services grouped strictly by responsibility.
 *
 * Rules:
 * - Import ONLY from this file outside /services
 * - Do NOT add business logic here
 * - This is a wiring layer, not an execution layer
 */

// ==============================
// INGESTION – document intake & storage
// ==============================
const pdfDocumentService = require('./ingestion/pdfDocumentService');

// ==============================
// RETRIEVAL – finding relevant law
// ==============================
const ragService = require('./retrieval/ragService');
const pythonIntegrationService = require('./retrieval/pythonIntegrationService');

// ==============================
// VALIDATION – legal safety & constraints
// ==============================
const safetyCheck = require('./validation/safetyCheck');

// ==============================
// ORCHESTRATION – system conductor
// ==============================
const chatService = require('./orchestration/chatService');

module.exports = {
  ingestion: {
    pdfDocumentService
  },

  retrieval: {
    ragService,
    pythonIntegrationService
  },

  validation: {
    safetyCheck
  },

  orchestration: {
    chatService
  }
};
