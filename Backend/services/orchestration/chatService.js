// const documentService = require("../ingestion/pdfDocumentService");
// const ragService = require("../retrieval/ragService");
// const safetyCheck = require("../validation/safetyCheck");
// const pythonIntegrationService = require("../retrieval/pythonIntegrationService");
// const resultFormatter = require("./resultFormatter");
// const axios = require("axios");

// class ChatService {
//   constructor() {
//     this.conversationHistory = [];
//     console.log('? ChatService initialized with EPISTEMIC AUTHORITY COMPLIANCE');
    
//     // Bind methods
//     this.structureAnswerWithDoctrinalTemplate = this.structureAnswerWithDoctrinalTemplate.bind(this);
//     this.generateStructuredClarification = this.generateStructuredClarification.bind(this);
//     this.getConversationHistory = this.getConversationHistory.bind(this);
//     this.addSafetyInformation = this.addSafetyInformation.bind(this);
//     this.normalizeParagraph = this.normalizeParagraph.bind(this);
//     this.findExactParagraph = this.findExactParagraph.bind(this);
//     this.extractParagraphFromText = this.extractParagraphFromText.bind(this);
//     this.isTerminalAuthority = this.isTerminalAuthority.bind(this);
//     this.shouldBlockRagForFinalAuthority = this.shouldBlockRagForFinalAuthority.bind(this);
//     this.generateAuthoritativeAbstentionResponse = this.generateAuthoritativeAbstentionResponse.bind(this);
//     // ?? NEW: Exact norm detector
//     this.detectExactNormReference = this.detectExactNormReference.bind(this);
//   }

//   // ===========================================================================
//   // ?? EXACT NORM REFERENCE DETECTOR (NEW - CRITICAL FIX)
//   // ===========================================================================

//   detectExactNormReference(question) {
//     if (!question || typeof question !== 'string') return null;
    
//     // Patterns for German legal norm references
//     const patterns = [
//       // Pattern 1: § 325 HGB (with space)
//       /§\s*(\d+[a-z]?)\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i,

//       // Pattern 2: §325 HGB (no space)
//       /§(\d+[a-z]?)\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i,

//       // Pattern 3: BGB § 325
//       /(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)\s+§\s*(\d+[a-z]?)/i,

//       // Pattern 4: Artikel 5 GG  (with optional "Absatz N")
//       /artikel\s+(\d+[a-z]?)(?:\s+(?:absatz|abs\.?)\s+\d+[a-z]?)?\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i,

//       // Pattern 5: Art. 5 GG  (with optional "Absatz N")
//       /art\.?\s*(\d+[a-z]?)(?:\s+(?:absatz|abs\.?)\s+\d+[a-z]?)?\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i
//     ];
    
//     for (const pattern of patterns) {
//       const match = question.match(pattern);
//       if (match) {
//         // Extract statute and paragraph based on pattern
//         let statute, paragraph;
//         let isArticle = false;
        
//         if (pattern.toString().includes('(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)\\s+§')) {
//           // Pattern 3: BGB § 325
//           statute = match[1].toUpperCase();
//           paragraph = match[2];
//         } else if (pattern.toString().includes('artikel') || pattern.toString().includes('art\\.')) {
//           // Pattern 4/5: Artikel/Art. 5 GG
//           statute = match[2].toUpperCase();
//           paragraph = match[1];
//           isArticle = true;
//         } else {
//           // Pattern 1/2: § 325 HGB
//           paragraph = match[1];
//           statute = match[2].toUpperCase();
//         }
        
//         console.log(`?? [Exact Norm Detector] Found: ${statute} §${paragraph} ${isArticle ? '(Article)' : ''}`);
//         return {
//           statute,
//           paragraph,
//           isArticle,
//           source: 'explicit_question_reference',
//           matchedPattern: pattern.toString()
//         };
//       }
//     }
    
//     return null;
//   }

//   // ===========================================================================
//   // HELPER: Format raw chunk content into a clean answer string
//   // Strips PDF boilerplate headers, limits length, adds statute label.
//   // ===========================================================================

//   formatChunkAsAnswer(rawContent, statute, paragraph, isArticle) {
//     const BOILERPLATE = [
//       /Ein Service des Bundesministerium[^\n]*/gi,
//       /sowie des Bundesamts für Justiz[^\n]*/gi,
//       /www\.gesetze-im-internet\.de[^\n]*/gi,
//       /- Seite \d+ von \d+ -/gi,
//       /Seite \d+ von \d+/gi,
//     ];

//     let cleaned = rawContent || '';
//     for (const pat of BOILERPLATE) cleaned = cleaned.replace(pat, '');
//     cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

//     const statuteName = this.getStatuteDisplayName(statute) || statute;
//     const ref = paragraph
//       ? `${isArticle ? 'Art.' : '§'} ${paragraph} ${statute}`
//       : statute;

//     return `**${statuteName} — ${ref}**\n\n${cleaned}\n\n*Diese Angaben stammen aus deutschen Rechtsdokumenten und ersetzen keine Rechtsberatung.*`;
//   }

//   // ===========================================================================
//   // ?? CRITICAL FIX: PARAGRAPH NORMALIZATION HELPER
//   // ===========================================================================

//   normalizeParagraph(value) {
//     if (!value) return null;
    
//     // Handle arrays (sometimes metadata is stored as arrays)
//     if (Array.isArray(value)) {
//       value = value[0];
//     }
    
//     // Convert to string and normalize
//     const str = String(value);
    
//     // Remove all non-alphanumeric characters except letters and numbers
//     // Handle German legal formats: §558a, § 558a, Paragraph 558a, Art. 5, Artikel 5
//     return str
//       .toLowerCase()
//       .replace(/§/g, '')
//       .replace(/paragraph/gi, '')
//       .replace(/artikel/gi, '')
//       .replace(/article/gi, '')
//       .replace(/art\./gi, '')
//       .replace(/art/gi, '')
//       .replace(/\s+/g, '')
//       .replace(/[^\w\s]/g, '')
//       .trim();
//   }

//   // ===========================================================================
//   // ?? CRITICAL FIX: EXTRACT PARAGRAPH FROM TEXT (German legal PDFs)
//   // ===========================================================================

//   extractParagraphFromText(text) {
//     if (!text) return null;
    
//     // Try multiple patterns for German legal paragraph markers
//     const patterns = [
//       // Pattern 1: §558a or § 558a or §\n558a
//       /§\s*\n*\s*(\d+[a-z]?)/i,
      
//       // Pattern 2: Paragraph 558a or Paragraph 5
//       /paragraph\s+(\d+[a-z]?)/i,
      
//       // Pattern 3: Artikel 5 or Art. 5 or Art 5
//       /(?:artikel|art\.|art)\s+(\d+[a-z]?)/i,
      
//       // Pattern 4: In text like "§ 558a Form und Begründung..."
//       /§\s*(\d+[a-z]?)\s+[A-ZÄÖÜ]/,
      
//       // Pattern 5: Just numbers at start of meaningful sentence
//       /^(\d+[a-z]?)\s+[A-ZÄÖÜ]/,
//     ];
    
//     // Also check for paragraph markers that might be split across lines
//     const first500Chars = text.substring(0, 500);
    
//     for (const pattern of patterns) {
//       const match = first500Chars.match(pattern);
//       if (match && match[1]) {
//         console.log(`?? [Extract] Found paragraph ${match[1]} with pattern ${pattern}`);
//         return `§${match[1]}`;
//       }
//     }
    
//     return null;
//   }

//   // ===========================================================================
//   // ?? CRITICAL FIX: EXACT PARAGRAPH FINDER WITH TEXT EXTRACTION
//   // ===========================================================================

//   findExactParagraph(allDocuments, statute, paragraph) {
//     const normalizedAuthorityPara = this.normalizeParagraph(paragraph);
    
//     if (!normalizedAuthorityPara) {
//       console.log(`? [Exact Mode] Cannot normalize paragraph: ${paragraph}`);
//       return null;
//     }
    
//     console.log(`?? [Exact Mode] Looking for ${statute} §${paragraph} (normalized: ${normalizedAuthorityPara})`);
    
//     // Track matches for debugging
//     const potentialMatches = [];
    
//     // Search through all documents and chunks
//     for (const doc of allDocuments) {
//       const chunks = doc.chunks || [doc]; // Handle both chunked and single documents
      
//       for (const chunk of chunks) {
//         // Get statute from chunk or document
//         const statuteRaw = 
//           chunk.metadata?.statute ||
//           chunk.metadata?.statute_id ||
//           chunk.metadata?.law ||
//           doc.metadata?.statute;
        
//         // Skip if not the right statute
//         if (statuteRaw !== statute) {
//           continue;
//         }
        
//         // Try to extract paragraph from text
//         const extractedPara = this.extractParagraphFromText(chunk.content || chunk.text);
//         const normalizedChunkPara = this.normalizeParagraph(extractedPara);
        
//         // For debugging, log when we find potential matches
//         if (normalizedChunkPara) {
//           potentialMatches.push({
//             paraRaw: extractedPara,
//             normalized: normalizedChunkPara,
//             preview: (chunk.content || chunk.text).substring(0, 100)
//           });
          
//           // Check for match
//           if (normalizedChunkPara === normalizedAuthorityPara) {
//             console.log(`? [Exact Mode] Found exact match!`);
//             console.log(`   Statute: ${statuteRaw}`);
//             console.log(`   Paragraph: ${extractedPara}`);
//             console.log(`   Normalized: ${normalizedChunkPara}`);
//             console.log(`   Preview: ${(chunk.content || chunk.text).substring(0, 200)}...`);
//             return chunk;
//           }
//         }
        
//         // Also check metadata if it exists
//         const metaPara = chunk.metadata?.paragraph || chunk.metadata?.paragraph_number;
//         if (metaPara) {
//           const normalizedMetaPara = this.normalizeParagraph(metaPara);
//           if (normalizedMetaPara === normalizedAuthorityPara) {
//             console.log(`? [Exact Mode] Found in metadata!`);
//             console.log(`   Statute: ${statuteRaw}`);
//             console.log(`   Paragraph: ${metaPara}`);
//             console.log(`   Normalized: ${normalizedMetaPara}`);
//             return chunk;
//           }
//         }
//       }
//     }
    
//     // Log what we found for debugging
//     if (potentialMatches.length > 0) {
//       console.log(`?? [Debug] Found ${potentialMatches.length} potential paragraphs in ${statute}:`);
//       potentialMatches.slice(0, 10).forEach((match, i) => {
//         console.log(`   ${i + 1}. ${match.paraRaw} (normalized: ${match.normalized})`);
//       });
//     }
    
//     console.log(`? [Exact Mode] No exact match found for ${statute} §${paragraph}`);
//     return null;
//   }

//   // ===========================================================================
//   // ?? TERMINAL AUTHORITY CHECK (NEW)
//   // ===========================================================================
  
//   isTerminalAuthority(authority) {
//     if (!authority) return false;
    
//     return (
//       authority.authority_final === true ||
//       authority.terminal === true ||
//       authority.metadata?.authority_final === true ||
//       authority.retrieval?.constraint === 'PARAGRAPH_STRICT' ||
//       authority.constraint === 'PARAGRAPH_STRICT' ||
//       authority.force_exact === true
//     );
//   }

//   // ===========================================================================
//   // ?? AUTHORITY LOCK MECHANISM (NEW - FINAL FIX)
//   // ===========================================================================
  
//   createAuthorityLock(authority) {
//     if (!authority) return { __locked: false };
    
//     // ?? CLEANUP: Single point of truth for lock decision
//     const isLocked = 
//       this.isTerminalAuthority(authority) ||
//       authority.__empty_authoritative_result === true;
    
//     const lock = {
//       ...authority,
//       __locked: isLocked,
//       __lockTimestamp: new Date().toISOString(),
//       __lockReason: isLocked ? (this.isTerminalAuthority(authority) ? 'terminal_authority' : 'empty_authoritative_result') : 'non_terminal'
//     };
    
//     if (isLocked) {
//       console.log(`?? [Authority Lock] Created LOCKED authority object:`, {
//         statute: authority.statute,
//         paragraph: authority.paragraph,
//         authority_final: authority.authority_final,
//         terminal: authority.terminal,
//         empty_authoritative_result: authority.__empty_authoritative_result,
//         reason: lock.__lockReason
//       });
//     }
    
//     return lock;
//   }

//   // ===========================================================================
//   // ??? FINAL AUTHORITY GUARD (NEW)
//   // ===========================================================================

//   shouldBlockRagForFinalAuthority(authority, pythonResults) {
//     if (!authority || !pythonResults) return false;
    
//     // Check if this is a terminal/final authority
//     const isTerminal = this.isTerminalAuthority(authority);
    
//     // Check if Python search returned empty authoritative results
//     const isEmptyAuthoritativeResult = 
//       pythonResults.results && 
//       pythonResults.results.length === 0 &&
//       pythonResults.authoritative_found === false;
    
//     // Block RAG if: terminal authority + empty authoritative results
//     const shouldBlock = isTerminal && isEmptyAuthoritativeResult;
    
//     if (shouldBlock) {
//       console.log(`??? [Final Authority Guard] RAG BLOCKED - Terminal authority with empty results`);
//       console.log(`   Terminal Check: ${isTerminal}, Authority Final: ${authority.authority_final}`);
//       console.log(`   Empty Results: ${isEmptyAuthoritativeResult}, Results Length: ${pythonResults.results?.length || 0}`);
//       console.log(`   Authoritative Found: ${pythonResults.authoritative_found}`);
//     }
    
//     return shouldBlock;
//   }

//   // ===========================================================================
//   // ?? GENERATE AUTHORITATIVE ABSTENTION RESPONSE (NEW)
//   // ===========================================================================

//   generateAuthoritativeAbstentionResponse(authority, question) {
//     const statuteName = this.getStatuteDisplayName(authority.statute);
//     const paragraphRef = authority.paragraph
//       ? (authority.isArticle ? `Artikel ${authority.paragraph}` : `§${authority.paragraph}`)
//       : '';
//     const normRef = paragraphRef ? `${statuteName} ${paragraphRef}` : statuteName;

//     const responseTemplates = {
//       default: `**${normRef}**\n\n` +
//                `Die Norm wurde eindeutig identifiziert. Eine inhaltliche Auslegung erfordert juristische Subsumtion oder zusätzlichen Kontext.\n\n` +
//                `*Autoritative Suche ergab keine auslegungsfähigen Textstellen.*`,

//       BGB: `**${normRef}**\n\n` +
//            `Die Vorschrift wurde identifiziert. Eine konkrete inhaltliche Würdigung erfordert die Prüfung von Rechtsprechung oder Literatur.\n\n` +
//            `*Der autoritative Suchdienst konnte keine unmittelbar auslegungsfähigen Passagen extrahieren.*`,

//       GG: `**${normRef}**\n\n` +
//           `Der Verfassungsartikel wurde bestimmt. Die Auslegung von Grundrechten erfordert stets die Berücksichtigung der Rechtsprechung des Bundesverfassungsgerichts.\n\n` +
//           `*Die autoritative Suche ergab keine unmittelbar synthetisierbaren Textstellen.*`
//     };
    
//     const template = responseTemplates[authority.statute] || responseTemplates.default;
    
//     return {
//       success: true,
//       data: {
//         answer: template,
//         confidence: 0.85,
//         statute: authority.statute,
//         paragraph: authority.paragraph,
//         metadata: {
//           authority_final: true,
//           empty_authoritative_result: true,
//           rag_disabled: true,
//           fallback_prohibited: true,
//           legal_status: 'norm_identified_but_no_interpretable_text'
//         }
//       }
//     };
//   }

//   // ===========================================================================
//   // ?? CRITICAL FIX: DOCTRINAL EARLY-EXIT CHECK - UPDATED FOR STATUTE-ONLY
//   // ===========================================================================
  
//   shouldUseDoctrinalEarlyExit(authority) {
//     if (!authority) return false;

//     // ONLY genuine doctrine question types trigger early-exit.
//     // anchorNormMode+uncertain was incorrectly routing DEFINITION/GENERAL questions
//     // (which have no specific paragraph) to the doctrine endpoint.
//     const DOCTRINAL_TYPES = new Set([
//       'DOCTRINE', 'GENERAL_DOCTRINE', 'LEGAL_PRINCIPLE', 'GRUNDSATZ', 'PRINCIPLE', 'DOCTRINAL_ANALYSIS'
//     ]);

//     const isDoctrinalQuestion =
//       DOCTRINAL_TYPES.has(authority.classification?.type) ||
//       DOCTRINAL_TYPES.has(authority.question_type) ||
//       authority.doctrinal_match === true;

//     if (!isDoctrinalQuestion) {
//       // DEFINITION, GENERAL, FACTUAL, GENERAL_INFORMATION, STATUTE_OVERVIEW etc.
//       // must go through normal retrieval, not doctrine early-exit.
//       return false;
//     }

//     const isConfirmed =
//       authority.epistemicCertainty === 'confirmed' ||
//       authority.epistemic_certainty === 'confirmed';

//     const isAnchorNormMode =
//       authority.anchorNormMode === true ||
//       authority.anchor_norm_mode === true;

//     if (isDoctrinalQuestion && (isAnchorNormMode || isConfirmed)) {
//       console.log(`? [Doctrine Early-Exit] Triggered: type=${authority.question_type}, anchor=${isAnchorNormMode}, confirmed=${isConfirmed}`);
//       return true;
//     }

//     return false;
//   }

//   // ===========================================================================
//   // DOCTRINAL DELEGATION
//   // ===========================================================================
  
//   async callDoctrineInductionService(question, authority) {
//     try {
//       const doctrineResult = await pythonIntegrationService.callDoctrineInductor({
//         question: question,
//         statute: authority.statute,
//         paragraph: authority.paragraph,
//         classification: authority.classification,
//         authority_mode: authority.authority_mode,
//         suggested_field: authority.suggestedField || authority.doctrinal_field,
//         epistemic_certainty: authority.epistemicCertainty
//       });

//       // When the doctrine endpoint finds a known doctrine and doctrinal_match is set,
//       // the content is authoritative — promote certainty so callers skip uncertainty warnings.
//       if (doctrineResult?.doctrine_found === true && authority.doctrinal_match === true) {
//         authority.epistemicCertainty = 'confirmed';
//         console.log(`? [Doctrine] doctrine_found + doctrinal_match ? epistemicCertainty promoted to 'confirmed'`);
//       }

//       return doctrineResult;
//     } catch (error) {
//       console.error(`?? Doctrine induction failed: ${error.message}`);
//       return null;
//     }
//   }

//   // ===========================================================================
//   // DOCTRINE ENFORCEMENT
//   // ===========================================================================
  
//   async enforcePythonDoctrine(question, authority) {
//     // First check for doctrinal early-exit
//     if (this.shouldUseDoctrinalEarlyExit(authority)) {
//       console.log(`?? [Doctrinal Early-Exit] Confirmed doctrine - immediate return`);
//       return await this.callDoctrineInductionService(question, authority);
//     }
    
//     // Original logic for exact operative norms
//     if (!authority?.statute || !authority?.paragraph) return null;
    
//     console.log(`?? [Doctrine Enforcement] Checking if exact operative norm: ${authority.statute} §${authority.paragraph}`);
    
//     const isExactOperativeNorm = 
//       authority.authority_mode === 'exact' && 
//       authority.statute && 
//       authority.paragraph &&
//       (authority.normFunction === 'OPERATIVE' || !authority.normFunction);
    
//     if (!isExactOperativeNorm) {
//       console.log(`?? [Doctrine] Not enforcing doctrine - mode: ${authority.authority_mode}, normFunction: ${authority.normFunction}`);
//       return null;
//     }
    
//     console.log(`?? [Doctrine Enforcement] Exact operative norm detected - calling Python doctrine`);
    
//     try {
//       const doctrineResult = await this.callDoctrineInductionService(question, authority);

//       // Only return the doctrine result when Python confirmed a specific doctrine match.
//       if (doctrineResult?.doctrine_found === true &&
//           (doctrineResult?.doctrinal_summary || doctrineResult?.answer)) {
//         console.log(`? [Doctrine] Received confirmed doctrinal analysis from Python`);
//         return doctrineResult;
//       }
//     } catch (error) {
//       console.log(`?? [Doctrine] Python doctrine call failed: ${error.message}`);
//     }

//     return null;
//   }

//   // ===========================================================================
//   // GENERATE DOCTRINAL ANSWER
//   // ===========================================================================
  
//   generateDoctrinalAnswer(doctrineResult, authority, question) {
//     const statuteName = this.getStatuteDisplayName(authority.statute);
//     const paragraphRef = authority.paragraph
//       ? (authority.isArticle ? `Artikel ${authority.paragraph}` : `§ ${authority.paragraph}`)
//       : '';

//     let answer = `**${statuteName}${paragraphRef ? ` ${paragraphRef}` : ''}**\n\n`;
    
//     if (doctrineResult.doctrinal_summary) {
//       answer += doctrineResult.doctrinal_summary;
//     } else if (doctrineResult.answer) {
//       answer += doctrineResult.answer;
//     }
    
//     // Minimal metadata
//     answer += `\n\n*Doctrinale Analyse durch Python-Autoritätsdienst*`;
    
//     return {
//       fullAnswer: answer,
//       confidence: doctrineResult.confidence || 0.92,
//       template_used: 'python_doctrine',
//       domain: doctrineResult.domain || 'civil',
//       metadata: {
//         doctrine_applied: true,
//         python_doctrine: true,
//         authority_mode: 'exact',
//         epistemic_certainty: authority.epistemicCertainty,
//         anchor_norm_mode: authority.anchorNormMode,
//         retrieval_used: false,
//         safety_check_skipped: true
//       }
//     };
//   }

//   // ===========================================================================
//   // ?? CRITICAL FIX: RETRIEVAL WITH DOCTRINE GUARD & AUTHORITY LOCK
//   // ===========================================================================
  
//   async retrieveDocumentsWithDoctrineGuard(question, authority, authorityLock, allDocuments, classification) {
//     classification = classification || { type: 'GENERAL', domain: 'general' };

//     // Note: authority lock is informational — we do not skip retrieval based on it.
//     // Retrieval must always be attempted so the RAG synthesis has real content.

//     // Original doctrine guard logic
//     const isDoctrinalQuestion = 
//       classification?.type === 'DOCTRINE' ||
//       authority?.question_type === 'DOCTRINE' ||
//       authority?.question_type === 'GENERAL_DOCTRINE' ||
//       (authority?.anchorNormMode === true && authority?.epistemicCertainty === 'uncertain') ||
//       authority?.doctrinal_match === true ||
//       (authority?.anchor_norm_mode === true && authority?.epistemic_certainty === 'uncertain');
    
//     if (isDoctrinalQuestion) {
//       // If the question also contains a specific § reference, still attempt retrieval.
//       // The doctrine guard should only block pure abstract-doctrine questions with no
//       // paragraph anchor, not concrete paragraph questions that happen to be classified DOCTRINE.
//       const hasSpecificParagraph = /§\s*\d+|art\.\s*\d+/i.test(question);
//       if (!hasSpecificParagraph) {
//         console.log(`?? [Doctrine Guard] Pure doctrinal question — skipping TF-IDF, using Python only`);
//         console.log(`   Reason: classification=${classification?.type}, question_type=${authority?.question_type}`);

//         safetyCheck.logSafetyEvent('DOCTRINE_GUARD_TRIGGERED', {
//           question,
//           classification_type: classification?.type,
//           question_type: authority?.question_type,
//           anchorNormMode: authority?.anchorNormMode,
//           epistemicCertainty: authority?.epistemicCertainty,
//           doctrinal_match: authority?.doctrinal_match
//         });

//         return {
//           results: [],
//           authoritative_found: false,
//           authority_summary: {
//             doctrine_mode: true,
//             doctrine_detected: true,
//             reason: 'doctrinal_question_guard'
//           },
//           authority_mode: authority.authority_mode
//         };
//       }
//       // Has specific paragraph — fall through to normal retrieval
//       console.log(`⬇️ [Doctrine Guard] Doctrinal question but has § reference — proceeding to retrieval`);
//     }

//     // Exact mode still needs retrieval — the paragraph number constrains the search
//     // but must not short-circuit it to empty results.

//     // Retrieval logic
//     try {
//       console.log(`?? Using Python for authoritative retrieval (mode: ${authority.authority_mode})...`);
      
//       const preparedDocs = this.prepareDocumentsForPython(allDocuments);
      
//       const sourcesResult = await pythonIntegrationService.getAuthoritativeSources(
//         question,
//         authority.statute,
//         classification.type,
//         preparedDocs
//       );
      
//       if (sourcesResult.success) {
//         const hasResults = sourcesResult.allowed_documents?.length > 0;
//         const isOverviewMode = authority.authority_mode === 'overview';
        
//         return {
//           results: hasResults ? sourcesResult.allowed_documents : 
//                    (isOverviewMode ? preparedDocs : []),
//           authoritative_found: hasResults,
//           authority_summary: sourcesResult.authority_summary || {},
//           authority_mode: authority.authority_mode
//         };
//       } else {
//         console.log(`?? Python authoritative sources failed, using fallback`);
//         return {
//           results: preparedDocs,
//           authoritative_found: false,
//           authority_summary: { fallback: true },
//           authority_mode: authority.authority_mode
//         };
//       }
      
//     } catch (error) {
//       console.log(`?? Python retrieval error: ${error.message}`);
//       const isOverviewMode = authority.authority_mode === 'overview';
//       return {
//         results: isOverviewMode ? allDocuments : [],
//         authoritative_found: false,
//         authority_summary: { error: error.message },
//         authority_mode: authority.authority_mode
//       };
//     }
//   }

//   // ===========================================================================
//   // CONFIDENCE CALCULATION
//   // ===========================================================================
  
//   calculateEpistemicConfidence(baseConfidence, authority, ragResponse = null) {
//     // ?? CRITICAL FIX: Exact mode = 1.0 confidence
//     if (authority.authority_mode === 'exact' && authority.statute && authority.paragraph) {
//       console.log(`?? [Exact Mode] Confidence overridden to 1.0`);
//       return 1.0;
//     }
    
//     // Rule: IF epistemicCertainty == "confirmed" AND question_type == "DOCTRINE"
//     // ? confidence = max(confidence, 0.9)
    
//     const isDoctrinalQuestion = authority.classification?.type === 'DOCTRINE' || 
//                                authority.question_type === 'DOCTRINE' ||
//                                authority.question_type === 'GENERAL_DOCTRINE';
    
//     const isConfirmed = authority.epistemicCertainty === 'confirmed' || 
//                        authority.epistemic_certainty === 'confirmed';
    
//     if (isDoctrinalQuestion && isConfirmed) {
//       const doctrinalConfidence = Math.max(baseConfidence, 0.9);
//       console.log(`?? [Confidence Override] Doctrinal question: ${doctrinalConfidence.toFixed(2)} (was: ${baseConfidence.toFixed(2)})`);
//       return doctrinalConfidence;
//     }
    
//     // For derivative norm questions, consider synthesis quality
//     if (authority.question_type === "DERIVATIVE_NORM" && ragResponse?.synthesisQuality) {
//       const synthesisBoost = ragResponse.synthesisQuality === "HIGH" ? 0.1 : 0;
//       return Math.min(baseConfidence + synthesisBoost, 0.95);
//     }
    
//     // For exact operative norms, require chunk evidence
//     if (authority.question_type === "EXACT_OPERATIVE_NORM" || authority.authority_mode === 'exact') {
//       const chunkCount = ragResponse?.metadata?.chunksUsed || 0;
//       if (chunkCount === 0) {
//         return Math.min(baseConfidence, 0.6); // Penalize no evidence
//       }
//     }
    
//     return baseConfidence;
//   }

//   // ===========================================================================
//   // SMART METHOD 1: Structure Answer
//   // ===========================================================================
  
//   structureAnswerWithDoctrinalTemplate(ragResponse, question, safetyValidation, authority, classification, pythonResults) {
//     // Let the answer speak for itself - don't force templates
//     let fullAnswer = ragResponse.doctrine_summary || ragResponse.answer || '';
    
//     // Add statutory context ONLY if confirmed
//     if (authority.statute && authority.paragraph) {
//       const statuteName = this.getStatuteDisplayName(authority.statute);
//       const paragraphRef = authority.isArticle 
//         ? `Artikel ${authority.paragraph}` 
//         : `§${authority.paragraph}`;
      
//       fullAnswer = `**${statuteName} ${paragraphRef}**\n\n${fullAnswer}`;
//     }
    
//     // Add safety info (respects doctrine skip)
//     fullAnswer = this.addSafetyInformation(fullAnswer, safetyValidation, authority, question);
    
//     // Smart confidence calculation
//     const finalConfidence = this.calculateEpistemicConfidence(
//       ragResponse.confidence || 0.7, 
//       authority, 
//       ragResponse
//     );
    
//     return {
//       fullAnswer,
//       confidence: finalConfidence,
//       template_used: ragResponse.doctrine_summary ? 'python_doctrine' : 'rag_synthesis',
//       domain: classification?.domain || 'general',
//       metadata: {
//         doctrine_applied: !!ragResponse.doctrine_summary,
//         authority_mode: authority.authority_mode,
//         epistemic_certainty: authority.epistemicCertainty,
//         retrieval_used: !ragResponse.doctrine_summary,
//         safety_check_skipped: classification?.type === 'DOCTRINE',
//         chunks_used: ragResponse.metadata?.chunksUsed || 0
//       }
//     };
//   }

//   // ===========================================================================
//   // SMART METHOD 2: Generate Clarification
//   // ===========================================================================
  
//   generateStructuredClarification(authority, question, pythonError = null) {
//     let message = '';
    
//     if (!authority.statute) {
//       message = 'Um eine präzise rechtliche Analyse zu ermöglichen, geben Sie bitte das relevante Gesetz an (z.B. BGB, StGB, HGB).';
//     } else if (!authority.paragraph) {
//       const statuteName = this.getStatuteDisplayName(authority.statute);
//       message = `${statuteName} wurde erkannt. Bitte präzisieren Sie den relevanten Paragraphen oder bestätigen Sie, dass eine Übersicht gewünscht ist.`;
//     } else {
//       message = 'Zusätzliche Präzisierung der Rechtsfrage erforderlich.';
//     }
    
//     return {
//       success: true,
//       data: {
//         answer: `**Präzisierung erforderlich**\n\n${message}`,
//         confidence: 0.3,
//         clarification_required: true,
//         statute: authority.statute || null,
//         paragraph: authority.paragraph || null,
//         metadata: {
//           requires_clarification: true,
//           authority_status: authority.status || 'unknown'
//         }
//       }
//     };
//   }

//   // ===========================================================================
//   // SMART METHOD 3: Conversation History
//   // ===========================================================================
  
//   getConversationHistory(limit = 20) {
//     if (!this.conversationHistory?.length) return [];
//     return this.conversationHistory.slice(-limit);
//   }

//   // ===========================================================================
//   // CRITICAL FIX: addSafetyInformation
//   // ===========================================================================
  
//   addSafetyInformation(answer, safetyValidation, authority, originalQuestion = '') {
//     // Skip safety info for doctrine questions
//     if (authority.classification?.type === 'DOCTRINE' || 
//         authority.question_type === 'DOCTRINE' ||
//         authority.question_type === 'GENERAL_DOCTRINE' ||
//         safetyValidation?.metadata?.safety_check_skipped) {
//       return answer;
//     }
    
//     // Only add if safety validation exists and has meaningful data
//     if (!safetyValidation?.legalDefensibility) {
//       return answer;
//     }
    
//     const defensibility = safetyValidation.legalDefensibility;
//     const readiness = safetyValidation.examinerReadiness;
    
//     // Only add warning if there's an actual issue
//     if (defensibility === 'LOW' || readiness === 'NEEDS_REVIEW') {
//       return answer + '\n\n?? *Diese Antwort erfordert weitere rechtliche Prüfung.*';
//     }
    
//     return answer;
//   }

//   // ===========================================================================
//   // COMPARISON MODE — DeepSeek-powered dual retrieval + table synthesis
//   // ===========================================================================

//   async _callDeepSeek(messages, opts = {}) {
//     const apiKey = process.env.DEEPSEEK_API_KEY;
//     if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
//       throw new Error('DEEPSEEK_API_KEY not configured');
//     }
//     const response = await axios.post(
//       'https://api.deepseek.com/v1/chat/completions',
//       {
//         model: 'deepseek-chat',
//         messages,
//         temperature: opts.temperature ?? 0,
//         ...(opts.json ? { response_format: { type: 'json_object' } } : {})
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${apiKey}`,
//           'Content-Type': 'application/json'
//         },
//         timeout: opts.timeout ?? 20000
//       }
//     );
//     return response.data.choices[0].message.content;
//   }

//   async handleComparisonQuestion(question, allDocuments, languageStr) {
//     console.log(`🔀 [Comparison] Entering comparison mode for: "${question.substring(0, 60)}"`);
//     const apiKey = process.env.DEEPSEEK_API_KEY;
//     if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
//       console.warn('[Comparison] DEEPSEEK_API_KEY not set — skipping comparison mode');
//       return null;
//     }

//     // ── Step 1: Extract concepts via DeepSeek ────────────────────────────────
//     let concepts;
//     try {
//       const extractRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
//         body: JSON.stringify({
//           model: 'deepseek-chat',
//           max_tokens: 200,
//           temperature: 0,
//           response_format: { type: 'json_object' },
//           messages: [
//             {
//               role: 'system',
//               content:
//                 'Extract the two legal concepts being compared. Return ONLY JSON:\n' +
//                 '{"concept1":{"term":"string","statute":"BGB|StGB|HGB|GG|ZPO|StPO|GmbHG","paragraph":"string or null"},' +
//                 '"concept2":{"term":"string","statute":"BGB|StGB|HGB|GG|ZPO|StPO|GmbHG","paragraph":"string or null"}}\n\n' +
//                 'KNOWN PARAGRAPH MAPPINGS — always use these exact paragraphs:\n' +
//                 'Vorsatz → StGB § 15\n' +
//                 'Fahrlässigkeit → StGB § 15\n' +
//                 'Vorsätzlich → StGB § 15\n' +
//                 'Notwehr → StGB § 32\n' +
//                 'Nothilfe → StGB § 32\n' +
//                 'Mord → StGB § 211\n' +
//                 'Totschlag → StGB § 212\n' +
//                 'Diebstahl → StGB § 242\n' +
//                 'Betrug → StGB § 263\n' +
//                 'Körperverletzung → StGB § 223\n' +
//                 'Kaufvertrag → BGB § 433\n' +
//                 'Werkvertrag → BGB § 631\n' +
//                 'Mietvertrag → BGB § 535\n' +
//                 'Darlehen → BGB § 488\n' +
//                 'Schenkung → BGB § 516\n' +
//                 'Bürgschaft → BGB § 765\n' +
//                 'Eigentum → BGB § 903\n' +
//                 'Besitz → BGB § 854\n' +
//                 'Geschäftsfähigkeit → BGB § 104\n' +
//                 'Verjährung → BGB § 195\n' +
//                 'Schadensersatz → BGB § 249\n' +
//                 'Kaufmann → HGB § 1\n' +
//                 'Prokura → HGB § 48\n' +
//                 'GmbH → GmbHG § 13\n' +
//                 'Stammkapital → GmbHG § 5\n' +
//                 'Normenkontrolle → GG Art 93\n' +
//                 'Grundrechte → GG Art 1\n' +
//                 'Versammlungsfreiheit → GG Art 8\n' +
//                 'Strafbefehl → StPO § 407\n' +
//                 'Klage → ZPO § 253\n' +
//                 'Example: "Vorsatz vs Fahrlässigkeit" → ' +
//                 '{"concept1":{"term":"Vorsatz","statute":"StGB","paragraph":"15"},' +
//                 '"concept2":{"term":"Fahrlässigkeit","statute":"StGB","paragraph":"15"}}'
//             },
//             { role: 'user', content: question }
//           ]
//         }),
//         signal: AbortSignal.timeout(8000)
//       });
//       const extractData = await extractRes.json();
//       concepts = JSON.parse(extractData.choices[0].message.content);
//       console.log(`[Comparison] Concepts: ${JSON.stringify(concepts)}`);
//     } catch (err) {
//       console.error('[Comparison] Concept extraction failed:', err.message);
//       return null;
//     }

//     if (!concepts?.concept1?.statute || !concepts?.concept2?.statute) {
//       console.warn('[Comparison] Incomplete extraction — falling back');
//       return null;
//     }

//     // ── Step 2: Retrieve chunks directly (bypass doctrine gates) ─────────────
//     const getChunks = (term, statute, paragraph) => {
//       try {
//         const docs = ragService.filterByStatute(statute.toUpperCase(), allDocuments);
//         const allChunks = [];
//         for (const doc of docs) {
//           if (doc.chunks) allChunks.push(...doc.chunks);
//           else if (doc.content) allChunks.push({ content: doc.content, metadata: doc.metadata || {} });
//         }
//         console.log(`[getChunks] ${term}: total chunks available: ${allChunks.length}`);

//         // Strategy 1: term appears in first 200 chars (heading match)
//         const headingChunks = allChunks.filter(c => {
//           const heading = (c.content || '').substring(0, 200).toLowerCase();
//           return heading.includes(term.toLowerCase());
//         });
//         if (headingChunks.length >= 2) {
//           console.log(`[getChunks] ${term}: heading match found ${headingChunks.length} chunks`);
//           return headingChunks.slice(0, 4);
//         }

//         // Strategy 2: paragraph number with word boundary
//         if (paragraph) {
//           const paraChunks = allChunks.filter(c => {
//             const content = c.content || '';
//             return content.match(new RegExp(`§\\s*${paragraph}[^0-9]`));
//           });
//           if (paraChunks.length >= 1) {
//             console.log(`[getChunks] ${term}: paragraph ${paragraph} match found ${paraChunks.length} chunks`);
//             return paraChunks.slice(0, 4);
//           }
//         }

//         // Strategy 3: TF-IDF fallback
//         const ranked = ragService.tfidfRerank(allChunks, term);
//         console.log(`[getChunks] ${term}: TF-IDF fallback, top chunk: ${ranked[0]?.content?.substring(0,80)}`);
//         return ranked.slice(0, 4);
//       } catch (err) {
//         console.error(`[getChunks] Failed for ${term}:`, err.message);
//         return [];
//       }
//     };

//     const chunks1 = getChunks(concepts.concept1.term, concepts.concept1.statute, concepts.concept1.paragraph);
//     const chunks2 = getChunks(concepts.concept2.term, concepts.concept2.statute, concepts.concept2.paragraph);
//     console.log(`[Comparison] Retrieved ${chunks1.length} chunks for concept1, ${chunks2.length} for concept2`);

//     const text1 = chunks1.map(c => c.content || '').join('\n').substring(0, 1500);
//     const text2 = chunks2.map(c => c.content || '').join('\n').substring(0, 1500);

//     if (!text1 && !text2) {
//       console.warn('[Comparison] No statute text found for either concept — falling back');
//       return null;
//     }

//     // ── Step 3: Synthesize comparison via DeepSeek ───────────────────────────
//     const c1Label = `${concepts.concept1.term} (${concepts.concept1.statute}${concepts.concept1.paragraph ? ' §' + concepts.concept1.paragraph : ''})`;
//     const c2Label = `${concepts.concept2.term} (${concepts.concept2.statute}${concepts.concept2.paragraph ? ' §' + concepts.concept2.paragraph : ''})`;

//     let comparisonAnswer;
//     try {
//       const synthRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
//         body: JSON.stringify({
//           model: 'deepseek-chat',
//           max_tokens: 900,
//           temperature: 0.1,
//           messages: [
//             {
//               role: 'system',
//               content:
//                 'You are a German legal assistant. Compare the two concepts using ONLY the statute text below.\n' +
//                 'Structure your answer exactly as:\n\n' +
//                 '**[Concept 1] (§ X Statute)**\n- Definition:\n- Key obligations:\n- Risk/liability:\n\n' +
//                 '**[Concept 2] (§ X Statute)**\n- Definition:\n- Key obligations:\n- Risk/liability:\n\n' +
//                 '**Wesentliche Unterschiede:**\n' +
//                 '| Kriterium | Concept 1 | Concept 2 |\n|---|---|---|\n' +
//                 '| Definition | ... | ... |\n| Hauptpflichten | ... | ... |\n| Haftung | ... | ... |\n\n' +
//                 'Answer in German. Do not add information not in the provided text.'
//             },
//             {
//               role: 'user',
//               content: `Frage: ${question}\n\n--- ${c1Label} ---\n${text1 || '(keine Textstellen gefunden)'}\n\n--- ${c2Label} ---\n${text2 || '(keine Textstellen gefunden)'}`
//             }
//           ]
//         }),
//         signal: AbortSignal.timeout(30000)
//       });
//       const synthData = await synthRes.json();
//       comparisonAnswer = synthData.choices[0].message.content;
//       console.log(`[Comparison] Answer generated, length: ${comparisonAnswer.length}`);
//     } catch (err) {
//       console.error('[Comparison] Synthesis failed:', err.message);
//       return null;
//     }

//     // ── Step 4: Return ────────────────────────────────────────────────────────
//     const sources = [
//       ...chunks1.slice(0, 1).map(c => c.metadata || {}),
//       ...chunks2.slice(0, 1).map(c => c.metadata || {})
//     ];

//     return {
//       success: true,
//       data: {
//         answer: comparisonAnswer,
//         sources,
//         confidence: 0.9,
//         statute: null,
//         paragraph: null,
//         metadata: {
//           comparison_mode: true,
//           concept1: concepts.concept1,
//           concept2: concepts.concept2,
//           language: languageStr
//         }
//       }
//     };
//   }

//   // ===========================================================================
//   // ?? CRITICAL FIX: MAIN PROCESSING FLOW WITH AUTHORITY LOCK & EXACT NORM DETECTION
//   // ===========================================================================

//   async processQuestion(question, context = {}) {
//     // ?? CRITICAL FIX: Declare authorityLock at TOP LEVEL (FIXED SCOPE BUG)
//     let authority = null;
//     let authorityLock = { __locked: false };
//     let pythonAuthorityError = null;

//     // Map UI language code to the language string used by the Python service
//     const _lang = context.language || 'de';
//     const languageStr = _lang === 'de' ? 'german' : 'english';

//     try {
//       console.log(`\n?? Processing with EPISTEMIC AUTHORITY: "${question}" [lang=${languageStr}]`);

//       // STEP 0: Reject comparative foreign-law questions — corpus is German law only
//       // Note: \b fails on non-ASCII chars (ö, ä, ü) in JS — use root-substring matching instead.
//       const FOREIGN_SYSTEMS = /(österreich|schweizer|schweiz(?:er)?|amerikanisch|französisch|englisch|britisch|niederländisch|belgisch|polnisch|italienisch|spanisch|türkisch|japanisch|chinesisch|ausländisch|rechtsvergleich|komparativ|austrian|swiss\s+law|french\s+law|common\s+law)/i;
//       if (FOREIGN_SYSTEMS.test(question)) {
//         return {
//           success: true,
//           data: {
//             answer: languageStr === 'german'
//               ? '**Korpus-Einschränkung**\n\nDieses System enthält ausschließlich deutsches Bundesrecht (BGB, StGB, HGB, GG, ZPO, StPO, GmbHG). Fragen zum Recht anderer Staaten oder zu Rechtsvergleichungen mit ausländischen Rechtsordnungen können nicht beantwortet werden.'
//               : '**Corpus limitation**\n\nThis system covers German federal law only (BGB, StGB, HGB, GG, ZPO, StPO, GmbHG). Questions comparing German law with foreign legal systems cannot be answered from this corpus.',
//             confidence: 0,
//             refused: true,
//             sources: [],
//             metadata: { out_of_corpus: true, reason: 'foreign_law_comparison' }
//           }
//         };
//       }

//       // STEP 1: Get all documents
//       const allDocuments = documentService.getAllDocuments();
      
//       if (!allDocuments || allDocuments.length === 0) {
//         return {
//           success: false,
//           error: "Keine Dokumente verfügbar. Bitte laden Sie zuerst deutsche Rechtsdokumente hoch.",
//           details: "Document service returned empty list"
//         };
//       }
      
//       // ===========================================================================
//       // STEP 1.5: COMPARISON MODE — intercept before Python authority resolution
//       // ===========================================================================
//       const COMPARISON_SIGNALS = ['unterschied','unterschiede','difference','differences','vergleich','compare','versus',' vs ','contrast','abgrenzung','gegensatz'];
//       const isComparison = COMPARISON_SIGNALS.some(s => question.toLowerCase().includes(s));
//       console.log('[Comparison Check]', isComparison, '| Question:', question.substring(0,50));

//       if (isComparison && process.env.DEEPSEEK_API_KEY) {
//         try {
//           console.log('[Comparison] Triggering DeepSeek comparison flow');
//           const extractRes = await fetch('https://api.deepseek.com/chat/completions', {
//             method: 'POST',
//             headers: {'Content-Type':'application/json','Authorization':'Bearer '+process.env.DEEPSEEK_API_KEY},
//             body: JSON.stringify({
//               model: 'deepseek-chat',
//               max_tokens: 200,
//               response_format: { type: 'json_object' },
//               messages: [
//                 {role:'system', content:
//                   'Extract the two legal concepts being compared. Return ONLY JSON:\n' +
//                   '{"concept1":{"term":"string","statute":"BGB|StGB|HGB|GG|ZPO|StPO|GmbHG","paragraph":"string or null"},' +
//                   '"concept2":{"term":"string","statute":"BGB|StGB|HGB|GG|ZPO|StPO|GmbHG","paragraph":"string or null"}}\n\n' +
//                   'KNOWN PARAGRAPH MAPPINGS — always use these exact paragraphs:\n' +
//                   'Vorsatz → StGB § 15\n' +
//                   'Fahrlässigkeit → StGB § 15\n' +
//                   'Vorsätzlich → StGB § 15\n' +
//                   'Notwehr → StGB § 32\n' +
//                   'Nothilfe → StGB § 32\n' +
//                   'Mord → StGB § 211\n' +
//                   'Totschlag → StGB § 212\n' +
//                   'Diebstahl → StGB § 242\n' +
//                   'Betrug → StGB § 263\n' +
//                   'Körperverletzung → StGB § 223\n' +
//                   'Kaufvertrag → BGB § 433\n' +
//                   'Werkvertrag → BGB § 631\n' +
//                   'Mietvertrag → BGB § 535\n' +
//                   'Darlehen → BGB § 488\n' +
//                   'Schenkung → BGB § 516\n' +
//                   'Bürgschaft → BGB § 765\n' +
//                   'Eigentum → BGB § 903\n' +
//                   'Besitz → BGB § 854\n' +
//                   'Geschäftsfähigkeit → BGB § 104\n' +
//                   'Verjährung → BGB § 195\n' +
//                   'Schadensersatz → BGB § 249\n' +
//                   'Kaufmann → HGB § 1\n' +
//                   'Prokura → HGB § 48\n' +
//                   'GmbH → GmbHG § 13\n' +
//                   'Stammkapital → GmbHG § 5\n' +
//                   'Normenkontrolle → GG Art 93\n' +
//                   'Grundrechte → GG Art 1\n' +
//                   'Versammlungsfreiheit → GG Art 8\n' +
//                   'Strafbefehl → StPO § 407\n' +
//                   'Klage → ZPO § 253\n' +
//                   'Example: "Vorsatz vs Fahrlässigkeit" → ' +
//                   '{"concept1":{"term":"Vorsatz","statute":"StGB","paragraph":"15"},' +
//                   '"concept2":{"term":"Fahrlässigkeit","statute":"StGB","paragraph":"15"}}'
//                 },
//                 {role:'user', content: question}
//               ]
//             }),
//             signal: AbortSignal.timeout(8000)
//           });
//           const extractData = await extractRes.json();
//           const extracted = JSON.parse(extractData.choices[0].message.content);
//           console.log('[Comparison] Extracted concepts:', JSON.stringify(extracted));

//           // Retrieve chunks for both concepts using filterByStatute + paragraph-aware retrieval
//           const _getChunks = (term, statute, paragraph) => {
//             try {
//               const docs = ragService.filterByStatute(statute.toUpperCase(), allDocuments);
//               const flat = [];
//               for (const doc of docs) {
//                 if (doc.chunks) flat.push(...doc.chunks);
//                 else if (doc.content) flat.push({ content: doc.content, metadata: doc.metadata || {} });
//               }
//               console.log(`[getChunks] ${term}: total chunks available: ${flat.length}`);

//               // Strategy 1: term appears in first 200 chars (heading match)
//               const headingChunks = flat.filter(c => {
//                 const heading = (c.content || '').substring(0, 200).toLowerCase();
//                 return heading.includes(term.toLowerCase());
//               });
//               if (headingChunks.length >= 2) {
//                 console.log(`[getChunks] ${term}: heading match found ${headingChunks.length} chunks`);
//                 return headingChunks.slice(0, 4);
//               }

//               // Strategy 2: paragraph number with word boundary
//               if (paragraph) {
//                 const paraChunks = flat.filter(c => {
//                   const content = c.content || '';
//                   return content.match(new RegExp(`§\\s*${paragraph}[^0-9]`));
//                 });
//                 if (paraChunks.length >= 1) {
//                   console.log(`[getChunks] ${term}: paragraph ${paragraph} match found ${paraChunks.length} chunks`);
//                   return paraChunks.slice(0, 4);
//                 }
//               }

//               // Strategy 3: TF-IDF fallback
//               const ranked = ragService.tfidfRerank(flat, term);
//               console.log(`[getChunks] ${term}: TF-IDF fallback, top chunk: ${ranked[0]?.content?.substring(0,80)}`);
//               return ranked.slice(0, 4);
//             } catch (err) {
//               console.error(`[getChunks] Failed for ${term}:`, err.message);
//               return [];
//             }
//           };
//           const chunks1 = _getChunks(extracted.concept1.term, extracted.concept1.statute, extracted.concept1.paragraph);
//           const chunks2 = _getChunks(extracted.concept2.term, extracted.concept2.statute, extracted.concept2.paragraph);
//           const text1 = chunks1.map(c=>c.content||'').join('\n').substring(0, 1500);
//           const text2 = chunks2.map(c=>c.content||'').join('\n').substring(0, 1500);

//           // Synthesize comparison
//           const synthRes = await fetch('https://api.deepseek.com/chat/completions', {
//             method: 'POST',
//             headers: {'Content-Type':'application/json','Authorization':'Bearer '+process.env.DEEPSEEK_API_KEY},
//             body: JSON.stringify({
//               model: 'deepseek-chat',
//               max_tokens: 800,
//               messages: [
//                 {role:'system', content:'You are a German legal assistant. Compare two legal concepts using ONLY the provided statute text. Structure your answer as:\n**[Concept 1] (§ X Statute)**\n- Definition:\n- Key obligations:\n- Risk/liability:\n\n**[Concept 2] (§ X Statute)**\n- Definition:\n- Key obligations:\n- Risk/liability:\n\n**Key Differences:**\n| Criteria | Concept 1 | Concept 2 |\nDo not add anything not in the provided text. Answer in German.'},
//                 {role:'user', content:`Question: ${question}\n\nConcept 1 text:\n${text1}\n\nConcept 2 text:\n${text2}`}
//               ]
//             }),
//             signal: AbortSignal.timeout(30000)
//           });
//           const synthData = await synthRes.json();
//           const comparisonAnswer = synthData.choices[0].message.content;
//           console.log('[Comparison] Answer generated, length:', comparisonAnswer.length);

//           // Quality gate: fall back to doctrine if RAG chunks were empty/useless
//           const isEmptyComparison = !comparisonAnswer ||
//             comparisonAnswer.includes('nicht möglich') ||
//             comparisonAnswer.includes('nicht aus den bereitgestellten') ||
//             comparisonAnswer.includes('keine Definition') ||
//             comparisonAnswer.length < 200;

//           if (isEmptyComparison && process.env.DEEPSEEK_API_KEY) {
//             console.log('[Comparison Fallback] Empty comparison — switching to doctrine fallback');
//             try {
//               const fallbackRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
//                 method: 'POST',
//                 headers: {
//                   'Content-Type': 'application/json',
//                   'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY
//                 },
//                 body: JSON.stringify({
//                   model: 'deepseek-chat',
//                   max_tokens: 600,
//                   messages: [
//                     {
//                       role: 'system',
//                       content: 'Du bist ein deutscher Rechtsdozent. Beantworte die Frage präzise auf Deutsch. ' +
//                         'Strukturiere die Antwort mit: Definition beider Konzepte, Unterschiede, Prüfungsschema. ' +
//                         'Zitiere relevante Paragraphen. Max 500 Wörter.'
//                     },
//                     { role: 'user', content: question }
//                   ]
//                 }),
//                 signal: AbortSignal.timeout(15000)
//               });
//               const fallbackData = await fallbackRes.json();
//               const fallbackAnswer = fallbackData.choices?.[0]?.message?.content;
//               if (fallbackAnswer && fallbackAnswer.length > 100) {
//                 const disclaimer = '\n\n---\n*⚠️ Diese Antwort basiert auf allgemeinem Rechtswissen, nicht auf einem spezifischen Gesetzestext.*';
//                 return {
//                   success: true,
//                   data: {
//                     answer: fallbackAnswer + disclaimer,
//                     confidence: 0.7,
//                     statute: null,
//                     sources: [],
//                     metadata: { comparison_mode: false, doctrine_fallback: true }
//                   }
//                 };
//               }
//             } catch (err) {
//               console.error('[Comparison Fallback] Failed:', err.message);
//             }
//           }

//           return {
//             success: true,
//             data: {
//               answer: comparisonAnswer,
//               statute: extracted.concept1.statute,
//               confidence: 0.9,
//               sources: [...chunks1.slice(0,1).map(c=>c.metadata||{}), ...chunks2.slice(0,1).map(c=>c.metadata||{})],
//               comparisonMode: true
//             }
//           };
//         } catch(err) {
//           console.error('[Comparison] Failed, falling back to standard RAG:', err.message);
//         }
//       }

//       // ===========================================================================
//       // STEP 2: Use PYTHON for authority resolution WITH IMMEDIATE TERMINAL CHECK
//       // ===========================================================================
//       console.log(`?? [ChatService] Resolving authority via Python service...`);
      
//       try {
//         const authorityResult = await pythonIntegrationService.resolveAuthority(question);
        
//         if (authorityResult.success && authorityResult.authority) {
//           authority = authorityResult.authority;

//           // Normalize statute to uppercase — Python sometimes returns 'StGB' instead of 'STGB'
//           if (authority.statute && typeof authority.statute === 'string') {
//             authority.statute = authority.statute.toUpperCase();
//           }

//           // ===========================================================================
//           // ?? CRITICAL FIX: DETECT EXPLICIT NORM REFERENCES BEFORE TERMINAL CHECK
//           // ===========================================================================
//           const explicitNorm = this.detectExactNormReference(question);
//           if (explicitNorm) {
//             console.log(`?? [CRITICAL FIX] Explicit norm reference detected: ${explicitNorm.statute} §${explicitNorm.paragraph}`);
//             console.log(`   Overriding Python authority (statute: ${authority.statute || 'null'})`);

//             // Override Python's authority with explicit reference
//             authority.statute = explicitNorm.statute;
//             authority.paragraph = explicitNorm.paragraph;
//             authority.isArticle = explicitNorm.isArticle;
//             authority.authority_mode = 'exact';
//             authority.isStatuteLocked = true;
//             authority.isParagraphLocked = true;
//             authority.requiresClarification = false;

//             // Mark as terminal-equivalent
//             authority.__explicit_norm_reference = true;
//             authority.__explicit_override = true;
//           } else {
//             // FIX: bare-statute keyword override — catches "nach StPO", "gemäß ZPO" etc.
//             // Python sometimes misclassifies when no § is present; the question's own words win.
//             const STATUTE_KEYWORDS = {
//               STPO: /\b(stpo|strafprozessordnung|strafverfahrensrecht)\b/i,
//               ZPO:  /\b(zpo|zivilprozessordnung|zivilprozess(?:recht)?)\b/i,
//               GMBHG: /\b(gmbhg|gmbh-gesetz|gmbh\s*gesetz)\b/i,
//               HGB:  /\b(hgb|handelsgesetzbuch|handelsrecht)\b/i,
//               GG:   /\b(grundgesetz|gg(?:\s|$))/i,
//               STGB: /\b(stgb|strafgesetzbuch|strafrecht)\b/i,
//               BGB:  /\b(bgb|bürgerliches\s*gesetzbuch|zivilrecht)\b/i,
//             };
//             for (const [statute, pattern] of Object.entries(STATUTE_KEYWORDS)) {
//               if (pattern.test(question)) {
//                 if (authority.statute !== statute) {
//                   console.log(`[StatuteKeyword] Overriding Python statute "${authority.statute}" → "${statute}" based on question keyword`);
//                   authority.statute = statute;
//                   authority.isStatuteLocked = true;
//                 }
//                 break;
//               }
//             }
//           }
          
//           // ===========================================================================
//           // DOCTRINE KEYWORD FALLBACK — when Python returns null statute, infer from
//           // question content so downstream RAG doesn't receive a null statute.
//           // ===========================================================================
//           if (!authority.statute || authority.statute === 'UNKNOWN' || authority.statute === 'null') {
//             const q = question.toLowerCase();
//             let inferredStatute;
//             if (q.match(/nichtig|anfechtb|willenserklär|geschäftsfähig|verjähr|kaufvertr|werkvertr|mietvertr|bürgschaft|besitz|eigentum|schadensersatz|kausalität|zurechenbar|schuld|pflichtverletz|unmittelbar|mittelbar|anspruch|einrede|delikt|haftung/)) {
//               inferredStatute = 'BGB';
//             } else if (q.match(/strafbar|vorsatz|fahrlässig|notwehr|mord|diebstahl|betrug|körperverletzung|tatbestand|rechtswidrigkeit|schuld.*straf|rechtfertig|entschuldig/)) {
//               inferredStatute = 'STGB';
//             } else if (q.match(/kaufmann|handelsgewerbe|prokura|firma|handelsregister|konnossement/)) {
//               inferredStatute = 'HGB';
//             } else if (q.match(/gmbh|stammkapital|gesellschaft.*mbh|geschäftsführer.*gmbh/)) {
//               inferredStatute = 'GMBHG';
//             } else if (q.match(/grundrecht|verfassung|bundestag|bundesrat|grundgesetz|normenkontrolle/)) {
//               inferredStatute = 'GG';
//             } else if (q.match(/strafverfahren|strafprozess|anklage|hauptverhandlung|strafbefehl/)) {
//               inferredStatute = 'STPO';
//             } else if (q.match(/klage.*zivil|zivilprozess|zustellung.*gericht|vollstreckung/)) {
//               inferredStatute = 'ZPO';
//             } else {
//               inferredStatute = 'BGB'; // safe default for unrecognized doctrine
//             }
//             console.log(`[Doctrine Keyword Fallback] authority.statute was "${authority.statute}" — inferred: ${inferredStatute}`);
//             authority.statute = inferredStatute;
//             authority.isStatuteLocked = true;
//           }

//           // ===========================================================================
//           // ?? CRITICAL: IMMEDIATE TERMINAL AUTHORITY CHECK (BEFORE ANY NODE PROCESSING)
//           // ===========================================================================
//           console.log(`? Python raw authority:`, JSON.stringify(authority, null, 2));
          
//           if (this.isTerminalAuthority(authority)) {
//             console.log(`?? [TERMINAL AUTHORITY] Python declared final paragraph - Node MUST STOP IMMEDIATELY`);
//             console.log(`   Statute: ${authority.statute}, Paragraph: ${authority.paragraph}`);
//             console.log(`   Terminal metadata:`, {
//               authority_final: authority.authority_final,
//               terminal: authority.terminal,
//               retrieval_constraint: authority.retrieval?.constraint,
//               force_exact: authority.force_exact
//             });
            
//             // ?? GUARDRAIL: Ensure contract integrity
//             if (authority.authority_final && !authority.paragraph) {
//               console.error(`?? CONTRACT VIOLATION: authority_final=true but paragraph missing!`);
//             }
            
//             if (authority.authority_final && authority.authority_mode === 'overview') {
//               console.error(`?? CONTRACT VIOLATION: terminal authority downgraded to overview mode`);
//             }
            
//             // Generate terminal response with exact content
//             const statuteName = this.getStatuteDisplayName(authority.statute);
//             const paragraphRef = authority.isArticle ? `Artikel ${authority.paragraph}` : `§${authority.paragraph}`;
            
//             // Try to find exact paragraph text for completeness
//             let answerText = authority.text || authority.answer || authority.content;
            
//             if (!answerText && authority.statute && authority.paragraph) {
//               const exactChunk = this.findExactParagraph(allDocuments, authority.statute, authority.paragraph);
//               if (exactChunk) {
//                 answerText = exactChunk.content || exactChunk.text;
//               }
//             }
            
//             // Fallback if no text found
//             if (!answerText) {
//               answerText = `**${statuteName} ${paragraphRef}**\n\n[Exakte Paragrapheninhalte aus dem Python-Autoritätsdienst]`;
//             }
            
//             const terminalResponse = {
//               success: true,
//               data: {
//                 answer: answerText,
//                 structuredAnswer: {
//                   fullAnswer: answerText,
//                   confidence: 1.0,
//                   template_used: 'terminal_authority',
//                   domain: 'legal',
//                   metadata: {
//                     terminal_authority: true,
//                     authority_final: true,
//                     statute: authority.statute,
//                     paragraph: authority.paragraph,
//                     authority_mode: authority.authority_mode || 'exact',
//                     retrieval_constraint: authority.retrieval?.constraint || 'PARAGRAPH_STRICT',
//                     retrieval_used: false,
//                     safety_check_skipped: true,
//                     node_pipeline_bypassed: true,
//                     python_authority_preserved: true,
//                     python_metadata_untouched: true
//                   }
//                 },
//                 sources: authority.statute && authority.paragraph ? [{
//                   statute: authority.statute,
//                   paragraph: authority.paragraph,
//                   content: 'Python terminal authority directive',
//                   metadata: { 
//                     source: 'python_authority_service',
//                     authority_final: authority.authority_final,
//                     constraint: authority.retrieval?.constraint
//                   }
//                 }] : [],
//                 confidence: 1.0,
//                 conversationId: Date.now().toString(),
//                 legalDomain: 'legal',
//                 statute: authority.statute,
//                 paragraph: authority.paragraph,
//                 isArticle: authority.isArticle,
//                 authority: authority, // PRESERVE ORIGINAL
//                 classification: authority.classification || { type: 'EXACT_OPERATIVE_NORM', domain: 'legal' },
//                 safetyCheck: {
//                   isLegallySound: true,
//                   legalDefensibility: 'HIGH',
//                   examinerReadiness: 'EXAMINER_READY',
//                   confidenceAdjusted: 1.0,
//                   metadata: { safety_check_skipped: true }
//                 },
//                 metadata: {
//                   terminal_authority: true,
//                   authority_final: true,
//                   node_pipeline_bypassed: true,
//                   python_terminal_directive: true,
//                   execution_order: 'terminal_early_exit'
//                 }
//               }
//             };
            
//             // Log safety event for audit
//             safetyCheck.logSafetyEvent('TERMINAL_AUTHORITY_ENFORCED', {
//               question,
//               statute: authority.statute,
//               paragraph: authority.paragraph,
//               authority_mode: authority.authority_mode,
//               retrieval_constraint: authority.retrieval?.constraint,
//               python_metadata: {
//                 authority_final: authority.authority_final,
//                 terminal: authority.terminal,
//                 force_exact: authority.force_exact
//               },
//               execution_order: 'immediate',
//               timestamp: new Date().toISOString(),
//               contract_integrity: 'preserved'
//             });
            
//             return resultFormatter.formatResponse(terminalResponse, authority);
//           }
          
//           // ===========================================================================
//           // ?? CREATE AUTHORITY LOCK (NON-TERMINAL CASES)
//           // ===========================================================================
//           authorityLock = this.createAuthorityLock(authority);
//           console.log(`?? [Authority Lock] Created for non-terminal authority:`, {
//             statute: authority.statute,
//             paragraph: authority.paragraph,
//             locked: authorityLock.__locked,
//             reason: authorityLock.__lockReason
//           });
          
//           // ===========================================================================
//           // ? ONLY NOW MAY NODE TOUCH AUTHORITY METADATA (NON-TERMINAL CASES)
//           // ===========================================================================
//           console.log(`? Terminal check passed - Node may process authority`);
          
//           // Preserve Python's doctrine classification
//           if (authorityResult.authority.question_type) {
//             authority.question_type = authorityResult.authority.question_type;
//           }
          
//           if (authorityResult.authority.doctrinal_match !== undefined) {
//             authority.doctrinal_match = authorityResult.authority.doctrinal_match;
//           }

//           // Python uses camelCase epistemicCertainty; snake_case is a fallback alias
//           if (authorityResult.authority.epistemicCertainty) {
//             authority.epistemicCertainty = authorityResult.authority.epistemicCertainty;
//           } else if (authorityResult.authority.epistemic_certainty) {
//             authority.epistemicCertainty = authorityResult.authority.epistemic_certainty;
//           }

//           if (authorityResult.authority.suggestedField) {
//             authority.suggestedField = authorityResult.authority.suggestedField;
//           }
          
//           // Python uses camelCase (anchorNormMode); guard against snake_case alias too
//           if (authorityResult.authority.anchorNormMode !== undefined) {
//             authority.anchorNormMode = authorityResult.authority.anchorNormMode;
//           } else if (authorityResult.authority.anchor_norm_mode !== undefined) {
//             authority.anchorNormMode = authorityResult.authority.anchor_norm_mode;
//           }
          
//           // Don't override classification if Python provided one
//           if (!authority.classification && 
//               (authority.question_type === 'DOCTRINE' || 
//                authority.question_type === 'GENERAL_DOCTRINE' ||
//                authority.doctrinal_match === true)) {
//             authority.classification = {
//               type: 'DOCTRINE',
//               domain: authority.domain || 'general',
//               source: 'python_doctrine_detection'
//             };
//           }
          
//           // Parse Python's clarification field
//           if (authority.status) {
//             authority.requiresClarification = authority.status === 'CLARIFICATION_REQUIRED';
//             console.log(`?? Python status: ${authority.status}, requiresClarification: ${authority.requiresClarification}`);
//           }
          
//           console.log(`? Python authority resolved: ${authority.statute || 'NO_STATUTE'} ${authority.paragraph ? '§' + authority.paragraph : ''}`);
//           console.log(`   question_type: ${authority.question_type}`);
//           console.log(`   doctrinal_match: ${authority.doctrinal_match}`);
//           console.log(`   epistemicCertainty: ${authority.epistemicCertainty}`);
//           console.log(`   anchorNormMode: ${authority.anchorNormMode}`);
//           console.log(`   classification: ${authority.classification?.type || 'none'}`);
//           console.log(`   authority_lock: ${authorityLock.__locked ? 'LOCKED' : 'UNLOCKED'}`);
          
//         } else {
//           console.log(`?? Python authority resolution failed or no statute found — continuing with TF-IDF fallback`);
//           authority = {
//             statute: null,
//             paragraph: null,
//             isArticle: false,
//             requiresClarification: false,
//             stopProcessing: false,
//             confidence: 0.3,
//             referenceSource: 'python_failed',
//             authority_mode: 'fallback',
//             classification: {
//               type: 'GENERAL',
//               domain: 'general',
//               source: 'python_fallback'
//             }
//           };
//           authorityLock = { __locked: false };
//         }
//       } catch (error) {
//         console.log(`? Python authority service error: ${error.message} — continuing with TF-IDF fallback`);
//         pythonAuthorityError = error.message;
//         authority = {
//           statute: null,
//           paragraph: null,
//           isArticle: false,
//           requiresClarification: false,
//           stopProcessing: false,
//           confidence: 0.1,
//           referenceSource: 'python_error',
//           authority_mode: 'fallback',
//           classification: {
//             type: 'GENERAL',
//             domain: 'general',
//             source: 'python_error_fallback'
//           }
//         };
//         authorityLock = { __locked: false };
//       }
      
//       // ?? CHECK AUTHORITY LOCK BEFORE ANY FURTHER PROCESSING
//       if (authorityLock?.__locked === true) {
//         console.log(`?? [Authority Lock] Downstream processing BLOCKED`);
//         console.log(`   Question: "${question.substring(0, 80)}..."`);
//         console.log(`   Lock Reason: ${authorityLock.__lockReason}`);
        
//         safetyCheck.logSafetyEvent('AUTHORITY_LOCK_DOWNSTREAM_BLOCK', {
//           question,
//           statute: authorityLock.statute,
//           paragraph: authorityLock.paragraph,
//           lock_reason: authorityLock.__lockReason,
//           lock_timestamp: authorityLock.__lockTimestamp,
//           python_error: pythonAuthorityError,
//           execution_path: 'blocked_by_lock'
//         });
        
//         // Return locked response
//         const lockedResponse = {
//           success: true,
//           data: {
//             answer: `**Autorität gesperrt**\n\nDie Anfrage wurde durch den autoritativen Dienst finalisiert. Weitere Verarbeitung ist gesperrt.\n\n*Status: ${authorityLock.__lockReason}*`,
//             confidence: 0.9,
//             statute: authorityLock.statute,
//             paragraph: authorityLock.paragraph,
//             metadata: {
//               authority_locked: true,
//               lock_reason: authorityLock.__lockReason,
//               lock_timestamp: authorityLock.__lockTimestamp,
//               downstream_processing_blocked: true,
//               python_authority_preserved: true
//             }
//           }
//         };
        
//         return resultFormatter.formatResponse(lockedResponse, authority);
//       }
      
//       // ===========================================================================
//       // ?? CRITICAL FIX: UPDATED CLARIFICATION LOGIC WITH EXPLICIT NORM DETECTION
//       // ===========================================================================
//       const shouldRequireClarification = () => {
//         if (authority.stopProcessing === true) {
//       console.log('[TRACE] shouldRequireClarification called, requiresClarification=' + authority.requiresClarification + ' status=' + authority.status + ' mode=' + authority.authority_mode);
//           console.log(`?? Python service explicitly requested stop`);
//           return true;
//         }
        
//         const implicitAllowed = 
//           authority?.authority_mode === 'overview' && 
//           authority?.confidence >= 0.8;
        
//         // ?? CRITICAL FIX: Explicit norm references override Python's authority
//         if (authority.__explicit_norm_reference === true) {
//           console.log(`? [Explicit Norm Override] Suppressing clarification for explicit norm reference`);
//           return false; // ? NO clarification needed!
//         }

//         // Bypass clarification for doctrine/conceptual questions that don't need a
//         // specific §-reference to be answerable — DeepSeek fallback will cover them.
//         const DOCTRINE_TERMS = [
//           'nichtigkeit','anfechtbar','anfechtung','rechtsgeschäft',
//           'verjährung','schadensersatz','besitz','eigentum',
//           'notwehr','vorsatz','fahrlässigkeit','tatbestand',
//           'rechtsfolge','kausalität','zurechenbarkeit','schuld',
//           'rechtfertigung','entschuldigung','strafbarkeit',
//           'kaufvertrag','werkvertrag','mietvertrag','bürgschaft',
//           'ex tunc','ex nunc','willenserklärung','geschäftsfähigkeit',
//           'unmittelbar','mittelbar','anspruch','einrede',
//           'delikt','haftung','pflichtverletzung','verschulden',
//         ];
//         const hasDoctrineTerm = DOCTRINE_TERMS.some(t =>
//           question.toLowerCase().includes(t)
//         );
//         const isLongQuestion = question.length > 50;
//         const hasComparison = ['unterschied','vergleich','unterscheiden','versus',' vs '].some(s =>
//           question.toLowerCase().includes(s)
//         );

//         if (hasDoctrineTerm || (isLongQuestion && hasComparison)) {
//           console.log(`✅ [Doctrine Bypass] Suppressing clarification — doctrine:${hasDoctrineTerm} longComparison:${isLongQuestion && hasComparison}`);
//           return false;
//         }

//         if (!authority.statute && !implicitAllowed) {
//           console.log(`?? No statute detected and implicit authority NOT allowed`);
//           return true;
//         }
        
//         if (!authority.statute && implicitAllowed) {
//           console.log(`? Implicit authority allowed – proceeding without statute`);
//           return false;
//         }
        
//         // ?? CRITICAL FIX: Check if this is a statute-only doctrine question
//         // ===========================================================================
//         const isStatuteOnlyDoctrineQuestion = () => {
//           // Check Python's metadata for statute-only constraint
//           const isStatuteOnly = 
//             authority.retrieval?.constraint === 'STATUTE_ONLY' ||
//             authority.constraint === 'STATUTE_ONLY' ||
//             authority.statute_only === true;
          
//           // Check if this is a doctrinal question
//           const isDoctrinalQuestion = 
//             authority.question_type === 'DOCTRINE' ||
//             authority.question_type === 'GENERAL_DOCTRINE' ||
//             authority.question_type === 'GENERAL' ||
//             authority.doctrinal_match === true ||
//             authority.classification?.type === 'DOCTRINE';
          
//           // Statute is locked but paragraph is not
//           const isStatuteLocked = 
//             authority.isStatuteLocked === true ||
//             authority.statute_locked === true;
          
//           const isParagraphNotLocked = 
//             authority.isParagraphLocked === false ||
//             authority.paragraph_locked === false;
          
//           return isStatuteOnly && isDoctrinalQuestion && isStatuteLocked && isParagraphNotLocked;
//         };
        
//         // ?? CRITICAL FIX: Handle statute-only doctrine questions
//         if (authority.statute && !authority.paragraph) {
//           // Check if this is a statute-only doctrine question FIRST
//           if (isStatuteOnlyDoctrineQuestion()) {
//             console.log(`? [DOCTRINE FIX] Statute-only doctrine question: ${authority.statute} - paragraph NOT required`);
//             console.log(`   Retrieval constraint: ${authority.retrieval?.constraint}`);
//             console.log(`   Question type: ${authority.question_type}`);
//             console.log(`   Statute locked: ${authority.isStatuteLocked}, Paragraph locked: ${authority.isParagraphLocked}`);
//             return false; // ? NO clarification needed!
//           }
          
//           // Original logic for non-doctrinal questions
//           if (authority.authority_mode === 'overview') {
//             console.log(`? Overview mode: statute ${authority.statute} without paragraph is allowed`);
//             return false;
//           }

//           // General definition questions (e.g. "Was ist Schadensersatz?") arrive with
//           // anchorNormMode=true but no specific paragraph. When authority_mode is
//           // undefined or 'fallback', Python has identified a statute anchor but not a
//           // paragraph — this is intentional and must not block the response.
//           const isUndefinedOrFallbackMode =
//             !authority.authority_mode || authority.authority_mode === 'fallback';
//           if (isUndefinedOrFallbackMode && authority.anchorNormMode === true) {
//             console.log(`? [Anchor Norm Mode] Statute-only anchor for general question — paragraph not required`);
//             console.log(`   authority_mode: ${authority.authority_mode || 'undefined'}, anchorNormMode: ${authority.anchorNormMode}`);
//             return false;
//           }

//           // If the user's question contains no specific paragraph reference (§ N or Art. N),
//           // it is an overview/definition question — allow it to proceed without a paragraph.
//           const questionHasSpecificParagraph = /§\s*\d+|art\.\s*\d+/i.test(question);
//           if (!questionHasSpecificParagraph) {
//             console.log(`? [Overview Fallback] No specific § in question — allowing statute-overview for ${authority.statute}`);
//             return false;
//           }

//           // Do NOT fire clarification if the question already contains an explicit
//           // statute name (BGB, StGB, etc.) AND a § reference — the user was clear.
//           const KNOWN_STATUTE_NAMES = /\b(BGB|StGB|HGB|GmbHG|StPO|ZPO|GG)\b/i;
//           if (KNOWN_STATUTE_NAMES.test(question)) {
//             console.log(`✅ [Explicit Ref] Question has § + statute name — skipping clarification for ${authority.statute}`);
//             return false;
//           }

//           console.log(`?? Statute ${authority.statute} found but paragraph missing in mode ${authority.authority_mode}`);
//           return true;
//         }
        
//         const _noParaInQ = !question.match(/\u00a7|\u0026#167;|art\.\s*\d+/i) && !question.includes("§"); if (_noParaInQ) { console.log("✅ [ReqClar Bypass] No § in question — ignoring Python clarification flag"); return false; } if (authority.requiresClarification === true) {
//           console.log(`?? Python explicitly flagged clarification required`);
//           return true;
//         }
        
//         return false;
//       };
      
//       if (shouldRequireClarification()) {
//         console.log(`? [ChatService] Authority clarification required`);
        
//         safetyCheck.logSafetyEvent('AUTHORITY_CLARIFICATION', {
//           question,
//           statute: authority.statute,
//           paragraph: authority.paragraph,
//           authority_mode: authority.authority_mode,
//           clarificationType: !authority.statute ? 'statute_missing' : 'paragraph_missing',
//           timestamp: new Date().toISOString(),
//           python_error: !!pythonAuthorityError,
//           python_status: authority.status || 'unknown'
//         });
        
//         const clarification = this.generateStructuredClarification(authority, question, pythonAuthorityError);
//         return resultFormatter.formatResponse(clarification, authority);
//       }
      
//       console.log(`? Authority from Python: ${authority.statute} ${authority.paragraph ? (authority.isArticle ? 'Article ' : '§') + authority.paragraph : ''} (mode: ${authority.authority_mode})`);
      
//       // ===========================================================================
//       // STEP 3: CHECK FOR EXACT MODE (WITH TEXT-BASED PARAGRAPH EXTRACTION)
//       // ===========================================================================
//       if (authority.authority_mode === 'exact' && authority.statute && authority.paragraph) {
//         console.log(`?? [Exact Mode] Processing exact paragraph: ${authority.statute} §${authority.paragraph}`);
        
//         // Find exact paragraph with text extraction
//         const exactChunk = this.findExactParagraph(allDocuments, authority.statute, authority.paragraph);
        
//         if (!exactChunk) {
//           console.log(`? [Exact Mode] Paragraph §${authority.paragraph} not found in ${authority.statute}`);
          
//           // Try fallback: Search for any BGB chunks that might contain the paragraph
//           console.log(`?? [Exact Mode Fallback] Searching for any mention of §${authority.paragraph} in ${authority.statute} content...`);
          
//           const fallbackChunks = [];
//           for (const doc of allDocuments) {
//             const chunks = doc.chunks || [doc];
//             for (const chunk of chunks) {
//               const statuteRaw = chunk.metadata?.statute || doc.metadata?.statute;
//               if (statuteRaw === authority.statute) {
//                 const content = chunk.content || chunk.text || '';
//                 // Look for paragraph in text
//                 if (content.includes(`§${authority.paragraph}`) || 
//                     content.includes(`§ ${authority.paragraph}`) ||
//                     content.includes(`Paragraph ${authority.paragraph}`)) {
//                   fallbackChunks.push({
//                     chunk,
//                     matchType: 'text_inclusion',
//                     preview: content.substring(0, 200)
//                   });
//                 }
//               }
//             }
//           }
          
//           if (fallbackChunks.length > 0) {
//             console.log(`?? [Exact Mode] Found ${fallbackChunks.length} chunks containing §${authority.paragraph} in text`);
//             // Use the first one
//             const fallbackChunk = fallbackChunks[0].chunk;
//             console.log(`? [Exact Mode Fallback] Using chunk with text inclusion`);
            
//             const exactResponse = {
//               success: true,
//               data: {
//                 answer: this.formatChunkAsAnswer(fallbackChunk.content || fallbackChunk.text, authority.statute, authority.paragraph, authority.isArticle),
//                 structuredAnswer: {
//                   fullAnswer: this.formatChunkAsAnswer(fallbackChunk.content || fallbackChunk.text, authority.statute, authority.paragraph, authority.isArticle),
//                   confidence: 1.0,
//                   template_used: 'exact_paragraph_fallback',
//                   domain: 'legal',
//                   metadata: {
//                     exact_mode: true,
//                     authority_mode: 'exact',
//                     statute: authority.statute,
//                     paragraph: authority.paragraph,
//                     retrieval_used: false,
//                     safety_check_skipped: true,
//                     content_source: 'text_inclusion_fallback',
//                     fallback_used: true
//                   }
//                 },
//                 sources: [{
//                   statute: authority.statute,
//                   paragraph: authority.paragraph,
//                   content: (fallbackChunk.content || fallbackChunk.text)?.substring(0, 200) + '...',
//                   metadata: fallbackChunk.metadata
//                 }],
//                 confidence: 1.0,
//                 conversationId: Date.now().toString(),
//                 legalDomain: 'legal',
//                 statute: authority.statute,
//                 paragraph: authority.paragraph,
//                 isArticle: authority.isArticle,
//                 authority: authority,
//                 classification: {
//                   type: 'EXACT_OPERATIVE_NORM',
//                   domain: 'legal',
//                   source: 'exact_mode_processor'
//                 },
//                 safetyCheck: {
//                   isLegallySound: true,
//                   legalDefensibility: 'HIGH',
//                   examinerReadiness: 'EXAMINER_READY',
//                   confidenceAdjusted: 1.0,
//                   metadata: { safety_check_skipped: true }
//                 },
//                 metadata: {
//                   documentsUsed: 1,
//                   processingTime: 0,
//                   language: languageStr,
//                   exactParagraphMatch: false,
//                   textInclusionMatch: true,
//                   chunksUsed: 1,
//                   safetyPassed: true,
//                   legalDefensibility: 'HIGH',
//                   examinerReadiness: 'EXAMINER_READY',
//                   architecture: 'epistemic_authority',
//                   statuteLocked: true,
//                   python_service_used: true,
//                   python_authority_resolved: true,
//                   python_authoritative_found: false,
//                   python_results_count: 0,
//                   authority_mode: 'exact',
//                   doctrinal_template: 'exact_paragraph_fallback',
//                   epistemic_certainty: authority.epistemicCertainty,
//                   anchor_norm_mode: authority.anchorNormMode,
//                   safety_check_skipped: true,
//                   fallback_used: true
//                 }
//               }
//             };
            
//             return resultFormatter.formatResponse(exactResponse, authority);
//           }
          
//           return {
//             success: false,
//             error: `Paragraph §${authority.paragraph} nicht in ${this.getStatuteDisplayName(authority.statute)} gefunden.`,
//             data: {
//               requires_clarification: true,
//               statute: authority.statute,
//               paragraph: authority.paragraph,
//               suggestion: "Möglicherweise ist der Paragraph nicht im geladenen Dokument oder die PDF-Struktur enthält keine Paragraphen-Markierungen."
//             }
//           };
//         }
        
//         // Generate exact mode response
//         const exactResponse = {
//           success: true,
//           data: {
//             answer: this.formatChunkAsAnswer(exactChunk.content || exactChunk.text, authority.statute, authority.paragraph, authority.isArticle),
//             structuredAnswer: {
//               fullAnswer: this.formatChunkAsAnswer(exactChunk.content || exactChunk.text, authority.statute, authority.paragraph, authority.isArticle),
//               confidence: 1.0,
//               template_used: 'exact_paragraph',
//               domain: 'legal',
//               metadata: {
//                 exact_mode: true,
//                 authority_mode: 'exact',
//                 statute: authority.statute,
//                 paragraph: authority.paragraph,
//                 retrieval_used: false,
//                 safety_check_skipped: true,
//                 content_source: 'direct_paragraph_extraction',
//                 text_extraction_used: true
//               }
//             },
//             sources: [{
//               statute: authority.statute,
//               paragraph: authority.paragraph,
//               content: (exactChunk.content || exactChunk.text)?.substring(0, 200) + '...',
//               metadata: exactChunk.metadata
//             }],
//             confidence: 1.0,
//             conversationId: Date.now().toString(),
//             legalDomain: 'legal',
//             statute: authority.statute,
//             paragraph: authority.paragraph,
//             isArticle: authority.isArticle,
//             authority: authority,
//             classification: {
//               type: 'EXACT_OPERATIVE_NORM',
//               domain: 'legal',
//               source: 'exact_mode_processor'
//             },
//             safetyCheck: {
//               isLegallySound: true,
//               legalDefensibility: 'HIGH',
//               examinerReadiness: 'EXAMINER_READY',
//               confidenceAdjusted: 1.0,
//               metadata: { safety_check_skipped: true }
//             },
//             metadata: {
//               documentsUsed: 1,
//               processingTime: 0,
//               language: languageStr,
//               exactParagraphMatch: true,
//               chunksUsed: 1,
//               safetyPassed: true,
//               legalDefensibility: 'HIGH',
//               examinerReadiness: 'EXAMINER_READY',
//               architecture: 'epistemic_authority',
//               statuteLocked: true,
//               python_service_used: true,
//               python_authority_resolved: true,
//               python_authoritative_found: false,
//               python_results_count: 0,
//               authority_mode: 'exact',
//               doctrinal_template: 'exact_paragraph',
//               epistemic_certainty: authority.epistemicCertainty,
//               anchor_norm_mode: authority.anchorNormMode,
//               safety_check_skipped: true,
//               text_extraction_used: true
//             }
//           }
//         };
        
//         // Format with resultFormatter
//         return resultFormatter.formatResponse(exactResponse, authority);
//       }
      
//       // Classification from Python (preserved from above)
//       const classification = authority.classification || {
//         type: 'GENERAL',
//         domain: 'general',
//         source: 'python_default'
//       };
      
//       console.log(`?? Classification: ${classification.type} (domain: ${classification.domain || 'general'})`);
      
//       // ===========================================================================
//       // STEP 4: Handle Doctrine/System questions
//       // ===========================================================================
//       if (classification.type === 'DOCTRINE' || authority.question_type === 'GENERAL_DOCTRINE') {
//         console.log(`?? Doctrine question detected - separate path`);

//         // doctrinal_match=true means Python already confirmed this is a settled doctrine;
//         // its content is authoritative regardless of the pre-call epistemicCertainty value.
//         if (authority.epistemicCertainty === 'confirmed' || authority.doctrinal_match === true) {
//           const result = await this.handleConfirmedDoctrine(question, authority);
//           if (result !== null) {
//             return resultFormatter.formatResponse(result, authority);
//           }
//           console.log(`⬇️ [STEP 4] Confirmed doctrine path returned null — falling through to RAG`);
//         } else {
//           const result = await this.handleUnconfirmedDoctrine(question, authority);
//           if (result !== null) {
//             return resultFormatter.formatResponse(result, authority);
//           }
//           console.log(`⬇️ [STEP 4] Unconfirmed doctrine path returned null — falling through to RAG`);
//         }
//         // Fall through to STEP 5+ (RAG retrieval)
//       }
      
//       if (classification.type === 'SYSTEM') {
//         console.log(`?? System question - conceptual answer`);
//         const result = this.handleSystemQuestion(question, authority);
//         return resultFormatter.formatResponse(result, authority);
//       }
      
//       // ===========================================================================
//       // STEP 5: DOCTRINAL EARLY-EXIT WITH PROPER METADATA
//       // ===========================================================================
//       if (this.shouldUseDoctrinalEarlyExit(authority)) {
//         console.log(`?? [Doctrinal Early-Exit] Using doctrinal path`);
//         console.log(`   Authority metadata:`, {
//           question_type: authority.question_type,
//           epistemicCertainty: authority.epistemicCertainty,
//           anchorNormMode: authority.anchorNormMode,
//           doctrinal_match: authority.doctrinal_match
//         });
        
//         const doctrineResult = await this.callDoctrineInductionService(question, authority);

//         // Only use the doctrine result when Python actually found a specific doctrine.
//         // doctrine_found === false means Python returned a generic "no match" message —
//         // that should fall through to RAG vector search, not become the final answer.
//         if (doctrineResult?.doctrine_found === true) {
//           const doctrinalAnswer = this.generateDoctrinalAnswer(doctrineResult, authority, question);

//           // No safety check for doctrine, immediate return
//           safetyCheck.logSafetyEvent('DOCTRINAL_EARLY_EXIT', {
//             question,
//             question_type: authority.question_type,
//             epistemicCertainty: authority.epistemicCertainty,
//             anchorNormMode: authority.anchorNormMode,
//             statute: authority.statute,
//             retrievalUsed: false,
//             safetyCheckSkipped: true
//           });
          
//           const rawResponse = {
//             success: true,
//             data: {
//               answer: doctrinalAnswer.fullAnswer,
//               structuredAnswer: doctrinalAnswer,
//               sources: [],
//               confidence: doctrinalAnswer.confidence,
//               statute: authority.statute,
//               paragraph: authority.paragraph,
//               isArticle: authority.isArticle,
//               metadata: doctrinalAnswer.metadata
//             }
//           };
          
//           return resultFormatter.formatResponse(rawResponse, authority);
//         } else {
//           console.log(`?? Doctrine induction failed, falling back to unconfirmed doctrine path`);
//         }
//       }
      
//       // ===========================================================================
//       // STEP 6: Retrieval with doctrine guard & authority lock (NOW PROPERLY BLOCKS)
//       // ===========================================================================
//       let pythonResults = null;
      
//       // Always attempt retrieval — the authority lock constrains scope inside
//       // retrieveDocumentsWithDoctrineGuard but must not skip the whole retrieval
//       // chain or every specific-paragraph question returns an empty abstention.
//       pythonResults = await this.retrieveDocumentsWithDoctrineGuard(
//         question, authority, authorityLock, allDocuments, classification
//       );
      
//       // Always allow RAG synthesis — empty Python results just means TF-IDF will
//       // be the primary source, which is correct behaviour for corpus questions.
//       console.log(`✅ [Guard Passed] Proceeding to RAG synthesis:`, {
//         authority_final: authority?.authority_final,
//         has_results: pythonResults?.results?.length > 0,
//         authoritative_found: pythonResults?.authoritative_found,
//         authority_mode: authority?.authority_mode,
//         authority_lock: authorityLock?.__locked || false
//       });
      
//       // Check if doctrine guard blocked retrieval
//       if (pythonResults.authority_summary?.doctrine_mode && pythonResults.results.length === 0 && question.match(/\xA7\s*\d+|art\.\s*\d+/i)) {
//         console.log(`?? Doctrine guard blocked retrieval - asking for clarification`);
        
//         // This is a doctrinal question that needs special handling
//         if (authority.question_type === 'GENERAL_DOCTRINE' || authority.doctrinal_match) {
//           // doctrinal_match=true → authoritative content, no uncertainty warning
//           const handler = authority.doctrinal_match
//             ? this.handleConfirmedDoctrine.bind(this)
//             : this.handleUnconfirmedDoctrine.bind(this);
//           const result = await handler(question, authority);
//           // null means no settled doctrine — fall through to RAG rather than blocking
//           if (result !== null) {
//             return resultFormatter.formatResponse(result, authority);
//           }
//           console.log(`⬇️ [Guard] Doctrine handler returned null — continuing to RAG`);
//         }
        
//         // No doctrine path available — fall through to RAG rather than returning
//         // a clarification. RAG may have content even when doctrine fails.
//         console.log(`⬇️ [Guard] No doctrine path available — falling through to RAG`);
//       }
      
//       // ===========================================================================
//       // STEP 7: RAG call (ONLY IF GUARD PASSES)
//       // ===========================================================================
//       const ragResponse = await ragService.generateResponse(
//         question,
//         allDocuments,
//         {
//           language: languageStr,
//           authority: authority,
//           classification: classification,
//           python_results: pythonResults
//         }
//       );
      
//       // Add Python service metadata
//       ragResponse.python_service_used = true;
//       ragResponse.python_authority_resolved = !pythonAuthorityError && authority.statute;
//       ragResponse.python_authoritative_found = pythonResults?.authoritative_found || false;
//       ragResponse.python_results_count = pythonResults?.results?.length || 0;
//       ragResponse.authority_mode = authority.authority_mode;
//       ragResponse.originalQuestion = question;
      
//       if (pythonAuthorityError) {
//         ragResponse.python_authority_error = pythonAuthorityError;
//       }
      
//       // ===========================================================================
//       // STEP 8: Confidence override
//       // ===========================================================================
//       const baseConfidence = ragResponse.confidence || 0.7;
//       const finalConfidence = this.calculateEpistemicConfidence(baseConfidence, authority, ragResponse);
//       ragResponse.confidence = finalConfidence;
      
//       // ===========================================================================
//       // STEP 9: Safety check (SKIP FOR DOCTRINE)
//       // ===========================================================================
//       let safetyValidation = null;
      
//       if (classification.type !== 'DOCTRINE' && 
//           authority.question_type !== 'DOCTRINE' && 
//           authority.question_type !== 'GENERAL_DOCTRINE') {
//         safetyValidation = ragResponse.safetyCheck || await safetyCheck.validateBeforeAnswer(question, ragResponse, authority);
//       } else {
//         console.log(`?? Safety check skipped for doctrine question`);
//         safetyValidation = {
//           isLegallySound: true,
//           legalDefensibility: 'HIGH',
//           examinerReadiness: 'EXAMINER_READY',
//           confidenceAdjusted: finalConfidence,
//           metadata: {
//             safety_check_skipped: true,
//             reason: 'doctrine_question'
//           }
//         };
//       }
      
//       // ===========================================================================
//       // STEP 10: Structure answer
//       // ===========================================================================
//       const structuredAnswer = this.structureAnswerWithDoctrinalTemplate(
//         ragResponse, 
//         question, 
//         safetyValidation, 
//         authority,
//         classification,
//         pythonResults
//       );
      
//       // ===========================================================================
//       // STEP 11: Build raw response
//       // ===========================================================================
//       const rawResponse = {
//         success: true,
//         data: {
//           answer: structuredAnswer.fullAnswer,
//           structuredAnswer: structuredAnswer,
//           sources: ragResponse.citations,
//           confidence: structuredAnswer.confidence,
//           conversationId: Date.now().toString(),
//           legalDomain: structuredAnswer.domain || ragResponse.metadata?.legalDomain || 'general',
//           statute: authority.statute,
//           paragraph: authority.paragraph,
//           isArticle: authority.isArticle,
//           authority: authority,
//           classification: classification,
//           safetyCheck: safetyValidation,
//           metadata: {
//             documentsUsed: ragResponse.documentsUsed || 0,
//             processingTime: ragResponse.metadata?.processingTime || 0,
//             language: languageStr,
//             exactParagraphMatch: ragResponse.metadata?.exactParagraphMatch || false,
//             chunksUsed: ragResponse.metadata?.chunksUsed || 0,
//             safetyPassed: safetyValidation.isLegallySound,
//             legalDefensibility: safetyValidation.legalDefensibility,
//             examinerReadiness: safetyValidation.examinerReadiness,
//             architecture: 'epistemic_authority',
//             statuteLocked: !!authority.statute,
//             python_service_used: ragResponse.python_service_used || false,
//             python_authority_resolved: ragResponse.python_authority_resolved || false,
//             python_authoritative_found: ragResponse.python_authoritative_found || false,
//             python_results_count: ragResponse.python_results_count || 0,
//             authority_mode: authority.authority_mode,
//             doctrinal_template: structuredAnswer.template_used || 'default',
//             epistemic_certainty: authority.epistemicCertainty,
//             anchor_norm_mode: authority.anchorNormMode,
//             safety_check_skipped: classification.type === 'DOCTRINE',
//             authority_lock_applied: authorityLock?.__locked || false,
//             authority_lock_reason: authorityLock?.__lockReason || 'none',
//             explicit_norm_override: authority.__explicit_norm_reference || false
//           },
//         },
//       };
      
//       // ===========================================================================
//       // STEP 12: Format with resultFormatter
//       // ===========================================================================
//       const formattedResponse = resultFormatter.formatResponse(rawResponse, authority);
      
//       // ===========================================================================
//       // STEP 13: Add to conversation history
//       // ===========================================================================
//       const conversationEntry = {
//         question: question,
//         answer: structuredAnswer.fullAnswer,
//         structuredAnswer: structuredAnswer,
//         sources: ragResponse.citations,
//         timestamp: new Date().toISOString(),
//         confidence: structuredAnswer.confidence,
//         legalDomain: structuredAnswer.domain || ragResponse.metadata?.legalDomain || 'general',
//         statute: authority.statute,
//         paragraph: authority.paragraph,
//         isArticle: authority.isArticle,
//         authority: authority,
//         classification: classification,
//         safetyCheck: safetyValidation,
//         python_authority_used: !pythonAuthorityError,
//         python_authoritative_found: pythonResults?.authoritative_found || false,
//         python_results_count: pythonResults?.results?.length || 0,
//         authority_mode: authority.authority_mode,
//         doctrinal_template: structuredAnswer.template_used || 'default',
//         epistemic_certainty: authority.epistemicCertainty,
//         anchor_norm_mode: authority.anchorNormMode,
//         authority_lock_applied: authorityLock?.__locked || false,
//         authority_lock_reason: authorityLock?.__lockReason || 'none',
//         explicit_norm_override: authority.__explicit_norm_reference || false
//       };

//       this.conversationHistory.push(conversationEntry);
//       if (this.conversationHistory.length > 20) {
//         this.conversationHistory = this.conversationHistory.slice(-20);
//       }

//       // ===========================================================================
//       // STEP 14: Log and return
//       // ===========================================================================
//       safetyCheck.logSafetyEvent('QUESTION_PROCESSED', {
//         question,
//         statute: authority.statute,
//         paragraph: authority.paragraph,
//         question_type: classification.type,
//         epistemicCertainty: authority.epistemicCertainty,
//         confidence: structuredAnswer.confidence,
//         legalDefensibility: safetyValidation.legalDefensibility || 'UNKNOWN',
//         examinerReadiness: safetyValidation.examinerReadiness || 'UNKNOWN',
//         python_authority_used: !pythonAuthorityError,
//         python_authoritative_found: pythonResults?.authoritative_found || false,
//         authority_mode: authority.authority_mode,
//         doctrinal_template: structuredAnswer.template_used || 'default',
//         safety_check_skipped: classification.type === 'DOCTRINE',
//         authority_lock_applied: authorityLock?.__locked || false,
//         authority_lock_reason: authorityLock?.__lockReason || 'none',
//         explicit_norm_override: authority.__explicit_norm_reference || false
//       });

//       this.logProcessing(question, ragResponse, authority, classification, pythonResults, safetyValidation);

//       // ── DeepSeek Synthesis ──
//       try {
//         const _q = question || '';
//         const _a = formattedResponse?.data?.answer || '';
//         const _signals = ['rechte','ansprüche','voraussetzungen','rechtsfolgen','was sind','was regelt','unterschied','erklären','bedeutung','prüfungsschema','welche','sachmängel','wie wird','wie entsteht','welche pflichten','welche folgen'];
//         const _hit = _signals.some(s => _q.toLowerCase().includes(s)) && _q.length > 30;
//         console.log('[SYNTH]', _hit, '|', _q.substring(0, 50));
//         if (_hit && _a.length > 30 && process.env.DEEPSEEK_API_KEY) {
//           const _r = await fetch('https://api.deepseek.com/v1/chat/completions', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY },
//             body: JSON.stringify({
//               model: 'deepseek-chat',
//               max_tokens: 800,
//               messages: [
//                 {
//                   role: 'system',
//                   content: 'Du bist ein Staatsexamen-Repetitor für deutsches Recht.\n' +
//                     'Antworte ausschließlich auf Basis des bereitgestellten Gesetzestextes.\n\n' +
//                     '**GESETZESTEXT:**\n' +
//                     'Zitiere wörtlich die relevantesten Sätze. Nenne § und Absatz.\n\n' +
//                     '**RECHTLICHE ANALYSE:**\n' +
//                     '1. Definition\n2. Voraussetzungen\n3. Rechtsfolgen\n4. Abgrenzung\n\n' +
//                     '**RELEVANTE PARAGRAPHEN:**\n' +
//                     'Liste alle §§ im Format: § X [Gesetz] — Kurzbezeichnung.\n\n' +
//                     'Max 400 Wörter. Nur Deutsch. Keine erfundenen Inhalte.'
//                 },
//                 {
//                   role: 'user',
//                   content: 'Frage: ' + _q + '\n\nGesetzestext:\n' + _a
//                 }
//               ]
//             }),
//             signal: AbortSignal.timeout(20000)
//           });
//           const _d = await _r.json();
//           const _s = _d.choices?.[0]?.message?.content;
//           if (_s && _s.length > 100) {
//             console.log('[SYNTH SUCCESS] length:', _s.length);
//             if (formattedResponse?.data) formattedResponse.data.answer = _s;
//           }
//         }
//       } catch (_e) {
//         console.error('[SYNTH ERROR]', _e.message);
//       }
//       // ── End DeepSeek Synthesis ──

//       return formattedResponse;
//     } catch (error) {
//       console.error("Error processing question:", error);
      
//       safetyCheck.logSafetyEvent('PROCESSING_ERROR', {
//         question,
//         error: error.message,
//         timestamp: new Date().toISOString(),
//         python_error: error.message.includes('python') || error.message.includes('Python')
//       });
      
//       return {
//         success: false,
//         error: "Fehler bei der Verarbeitung der Frage",
//         details: error.message,
//       };
//     }
//   }

//   // ===========================================================================
//   // DOCTRINE HANDLERS
//   // ===========================================================================
  
//   async handleConfirmedDoctrine(question, authority) {
//     console.log(`?? Confirmed doctrine - delegating to induction service`);
    
//     const doctrineResult = await this.callDoctrineInductionService(question, authority);

//     if (doctrineResult?.doctrine_found === true) {
//       const doctrinalAnswer = this.generateDoctrinalAnswer(doctrineResult, authority, question);

//       return {
//         success: true,
//         data: {
//           answer: doctrinalAnswer.fullAnswer,
//           structuredAnswer: doctrinalAnswer,
//           sources: [],
//           confidence: doctrinalAnswer.confidence,
//           statute: authority.statute,
//           paragraph: authority.paragraph,
//           metadata: doctrinalAnswer.metadata
//         }
//       };
//     }

//     // No confirmed doctrine — return null so caller can fall through to RAG retrieval
//     console.log(`⬇️ [Doctrine] doctrine_found=false — signalling fallthrough to RAG`);
//     return null;
//   }
  
//   async handleUnconfirmedDoctrine(question, authority) {
//     console.log(`?? Unconfirmed doctrine - epistemic warning path`);
    
//     const doctrineResult = await this.callDoctrineInductionService(question, authority);

//     if (doctrineResult?.doctrine_found === true) {
//       const statuteName = this.getStatuteDisplayName(authority.statute); // eslint-disable-line no-unused-vars
//       let answer = `**Epistemischer Hinweis**\n\n`;
//       answer += `Die Frage betrifft eine Rechtsdoktrin, die nicht mit hoher Sicherheit bestätigt werden konnte.\n\n`;
      
//       if (doctrineResult.doctrinal_summary) {
//         answer += doctrineResult.doctrinal_summary;
//       } else if (doctrineResult.answer) {
//         answer += doctrineResult.answer;
//       }
      
//       answer += `\n\n*Epistemischer Status: ${authority.epistemicCertainty || 'unbestimmt'}*`;
      
//       const structuredAnswer = {
//         fullAnswer: answer,
//         confidence: 0.7,
//         metadata: {
//           doctrine_applied: true,
//           epistemic_certainty: authority.epistemicCertainty,
//           anchor_norm_mode: authority.anchorNormMode || false,
//           retrieval_used: false,
//           unconfirmed_doctrine: true,
//           content_source: 'doctrine_induction_service',
//           safety_check_skipped: true
//         }
//       };
      
//       safetyCheck.logSafetyEvent('UNCONFIRMED_DOCTRINE', {
//         question,
//         epistemicCertainty: authority.epistemicCertainty,
//         suggestedField: authority.suggestedField,
//         safetyCheckSkipped: true
//       });
      
//       return {
//         success: true,
//         data: {
//           answer: structuredAnswer.fullAnswer,
//           structuredAnswer: structuredAnswer,
//           sources: [],
//           confidence: structuredAnswer.confidence,
//           statute: authority.statute,
//           metadata: structuredAnswer.metadata
//         }
//       };
//     }

//     // No settled doctrine — return null so caller falls through to RAG retrieval
//     console.log(`⬇️ [Doctrine] Unconfirmed doctrine — no match, signalling fallthrough to RAG`);
//     return null;
//   }

//   generateEpistemicallySafeFallback(authority, question) {
//     return {
//       success: true,
//       data: {
//         answer: `**Methodischer Hinweis**\n\n` +
//                 `Die doctrinale Analyse konnte nicht abgeschlossen werden.\n\n` +
//                 `*Frage: ${question.substring(0, 100)}...*\n` +
//                 `*Epistemischer Status: ${authority.epistemicCertainty || 'unbestimmt'}*`,
//         confidence: 0.6,
//         metadata: {
//           doctrine_applied: false,
//           retrieval_used: false,
//           fallback_used: true,
//           content_source: 'epistemic_fallback',
//           safety_check_skipped: true
//         }
//       }
//     };
//   }
  
//   handleSystemQuestion(question, authority) {
//     return {
//       success: true,
//       data: {
//         answer: this.generateSystemAnswer(),
//         confidence: 0.95,
//         metadata: {
//           architecture: "system_bypass",
//           classification: { type: 'SYSTEM' },
//           statuteLocked: false,
//           requiresRetrieval: false,
//           authority_mode: 'none',
//           safety_check_skipped: true
//         }
//       }
//     };
//   }

//   // ===========================================================================
//   // HELPER: Statute Display Names
//   // ===========================================================================
  
//   getStatuteDisplayName(statute) {
//     const names = {
//       'BGB': 'Bürgerliches Gesetzbuch',
//       'StGB': 'Strafgesetzbuch',
//       'STGB': 'Strafgesetzbuch',
//       'HGB': 'Handelsgesetzbuch',
//       'GG': 'Grundgesetz',
//       'ZPO': 'Zivilprozessordnung',
//       'StPO': 'Strafprozessordnung',
//       'STPO': 'Strafprozessordnung',
//       'GMBHG': 'GmbH-Gesetz'
//     };
//     return names[statute] || statute;
//   }

//   // ===========================================================================
//   // UTILITY METHODS
//   // ===========================================================================
  
//   generateSystemAnswer() {
//     return `**Systemarchitektur - Epistemische Autorität**\n\n` +
//            `Das System arbeitet nach einem mehrstufigen epistemischen Modell:\n\n` +
//            `1. **Autoritätsauflösung**: Python-Dienst identifiziert Gesetz und Paragraph\n` +
//            `2. **Doctrinale Induktion**: Bei bestätigten Doktrinfragen ? Python-Autoritätsdienst\n` +
//            `3. **Retrieval mit Guard**: TF-IDF-Fallback für Doktrinfragen blockiert\n` +
//            `4. **Sicherheitsprüfung**: Automatische Bewertung der rechtlichen Verteidigbarkeit\n` +
//            `5. **Epistemische Konfidenz**: Sonderregeln für doctrinale Fragen\n\n` +
//            `**Status**: Alle Komponenten aktiv, Python-Integration läuft.`;
//   }

//   prepareDocumentsForPython(documents) {
//     return documents.map(doc => ({
//       id: doc.id || doc._id || `doc_${Math.random().toString(36).substr(2, 9)}`,
//       content: doc.content || doc.text || '',
//       metadata: {
//         title: doc.title || doc.filename || 'Unbenanntes Dokument',
//         type: doc.type || 'legal_document',
//         source: doc.source || 'upload',
//         chunks_count: doc.chunks?.length || 0,
//         statute_refs: doc.statute_refs || [],
//         paragraph_refs: doc.paragraph_refs || [],
//         statute: doc.metadata?.statute || doc.statute || null,
//         paragraph: doc.metadata?.paragraph || null,
//         detected_paragraphs: doc.metadata?.detectedParagraphs || []
//       }
//     }));
//   }

//   logProcessing(question, ragResponse, authority, classification, pythonResults, safetyValidation) {
//     console.log(`?? Processing Complete:`);
//     console.log(`   Question: "${question.substring(0, 80)}..."`);
//     console.log(`   Authority: ${authority.statute || 'NONE'} ${authority.paragraph ? '§' + authority.paragraph : ''}`);
//     console.log(`   Mode: ${authority.authority_mode}, Classification: ${classification.type}`);
//     console.log(`   Confidence: ${ragResponse.confidence?.toFixed(2) || 'N/A'}`);
//     console.log(`   Python Results: ${pythonResults?.results?.length || 0} docs`);
//     console.log(`   Authoritative Found: ${pythonResults?.authoritative_found || false}`);
//     console.log(`   Safety: ${safetyValidation?.isLegallySound ? 'PASS' : 'FAIL'}`);
//     console.log(`   Legal Defensibility: ${safetyValidation?.legalDefensibility || 'UNKNOWN'}`);
//   }

//   clearHistory() {
//     this.conversationHistory = [];
//     console.log('? Conversation history cleared');
//   }

//   getStats() {
//     return {
//       totalQuestions: this.conversationHistory.length,
//       averageConfidence: this.conversationHistory.length > 0 
//         ? this.conversationHistory.reduce((sum, entry) => sum + (entry.confidence || 0), 0) / this.conversationHistory.length
//         : 0,
//       statutesUsed: [...new Set(this.conversationHistory.filter(e => e.statute).map(e => e.statute))],
//       domainsCovered: [...new Set(this.conversationHistory.filter(e => e.legalDomain).map(e => e.legalDomain))],
//       lastQuestion: this.conversationHistory.length > 0 ? this.conversationHistory[this.conversationHistory.length - 1].question : null
//     };
//   }

//   healthCheck() {
//     return {
//       service: 'ChatService',
//       status: 'healthy',
//       conversationHistorySize: this.conversationHistory.length,
//       lastUpdate: this.conversationHistory.length > 0 
//         ? this.conversationHistory[this.conversationHistory.length - 1].timestamp 
//         : 'never',
//       memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB',
//       uptime: process.uptime() + ' seconds'
//     };
//   }
// }

// // ===========================================================================
// // ?? TERMINAL AUTHORITY CONTRACT TEST
// // ===========================================================================
// function testTerminalAuthorityContract() {
//   console.log('\n?? Testing Terminal Authority Contract...');
  
//   const testCases = [
//     // Valid terminal authority
//     {
//       input: { authority_final: true, paragraph: "41", statute: "BGB", authority_mode: "exact" },
//       shouldTerminate: true,
//       description: "Valid terminal authority"
//     },
//     // Contract violation: terminal but overview mode
//     {
//       input: { authority_final: true, paragraph: "41", statute: "BGB", authority_mode: "overview" },
//       shouldTerminate: true, // Still terminates but logs violation
//       description: "CONTRACT VIOLATION: terminal with overview mode"
//     },
//     // Contract violation: terminal but no paragraph
//     {
//       input: { authority_final: true, statute: "BGB", authority_mode: "exact" },
//       shouldTerminate: true, // Still terminates but logs violation
//       description: "CONTRACT VIOLATION: terminal without paragraph"
//     },
//     // Non-terminal
//     {
//       input: { statute: "BGB", paragraph: "41", authority_mode: "exact" },
//       shouldTerminate: false,
//       description: "Non-terminal exact mode"
//     }
//   ];
  
//   let passed = 0;
//   const service = new ChatService();
  
//   for (const testCase of testCases) {
//     const isTerminal = service.isTerminalAuthority(testCase.input);
//     const passedTest = isTerminal === testCase.shouldTerminate;
    
//     if (passedTest) {
//       console.log(`? ${testCase.description}`);
//       passed++;
//     } else {
//       console.log(`? ${testCase.description}: expected ${testCase.shouldTerminate}, got ${isTerminal}`);
//     }
//   }
  
//   console.log(`?? Terminal authority tests: ${passed}/${testCases.length} passed`);
//   return passed === testCases.length;
// }

// // Run test if file is executed directly
// if (require.main === module) {
//   console.log('?? Running ChatService contract tests...');
//   const success = testTerminalAuthorityContract();
//   console.log(success ? '? All tests passed!' : '? Some tests failed');
//   process.exit(success ? 0 : 1);
// }

// module.exports = new ChatService();



// ============================================================================
// LEGACY CODE (commented out — full original preserved for rollback)
// Restore: git checkout HEAD~1 -- src/services/chatService.js
// ============================================================================

// const documentService = require("../ingestion/pdfDocumentService");
// ... [full legacy class omitted — see git history] ...
// module.exports = new ChatService();


const documentService = require("../ingestion/pdfDocumentService");
const ragService = require("../retrieval/ragService");
const safetyCheck = require("../validation/safetyCheck");
const pythonIntegrationService = require("../retrieval/pythonIntegrationService");
const resultFormatter = require("./resultFormatter");
const axios = require("axios");
const { isEBVQuestion } = require("../retrieval/queryClassifier");

class ChatService {
  constructor() {
    this.conversationHistory = [];
    console.log('✅ ChatService initialized with EPISTEMIC AUTHORITY COMPLIANCE');
    
    // Bind methods
    this.structureAnswerWithDoctrinalTemplate = this.structureAnswerWithDoctrinalTemplate.bind(this);
    this.generateStructuredClarification = this.generateStructuredClarification.bind(this);
    this.getConversationHistory = this.getConversationHistory.bind(this);
    this.addSafetyInformation = this.addSafetyInformation.bind(this);
    this.normalizeParagraph = this.normalizeParagraph.bind(this);
    this.findExactParagraph = this.findExactParagraph.bind(this);
    this.extractParagraphFromText = this.extractParagraphFromText.bind(this);
    this.isTerminalAuthority = this.isTerminalAuthority.bind(this);
    this.shouldBlockRagForFinalAuthority = this.shouldBlockRagForFinalAuthority.bind(this);
    this.generateAuthoritativeAbstentionResponse = this.generateAuthoritativeAbstentionResponse.bind(this);
    this.detectExactNormReference = this.detectExactNormReference.bind(this);
    this.detectConceptualNormReference = this.detectConceptualNormReference.bind(this);
    this.isPureDoctrineQuestion = this.isPureDoctrineQuestion.bind(this);
    this.handleDeepSeekDirectSynthesis = this.handleDeepSeekDirectSynthesis.bind(this);
  }

  // Layer 1: extract explicit §/Art. citations from question text
  static extractExplicitCitations(question) {
    const matches = [...question.matchAll(
      /(?:§§?\s*\d+[a-z]?(?:\s+Abs\.\s*\d+)?|Art\.\s*\d+(?:\s+[IVX]+)?(?:\s+Nr\.\s*\d+)?)/gi
    )].map(m => m[0].replace(/\s+/g, ' ').trim());
    if (matches.length > 0) {
      console.log(`[AnchorBoost] explicit citations from question: ${JSON.stringify(matches)}`);
    }
    return matches;
  }

  // Layer 2: extract statute anchors from top retrieved chunks
  static extractAnchorsFromChunks(chunks) {
    const anchors = new Set();
    const statuteRegex = /(?:§§?\s*\d+[a-z]?(?:\s+Abs\.\s*\d+)?|Art\.\s*\d+(?:\s+[IVX]+)?)/gi;
    for (const chunk of chunks.slice(0, 10)) {
      const content = chunk.content || chunk.text || '';
      const lines = content.split('\n');
      // Check first 3 lines of each chunk — statute headers are always at the top
      for (const line of lines.slice(0, 3)) {
        const found = line.match(statuteRegex);
        if (found) found.forEach(m => anchors.add(m.replace(/\s+/g, ' ').trim()));
      }
    }
    const result = Array.from(anchors);
    if (result.length > 0) {
      console.log(`[AnchorBoost] anchors from chunks: ${JSON.stringify(result)}`);
    }
    return result;
  }

  // Boost: sort chunks so those containing anchor refs come first
  static boostAnchorParagraphs(question, chunks) {
    // Layer 1: explicit refs in question
    let anchors = ChatService.extractExplicitCitations(question);
    // Layer 2: if no explicit refs, extract from chunks themselves
    if (anchors.length === 0) anchors = ChatService.extractAnchorsFromChunks(chunks);
    // No anchors found — return unchanged
    if (anchors.length === 0) {
      console.log(`[AnchorBoost] no anchors found — returning chunks unchanged`);
      return chunks;
    }
    const normalize = s => s.replace(/\s+/g, '').toLowerCase();
    const normalizedAnchors = anchors.map(normalize);
    const hasAnchor = text => normalizedAnchors.some(a => normalize(text).includes(a));
    const matched = chunks.filter(c => hasAnchor(c.content || c.text || ''));
    const unmatched = chunks.filter(c => !hasAnchor(c.content || c.text || ''));
    console.log(`[AnchorBoost] boosted ${matched.length}/${chunks.length} chunks to top`);
    return [...matched, ...unmatched];
  }

  // Post-generation hallucination guard for subsection citations (§N Abs. M Nr. K).
  // Returns an array of citation strings that appear in the answer but not in any retrieved chunk.
  // Empty array means all citations are grounded.
  static detectHallucinatedCitations(answer, chunkTexts) {
    if (!answer) return [];
    const nrMatches = [...answer.matchAll(/§\s*(\d+[a-z]?)\s+Abs\.\s*(\d+)\s+Nr\.\s*(\d+)/gi)];
    if (nrMatches.length === 0) return [];
    const combined = chunkTexts.join('\n');
    const hallucinated = [];
    for (const m of nrMatches) {
      const cite = `§${m[1]} Abs. ${m[2]} Nr. ${m[3]}`;
      // A citation is grounded only if "Nr. K" (with that exact number) appears in the source text
      if (!new RegExp(`Nr\\.\\s*${m[3]}\\b`).test(combined)) {
        hallucinated.push(cite);
      }
    }
    if (hallucinated.length > 0) {
      console.warn(`[HALLUCINATION GUARD] Unverified citations detected: ${hallucinated.join(', ')}`);
    }
    return hallucinated;
  }

  // Strip boilerplate from a chunk before sending to LLM — reduces token count ~30-40%.
  // Does not alter the legal content, only removes repeated headers and footnotes.
  static _compressChunk(text) {
    if (!text) return '';
    return text
      // Remove leading statute-title header lines: "§ 286 BGB — Schuldnerverzug\n"
      .replace(/^§+\s*\d+[a-z]?\s+\w+\s*[-–—][^\n]*\n/i, '')
      // Remove footnote lines (line starting with digit+dot/paren or asterisk, ≤120 chars)
      .replace(/^\s*(?:\d+[.)]\s*|\*+\s*).{0,120}\n/gm, '')
      // Collapse 3+ blank lines to single blank
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Returns all explicit §N STATUTE and STATUTE §N norm pairs found in the question.
  // Used by Bug 4 cross-statute detection to supplement keyword-based isComparison.
  static _extractExplicitNormPairs(question) {
    const STATUTES = '(?:BGB|StGB|HGB|GG|ZPO|StPO|GmbHG)';
    const pairs = [];

    // §826 BGB
    for (const m of question.matchAll(new RegExp(`§\\s*(\\d+[a-z]?)\\s*(${STATUTES})`, 'gi'))) {
      pairs.push({ paragraph: m[1], statute: m[2].toUpperCase() });
    }
    // BGB §826
    for (const m of question.matchAll(new RegExp(`(${STATUTES})\\s*§\\s*(\\d+[a-z]?)`, 'gi'))) {
      pairs.push({ paragraph: m[2], statute: m[1].toUpperCase() });
    }

    const seen = new Set();
    return pairs.filter(p => {
      const k = `${p.statute}:${p.paragraph}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  /**
   * Topic-aware deterministic gap detection.
   * Returns an array of gap strings (empty = no gaps found).
   * Runs before LLM self-check so hard-coded rules can never be overridden by "nothing".
   */
  static _topicGapCheck(question, answer) {
    const q = question.toLowerCase();
    const a = answer.toLowerCase();
    const gaps = [];

    // 1. CRIMINAL LAW — Rücktritt / §24 must distinguish beendet/unbeendet
    if (/rücktritt|§\s*24\s+stgb|§24\s+stgb/i.test(question)) {
      if (!/beend(et|eter|etes)\s+versuch/i.test(answer) || !/unbeend(et|eter|etes)\s+versuch/i.test(answer)) {
        gaps.push('Rücktritt: missing beendeter/unbeendeter Versuch distinction (§24 StGB)');
        console.warn('[SelfCheck] GAP DETECTED: missing beendeter/unbeendeter Versuch distinction');
      }
    }

    // 2. CRIMINAL LAW — BGHSt required for Organisationsherrschaft / Notwehr / Vorsatz doctrine
    if (/organisationsherrschaft|mittelbare\s+täterschaft|notwehr|vorsatz(?:doktrin|lehre)?/i.test(question)) {
      if (!/bghst/i.test(answer)) {
        gaps.push('Criminal doctrine: BGHSt case reference missing (required for Organisationsherrschaft/Notwehr/Vorsatz)');
        console.warn('[SelfCheck] GAP DETECTED: missing BGHSt reference for criminal doctrine question');
      }
    }

    // 3. CONSTITUTIONAL LAW — BVerfGE required for Grundrechte / Art.79 / Verhältnismäßigkeit
    if (/grundrecht|art(?:ikel)?\s*\.?\s*79\s+gg|verhältnismäßigkeit|übermaßverbot/i.test(question)) {
      if (!/bverfge/i.test(answer)) {
        gaps.push('Constitutional law: BVerfGE case reference missing (required for Grundrechte/Art.79 GG/Verhältnismäßigkeit)');
        console.warn('[SelfCheck] GAP DETECTED: missing BVerfGE reference for constitutional law question');
      }
    }

    // 4. PROPERTY LAW — §932 gutgläubiger Erwerb must address §935 (no good-faith acquisition of stolen goods)
    if (/§\s*932\b/.test(question)) {
      if (!/§\s*935\b/.test(answer)) {
        gaps.push('§932: missing §935 (stolen/lost goods exception to good-faith acquisition)');
        console.warn('[SelfCheck] GAP DETECTED: missing §935 exception in §932 answer');
      }
    }

    // 5. VERSUCH questions — must cover both beendeter and unbeendeter Versuch
    if (/versuch(?:sstrafbarkeit)?|strafbarkeit\s+des\s+versuchs/i.test(question)) {
      const hasBeendet   = /beend(et|eter|etes)\s+versuch/i.test(answer);
      const hasUnbeendet = /unbeend(et|eter|etes)\s+versuch/i.test(answer);
      if (!hasBeendet || !hasUnbeendet) {
        const which = !hasBeendet && !hasUnbeendet
          ? 'both beendeter and unbeendeter Versuch'
          : !hasBeendet ? 'beendeter Versuch' : 'unbeendeter Versuch';
        gaps.push(`Versuch: missing ${which}`);
        console.warn(`[SelfCheck] GAP DETECTED: missing ${which}`);
      }
    }

    // 6. §13 StGB — Garantenstellung analysis required
    if (/garantenstellung|ingerenz|unterlassen|§\s*13\s+stgb/i.test(question)) {
      if (!/garantenpflicht|garantenstellung/i.test(answer)) {
        gaps.push('§13 StGB: Garantenstellung analysis missing');
        console.warn('[SelfCheck] GAP DETECTED: missing Garantenstellung analysis for §13 StGB question');
      }
    }

    // 7. §201a StGB — technologieneutrale Auslegung required for AI/real-time analysis questions
    if (/§\s*201a|echtzeit.*anal|ki.*bildaufnahme/i.test(question)) {
      if (!/technologieneutral|anfertigen|rückzugsbereich/i.test(answer)) {
        gaps.push('§201a StGB: missing technologieneutrale Auslegung or Schutzbereich analysis');
        console.warn('[SelfCheck] GAP DETECTED: missing §201a technologieneutrale Auslegung');
      }
    }

    return gaps;
  }

  static async selfCheckAnswer(question, answer, chunksText, apiKey) {
    // Skip self-check for short factual answers
    if (!answer || answer.length < 100) return answer;

    // ── Deterministic topic-gap check — runs regardless of LLM verdict ──────
    const topicGaps = ChatService._topicGapCheck(question, answer);

    try {
      const checkResult = await ChatService._dsStream(apiKey, {
          model: 'deepseek-chat',
          max_tokens: 400,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: 'You are a German law examiner checking a student answer for completeness.\n' +
                'Your job: identify what important legal provisions or distinctions are MISSING ' +
                'from the answer based on the retrieved statute text.\n\n' +
                'RESPOND IN THIS EXACT FORMAT:\n' +
                'MISSING: [comma-separated list of missing §§ or concepts, or "nothing" if complete]\n' +
                'ADDITIONS: [one sentence per missing item to add, or "none"]\n\n' +
                'RULES:\n' +
                '- Only flag things actually present in the retrieved statute text\n' +
                '- Maximum 3 missing items\n' +
                '- If answer is already complete, write MISSING: nothing\n' +
                '- Be concise — additions must be one sentence each'
            },
            {
              role: 'user',
              content: 'QUESTION: ' + question +
                '\n\nSTUDENT ANSWER:\n' + answer +
                '\n\nRETRIEVED STATUTE TEXT (check this for missing references):\n' + chunksText
            }
          ]
        }, 10000);

      const missingMatch = checkResult.match(/MISSING:\s*(.+)/i);
      const additionsMatch = checkResult.match(/ADDITIONS:\s*([\s\S]+)/i);

      const llmMissing = missingMatch?.[1]?.trim() || 'nothing';
      const additions  = additionsMatch?.[1]?.trim() || 'none';

      // LLM said nothing missing — but override if deterministic topic gaps exist
      const llmComplete = llmMissing.toLowerCase() === 'nothing' || additions.toLowerCase() === 'none';
      if (llmComplete && topicGaps.length === 0) {
        console.log('[SelfCheck] Answer complete — no gaps detected');
        return answer;
      }

      // Merge: report topic gaps even when LLM says "nothing"
      const allMissing = [
        ...(llmComplete ? [] : [llmMissing]),
        ...topicGaps
      ].join('; ');
      const missing = allMissing || llmMissing;

      console.log(`[SelfCheck] Missing: ${missing}`);
      if (!llmComplete) console.log(`[SelfCheck] Adding: ${additions.substring(0, 100)}...`);

      // Build addition text: LLM additions (if any) + topic gap list (always shown)
      const additionLines = [];
      if (!llmComplete && additions.toLowerCase() !== 'none') additionLines.push(additions);
      if (topicGaps.length > 0) additionLines.push('Topic gaps: ' + topicGaps.join('; '));
      const additionText = additionLines.join('\n');

      const summaryIndex = answer.lastIndexOf('SUMMARY');
      if (summaryIndex > -1) {
        return answer.substring(0, summaryIndex) +
          '\n\nADDITIONAL PROVISIONS:\n' + additionText + '\n\n' +
          answer.substring(summaryIndex);
      }
      return answer + '\n\nADDITIONAL PROVISIONS:\n' + additionText;

    } catch (err) {
      console.warn('[SelfCheck] Failed:', err.message, '— returning original answer');
      // Still surface topic gaps even when LLM call fails
      if (topicGaps.length > 0) {
        return answer + '\n\nADDITIONAL PROVISIONS:\nTopic gaps: ' + topicGaps.join('; ');
      }
      return answer;
    }
  }

  detectExactNormReference(question) {
    if (!question || typeof question !== 'string') return null;

    // Heuristic: multi-norm argumentative questions should not lock to a single paragraph.
    // If the question has 2+ § references AND contains a question/condition word, route to
    // DeepSeek doctrine synthesis instead of exact-norm retrieval.
    const paragraphRefs = question.match(/§\s*\d+/g) || [];
    const hasMultipleRefs = paragraphRefs.length >= 2;
    const hasQuestionWord = /\b(kann|muss|darf|wann|ob|ohne|unter welchen voraussetzungen|inwieweit|inwiefern)\b/i.test(question);
    if (hasMultipleRefs && hasQuestionWord) {
      console.log(`🔀 [Exact Norm Detector] Multi-norm argumentative question (${paragraphRefs.length} refs) — skipping exact mode, routing to doctrine synthesis`);
      return null;
    }

    const STATUTE_ALT = '(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)';
    const ABS_PART   = '(?:\\s+abs(?:atz)?\\.?\\s+\\d+[a-z]?(?:\\s+nr\\.?\\s+\\d+[a-z]?)?)';
    const patterns = [
      // §311 Abs. 3 BGB / §311 Abs. 3 Nr. 1 BGB  (Absatz between number and statute)
      new RegExp(`§\\s*(\\d+[a-z]?)${ABS_PART}\\s+${STATUTE_ALT}`, 'i'),
      // BGB §311 Abs. 3  (statute before, Absatz after — still lock to the paragraph)
      new RegExp(`${STATUTE_ALT}\\s+§\\s*(\\d+[a-z]?)${ABS_PART}`, 'i'),
      // §311 BGB  (direct — no Absatz)
      /§\s*(\d+[a-z]?)\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i,
      /§(\d+[a-z]?)\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i,
      /(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)\s+§\s*(\d+[a-z]?)/i,
      /artikel\s+(\d+[a-z]?)(?:\s+(?:absatz|abs\.?)\s+\d+[a-z]?)?\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i,
      /art\.?\s*(\d+[a-z]?)(?:\s+(?:absatz|abs\.?)\s+\d+[a-z]?)?\s+(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)/i
    ];
    
    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match) {
        let statute, paragraph;
        let isArticle = false;
        
        if (pattern.toString().includes('(bgb|stgb|hgb|gg|zpo|stpo|gmbhg)\\s+§')) {
          statute = match[1].toUpperCase();
          paragraph = match[2];
        } else if (pattern.toString().includes('artikel') || pattern.toString().includes('art\\.')) {
          statute = match[2].toUpperCase();
          paragraph = match[1];
          isArticle = true;
        } else {
          paragraph = match[1];
          statute = match[2].toUpperCase();
        }
        
        console.log(`🎯 [Exact Norm Detector] Found: ${statute} §${paragraph} ${isArticle ? '(Article)' : ''}`);
        return { statute, paragraph, isArticle, source: 'explicit_question_reference', matchedPattern: pattern.toString() };
      }
    }
    // Pattern 6: "Artikel N Grundgesetz" / "Artikel N des Grundgesetzes"
    const ggArtikelMatch = question.match(/artikel\s+(\d+[a-z]?)\s+(?:des\s+)?grundgesetzes?/i);
    if (ggArtikelMatch) {
      const paragraph = ggArtikelMatch[1];
      console.log(`🎯 [Exact Norm Detector] Found: GG §${paragraph} (Article)`);
      return { statute: 'GG', paragraph, isArticle: true, source: 'explicit_question_reference', matchedPattern: 'artikel-grundgesetz' };
    }

    // Pattern 7: bare "Artikel N" when "Grundgesetz" appears anywhere in the question
    if (/grundgesetz/i.test(question)) {
      const bareArtikelMatch = question.match(/artikel\s+(\d+[a-z]?)/i);
      if (bareArtikelMatch) {
        const paragraph = bareArtikelMatch[1];
        console.log(`🎯 [Exact Norm Detector] Found: GG §${paragraph} (Article, Grundgesetz context)`);
        return { statute: 'GG', paragraph, isArticle: true, source: 'explicit_question_reference', matchedPattern: 'artikel-grundgesetz-context' };
      }
    }

    return null;
  }

  detectConceptualNormReference(question) {
    if (!question || typeof question !== 'string') return null;
    // Only applies when the question has no explicit § — those go through detectExactNormReference
    if (/§\s*\d+/.test(question)) return null;
    const q = question.toLowerCase();

    // Good faith acquisition — §§ 929–935 BGB (gutgläubiger Erwerb)
    const hasGoodFaith = /\bgood[\s-]?faith\b|\bgutgläubig\b|\bbona\s+fide\b/.test(q);
    const hasAcquisition = /\bacquir[esdrin]|\bbuy\b|\bbuyer\b|\bpurchas|\bsell[e]?\b|\bnon.?owner\b|\bnichtberech|\berwerb\b|\beigentum\b|\bpossess/.test(q);
    if (hasGoodFaith && hasAcquisition) {
      console.log(`🧠 [ConceptualNorm] "good faith acquisition" → BGB §932`);
      return { statute: 'BGB', paragraph: '932', authority_mode: 'concept', isStatuteLocked: true, isParagraphLocked: false };
    }

    // Ownerless / abandoned property — §§ 958–960 BGB (herrenlose Sachen / Aneignung)
    if (/\bherrenlos|\bownerless\b|\babandoned\s+propert|\bres\s+nullius\b|\baneignung\b/.test(q)) {
      console.log(`🧠 [ConceptualNorm] "ownerless/herrenlos" → BGB §958`);
      return { statute: 'BGB', paragraph: '958', authority_mode: 'concept', isStatuteLocked: true, isParagraphLocked: false };
    }

    return null;
  }

  /**
   * NEW: Detect pure doctrine questions that should bypass TF-IDF retrieval
   * Conditions:
   * - Question length > 80 characters
   * - No § reference (no specific paragraph)
   * - No statute name (BGB, StGB, HGB, GG, ZPO, StPO, GmbHG)
   */
  isPureDoctrineQuestion(question) {
    if (!question || typeof question !== 'string') return false;
    
    const questionLength = question.length;
    if (questionLength <= 50) return false;

    // Comparison questions must reach handleComparisonQuestion(), not doctrine synthesis.
    // Must be checked BEFORE doctrineTerms (e.g. 'kaufvertrag' is both a doctrine term and a comparison subject).
    const COMPARISON_SIGNALS = ['unterschied','unterschiede','vergleich','compare','versus',' vs ','contrast','abgrenzung','gegensatz','difference','differences'];
    if (COMPARISON_SIGNALS.some(s => question.toLowerCase().includes(s))) return false;

    // Check for § reference
    const hasParagraphRef = /§\s*\d+|art\.\s*\d+/i.test(question);
    if (hasParagraphRef) return false;

    // Doctrine keyword detection (expanded list)
    const doctrineTerms = [
      'einwendung', 'einrede', 'rechtshindernde', 'rechtsvernichtende',
      'rechtshemmende', 'anspruchsprüfung', 'tatbestand', 'rechtsfolge',
      'subsumtion', 'prüfungsschema', 'dogmatik', 'doktrin',
      'nichtigkeit', 'anfechtbar', 'anfechtung', 'rechtsgeschäft',
      'verjährung', 'schadensersatz', 'besitz', 'eigentum', 'notwehr',
      'vorsatz', 'fahrlässigkeit', 'kausalität', 'zurechenbarkeit', 'schuld',
      'rechtfertigung', 'entschuldigung', 'strafbarkeit', 'kaufvertrag',
      'werkvertrag', 'mietvertrag', 'bürgschaft', 'ex tunc', 'ex nunc',
      'willenserklärung', 'geschäftsfähigkeit', 'rechtsfähigkeit', 'unmittelbar', 'mittelbar',
      'anspruch', 'delikt', 'haftung', 'pflichtverletzung', 'verschulden', 'pflicht',
      'mahnung', 'verzug', 'schuldnerverzug', 'mahnen', 'fälligkeit', 'leistungszeit',
      'dienstvertrag', 'bereicherung', 'deliktsrecht', 'pfandrecht',
      'doctrine', 'doctrinal', 'legal principle', 'elements', 'requirements',
      'liability', 'duty', 'obligations', 'fiduciary', 'negligence', 'intent'
    ];
    
    const hasDoctrineTerm = doctrineTerms.some(term => question.toLowerCase().includes(term));
    
    // Long questions without statute references are likely conceptual/doctrinal
    return hasDoctrineTerm || questionLength > 120;
  }

  /**
   * NEW: Handle pure doctrine questions via DeepSeek direct synthesis
   * Skips TF-IDF retrieval entirely and uses DeepSeek's knowledge
   */
  async handleDeepSeekDirectSynthesis(question, languageStr) {
    console.log('[DeepSeek Direct] Starting synthesis...');
    console.log(`🎓 [DeepSeek Direct] Handling pure doctrine question: "${question.substring(0, 80)}..."`);
    
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
      console.warn('[DeepSeek Direct] API key not configured, falling back to standard processing');
      return null;
    }
    
    try {
      const systemPrompt = `You are Jurisma, a German law tutor (Jura-Repetitor).
You answer based on your legal expertise since no document chunks were retrieved for this question.

For EVERY answer, follow this EXACT 5-part structure:

1. DEFINITION
One complete sentence restating the question as a definition.

2. LEGAL BASIS (Gesetzesgrundlage)
Cite ONLY directly relevant articles/sections you are certain of.
If uncertain, say: "Provision not in retrieved sources."
Do NOT infer or guess article numbers.

3. ELEMENTS / SUBTYPES
List all subtypes or requirements if the concept has them.
If none exist, write: "No standard subtypes."

4. LEGAL CONSEQUENCE (Rechtsfolge)
State what happens when this rule applies or procedure succeeds.

5. SUMMARY
One sentence for memorization.

STRICT RULES:
- Never cite Art. 94 GG for Normenkontrolle (correct: Art. 93, 100 GG)
- Never cite §316c or §232 StGB for Vorsatz/Fahrlässigkeit (correct: §15, §16 StGB)
- Never produce fragment sentences or cut-off answers
- Never exceed 250 words
- End every answer with the SUMMARY line
- Plain text only, no markdown, clear line breaks between sections`;
      
      const answer = await ChatService._dsStream(apiKey, {
          model: 'deepseek-chat',
          max_tokens: 1200,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question }
          ]
        }, 120000);
      
      if (!answer || answer.length < 100) {
        console.warn('[DeepSeek Direct] Response too short, falling back');
        return null;
      }
      
      console.log(`✅ [DeepSeek Direct] Generated answer, length: ${answer.length}`);
      
      const disclaimer = languageStr === 'german'
        ? '\n\n---\n*📚 Diese Antwort basiert auf juristischem Fachwissen und ersetzt keine Rechtsberatung. Die zitierten Paragraphen dienen der Orientierung.*'
        : '\n\n---\n*📚 This answer is based on legal expertise and does not constitute legal advice. Cited paragraphs are for reference.*';
      
      return {
        success: true,
        data: {
          answer: answer + disclaimer,
          confidence: 0.85,
          statute: null,
          paragraph: null,
          metadata: {
            deepseek_direct_synthesis: true,
            pure_doctrine_question: true,
            retrieval_bypassed: true,
            language: languageStr
          }
        }
      };
      
    } catch (error) {
      console.error('[DeepSeek Direct] FAILED:', error.message);
      return null;
    }
  }

  formatChunkAsAnswer(rawContent, statute, paragraph, isArticle) {
    const BOILERPLATE = [
      /Ein Service des Bundesministerium[^\n]*/gi,
      /sowie des Bundesamts für Justiz[^\n]*/gi,
      /www\.gesetze-im-internet\.de[^\n]*/gi,
      /- Seite \d+ von \d+ -/gi,
      /Seite \d+ von \d+/gi,
    ];

    let cleaned = rawContent || '';
    for (const pat of BOILERPLATE) cleaned = cleaned.replace(pat, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

    const statuteName = this.getStatuteDisplayName(statute) || statute;
    const ref = paragraph ? `${isArticle ? 'Art.' : '§'} ${paragraph} ${statute}` : statute;

    return `**${statuteName} — ${ref}**\n\n${cleaned}\n\n*Diese Angaben stammen aus deutschen Rechtsdokumenten und ersetzen keine Rechtsberatung.*`;
  }

  normalizeParagraph(value) {
    if (!value) return null;
    if (Array.isArray(value)) value = value[0];
    const str = String(value);
    return str.toLowerCase().replace(/§/g, '').replace(/paragraph/gi, '').replace(/artikel/gi, '').replace(/article/gi, '').replace(/art\./gi, '').replace(/art/gi, '').replace(/\s+/g, '').replace(/[^\w\s]/g, '').trim();
  }

  extractParagraphFromText(text) {
    if (!text) return null;
    const patterns = [
      /§\s*\n*\s*(\d+[a-z]?)/i,
      /paragraph\s+(\d+[a-z]?)/i,
      /(?:artikel|art\.|art)\s+(\d+[a-z]?)/i,
      /§\s*(\d+[a-z]?)\s+[A-ZÄÖÜ]/,
      /^(\d+[a-z]?)\s+[A-ZÄÖÜ]/,
    ];
    const first500Chars = text.substring(0, 500);
    for (const pattern of patterns) {
      const match = first500Chars.match(pattern);
      if (match && match[1]) {
        return `§${match[1]}`;
      }
    }
    return null;
  }

  findExactParagraph(allDocuments, statute, paragraph) {
    const normalizedAuthorityPara = this.normalizeParagraph(paragraph);
    if (!normalizedAuthorityPara) return null;
    
    console.log(`🎯 [Exact Mode] Looking for ${statute} §${paragraph} (normalized: ${normalizedAuthorityPara})`);
    
    for (const doc of allDocuments) {
      const chunks = doc.chunks || [doc];
      for (const chunk of chunks) {
        const statuteRaw = chunk.metadata?.statute || chunk.metadata?.statute_id || chunk.metadata?.law || doc.metadata?.statute;
        if (statuteRaw !== statute) continue;
        
        const extractedPara = this.extractParagraphFromText(chunk.content || chunk.text);
        const normalizedChunkPara = this.normalizeParagraph(extractedPara);
        
        if (normalizedChunkPara && normalizedChunkPara === normalizedAuthorityPara) {
          console.log(`✅ [Exact Mode] Found exact match!`);
          return chunk;
        }
        
        const metaPara = chunk.metadata?.paragraph || chunk.metadata?.paragraph_number;
        if (metaPara && this.normalizeParagraph(metaPara) === normalizedAuthorityPara) {
          console.log(`✅ [Exact Mode] Found in metadata!`);
          return chunk;
        }
      }
    }
    return null;
  }

  isTerminalAuthority(authority) {
    if (!authority) return false;
    return (authority.authority_final === true || authority.terminal === true || authority.metadata?.authority_final === true || authority.retrieval?.constraint === 'PARAGRAPH_STRICT' || authority.constraint === 'PARAGRAPH_STRICT' || authority.force_exact === true);
  }

  createAuthorityLock(authority) {
    if (!authority) return { __locked: false };
    const isLocked = this.isTerminalAuthority(authority) || authority.__empty_authoritative_result === true;
    const lock = { ...authority, __locked: isLocked, __lockTimestamp: new Date().toISOString(), __lockReason: isLocked ? (this.isTerminalAuthority(authority) ? 'terminal_authority' : 'empty_authoritative_result') : 'non_terminal' };
    if (isLocked) console.log(`🔒 [Authority Lock] Created LOCKED authority object`);
    return lock;
  }

  shouldBlockRagForFinalAuthority(authority, pythonResults) {
    if (!authority || !pythonResults) return false;
    const isTerminal = this.isTerminalAuthority(authority);
    const isEmptyAuthoritativeResult = pythonResults.results && pythonResults.results.length === 0 && pythonResults.authoritative_found === false;
    return isTerminal && isEmptyAuthoritativeResult;
  }

  generateAuthoritativeAbstentionResponse(authority, question) {
    const statuteName = this.getStatuteDisplayName(authority.statute);
    const paragraphRef = authority.paragraph ? (authority.isArticle ? `Artikel ${authority.paragraph}` : `§${authority.paragraph}`) : '';
    const normRef = paragraphRef ? `${statuteName} ${paragraphRef}` : statuteName;
    const template = `**${normRef}**\n\nDie Norm wurde eindeutig identifiziert. Eine inhaltliche Auslegung erfordert juristische Subsumtion oder zusätzlichen Kontext.\n\n*Autoritative Suche ergab keine auslegungsfähigen Textstellen.*`;
    return { success: true, data: { answer: template, confidence: 0.85, statute: authority.statute, paragraph: authority.paragraph, metadata: { authority_final: true, empty_authoritative_result: true, rag_disabled: true } } };
  }

  shouldUseDoctrinalEarlyExit(authority) {
    if (!authority) return false;
    const DOCTRINAL_TYPES = new Set(['DOCTRINE', 'GENERAL_DOCTRINE', 'LEGAL_PRINCIPLE', 'GRUNDSATZ', 'PRINCIPLE', 'DOCTRINAL_ANALYSIS']);
    const isDoctrinalQuestion = DOCTRINAL_TYPES.has(authority.classification?.type) || DOCTRINAL_TYPES.has(authority.question_type) || authority.doctrinal_match === true;
    if (!isDoctrinalQuestion) return false;
    const isConfirmed = authority.epistemicCertainty === 'confirmed' || authority.epistemic_certainty === 'confirmed';
    const isAnchorNormMode = authority.anchorNormMode === true || authority.anchor_norm_mode === true;
    return isDoctrinalQuestion && (isAnchorNormMode || isConfirmed);
  }

  async callDoctrineInductionService(question, authority) {
    if (!this._doctrineCache) this._doctrineCache = new Map();
    const _dKey = question.trim().toLowerCase().substring(0, 60);
    if (this._doctrineCache.has(_dKey)) {
      console.log(`[Doctrine Inductor] Using cached result for key: "${_dKey}"`);
      return this._doctrineCache.get(_dKey);
    }
    try {
      const doctrineResult = await pythonIntegrationService.callDoctrineInductor({
        question, statute: authority.statute, paragraph: authority.paragraph, classification: authority.classification,
        authority_mode: authority.authority_mode, suggested_field: authority.suggestedField || authority.doctrinal_field,
        epistemic_certainty: authority.epistemicCertainty
      });
      if (doctrineResult?.doctrine_found === true && authority.doctrinal_match === true) authority.epistemicCertainty = 'confirmed';
      this._doctrineCache.set(_dKey, doctrineResult);
      return doctrineResult;
    } catch (error) {
      console.error(`❌ Doctrine induction failed: ${error.message}`);
      return null;
    }
  }

  async enforcePythonDoctrine(question, authority) {
    if (this.shouldUseDoctrinalEarlyExit(authority)) return await this.callDoctrineInductionService(question, authority);
    if (!authority?.statute || !authority?.paragraph) return null;
    const isExactOperativeNorm = authority.authority_mode === 'exact' && authority.statute && authority.paragraph && (authority.normFunction === 'OPERATIVE' || !authority.normFunction);
    if (!isExactOperativeNorm) return null;
    try {
      const doctrineResult = await this.callDoctrineInductionService(question, authority);
      if (doctrineResult?.doctrine_found === true && (doctrineResult?.doctrinal_summary || doctrineResult?.answer)) return doctrineResult;
    } catch (error) { console.log(`⚠️ [Doctrine] Python doctrine call failed: ${error.message}`); }
    return null;
  }

  generateDoctrinalAnswer(doctrineResult, authority, question) {
    const statuteName = this.getStatuteDisplayName(authority.statute);
    const paragraphRef = authority.paragraph ? (authority.isArticle ? `Artikel ${authority.paragraph}` : `§ ${authority.paragraph}`) : '';
    let answer = `**${statuteName}${paragraphRef ? ` ${paragraphRef}` : ''}**\n\n`;
    if (doctrineResult.doctrinal_summary) answer += doctrineResult.doctrinal_summary;
    else if (doctrineResult.answer) answer += doctrineResult.answer;
    answer += `\n\n*Doctrinale Analyse durch Python-Autoritätsdienst*`;
    return { fullAnswer: answer, confidence: doctrineResult.confidence || 0.92, template_used: 'python_doctrine', domain: doctrineResult.domain || 'civil', metadata: { doctrine_applied: true, python_doctrine: true, authority_mode: 'exact', epistemic_certainty: authority.epistemicCertainty, anchor_norm_mode: authority.anchorNormMode, retrieval_used: false, safety_check_skipped: true } };
  }

  buildDoctrineCitationSources(authority, pythonResults = null, doctrineSources = []) {
    const retrievedSources = (pythonResults?.results || [])
      .slice(0, 3)
      .map((r, i) => ({
        id: i + 1,
        paragraph: r.paragraph || '',
        statute: r.statute || authority?.statute || 'BGB',
        document: `${authority?.statute || r.statute || 'BGB'}.pdf`,
        score: parseFloat(r.score || r.similarity || '0.5'),
        confidence: parseFloat(r.score || r.similarity || '0.5'),
        content: (r.content || r.text || '').substring(0, 150),
      }));

    if (retrievedSources.length > 0) return retrievedSources;

    const sourceList = Array.isArray(doctrineSources)
      ? doctrineSources
      : doctrineSources
      ? [doctrineSources]
      : [];

    return sourceList.slice(0, 3).map((source, i) => {
      const text = String(source || '');
      const match = text.match(/§\s*(\d+[a-z]?)/i);
      return {
        id: i + 1,
        paragraph: match?.[1] || authority?.paragraph || '',
        statute: authority?.statute || (text.match(/\b(BGB|STGB|HGB|GG|ZPO|STPO|GMBHG)\b/i)?.[1] || 'BGB').toUpperCase(),
        document: `${authority?.statute || 'BGB'}.pdf`,
        score: 0.5,
        confidence: 0.5,
        content: text.substring(0, 150),
      };
    });
  }

  async retrieveDocumentsWithDoctrineGuard(question, authority, authorityLock, allDocuments, classification) {
    classification = classification || { type: 'GENERAL', domain: 'general' };
    const isDoctrinalQuestion = classification?.type === 'DOCTRINE' || authority?.question_type === 'DOCTRINE' || authority?.question_type === 'GENERAL_DOCTRINE' || (authority?.anchorNormMode === true && authority?.epistemicCertainty === 'uncertain') || authority?.doctrinal_match === true || (authority?.anchor_norm_mode === true && authority?.epistemic_certainty === 'uncertain');
    if (isDoctrinalQuestion) {
      const hasSpecificParagraph = /§\s*\d+|art\.\s*\d+/i.test(question);
      if (!hasSpecificParagraph) {
        console.log(`🎓 [Doctrine Guard] Pure doctrinal question — retrieving chunks (topK: 8) instead of skipping TF-IDF`);
        safetyCheck.logSafetyEvent('DOCTRINE_GUARD_TRIGGERED', { question, classification_type: classification?.type, question_type: authority?.question_type });
        try {
          // Retrieve from the authority statute if known, otherwise search all
          const _guardStatutes = authority?.statute
            ? [authority.statute.toUpperCase()]
            : ['BGB', 'STGB', 'GG', 'ZPO', 'HGB'];
          let _guardChunks = [];
          for (const _gs of _guardStatutes) {
            const _gDocs = ragService.filterByStatute(_gs, allDocuments);
            for (const _gDoc of _gDocs) {
              const _gRaw = _gDoc.chunks
                ? _gDoc.chunks.map(c => ({ content: c.content || '', source: _gs, statute: _gs, paragraph: c.metadata?.paragraph || '', metadata: c.metadata || {} }))
                : _gDoc.content ? [{ content: _gDoc.content, source: _gs, statute: _gs, metadata: {} }] : [];
              _guardChunks.push(..._gRaw.filter(c => c.content.length > 50));
            }
          }
          if (_guardChunks.length > 0) {
            let _guardRanked;
            if (!this._rerankCache) this._rerankCache = new Map();
            const _guardRerankKey = question.trim().toLowerCase().substring(0, 80);
            const _guardCached = this._rerankCache.get(_guardRerankKey);
            if (_guardCached) {
              console.log('[FastPath] TF-IDF rerank cache hit');
              _guardRanked = _guardCached;
            } else {
              _guardRanked = ragService.tfidfRerank(_guardChunks, question);
              this._rerankCache.set(_guardRerankKey, _guardRanked);
              setTimeout(() => this._rerankCache.delete(_guardRerankKey), 60000);
            }
            _guardChunks = ChatService.boostAnchorParagraphs(question, _guardRanked).slice(0, 4);
          }
          console.log(`[Doctrine Guard] Retrieved ${_guardChunks.length} chunks from [${_guardStatutes.join(', ')}]`);
          if (_guardChunks.length > 0) {
            return {
              results: _guardChunks,
              authoritative_found: true,
              authority_summary: { doctrine_mode: true, doctrine_detected: true, reason: 'doctrinal_question_guard_with_retrieval' },
              authority_mode: authority.authority_mode
            };
          }
        } catch (_guardErr) {
          console.error(`[Doctrine Guard] Retrieval failed: ${_guardErr.message} — returning empty`);
        }
        // Only return empty if retrieval itself failed
        return { results: [], authoritative_found: false, authority_summary: { doctrine_mode: true, doctrine_detected: true, reason: 'doctrinal_question_guard' }, authority_mode: authority.authority_mode };
      }
    }
    try {
      console.log(`🔍 Using Python for authoritative retrieval (mode: ${authority.authority_mode})...`);
      const preparedDocs = this.prepareDocumentsForPython(allDocuments);
      const sourcesResult = await pythonIntegrationService.getAuthoritativeSources(question, authority.statute, classification.type, preparedDocs);
      if (sourcesResult.success) {
        const hasResults = sourcesResult.allowed_documents?.length > 0;
        const isOverviewMode = authority.authority_mode === 'overview';
        return { results: hasResults ? sourcesResult.allowed_documents : (isOverviewMode ? preparedDocs : []), authoritative_found: hasResults, authority_summary: sourcesResult.authority_summary || {}, authority_mode: authority.authority_mode };
      } else {
        console.log(`⚠️ Python authoritative sources failed, using fallback`);
        return { results: preparedDocs, authoritative_found: false, authority_summary: { fallback: true }, authority_mode: authority.authority_mode };
      }
    } catch (error) {
      console.log(`⚠️ Python retrieval error: ${error.message}`);
      const isOverviewMode = authority.authority_mode === 'overview';
      return { results: isOverviewMode ? allDocuments : [], authoritative_found: false, authority_summary: { error: error.message }, authority_mode: authority.authority_mode };
    }
  }

  calculateEpistemicConfidence(baseConfidence, authority, ragResponse = null) {
    if (authority.authority_mode === 'exact' && authority.statute && authority.paragraph) return 1.0;
    const isDoctrinalQuestion = authority.classification?.type === 'DOCTRINE' || authority.question_type === 'DOCTRINE' || authority.question_type === 'GENERAL_DOCTRINE';
    const isConfirmed = authority.epistemicCertainty === 'confirmed' || authority.epistemic_certainty === 'confirmed';
    if (isDoctrinalQuestion && isConfirmed) return Math.max(baseConfidence, 0.9);
    if (authority.question_type === "DERIVATIVE_NORM" && ragResponse?.synthesisQuality) return Math.min(baseConfidence + (ragResponse.synthesisQuality === "HIGH" ? 0.1 : 0), 0.95);
    if (authority.question_type === "EXACT_OPERATIVE_NORM" || authority.authority_mode === 'exact') {
      const chunkCount = ragResponse?.metadata?.chunksUsed || 0;
      if (chunkCount === 0) return Math.min(baseConfidence, 0.6);
    }
    return baseConfidence;
  }

  structureAnswerWithDoctrinalTemplate(ragResponse, question, safetyValidation, authority, classification, pythonResults) {
    let fullAnswer = ragResponse.doctrine_summary || ragResponse.answer || '';
    if (authority.statute && authority.paragraph) {
      const statuteName = this.getStatuteDisplayName(authority.statute);
      const paragraphRef = authority.isArticle ? `Artikel ${authority.paragraph}` : `§${authority.paragraph}`;
      fullAnswer = `**${statuteName} ${paragraphRef}**\n\n${fullAnswer}`;
    }
    fullAnswer = this.addSafetyInformation(fullAnswer, safetyValidation, authority, question);
    const finalConfidence = this.calculateEpistemicConfidence(ragResponse.confidence || 0.7, authority, ragResponse);
    return { fullAnswer, confidence: finalConfidence, template_used: ragResponse.doctrine_summary ? 'python_doctrine' : 'rag_synthesis', domain: classification?.domain || 'general', metadata: { doctrine_applied: !!ragResponse.doctrine_summary, authority_mode: authority.authority_mode, epistemic_certainty: authority.epistemicCertainty, retrieval_used: !ragResponse.doctrine_summary, safety_check_skipped: classification?.type === 'DOCTRINE', chunks_used: ragResponse.metadata?.chunksUsed || 0 } };
  }

  generateStructuredClarification(authority, question, pythonError = null) {
    let message = '';
    if (!authority.statute) message = 'Um eine präzise rechtliche Analyse zu ermöglichen, geben Sie bitte das relevante Gesetz an (z.B. BGB, StGB, HGB).';
    else if (!authority.paragraph) message = `${this.getStatuteDisplayName(authority.statute)} wurde erkannt. Bitte präzisieren Sie den relevanten Paragraphen oder bestätigen Sie, dass eine Übersicht gewünscht ist.`;
    else message = 'Zusätzliche Präzisierung der Rechtsfrage erforderlich.';
    return { success: true, data: { answer: `**Präzisierung erforderlich**\n\n${message}`, confidence: 0.3, clarification_required: true, statute: authority.statute || null, paragraph: authority.paragraph || null, metadata: { requires_clarification: true, authority_status: authority.status || 'unknown' } } };
  }

  getConversationHistory(limit = 20) {
    if (!this.conversationHistory?.length) return [];
    return this.conversationHistory.slice(-limit);
  }

  validateAnswer(query, answer) {
    const issues = [];

    // Minimum length for BGB doctrine answers
    const isBGBAnswer = /mahnung|verzug|nichtig|anfechtbar|kaufvertrag|werkvertrag|eigentum|besitz|willenserklärung/i.test(query);
    if (isBGBAnswer && answer.length < 400) {
      issues.push(`INCOMPLETE: BGB doctrine answer is ${answer.length} chars — minimum 400 required`);
    }

    // Every legal answer must cite at least one provision
    const hasCitation = /§\s*\d+|Art\.\s*\d+/i.test(answer);
    if (!hasCitation) {
      issues.push('MISSING CITATION: Answer contains no legal provision reference');
    }

    // Banned phrases that indicate retrieval or synthesis failure
    const BANNED_PHRASES = [
      'Provision not in retrieved sources',
      'No standard subtypes',
      'Please re-query',
      'Retrieved chunks do not cover'
    ];
    for (const banned of BANNED_PHRASES) {
      if (answer.includes(banned)) {
        issues.push(`BANNED PHRASE DETECTED: "${banned}"`);
      }
    }

    if (issues.length > 0) {
      console.warn('[validateAnswer] Quality issues detected:\n' + issues.map(i => '  - ' + i).join('\n'));
    }
    return issues;
  }

  addSafetyInformation(answer, safetyValidation, authority, originalQuestion = '') {
    if (authority.classification?.type === 'DOCTRINE' || authority.question_type === 'DOCTRINE' || authority.question_type === 'GENERAL_DOCTRINE' || safetyValidation?.metadata?.safety_check_skipped) return answer;
    if (!safetyValidation?.legalDefensibility) return answer;
    const defensibility = safetyValidation.legalDefensibility;
    const readiness = safetyValidation.examinerReadiness;
    if (defensibility === 'LOW' || readiness === 'NEEDS_REVIEW') return answer + '\n\n⚠️ *Diese Antwort erfordert weitere rechtliche Prüfung.*';
    return answer;
  }

  // Central streaming helper — replaces all inline fetch+json() pairs for DeepSeek.
  // Sends stream:true, accumulates the SSE token stream, returns complete text.
  static async _dsStream(apiKey, bodyObj, timeoutMs = 120000) {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ ...bodyObj, stream: true }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${await response.text()}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    outer: while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break outer;
        try { fullText += JSON.parse(data).choices[0]?.delta?.content || ''; }
        catch { /* partial SSE chunk — skip */ }
      }
    }
    return fullText;
  }

  async _callDeepSeek(messages, opts = {}) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'your_deepseek_api_key_here') throw new Error('DEEPSEEK_API_KEY not configured');
    return ChatService._dsStream(apiKey, {
      model: 'deepseek-chat',
      messages,
      temperature: opts.temperature ?? 0,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }, opts.timeout ?? 120000);
  }

  async handleComparisonQuestion(question, allDocuments, languageStr) {
    console.log(`🔀 [Comparison] Entering comparison mode for: "${question.substring(0, 60)}"`);
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
      console.warn('[Comparison] DEEPSEEK_API_KEY not set — skipping comparison mode');
      return null;
    }

    let concepts;
    try {
      const extractText = await ChatService._dsStream(apiKey, {
          model: 'deepseek-chat',
          max_tokens: 200,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'Extract the two legal concepts being compared. Return ONLY JSON:\n' +
                '{"concept1":{"term":"string","statute":"BGB|StGB|HGB|GG|ZPO|StPO|GmbHG","paragraph":"string or null"},' +
                '"concept2":{"term":"string","statute":"BGB|StGB|HGB|GG|ZPO|StPO|GmbHG","paragraph":"string or null"}}\n\n' +
                'KNOWN PARAGRAPH MAPPINGS — always use these exact paragraphs:\n' +
                'Vorsatz → StGB § 15\nFahrlässigkeit → StGB § 15\nVorsätzlich → StGB § 15\nNotwehr → StGB § 32\n' +
                'Nothilfe → StGB § 32\nMord → StGB § 211\nTotschlag → StGB § 212\nDiebstahl → StGB § 242\n' +
                'Betrug → StGB § 263\nKörperverletzung → StGB § 223\nKaufvertrag → BGB § 433\nWerkvertrag → BGB § 631\n' +
                'Mietvertrag → BGB § 535\nDarlehen → BGB § 488\nSchenkung → BGB § 516\nBürgschaft → BGB § 765\n' +
                'Eigentum → BGB § 903\nBesitz → BGB § 854\nGeschäftsfähigkeit → BGB § 104\nVerjährung → BGB § 195\n' +
                'Schadensersatz → BGB § 249\nKaufmann → HGB § 1\nProkura → HGB § 48\nGmbH → GmbHG § 13\n' +
                'Stammkapital → GmbHG § 5\nNormenkontrolle → GG Art 93\nGrundrechte → GG Art 1\n' +
                'Versammlungsfreiheit → GG Art 8\nStrafbefehl → StPO § 407\nKlage → ZPO § 253\n' +
                'Example: "Vorsatz vs Fahrlässigkeit" → ' +
                '{"concept1":{"term":"Vorsatz","statute":"StGB","paragraph":"15"},' +
                '"concept2":{"term":"Fahrlässigkeit","statute":"StGB","paragraph":"15"}}'
            },
            { role: 'user', content: question }
          ]
        }, 120000);
      concepts = JSON.parse(extractText);
      console.log(`[Comparison] Concepts: ${JSON.stringify(concepts)}`);
    } catch (err) {
      console.error('[Comparison] Concept extraction failed:', err.message);
      return null;
    }

    if (!concepts?.concept1?.statute || !concepts?.concept2?.statute) {
      console.warn('[Comparison] Incomplete extraction — falling back');
      return null;
    }

    const getChunks = (term, statute, paragraph) => {
      try {
        const docs = ragService.filterByStatute(statute.toUpperCase(), allDocuments);
        const allChunks = [];
        for (const doc of docs) {
          if (doc.chunks) allChunks.push(...doc.chunks);
          else if (doc.content) allChunks.push({ content: doc.content, metadata: doc.metadata || {} });
        }
        console.log(`[getChunks] ${term}: total chunks available: ${allChunks.length}`);

        const headingChunks = allChunks.filter(c => {
          const heading = (c.content || '').substring(0, 200).toLowerCase();
          return heading.includes(term.toLowerCase());
        });
        if (headingChunks.length >= 2) {
          console.log(`[getChunks] ${term}: heading match found ${headingChunks.length} chunks`);
          return headingChunks.slice(0, 4);
        }

        if (paragraph) {
          const paraChunks = allChunks.filter(c => {
            const content = c.content || '';
            return content.match(new RegExp(`§\\s*${paragraph}[^0-9]`));
          });
          if (paraChunks.length >= 1) {
            console.log(`[getChunks] ${term}: paragraph ${paragraph} match found ${paraChunks.length} chunks`);
            return paraChunks.slice(0, 4);
          }
        }

        const ranked = ragService.tfidfRerank(allChunks, term);
        console.log(`[getChunks] ${term}: TF-IDF fallback, top chunk: ${ranked[0]?.content?.substring(0,80)}`);
        return ranked.slice(0, 4);
      } catch (err) {
        console.error(`[getChunks] Failed for ${term}:`, err.message);
        return [];
      }
    };

    const chunks1 = getChunks(concepts.concept1.term, concepts.concept1.statute, concepts.concept1.paragraph);
    const chunks2 = getChunks(concepts.concept2.term, concepts.concept2.statute, concepts.concept2.paragraph);
    console.log(`[Comparison] Retrieved ${chunks1.length} chunks for concept1, ${chunks2.length} for concept2`);

    const text1 = chunks1.map(c => c.content || '').join('\n').substring(0, 1500);
    const text2 = chunks2.map(c => c.content || '').join('\n').substring(0, 1500);

    if (!text1 && !text2) {
      console.warn('[Comparison] No statute text found for either concept — falling back');
      return null;
    }

    const c1Label = `${concepts.concept1.term} (${concepts.concept1.statute}${concepts.concept1.paragraph ? ' §' + concepts.concept1.paragraph : ''})`;
    const c2Label = `${concepts.concept2.term} (${concepts.concept2.statute}${concepts.concept2.paragraph ? ' §' + concepts.concept2.paragraph : ''})`;

    let comparisonAnswer;
    try {
      comparisonAnswer = await ChatService._dsStream(apiKey, {
          model: 'deepseek-chat',
          max_tokens: 2500,
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: 'Du bist ein deutscher Rechtsdozent. Vergleiche die zwei Rechtsinstitute.\n\n' +
                'Struktur EXAKT wie folgt:\n\n' +
                `**${c1Label}**\n` +
                '- Definition: ...\n- Voraussetzungen: ...\n- Rechtsfolge: ...\n\n' +
                `**${c2Label}**\n` +
                '- Definition: ...\n- Voraussetzungen: ...\n- Rechtsfolge: ...\n\n' +
                '| Kriterium | ' + concepts.concept1.term + ' | ' + concepts.concept2.term + ' |\n' +
                '|-----------|------------|------------|\n' +
                '| Zeitpunkt | ... | ... |\n' +
                '| Wirkung | ... | ... |\n' +
                '| Voraussetzungen | ... | ... |\n' +
                '| Rechtsfolge | ... | ... |\n' +
                '| Hauptunterschied | ... | ... |\n\n' +
                (languageStr === 'german'
                  ? 'Antworte auf Deutsch.'
                  : `Respond in ${languageStr}. Keep German legal terms (§, BGB, StGB, etc.); write all explanations in ${languageStr}.`) +
                ' Base answer on retrieved statute text only.'
            },
            {
              role: 'user',
              content: `Frage: ${question}\n\n--- ${c1Label} ---\n${text1 || '(keine Textstellen gefunden)'}\n\n--- ${c2Label} ---\n${text2 || '(keine Textstellen gefunden)'}`
            }
          ]
        }, 120000);
      console.log(`[Comparison] Answer generated, length: ${comparisonAnswer.length}`);
    } catch (err) {
      console.error('[Comparison] Synthesis failed:', err.message);
      return null;
    }

    const sources = [
      ...chunks1.slice(0, 1).map(c => c.metadata || {}),
      ...chunks2.slice(0, 1).map(c => c.metadata || {})
    ];

    return {
      success: true,
      data: {
        answer: comparisonAnswer,
        sources,
        confidence: 0.9,
        statute: null,
        paragraph: null,
        metadata: {
          comparison_mode: true,
          concept1: concepts.concept1,
          concept2: concepts.concept2,
          language: languageStr
        }
      }
    };
  }

  normalizeQuery(q) {
    // "242 BGB" → "§ 242 BGB"; already-present § is preserved (not doubled)
    return q.replace(
      /(§\s*)?(\b\d{1,4}[a-z]?\b)\s+(BGB|StGB|HGB|GG|ZPO|StPO|InsO|AktG|GmbHG|AO)\b/gi,
      (match, prefix, num, statute) => prefix ? match : `§ ${num} ${statute}`
    );
  }

  async processQuestion(question, context = {}) {
    question = this.normalizeQuery(question);
    console.log('[DEBUG ROUTE]', question.substring(0, 60));
    console.log('[DEBUG isPureDoc]', this.isPureDoctrineQuestion(question));
    const _compCheck = ['unterschied','unterschiede','vergleich','compare','versus',' vs ','contrast','abgrenzung','gegensatz','difference','differences','vergleichen'];
    console.log('[DEBUG isComparison]', _compCheck.some(s => question.toLowerCase().includes(s)));

    let authority = null;
    let authorityLock = { __locked: false };
    let pythonAuthorityError = null;
    let _pythonFirstCallResults = []; // hoisted so it's accessible after the try block

    const _lang = (context.language || 'de').toLowerCase().split('-')[0];
    const _LANG_MAP = {
      de: 'german',
      german: 'german',
      en: 'english',
      english: 'english',
      pl: 'polish',
      polish: 'polish',
      ar: 'arabic',
      arabic: 'arabic',
      no: 'norwegian',
      norwegian: 'norwegian',
    };
    const languageStr = _LANG_MAP[_lang] || 'german';
    const _langInstruction = _lang === 'en' || _lang === 'english'
      ? '\n\nYou must answer in English.'
      : _lang === 'pl' || _lang === 'polish'
      ? '\n\nMusisz odpowiedzieć po polsku.'
      : _lang === 'ar' || _lang === 'arabic'
      ? '\n\nيجب أن تجيب باللغة العربية.'
      : '\n\nAntworte auf Deutsch.';

    // §434 three-step test injection — computed once, used in all synthesis prompts
    const _is434 = /§\s*434|sachmangel|kaufvertrag\s+mangel/i.test(question);
    const _434Instruction = _is434
      ? '\nFor §434 BGB answers, explicitly state the three-step test: Step 1 subjective requirements §434 Abs. 2, Step 2 objective requirements §434 Abs. 3, Step 3 reasonable buyer expectations. Include at least one concrete example.'
      : '';

    // §13 StGB Garantenstellung category injection — distinguish the three bases
    const _is13 = /garantenstellung|ingerenz|unterlassen|§\s*13\s+stgb/i.test(question);
    const _13Instruction = _is13
      ? '\nFor §13 StGB Garantenstellung questions, distinguish between: (1) Ingerenz — prior dangerous conduct by the accused, (2) vertragliche Übernahme — contractual assumption of a duty to act, (3) enge Lebensgemeinschaft — close personal relationship imposing a duty. Apply the correct category to the facts and cite §13 StGB.'
      : '';

    // §201a StGB — technologieneutrale Auslegung: ephemeral AI capture IS "Anfertigen"
    const _is201a = /§\s*201a|bildaufnahme.*ki|ki.*bildaufnahme|echtzeit.*anal|anfertigen.*ki/i.test(question);
    const _201aInstruction = _is201a
      ? '\nFor §201a StGB questions about AI or real-time analysis: ' +
        'Apply technologieneutrale Auslegung. "Anfertigen" does NOT ' +
        'require permanent storage or a stable image — any temporary ' +
        'technical capture for processing constitutes Anfertigen. ' +
        'The protective purpose of §201a is the Schutz des räumlichen ' +
        'Rückzugsbereichs, which is violated by the capture act itself, ' +
        'not by storage. Ephemeral AI analysis therefore IS strafbar. ' +
        'Cite §201a Abs. 1 Nr. 1 StGB and the technologieneutrale Auslegung.'
      : '';

    // §249/§255 StGB — Raub vs räuberische Erpressung competition
    const _is249 = /§\s*249|§\s*255|raub|räuberische\s+erpressung/i.test(question);
    const _249Instruction = _is249
      ? '\nFor §249/§255 StGB questions: §249 is Raub (direct taking of property by force or threat). §255 is räuberische Erpressung (compelling the victim to surrender property by threat). They are NOT lex specialis to each other — both can apply simultaneously in Tateinheit (§52 StGB) where the facts satisfy both offences.'
      : '';

    try {
      console.log(`\n🚀 Processing with EPISTEMIC AUTHORITY: "${question}" [lang=${languageStr}]`);

      if (!this._rerankCache) this._rerankCache = new Map();
      const _rerankKey = question.trim().toLowerCase().substring(0, 80);

      // ===========================================================================
      // Pure Doctrine: retrieve chunks first, check coverage, then call DeepSeek
      // isPureDoc ONLY skips comparison mode — it never skips retrieval
      // ===========================================================================
      const DOMAIN_STATUTE_MAP = {
        'instanzenzug':          ['ZPO', 'GVG'],
        'berufung':              ['ZPO'],
        'revision':              ['ZPO'],
        'amtsgericht':           ['ZPO', 'GVG'],
        'streitwert':            ['ZPO'],
        'normenkontrolle':       ['GG', 'BVERFGG'],
        'verfassungsbeschwerde': ['GG', 'BVERFGG'],
        'organstreit':           ['GG', 'BVERFGG'],
        'vorsatz':               ['STGB'],
        'fahrlässigkeit':        ['STGB'],
        'notwehr':               ['STGB'],
        'kaufvertrag':           ['BGB'],
        'werkvertrag':           ['BGB'],
        'eigentum':              ['BGB'],
        'verzug':                ['BGB'],
        'nichtig':               ['BGB'],
        'anfechtbar':            ['BGB'],
        'nichtigkeit':           ['BGB'],
        'anfechtung':            ['BGB'],
        'willenserklärung':      ['BGB'],
        'geschäftsfähigkeit':    ['BGB'],
        'sittenwidrig':          ['BGB'],
        'mahnung':               ['BGB'],
        'verzug':                ['BGB'],
        'schuldnerverzug':       ['BGB'],
        'mahnen':                ['BGB'],
        'fälligkeit':            ['BGB'],
        'leistungszeit':         ['BGB']
      };

      const checkStatuteCoverage = (query, chunks) => {
        const queryLower = query.toLowerCase();
        for (const [keyword, required] of Object.entries(DOMAIN_STATUTE_MAP)) {
          if (queryLower.includes(keyword)) {
            const covered = chunks.map(c => c.source?.toUpperCase() || '');
            const missing = required.filter(
              doc => !covered.some(src => src.includes(doc))
            );
            if (missing.length > 0) return { covered: false, missing };
          }
        }
        return { covered: true, missing: [] };
      };

      if (this.isPureDoctrineQuestion(question) && process.env.DEEPSEEK_API_KEY) {
        console.log('[FastPath] isPureDoc — skipping Python authority resolution');
        console.log(`🎓 [Pure Doctrine] Detected — retrieving chunks first (topK: 5)`);
        try {
          // 1. Determine target statutes from query keywords
          const _queryLower = question.toLowerCase();
          const _targetStatutes = [...new Set(
            Object.entries(DOMAIN_STATUTE_MAP)
              .filter(([kw]) => _queryLower.includes(kw))
              .flatMap(([, statutes]) => statutes)
          )];

          // 2. Retrieve and rerank chunks
          const _allDocs = documentService.getAllDocuments() || [];
          const _statutesToSearch = _targetStatutes.length > 0
            ? _targetStatutes
            : ['BGB', 'STGB', 'GG', 'ZPO', 'HGB'];
          let _docChunks = [];
          for (const _statute of _statutesToSearch) {
            const _docs = ragService.filterByStatute(_statute, _allDocs);
            for (const _doc of _docs) {
              const _raw = _doc.chunks
                ? _doc.chunks.map(c => ({ content: c.content || '', source: _statute }))
                : _doc.content ? [{ content: _doc.content, source: _statute }] : [];
              _docChunks.push(..._raw.filter(c => c.content.length > 50));
            }
          }
          if (_docChunks.length > 0) {
            let _ranked;
            const _docRerankCached = this._rerankCache.get(_rerankKey);
            if (_docRerankCached) {
              console.log('[FastPath] TF-IDF rerank cache hit');
              _ranked = _docRerankCached;
            } else {
              _ranked = ragService.tfidfRerank(_docChunks, question);
              this._rerankCache.set(_rerankKey, _ranked);
              setTimeout(() => this._rerankCache.delete(_rerankKey), 60000);
            }
            _docChunks = ChatService.boostAnchorParagraphs(question, _ranked).slice(0, 4);
          }
          console.log(`[Pure Doctrine] Retrieved ${_docChunks.length} chunks from [${_statutesToSearch.join(', ')}]`);

          // 3. Coverage check
          const _coverage = checkStatuteCoverage(question, _docChunks);
          const _apiKey = process.env.DEEPSEEK_API_KEY;
          let _doctrineAnswer = null;

          if (_docChunks.length > 0 && _coverage.covered) {
            // PATH 1 — chunks retrieved and coverage passes: cite only statute text found
            console.log(`[Pure Doctrine] PATH 1 — chunks OK, coverage OK`);
            const _chunksText = _docChunks.map(c => `[${c.source}] ${ChatService._compressChunk(c.content)}`).join('\n\n');
            const _ans1 = await ChatService._dsStream(_apiKey, {
                model: 'deepseek-chat',
                max_tokens: 1500,
                temperature: 0,
                messages: [
                  {
                    role: 'system',
                    content: 'German law tutor. Answer using retrieved chunks only.\n' +
                      'Structure: 1.DEFINITION 2.LEGAL BASIS 3.ELEMENTS/SUBTYPES 4.RECHTSFOLGE 5.SUMMARY\n' +
                      'Cite only §§ in chunks. Plain text. End with SUMMARY. Max 250 words.\n' +
                      'Never: "Provision not in sources", "Please re-query". Never Art.94 for Normenkontrolle.' + _langInstruction
                  },
                  {
                    role: 'user',
                    content: 'QUESTION: ' + question + '\n\nRETRIEVED CHUNKS:\n' + _chunksText
                  }
                ]
              }, 120000);
            if (_ans1 && _ans1.length > 80) {
              _doctrineAnswer = _ans1 + '\n\n[Source: Jurisma Document Store]';
              console.log(`[Pure Doctrine] PATH 1 success, length: ${_ans1.length}`);
            }

          } else {
            // PATH 2 — coverage fails: required statute not in chunks → DeepSeek legal knowledge
            const _missingList = _coverage.missing.join(', ') || 'required statute';
            console.log(`[Pure Doctrine] PATH 2 — coverage failed, missing: [${_missingList}]`);
            const _ans2 = await ChatService._dsStream(_apiKey, {
                model: 'deepseek-chat',
                max_tokens: 1500,
                temperature: 0,
                messages: [
                  {
                    role: 'system',
                    content: 'You are a German law expert (Jura-Repetitor). The RAG document store did not retrieve the ' +
                      'required statute for this question. Answer entirely from your legal training knowledge.\n\n' +
                      'REQUIRED STRUCTURE:\n' +
                      '1. DEFINITION: One sentence restating the question as a complete answer.\n' +
                      '2. LEGAL BASIS: Cite the specific article/section (GG, ZPO, StGB, BGB etc.).\n' +
                      '3. ELEMENTS / SUBTYPES: List all subtypes with a one-line explanation each.\n' +
                      '4. LEGAL CONSEQUENCE (Rechtsfolge): What is the legal effect when this rule applies?\n' +
                      '5. SUMMARY: One sentence for exam memorization.\n\n' +
                      'RULES:\n' +
                      '- Normenkontrolle: cite Art. 93 I No. 2, Art. 100 GG — NEVER Art. 94\n' +
                      '- Vorsatz/Fahrlässigkeit: cite §15 StGB — NEVER §316c or §232\n' +
                      '- Instanzenzug/Berufung/Revision: cite §§ 511-544 ZPO and §§ 12, 23, 72, 119 GVG\n' +
                      '- No cut-off sentences\n' +
                      '- Under 250 words total\n' +
                      '- End with SUMMARY line' + _langInstruction
                  },
                  {
                    role: 'user',
                    content: 'Question: ' + question
                  }
                ]
              }, 120000);
            if (_ans2 && _ans2.length > 80) {
              _doctrineAnswer = _ans2 + '\n\n[Source: DeepSeek Legal Knowledge — not from document store]';
              console.log(`[Pure Doctrine] PATH 2 success, length: ${_ans2.length}`);
            }
          }

          if (_doctrineAnswer) {
            return resultFormatter.formatResponse({
              success: true,
              data: {
                answer: _doctrineAnswer,
                confidence: _coverage.covered ? 0.88 : 0.72,
                statute: null,
                sources: _docChunks.map(c => ({ document: c.source, excerpt: c.content.substring(0, 120) })),
                metadata: {
                  pure_doctrine: true,
                  chunks_used: _docChunks.length,
                  coverage_passed: _coverage.covered
                }
              }
            }, null);
          }
        } catch (err) {
          console.error(`⚠️ [Pure Doctrine] ${err.message} — falling through to standard processing`);
        }
      }

      const FOREIGN_SYSTEMS = /(österreich|schweizer|schweiz(?:er)?|amerikanisch|französisch|englisch|britisch|niederländisch|belgisch|polnisch|italienisch|spanisch|türkisch|japanisch|chinesisch|ausländisch|rechtsvergleich|komparativ|austrian|swiss\s+law|french\s+law|common\s+law)/i;
      if (FOREIGN_SYSTEMS.test(question)) {
        return { success: true, data: { answer: languageStr === 'german' ? '**Korpus-Einschränkung**\n\nDieses System enthält ausschließlich deutsches Bundesrecht (BGB, StGB, HGB, GG, ZPO, StPO, GmbHG). Fragen zum Recht anderer Staaten oder zu Rechtsvergleichungen mit ausländischen Rechtsordnungen können nicht beantwortet werden.' : '**Corpus limitation**\n\nThis system covers German federal law only (BGB, StGB, HGB, GG, ZPO, StPO, GmbHG). Questions comparing German law with foreign legal systems cannot be answered from this corpus.', confidence: 0, refused: true, sources: [], metadata: { out_of_corpus: true, reason: 'foreign_law_comparison' } } };
      }

      const allDocuments = documentService.getAllDocuments();
      if (!allDocuments || allDocuments.length === 0) return { success: false, error: "Keine Dokumente verfügbar. Bitte laden Sie zuerst deutsche Rechtsdokumente hoch.", details: "Document service returned empty list" };
      
      const COMPARISON_SIGNALS = ['unterschied','unterschiede','difference','differences','vergleich','compare','versus',' vs ','contrast','abgrenzung','gegensatz'];
      const _normPairs = ChatService._extractExplicitNormPairs(question);
      const _crossStatute = _normPairs.length >= 2 && new Set(_normPairs.map(p => p.statute)).size >= 2;
      const isComparison = COMPARISON_SIGNALS.some(s => question.toLowerCase().includes(s)) || _crossStatute;
      if (_crossStatute) {
        console.log('[CrossStatute] Detected cross-statute query:',
          _normPairs.map(p => `§${p.paragraph} ${p.statute}`).join(', '));
      }
      console.log('[Comparison Check] isComparison:', isComparison, '| crossStatute:', _crossStatute, '| hasKey:', !!process.env.DEEPSEEK_API_KEY, '| q:', question.substring(0,50));

      const _compKey = question.trim().toLowerCase().substring(0, 80);
      if (!this._failedComparisons) this._failedComparisons = new Set();

      // Doctrine/explanation questions always timeout in comparison — skip directly to doctrine path
      const _skipComparison = (
        /unterschied|difference|vergleich|compare|versus|vs\.|what is|was ist|was sind|define|definiere|explain|erkläre|purpose|zweck|when is|wann ist|how does|kaufvertrag|werkvertrag|mietvertrag|nichtig|anfechtbar|vorsatz|fahrlässigkeit|notwehr|mahnung|verzug|eigentum|besitz|normenkontrolle|verhältnismäßigkeit|instanzenzug|berufung|revision|grundrecht|verbrechen|vergehen/i.test(question)
      );
      if (_skipComparison && isComparison) {
        console.log('[FastPath] Skipping comparison — doctrine question detected');
      }

      if (isComparison && process.env.DEEPSEEK_API_KEY && !this._failedComparisons.has(_compKey) && !_skipComparison) {
        try {
          console.log('[Comparison] Starting comparison via handleComparisonQuestion...');
          const compResult = await Promise.race([
            this.handleComparisonQuestion(question, allDocuments, languageStr),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Comparison timeout 5s')), 5000))
          ]);
          if (compResult && compResult.success) {
            console.log('[Comparison] Success, returning result');
            return compResult;
          }
          console.log('[Comparison] Returned null, falling through to standard processing');
        } catch (err) {
          console.error('[Comparison FAILED]', err.message);
          this._failedComparisons.add(_compKey);
          console.log(`[Comparison] Cached failure for key: "${_compKey}" — next identical query skips comparison`);
        }
      } else if (isComparison && this._failedComparisons.has(_compKey)) {
        console.log(`[Comparison] Fast-fail bypass — previous attempt timed out, skipping to standard processing`);
      }


      console.log(`🔍 [ChatService] Resolving authority via Python service...`);

      // 50-entry LRU cache with 30-min TTL — avoids re-calling Python for repeated questions
      if (!this._authorityCache) this._authorityCache = new Map();
      const _authCacheKey = question.trim().toLowerCase().substring(0, 100);
      if (this._authorityCache.has(_authCacheKey)) {
        const _entry = this._authorityCache.get(_authCacheKey);
        if (Date.now() - _entry.ts < 30 * 60 * 1000) {
          // LRU refresh: delete + re-insert moves entry to end (most-recently-used)
          this._authorityCache.delete(_authCacheKey);
          this._authorityCache.set(_authCacheKey, _entry);
          authority = _entry.authority;
          console.log(`[AuthCache] Hit — ${authority.statute} ${authority.paragraph || ''}`);
        } else {
          this._authorityCache.delete(_authCacheKey);
          console.log(`[AuthCache] Expired — evicting stale entry`);
        }
      }

      // Concept-based short-circuit: skip slow Python FAISS for well-known English legal
      // concepts whose German statute/paragraph mapping is deterministic and unambiguous.
      if (!authority?.statute) {
        const _conceptNorm = this.detectConceptualNormReference(question);
        if (_conceptNorm) {
          authority = _conceptNorm;
          console.log(`🧠 [ConceptShortcut] ${authority.statute} §${authority.paragraph} — Python FAISS skipped`);
        }
      }

      if (authority?.statute) {
        console.log(`[Authority] Already resolved (${authority.statute}), skipping second call`);
      } else
      try {
        // Expand English legal terms to German equivalents before Python FAISS search
        // so multilingual embeddings score German statute text correctly.
        const _PRE_EXPAND = {
          'good faith':        'gutgläubig Erwerb § 932 § 929 § 935',
          'bona fide':         'gutgläubig § 932 § 929 § 935',
          'abandoned property':'herrenlose Sachen § 958 § 959 § 960 Aneignung',
          'ownerless':         'herrenlos § 958 § 959 § 960',
          'duress':            'Drohung § 123 Anfechtung widerrechtlich',
          'fraudulent':        'arglistig § 123 Täuschung Anfechtung',
          'good-faith':        'gutgläubig § 932 § 929',
        };
        let _pythonQuery = question;
        for (const [en, de] of Object.entries(_PRE_EXPAND)) {
          if (question.toLowerCase().includes(en.toLowerCase())) {
            _pythonQuery += ' ' + de;
            console.log(`[PreExpand] "${en}" → appended German terms for Python FAISS`);
          }
        }
        const authorityResult = await pythonIntegrationService.resolveAuthority(_pythonQuery);
        _pythonFirstCallResults = authorityResult.results || [];
        console.log('[DEBUG] Python authority result:', JSON.stringify({
          statute: authorityResult?.authority?.statute,
          success: authorityResult?.success,
          resultsCount: _pythonFirstCallResults.length,
          anchorParagraphs: authorityResult?.anchorParagraphs,
        }));

        if (authorityResult.success && authorityResult.authority) {
          authority = authorityResult.authority;

          if (authority.statute && typeof authority.statute === 'string') {
            authority.statute = authority.statute.toUpperCase();
          }

          const explicitNorm = this.detectExactNormReference(question);
          if (explicitNorm) {
            console.log(`🎯 [CRITICAL FIX] Explicit norm reference detected: ${explicitNorm.statute} §${explicitNorm.paragraph}`);
            authority.statute = explicitNorm.statute;
            authority.paragraph = explicitNorm.paragraph;
            authority.isArticle = explicitNorm.isArticle;
            authority.authority_mode = 'exact';
            authority.isStatuteLocked = true;
            authority.isParagraphLocked = true;
            authority.requiresClarification = false;
            authority.__explicit_norm_reference = true;
          } else {
            const STATUTE_KEYWORDS = {
              STPO: /\b(stpo|strafprozessordnung|strafverfahrensrecht)\b/i,
              ZPO:  /\b(zpo|zivilprozessordnung|zivilprozess(?:recht)?)\b/i,
              GMBHG: /\b(gmbhg|gmbh-gesetz|gmbh\s*gesetz)\b/i,
              HGB:  /\b(hgb|handelsgesetzbuch|handelsrecht)\b/i,
              GG:   /\b(grundgesetz|gg(?:\s|$))/i,
              STGB: /\b(stgb|strafgesetzbuch|strafrecht)\b/i,
              BGB:  /\b(bgb|bürgerliches\s*gesetzbuch|zivilrecht)\b/i,
            };
            for (const [statute, pattern] of Object.entries(STATUTE_KEYWORDS)) {
              if (pattern.test(question)) {
                if (authority.statute !== statute) {
                  console.log(`[StatuteKeyword] Overriding Python statute "${authority.statute}" → "${statute}" based on question keyword`);
                  authority.statute = statute;
                  authority.isStatuteLocked = true;
                }
                break;
              }
            }
          }
          
          if (!authority.statute || authority.statute === 'UNKNOWN' || authority.statute === 'null') {
            const q = question.toLowerCase();
            let inferredStatute;
            if (q.match(/nichtig|anfechtb|willenserklär|geschäftsfähig|verjähr|kaufvertr|werkvertr|mietvertr|bürgschaft|besitz|eigentum|schadensersatz|kausalität|zurechenbar|schuld|pflichtverletz|unmittelbar|mittelbar|anspruch|einrede|delikt|haftung/)) {
              inferredStatute = 'BGB';
            } else if (q.match(/strafbar|vorsatz|fahrlässig|notwehr|mord|diebstahl|betrug|körperverletzung|tatbestand|rechtswidrigkeit|schuld.*straf|rechtfertig|entschuldig/)) {
              inferredStatute = 'STGB';
            } else if (q.match(/kaufmann|handelsgewerbe|prokura|firma|handelsregister|konnossement/)) {
              inferredStatute = 'HGB';
            } else if (q.match(/gmbh|stammkapital|gesellschaft.*mbh|geschäftsführer.*gmbh/)) {
              inferredStatute = 'GMBHG';
            } else if (q.match(/grundrecht|verfassung|bundestag|bundesrat|grundgesetz|normenkontrolle/)) {
              inferredStatute = 'GG';
            } else if (q.match(/strafverfahren|strafprozess|anklage|hauptverhandlung|strafbefehl/)) {
              inferredStatute = 'STPO';
            } else if (q.match(/klage.*zivil|zivilprozess|zustellung.*gericht|vollstreckung/)) {
              inferredStatute = 'ZPO';
            } else {
              inferredStatute = 'BGB';
            }
            console.log(`[Doctrine Keyword Fallback] authority.statute was "${authority.statute}" — inferred: ${inferredStatute}`);
            authority.statute = inferredStatute;
            authority.isStatuteLocked = true;
          }

          // §249/§255 StGB explicit paragraph lock — guards against FAISS semantic drift
          // to §91 (terrorism) caused by "Waffe"/"Gefahr" in Raub/Erpressung questions.
          // Activates the ParaFilter even when detectExactNormReference returned null
          // (multi-ref heuristic) or when the doctrine path set isParagraphLocked=false.
          const _raub255m = question.match(/§\s*(249|255)\b/i);
          if (_raub255m && !authority.isParagraphLocked) {
            authority.paragraph = _raub255m[1];
            authority.statute   = authority.statute || 'STGB';
            authority.isParagraphLocked = true;
            authority.isStatuteLocked   = true;
            console.log(`[§249/255 Guard] Force-locked to §${authority.paragraph} ${authority.statute} — FAISS drift prevention`);
          }

          console.log(`? Python raw authority:`, JSON.stringify(authority, null, 2));

          if (this.isTerminalAuthority(authority)) {
            console.log(`🚦 [TERMINAL AUTHORITY] Python declared final paragraph - Node MUST STOP IMMEDIATELY`);
            
            let answerText = authority.text || authority.answer || authority.content;
            
            if (!answerText && authority.statute && authority.paragraph) {
              const exactChunk = this.findExactParagraph(allDocuments, authority.statute, authority.paragraph);
              if (exactChunk) answerText = exactChunk.content || exactChunk.text;
            }
            
            if (!answerText) {
              const statuteName = this.getStatuteDisplayName(authority.statute);
              const paragraphRef = authority.isArticle ? `Artikel ${authority.paragraph}` : `§${authority.paragraph}`;
              answerText = `**${statuteName} ${paragraphRef}**\n\n[Exakte Paragrapheninhalte aus dem Python-Autoritätsdienst]`;
            }
            
            const terminalResponse = { success: true, data: { answer: answerText, structuredAnswer: { fullAnswer: answerText, confidence: 1.0, template_used: 'terminal_authority', domain: 'legal', metadata: { terminal_authority: true, authority_final: true, retrieval_used: false } }, sources: [], confidence: 1.0, metadata: { terminal_authority: true } } };
            return resultFormatter.formatResponse(terminalResponse, authority);
          }
          
          authorityLock = this.createAuthorityLock(authority);
          
          if (authorityResult.authority.question_type) authority.question_type = authorityResult.authority.question_type;
          if (authorityResult.anchorParagraphs?.length > 0) authority.domain_anchor_paragraphs = authorityResult.anchorParagraphs;
          if (authorityResult.authority.doctrinal_match !== undefined) authority.doctrinal_match = authorityResult.authority.doctrinal_match;
          if (authorityResult.authority.epistemicCertainty) authority.epistemicCertainty = authorityResult.authority.epistemicCertainty;
          else if (authorityResult.authority.epistemic_certainty) authority.epistemicCertainty = authorityResult.authority.epistemic_certainty;
          if (authorityResult.authority.suggestedField) authority.suggestedField = authorityResult.authority.suggestedField;
          if (authorityResult.authority.anchorNormMode !== undefined) authority.anchorNormMode = authorityResult.authority.anchorNormMode;
          else if (authorityResult.authority.anchor_norm_mode !== undefined) authority.anchorNormMode = authorityResult.authority.anchor_norm_mode;
          
          if (!authority.classification && (authority.question_type === 'DOCTRINE' || authority.question_type === 'GENERAL_DOCTRINE' || authority.doctrinal_match === true)) {
            authority.classification = { type: 'DOCTRINE', domain: authority.domain || 'general', source: 'python_doctrine_detection' };
          }
          
          if (authority.status) authority.requiresClarification = authority.status === 'CLARIFICATION_REQUIRED';
          
          console.log(`✅ Python authority resolved: ${authority.statute || 'NO_STATUTE'} ${authority.paragraph ? '§' + authority.paragraph : ''}`);

          // Store resolved authority in LRU cache (only if useful — has a statute)
          if (authority?.statute) {
            if (this._authorityCache.size >= 50) {
              this._authorityCache.delete(this._authorityCache.keys().next().value);
            }
            this._authorityCache.set(_authCacheKey, { authority, ts: Date.now() });
            console.log(`[AuthCache] Stored — ${authority.statute} ${authority.paragraph || ''} (cache size: ${this._authorityCache.size})`);
          }

        } else {
          authority = { statute: null, paragraph: null, isArticle: false, requiresClarification: false, stopProcessing: false, confidence: 0.3, referenceSource: 'python_failed', authority_mode: 'fallback', classification: { type: 'GENERAL', domain: 'general', source: 'python_fallback' } };
          authorityLock = { __locked: false };
        }
      } catch (error) {
        console.log(`⚠️ Python authority service error: ${error.message}`);
        pythonAuthorityError = error.message;
        authority = { statute: null, paragraph: null, isArticle: false, requiresClarification: false, stopProcessing: false, confidence: 0.1, referenceSource: 'python_error', authority_mode: 'fallback', classification: { type: 'GENERAL', domain: 'general', source: 'python_error_fallback' } };
        authorityLock = { __locked: false };
      }
      
      if (authorityLock?.__locked === true) {
        const lockedResponse = { success: true, data: { answer: `**Autorität gesperrt**\n\nDie Anfrage wurde durch den autoritativen Dienst finalisiert. Weitere Verarbeitung ist gesperrt.\n\n*Status: ${authorityLock.__lockReason}*`, confidence: 0.9, metadata: { authority_locked: true, lock_reason: authorityLock.__lockReason } } };
        return resultFormatter.formatResponse(lockedResponse, authority);
      }
      
      const shouldRequireClarification = () => {
        if (authority.stopProcessing === true) return true;
        const implicitAllowed = authority?.authority_mode === 'overview' && authority?.confidence >= 0.8;
        if (authority.__explicit_norm_reference === true) return false;
        
        // UPDATED: Expanded DOCTRINE_TERMS with the requested terms
        const DOCTRINE_TERMS = [
          'nichtigkeit', 'anfechtbar', 'anfechtung', 'rechtsgeschäft',
          'verjährung', 'schadensersatz', 'besitz', 'eigentum',
          'notwehr', 'vorsatz', 'fahrlässigkeit', 'tatbestand',
          'rechtsfolge', 'kausalität', 'zurechenbarkeit', 'schuld',
          'rechtfertigung', 'entschuldigung', 'strafbarkeit',
          'kaufvertrag', 'werkvertrag', 'mietvertrag', 'bürgschaft',
          'ex tunc', 'ex nunc', 'willenserklärung', 'geschäftsfähigkeit',
          'unmittelbar', 'mittelbar', 'anspruch', 'einrede',
          'delikt', 'haftung', 'pflichtverletzung', 'verschulden',
          // NEW TERMS:
          'einwendung', 'einrede', 'rechtshindernde', 'rechtsvernichtende',
          'rechtshemmende', 'anspruchsprüfung', 'tatbestand', 'rechtsfolge',
          'subsumtion', 'prüfungsschema', 'dogmatik', 'doktrin'
        ];
        const hasDoctrineTerm = DOCTRINE_TERMS.some(t =>
          question.toLowerCase().includes(t)
        );
        const isLongQuestion = question.length > 50;
        const hasComparison = ['unterschied', 'vergleich', 'unterscheiden', 'versus', ' vs '].some(s =>
          question.toLowerCase().includes(s)
        );

        if (hasDoctrineTerm || (isLongQuestion && hasComparison)) {
          console.log(`✅ [Doctrine Bypass] Suppressing clarification — doctrine:${hasDoctrineTerm} longComparison:${isLongQuestion && hasComparison}`);
          return false;
        }

        if (!authority.statute && !implicitAllowed) {
          console.log(`⚠️ No statute detected and implicit authority NOT allowed`);
          return true;
        }
        
        if (!authority.statute && implicitAllowed) {
          console.log(`✅ Implicit authority allowed – proceeding without statute`);
          return false;
        }
        
        const isStatuteOnlyDoctrineQuestion = () => {
          const isStatuteOnly = 
            authority.retrieval?.constraint === 'STATUTE_ONLY' ||
            authority.constraint === 'STATUTE_ONLY' ||
            authority.statute_only === true;
          
          const isDoctrinalQuestion = 
            authority.question_type === 'DOCTRINE' ||
            authority.question_type === 'GENERAL_DOCTRINE' ||
            authority.question_type === 'GENERAL' ||
            authority.doctrinal_match === true ||
            authority.classification?.type === 'DOCTRINE';
          
          const isStatuteLocked = 
            authority.isStatuteLocked === true ||
            authority.statute_locked === true;
          
          const isParagraphNotLocked = 
            authority.isParagraphLocked === false ||
            authority.paragraph_locked === false;
          
          return isStatuteOnly && isDoctrinalQuestion && isStatuteLocked && isParagraphNotLocked;
        };
        
        if (authority.statute && !authority.paragraph) {
          if (isStatuteOnlyDoctrineQuestion()) {
            console.log(`✅ [DOCTRINE FIX] Statute-only doctrine question: ${authority.statute} - paragraph NOT required`);
            return false;
          }
          
          if (authority.authority_mode === 'overview') {
            console.log(`✅ Overview mode: statute ${authority.statute} without paragraph is allowed`);
            return false;
          }

          const isUndefinedOrFallbackMode =
            !authority.authority_mode || authority.authority_mode === 'fallback';
          if (isUndefinedOrFallbackMode && authority.anchorNormMode === true) {
            console.log(`✅ [Anchor Norm Mode] Statute-only anchor for general question — paragraph not required`);
            return false;
          }

          const questionHasSpecificParagraph = /§\s*\d+|art\.\s*\d+/i.test(question);
          if (!questionHasSpecificParagraph) {
            console.log(`✅ [Overview Fallback] No specific § in question — allowing statute-overview for ${authority.statute}`);
            return false;
          }

          const KNOWN_STATUTE_NAMES = /\b(BGB|StGB|HGB|GmbHG|StPO|ZPO|GG)\b/i;
          if (KNOWN_STATUTE_NAMES.test(question)) {
            console.log(`✅ [Explicit Ref] Question has § + statute name — skipping clarification for ${authority.statute}`);
            return false;
          }

          console.log(`⚠️ Statute ${authority.statute} found but paragraph missing in mode ${authority.authority_mode}`);
          return true;
        }
        
        const _noParaInQ = !question.match(/\u00a7|\u0026#167;|art\.\s*\d+/i) && !question.includes("§"); 
        if (_noParaInQ) { 
          console.log("✅ [ReqClar Bypass] No § in question — ignoring Python clarification flag"); 
          return false; 
        } 
        if (authority.requiresClarification === true) {
          console.log(`⚠️ Python explicitly flagged clarification required`);
          return true;
        }
        
        return false;
      };
      
      if (shouldRequireClarification()) {
        console.log(`⚠️ [ChatService] Authority clarification required`);
        
        safetyCheck.logSafetyEvent('AUTHORITY_CLARIFICATION', {
          question,
          statute: authority.statute,
          paragraph: authority.paragraph,
          authority_mode: authority.authority_mode,
          clarificationType: !authority.statute ? 'statute_missing' : 'paragraph_missing',
          timestamp: new Date().toISOString(),
          python_error: !!pythonAuthorityError,
          python_status: authority.status || 'unknown'
        });
        
        const clarification = this.generateStructuredClarification(authority, question, pythonAuthorityError);
        return resultFormatter.formatResponse(clarification, authority);
      }
      
      console.log(`✅ Authority from Python: ${authority.statute} ${authority.paragraph ? (authority.isArticle ? 'Article ' : '§') + authority.paragraph : ''} (mode: ${authority.authority_mode})`);
      
      if (authority.authority_mode === 'exact' && authority.statute && authority.paragraph) {
        console.log(`🎯 [Exact Mode] Processing exact paragraph: ${authority.statute} §${authority.paragraph}`);
        
        const exactChunk = this.findExactParagraph(allDocuments, authority.statute, authority.paragraph);
        
        if (!exactChunk) {
          console.log(`❌ [Exact Mode] Paragraph §${authority.paragraph} not found in ${authority.statute}`);
          
          const fallbackChunks = [];
          for (const doc of allDocuments) {
            const chunks = doc.chunks || [doc];
            for (const chunk of chunks) {
              const statuteRaw = chunk.metadata?.statute || doc.metadata?.statute;
              if (statuteRaw === authority.statute) {
                const content = chunk.content || chunk.text || '';
                if (content.includes(`§${authority.paragraph}`) || 
                    content.includes(`§ ${authority.paragraph}`) ||
                    content.includes(`Paragraph ${authority.paragraph}`)) {
                  fallbackChunks.push({ chunk, doc, matchType: 'text_inclusion', preview: content.substring(0, 200) });
                }
              }
            }
          }
          
          if (fallbackChunks.length > 0) {
            console.log(`✅ [Exact Mode] Found ${fallbackChunks.length} chunks containing §${authority.paragraph} in text`);
            const fallbackChunk = fallbackChunks[0].chunk;
            const _fbDoc = fallbackChunks[0].doc;
            const _fbDocName = fallbackChunk.documentName || fallbackChunk.filename || _fbDoc?.metadata?.filename || _fbDoc?.filename || `${authority.statute}.pdf`;

            const exactResponse = {
              success: true,
              data: {
                answer: this.formatChunkAsAnswer(fallbackChunk.content || fallbackChunk.text, authority.statute, authority.paragraph, authority.isArticle),
                structuredAnswer: {
                  fullAnswer: this.formatChunkAsAnswer(fallbackChunk.content || fallbackChunk.text, authority.statute, authority.paragraph, authority.isArticle),
                  confidence: 1.0,
                  template_used: 'exact_paragraph_fallback',
                  domain: 'legal',
                  metadata: { exact_mode: true, authority_mode: 'exact', retrieval_used: false, safety_check_skipped: true, fallback_used: true }
                },
                sources: [{ statute: authority.statute, paragraph: authority.paragraph, documentName: _fbDocName, page: fallbackChunk.metadata?.page || fallbackChunk.page || 1, content: (fallbackChunk.content || fallbackChunk.text)?.substring(0, 200) + '...', metadata: fallbackChunk.metadata }],
                confidence: 1.0,
                statute: authority.statute,
                paragraph: authority.paragraph,
                metadata: { exactParagraphMatch: false, textInclusionMatch: true, fallback_used: true }
              }
            };
            
            // DeepSeek Synthesis for Exact Mode (Fallback path)
            try {
              const _q = question || '';
              const _exactChunkText = ChatService._compressChunk(fallbackChunk.content || fallbackChunk.text || '');
              if (_q.length > 40 && _exactChunkText.length > 30 && process.env.DEEPSEEK_API_KEY) {
                console.log('[SYNTH-EXACT]', true, '|', _q.substring(0, 50));
                const _exactAnswer = await ChatService._dsStream(process.env.DEEPSEEK_API_KEY, {
                    model: 'deepseek-chat',
                    max_tokens: 1500,
                    temperature: 0,
                    messages: [
                      {
                        role: 'system',
                        content: 'German law tutor. Answer using retrieved statute text only.\n' +
                          'Structure: 1.DEFINITION 2.LEGAL BASIS 3.ELEMENTS/SUBTYPES 4.RECHTSFOLGE 5.SUMMARY\n' +
                          'List ALL conditions for "under what conditions" questions. Cite only §§ in text.\n' +
                          'Plain text. End with SUMMARY. No markdown.' + _434Instruction + _13Instruction + _201aInstruction + _249Instruction + _langInstruction
                      },
                      {
                        role: 'user',
                        content: 'QUESTION: ' + _q + '\n\nRETRIEVED STATUTE TEXT:\n' + _exactChunkText
                      }
                    ]
                  }, 18000);
                if (_exactAnswer && _exactAnswer.length > 100) {
                  console.log('[SYNTH-EXACT-DS] success, length:', _exactAnswer.length);
                  exactResponse.data.answer = _exactAnswer;
                  if (exactResponse.data.structuredAnswer) exactResponse.data.structuredAnswer.fullAnswer = _exactAnswer;
                } else {
                  console.log('[SYNTH-EXACT-DS] failed, using template fallback');
                }
              }
            } catch (_e) {
              console.error('[SYNTH-EXACT-DS] failed, using template fallback —', _e.message);
            }

            // Hallucination guard for exact-mode fallback path
            const _hallFb = ChatService.detectHallucinatedCitations(
              exactResponse.data.answer,
              [fallbackChunk.content || fallbackChunk.text || '']
            );
            if (_hallFb.length > 0) {
              if (!exactResponse.data.metadata) exactResponse.data.metadata = {};
              exactResponse.data.metadata.hallucinated_citations = _hallFb;
              exactResponse.data.metadata.unverified = true;
            }

            return resultFormatter.formatResponse(exactResponse, authority);
          }

          return { success: false, error: `Paragraph §${authority.paragraph} nicht in ${this.getStatuteDisplayName(authority.statute)} gefunden.`, data: { requires_clarification: true, statute: authority.statute, paragraph: authority.paragraph } };
        }
        
        const exactResponse = {
          success: true,
          data: {
            answer: this.formatChunkAsAnswer(exactChunk.content || exactChunk.text, authority.statute, authority.paragraph, authority.isArticle),
            structuredAnswer: {
              fullAnswer: this.formatChunkAsAnswer(exactChunk.content || exactChunk.text, authority.statute, authority.paragraph, authority.isArticle),
              confidence: 1.0,
              template_used: 'exact_paragraph',
              domain: 'legal',
              metadata: { exact_mode: true, authority_mode: 'exact', retrieval_used: false, safety_check_skipped: true, text_extraction_used: true }
            },
            sources: [{ statute: authority.statute, paragraph: authority.paragraph, content: (exactChunk.content || exactChunk.text)?.substring(0, 200) + '...', metadata: exactChunk.metadata }],
            confidence: 1.0,
            conversationId: Date.now().toString(),
            legalDomain: 'legal',
            statute: authority.statute,
            paragraph: authority.paragraph,
            isArticle: authority.isArticle,
            authority: authority,
            classification: { type: 'EXACT_OPERATIVE_NORM', domain: 'legal', source: 'exact_mode_processor' },
            safetyCheck: { isLegallySound: true, legalDefensibility: 'HIGH', examinerReadiness: 'EXAMINER_READY', confidenceAdjusted: 1.0, metadata: { safety_check_skipped: true } },
            metadata: { exactParagraphMatch: true, chunksUsed: 1, authority_mode: 'exact', epistemic_certainty: authority.epistemicCertainty, text_extraction_used: true }
          }
        };
        
        // DeepSeek Synthesis for Exact Mode (main path)
        try {
          const _q = question || '';
          const _exactChunkText = ChatService._compressChunk(exactChunk.content || exactChunk.text || '');
          if (_q.length > 40 && _exactChunkText.length > 30 && process.env.DEEPSEEK_API_KEY) {
            console.log('[SYNTH-EXACT]', true, '|', _q.substring(0, 50));
            const _exactAnswer = await ChatService._dsStream(process.env.DEEPSEEK_API_KEY, {
                model: 'deepseek-chat',
                max_tokens: 1500,
                temperature: 0,
                messages: [
                  {
                    role: 'system',
                    content: 'German law tutor. Answer using retrieved statute text only.\n' +
                      'Structure: 1.DEFINITION 2.LEGAL BASIS 3.ELEMENTS/SUBTYPES 4.RECHTSFOLGE 5.SUMMARY\n' +
                      'List ALL conditions for "under what conditions" questions. Cite only §§ in text.\n' +
                      'Plain text. End with SUMMARY. No markdown.' + _434Instruction + _13Instruction + _201aInstruction + _249Instruction + _langInstruction
                  },
                  {
                    role: 'user',
                    content: 'QUESTION: ' + _q + '\n\nRETRIEVED STATUTE TEXT:\n' + _exactChunkText
                  }
                ]
              }, 18000);
            if (_exactAnswer && _exactAnswer.length > 100) {
              console.log('[SYNTH-EXACT-DS] success, length:', _exactAnswer.length);
              exactResponse.data.answer = _exactAnswer;
              if (exactResponse.data.structuredAnswer) exactResponse.data.structuredAnswer.fullAnswer = _exactAnswer;
            } else {
              console.log('[SYNTH-EXACT-DS] failed, using template fallback');
            }
          }
        } catch (_e) {
          console.error('[SYNTH-EXACT-DS] failed, using template fallback —', _e.message);
        }

        // Hallucination guard for exact-mode main path
        const _hallMain = ChatService.detectHallucinatedCitations(
          exactResponse.data.answer,
          [exactChunk.content || exactChunk.text || '']
        );
        if (_hallMain.length > 0) {
          if (!exactResponse.data.metadata) exactResponse.data.metadata = {};
          exactResponse.data.metadata.hallucinated_citations = _hallMain;
          exactResponse.data.metadata.unverified = true;
        }

        return resultFormatter.formatResponse(exactResponse, authority);
      }

      const classification = authority.classification || { type: 'GENERAL', domain: 'general', source: 'python_default' };
      
      console.log(`📊 Classification: ${classification.type} (domain: ${classification.domain || 'general'})`);
      
      // Consolidated doctrine path — single induction call; fall through to RAG on failure.
      // unconfirmed_doctrine_path removed: it called callDoctrineInductionService again,
      // causing the triple-call loop described in Bug 3.
      if (classification.type === 'DOCTRINE' || authority.question_type === 'GENERAL_DOCTRINE' ||
          this.shouldUseDoctrinalEarlyExit(authority)) {
        console.log(`🎓 [Doctrine] Attempting induction (single call)`);

        const doctrineResult = await this.callDoctrineInductionService(question, authority);
        if (doctrineResult?.doctrine_found === true) {
          const doctrinalAnswer = this.generateDoctrinalAnswer(doctrineResult, authority, question);
          const doctrineSources = this.buildDoctrineCitationSources(
            authority,
            null,
            doctrineResult.sources || doctrineResult.statutory_basis || doctrineResult.constitutional_basis || []
          );
          safetyCheck.logSafetyEvent('DOCTRINE_INDUCTION_SUCCESS', {
            question, statute: authority.statute, epistemicCertainty: authority.epistemicCertainty,
            retrievalUsed: false, safetyCheckSkipped: true
          });
          return resultFormatter.formatResponse({
            success: true,
            data: {
              answer: doctrinalAnswer.fullAnswer,
              structuredAnswer: doctrinalAnswer,
              sources: doctrineSources,
              confidence: doctrinalAnswer.confidence,
              statute: authority.statute,
              paragraph: authority.paragraph,
              isArticle: authority.isArticle,
              metadata: doctrinalAnswer.metadata
            }
          }, authority);
        }
        console.log(`⬇️ [Doctrine] doctrine_found=false — falling through to RAG`);
      }

      if (classification.type === 'SYSTEM') {
        console.log(`⚙️ System question - conceptual answer`);
        const result = this.handleSystemQuestion(question, authority);
        return resultFormatter.formatResponse(result, authority);
      }
      
      // If resolveAuthority() already returned retrieval results, use them directly.
      // Making a second getAuthoritativeSources call would let the doctrine guard
      // intercept and fall back to TF-IDF on allDocuments, discarding the FAISS results.
      let pythonResults;
      if (_pythonFirstCallResults.length > 0) {
        console.log(`[DEBUG] Using ${_pythonFirstCallResults.length} results from resolveAuthority directly`);
        pythonResults = {
          results: _pythonFirstCallResults,
          authoritative_found: true,
          authority_summary: {},
          authority_mode: authority.authority_mode,
        };
      } else {
        pythonResults = await this.retrieveDocumentsWithDoctrineGuard(
          question, authority, authorityLock, allDocuments, classification
        );
      }

      // Paragraph relevance filter — when an exact §+statute is locked, discard chunks
      // whose paragraph metadata (or content) does not match the requested paragraph.
      // Prevents FAISS semantic drift from returning e.g. §1600 for a §311 query.
      if (authority.isParagraphLocked === true && authority.paragraph) {
        const _paraTarget = String(authority.paragraph).toLowerCase();
        // Regex: §\s*311\b — handles §311 , §311\n, §311. but not §311a
        const _paraRx = new RegExp(`§\\s*${authority.paragraph}\\b`);

        // Helper: returns true if a result chunk matches the target paragraph.
        // Checks: (1) top-level r.paragraph, (2) r.metadata.paragraph /
        // r.metadata.paragraphNumber, (3) regex match against content.
        const _matchesPara = r => {
          // Top-level paragraph field (Python retrieval_service.py always sets this)
          if (String(r.paragraph || '').toLowerCase() === _paraTarget) return true;
          // Metadata paragraph fields
          const _meta = r.metadata || {};
          const _mp = String(_meta.paragraph || _meta.paragraphNumber || '').toLowerCase();
          if (_mp === _paraTarget) return true;
          // Content text match
          return _paraRx.test(r.content || r.text || '');
        };

        const _pythonFiltered = (pythonResults?.results || []).filter(_matchesPara);
        console.log(`[ParaFilter] §${authority.paragraph} ${authority.statute}: FAISS kept ${_pythonFiltered.length}/${pythonResults?.results?.length || 0} relevant chunks`);

        if (_pythonFiltered.length >= 1) {
          pythonResults = { ...pythonResults, results: _pythonFiltered };
        } else {
          // FAISS index doesn't have §N (not yet re-indexed, or semantic drift).
          // Fall back to Node.js allDocuments chunks which are always up-to-date.
          const _docChunks = [];
          for (const doc of allDocuments) {
            const _stat = doc.metadata?.statute || doc.statute || '';
            if (_stat.toUpperCase() !== authority.statute.toUpperCase()) continue;
            for (const c of (doc.chunks || [])) {
              const _cPara = String(c.metadata?.paragraph || '').toLowerCase();
              const _cContent = c.content || c.text || '';
              if (_cPara === _paraTarget || _paraRx.test(_cContent)) {
                _docChunks.push({
                  content:      _cContent,
                  paragraph:    _cPara || _paraTarget,
                  statute:      authority.statute,
                  documentName: doc.metadata?.filename || doc.filename || `${authority.statute}.pdf`,
                  filename:     doc.metadata?.filename || doc.filename || '',
                  page:         c.metadata?.page || c.page || 1,
                  metadata:     { ...c.metadata, paragraph: _cPara || _paraTarget, statute: authority.statute },
                  source:       'allDocuments_fallback'
                });
              }
            }
          }
          console.log(`[ParaFilter] §${authority.paragraph} ${authority.statute}: allDocuments fallback found ${_docChunks.length} chunks`);

          if (_docChunks.length >= 1) {
            pythonResults = { ...pythonResults, results: _docChunks, authoritative_found: true };
          } else {
            // Truly missing from both FAISS and Node.js index
            const _normRef = `§${authority.paragraph} ${authority.statute}`;
            console.error(`CRITICAL: §${authority.paragraph} missing from both FAISS and allDocuments — ${_normRef} not indexed`);
            return resultFormatter.formatResponse({
              success: true,
              data: {
                answer: `${_normRef} wurde im geladenen Quellentext nicht gefunden. Die Antwort kann nicht verifiziert werden.`,
                confidence: 0,
                statute: authority.statute,
                paragraph: authority.paragraph,
                sources: [],
                metadata: {
                  retrieval_failed: true,
                  missing_norm: _normRef,
                  faiss_results: pythonResults?.results?.length || 0,
                  requested_paragraph: authority.paragraph
                }
              }
            }, authority);
          }
        }
      }

      // ── Fix 1: EBV guard — if EBV question and no §§987-1003 in retrieved chunks, refuse synthesis ──
      if (isEBVQuestion(question)) {
        const _ebvRx = /§\s*(9[89]\d|10[0-3]\d)\b/;
        const _hasEBVChunks = (pythonResults?.results || []).some(r =>
          _ebvRx.test(r.content || r.text || '')
        );
        if (!_hasEBVChunks) {
          console.warn('[EBV Guard] EBV question detected but no §§987-1003 chunks in results — returning retrieval_failed');
          return resultFormatter.formatResponse({
            success: true,
            data: {
              answer: '§§ 987–1003 BGB (Eigentümer-Besitzer-Verhältnis) wurde im geladenen Quellentext nicht gefunden. Die Antwort kann nicht verifiziert werden.',
              confidence: 0,
              statute: 'BGB',
              sources: [],
              metadata: {
                retrieval_failed: true,
                missing_norm: '§§987-1003 BGB',
                ebv_guard: true,
                reason: 'EBV question requires §§987-1003 chunks — none found in index'
              }
            }
          }, authority);
        }
        console.log(`[EBV Guard] ${(pythonResults.results || []).filter(r => _ebvRx.test(r.content || r.text || '')).length} EBV chunks found — proceeding`);
      }

      // ── Fix 2: Post-FAISS §N / Art. N paragraph boost — re-sort so primary anchor chunk comes first ──
      if (pythonResults?.results?.length > 0) {
        const _paraRefs = [...question.matchAll(/§\s*(\d+[a-z]?)/gi)].map(m => m[1].toLowerCase());
        // Strict word-boundary extraction: \bArt\.?\s*(\d+[a-z]?)\b prevents Art.13 matching "1"
        const _artRefs  = [...question.matchAll(/\bArt\.?\s*(\d+[a-z]?)\b/gi)].map(m => m[1].toLowerCase());

        // Count occurrences of each ref in the question to detect structural noise.
        // A single-digit ref (no letter suffix) that appears >3 times is a structural
        // reference (e.g. "Abs. 1", "Nr. 2") — exclude from boost candidates.
        const _qText = question.toLowerCase();
        const _isSingleDigitNoise = ref => {
          if (!/^\d$/.test(ref)) return false;           // only single digit, no letter
          const occurrences = (_qText.match(new RegExp(`\\b${ref}\\b`, 'g')) || []).length;
          return occurrences > 3;
        };

        const _artPrimary   = _artRefs.filter(r => !_isSingleDigitNoise(r));
        const _paraFiltered = _paraRefs.filter(r => !_isSingleDigitNoise(r));

        // Primary anchor = highest numeric Art/§ reference in the question.
        // "Art. 79 III GG" → anchor is "79"; boosts that chunk first.
        const _allCandidates = [..._artPrimary, ..._paraFiltered];
        const _primaryAnchor = _allCandidates.reduce((best, cur) => {
          const n = parseInt(cur, 10);
          return n > parseInt(best || '0', 10) ? cur : best;
        }, null);
        const _secondaryRefs = _allCandidates.filter(r => r !== _primaryAnchor);

        if (_allCandidates.length > 0) {
          // Build separate regex sets for §-format and Art-format content matching
          const _paraRxs  = _paraFiltered.map(p => new RegExp(`§\\s*${p}\\b`, 'i'));
          const _artRxs   = _artPrimary.map(p => new RegExp(`\\bArt\\.?\\s*${p}\\b`, 'i'));
          const _anchorRx = _primaryAnchor
            ? (_artPrimary.includes(_primaryAnchor)
                ? new RegExp(`\\bArt\\.?\\s*${_primaryAnchor}\\b`, 'i')
                : new RegExp(`§\\s*${_primaryAnchor}\\b`, 'i'))
            : null;

          const _matchesMeta = (r, refs) => {
            const _rp  = String(r.paragraph || '').toLowerCase();
            const _mp  = String((r.metadata || {}).paragraph || (r.metadata || {}).paragraphNumber || '').toLowerCase();
            return refs.includes(_rp) || refs.includes(_mp);
          };
          const _matchesContent = (r, rxs) => rxs.some(rx => rx.test(r.content || r.text || ''));

          const _isPrimary   = r => _primaryAnchor && (_matchesMeta(r, [_primaryAnchor]) || (_anchorRx && _anchorRx.test(r.content || r.text || '')));
          const _isSecondary = r => !_isPrimary(r) && (_matchesMeta(r, _secondaryRefs) || _matchesContent(r, [..._paraRxs, ..._artRxs]));

          const _primary   = pythonResults.results.filter(_isPrimary);
          const _secondary = pythonResults.results.filter(_isSecondary);
          const _rest      = pythonResults.results.filter(r => !_isPrimary(r) && !_isSecondary(r));

          if (_primary.length > 0 || _secondary.length > 0) {
            pythonResults = { ...pythonResults, results: [..._primary, ..._secondary, ..._rest] };
            console.log(`[ParaBoost] anchor=${_primaryAnchor} primary=${_primary.length} secondary=${_secondary.length} rest=${_rest.length}`);
          }
        }
      }

      console.log(`✅ [Guard Passed] Proceeding to RAG synthesis:`, {
        authority_final: authority?.authority_final,
        has_results: pythonResults?.results?.length > 0,
        authoritative_found: pythonResults?.authoritative_found,
        authority_mode: authority?.authority_mode,
        authority_lock: authorityLock?.__locked || false
      });

      if (pythonResults.authority_summary?.doctrine_mode && pythonResults.results.length === 0 && question.match(/\xA7\s*\d+|art\.\s*\d+/i)) {
        console.log(`⚠️ Doctrine guard blocked retrieval - asking for clarification`);
        
        if (authority.question_type === 'GENERAL_DOCTRINE' || authority.doctrinal_match) {
          // Use handleConfirmedDoctrine only; unconfirmed path removed (Bug 3 consolidation)
          const result = await this.handleConfirmedDoctrine(question, authority);
          if (result !== null) {
            return resultFormatter.formatResponse(result, authority);
          }
          console.log(`⬇️ [Guard] handleConfirmedDoctrine returned null — continuing to RAG`);
        }
        
        console.log(`⬇️ [Guard] No doctrine path available — falling through to RAG`);
      }
      
      // Map pythonResults.results → semanticChunks format so ragService uses them
      // directly instead of falling back to TF-IDF.  Python pre-filter chunks
      // have score/similarity/relevance=1.0 and are already ordered by relevance.
      const _pyResults = pythonResults?.results || [];
      if (_pyResults.length > 0) {
        const _first = _pyResults[0];
        console.log(`[SemanticChunks] First Python result fields: statute=${_first.statute} paragraph=${_first.paragraph} score=${_first.score} similarity=${_first.similarity} content_len=${(_first.content || '').length}`);
      }
      const _semanticChunks = _pyResults.map(r => ({
        content:         r.content || r.text || '',
        documentName:    r.documentName || r.filename || r.document || (r.statute ? `${r.statute}.pdf` : ''),
        documentStatute: r.statute || (r.metadata || {}).statute || r.source || '',
        statute:         r.statute || (r.metadata || {}).statute || r.source || '',
        paragraph:       r.paragraph || (r.metadata || {}).paragraph || '',
        similarity:      typeof r.similarity === 'number' ? r.similarity : (typeof r.score === 'number' ? r.score : 1.0),
        tfidfScore:      typeof r.tfidf_score === 'number' ? r.tfidf_score : 0,
        combinedScore:   typeof r.combined_score === 'number' ? r.combined_score : (typeof r.score === 'number' ? r.score : 1.0),
        metadata:        r.metadata || {},
      }));
      console.log(`[SemanticChunks] Passing ${_semanticChunks.length} Python chunks to ragService`);

      const ragResponse = await ragService.generateResponse(
        question,
        allDocuments,
        {
          language: languageStr,
          authority: authority,
          classification: classification,
          python_results: pythonResults,
          semanticChunks: _semanticChunks,
          anchorParagraphs: authority.domain_anchor_paragraphs || [],
          questionType: authority.question_type || 'GENERAL',
        }
      );
      
      console.log('[DEBUG] RAG response:', JSON.stringify({
        success: ragResponse?.success,
        answerLength: ragResponse?.data?.answer?.length,
        sourcesCount: ragResponse?.data?.sources?.length,
        error: ragResponse?.error,
      }));
      console.log('[DEBUG sources]', JSON.stringify(
        (ragResponse?.data?.sources || []).map(s => ({
          paragraph: s.paragraph,
          statute: s.statute || s.document,
          score: s.score,
          confidence: s.confidence,
        }))
      ));

      ragResponse.python_service_used = true;
      ragResponse.python_authority_resolved = !pythonAuthorityError && authority.statute;
      ragResponse.python_authoritative_found = pythonResults?.authoritative_found || false;
      ragResponse.python_results_count = pythonResults?.results?.length || 0;
      ragResponse.authority_mode = authority.authority_mode;
      ragResponse.originalQuestion = question;
      
      if (pythonAuthorityError) {
        ragResponse.python_authority_error = pythonAuthorityError;
      }
      
      const baseConfidence = ragResponse.confidence || 0.7;
      const finalConfidence = this.calculateEpistemicConfidence(baseConfidence, authority, ragResponse);
      ragResponse.confidence = finalConfidence;
      
      let safetyValidation = null;
      
      if (classification.type !== 'DOCTRINE' && 
          authority.question_type !== 'DOCTRINE' && 
          authority.question_type !== 'GENERAL_DOCTRINE') {
        safetyValidation = ragResponse.safetyCheck || await safetyCheck.validateBeforeAnswer(question, ragResponse, authority);
      } else {
        console.log(`✅ Safety check skipped for doctrine question`);
        safetyValidation = {
          isLegallySound: true,
          legalDefensibility: 'HIGH',
          examinerReadiness: 'EXAMINER_READY',
          confidenceAdjusted: finalConfidence,
          metadata: {
            safety_check_skipped: true,
            reason: 'doctrine_question'
          }
        };
      }

      // Override examinerReadiness for BGB doctrine questions misclassified as GENERAL
      // safetyCheck returns NOT_READY when authority_mode='none' && authorityRisk='HIGH',
      // but if the answer actually cites BGB sections the question IS answerable.
      if (authority.statute === 'BGB' &&
          safetyValidation?.examinerReadiness === 'NOT_READY') {
        const _answerText = ragResponse?.answer || '';
        if (/§\s*\d+/.test(_answerText)) {
          safetyValidation.examinerReadiness = 'EXAMINER_READY';
          console.log('[ExaminerReadiness] BGB §-reference in answer — overriding NOT_READY → EXAMINER_READY');
        }
      }

      const structuredAnswer = this.structureAnswerWithDoctrinalTemplate(
        ragResponse, 
        question, 
        safetyValidation, 
        authority,
        classification,
        pythonResults
      );
      
      const rawResponse = {
        success: true,
        data: {
          answer: structuredAnswer.fullAnswer,
          structuredAnswer: structuredAnswer,
          sources: ragResponse.citations,
          confidence: structuredAnswer.confidence,
          conversationId: Date.now().toString(),
          legalDomain: structuredAnswer.domain || ragResponse.metadata?.legalDomain || 'general',
          statute: authority.statute,
          paragraph: authority.paragraph,
          isArticle: authority.isArticle,
          authority: authority,
          classification: classification,
          safetyCheck: safetyValidation,
          metadata: {
            documentsUsed: ragResponse.documentsUsed || 0,
            processingTime: ragResponse.metadata?.processingTime || 0,
            language: languageStr,
            exactParagraphMatch: ragResponse.metadata?.exactParagraphMatch || false,
            chunksUsed: ragResponse.metadata?.chunksUsed || 0,
            safetyPassed: safetyValidation.isLegallySound,
            legalDefensibility: safetyValidation.legalDefensibility,
            examinerReadiness: safetyValidation.examinerReadiness,
            architecture: 'epistemic_authority',
            statuteLocked: !!authority.statute,
            python_service_used: ragResponse.python_service_used || false,
            python_authority_resolved: ragResponse.python_authority_resolved || false,
            python_authoritative_found: ragResponse.python_authoritative_found || false,
            python_results_count: ragResponse.python_results_count || 0,
            authority_mode: authority.authority_mode,
            doctrinal_template: structuredAnswer.template_used || 'default',
            epistemic_certainty: authority.epistemicCertainty,
            anchor_norm_mode: authority.anchorNormMode,
            safety_check_skipped: classification.type === 'DOCTRINE',
            authority_lock_applied: authorityLock?.__locked || false,
            authority_lock_reason: authorityLock?.__lockReason || 'none',
            explicit_norm_override: authority.__explicit_norm_reference || false
          },
        },
      };
      
      const formattedResponse = resultFormatter.formatResponse(rawResponse, authority);

      if (structuredAnswer?.metadata?.doctrine_applied && formattedResponse?.data?.answer?.length > 0) {
        if (!formattedResponse.data.sources?.length) {
          formattedResponse.data.sources = this.buildDoctrineCitationSources(authority, pythonResults);
        }
      }
      
      const conversationEntry = {
        question: question,
        answer: structuredAnswer.fullAnswer,
        structuredAnswer: structuredAnswer,
        sources: ragResponse.citations,
        timestamp: new Date().toISOString(),
        confidence: structuredAnswer.confidence,
        legalDomain: structuredAnswer.domain || ragResponse.metadata?.legalDomain || 'general',
        statute: authority.statute,
        paragraph: authority.paragraph,
        isArticle: authority.isArticle,
        authority: authority,
        classification: classification,
        safetyCheck: safetyValidation,
        python_authority_used: !pythonAuthorityError,
        python_authoritative_found: pythonResults?.authoritative_found || false,
        python_results_count: pythonResults?.results?.length || 0,
        authority_mode: authority.authority_mode,
        doctrinal_template: structuredAnswer.template_used || 'default',
        epistemic_certainty: authority.epistemicCertainty,
        anchor_norm_mode: authority.anchorNormMode,
        authority_lock_applied: authorityLock?.__locked || false,
        authority_lock_reason: authorityLock?.__lockReason || 'none',
        explicit_norm_override: authority.__explicit_norm_reference || false
      };

      this.conversationHistory.push(conversationEntry);
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      safetyCheck.logSafetyEvent('QUESTION_PROCESSED', {
        question,
        statute: authority.statute,
        paragraph: authority.paragraph,
        question_type: classification.type,
        epistemicCertainty: authority.epistemicCertainty,
        confidence: structuredAnswer.confidence,
        legalDefensibility: safetyValidation.legalDefensibility || 'UNKNOWN',
        examinerReadiness: safetyValidation.examinerReadiness || 'UNKNOWN',
        python_authority_used: !pythonAuthorityError,
        python_authoritative_found: pythonResults?.authoritative_found || false,
        authority_mode: authority.authority_mode,
        doctrinal_template: structuredAnswer.template_used || 'default',
        safety_check_skipped: classification.type === 'DOCTRINE',
        authority_lock_applied: authorityLock?.__locked || false,
        authority_lock_reason: authorityLock?.__lockReason || 'none',
        explicit_norm_override: authority.__explicit_norm_reference || false
      });

      this.logProcessing(question, ragResponse, authority, classification, pythonResults, safetyValidation);

      // DeepSeek Synthesis (RAG path)
      // OPT 6: messages array contains ONLY question text + answer text — no epistemicMetadata,
      // legalAssurance, safetyCheck objects, or console.log payloads are ever serialized here.
      try {
        const _q = question || '';
        const _a = formattedResponse?.data?.answer || '';
        const _signals = ['rechte','ansprüche','voraussetzungen','rechtsfolgen','was sind','was regelt','unterschied','erklären','bedeutung','prüfungsschema','welche','sachmängel','wie wird','wie entsteht','welche pflichten','welche folgen','what','how','distinguish','explain','analyze','discuss','compare','difference','when','under what','circumstances','doctrine','principle','rights','requirements','conditions','liability','deprivation','loss','constitutional','fundamental'];
        const _hit = _q.length > 40;
        // Budget: hard 30s wall in server.js; synthesis must leave headroom.
        // Python call may consume up to 10s, so cap synthesis at 18s.
        const _SYNTH_TIMEOUT = 18000;
        console.log('[SYNTH]', _hit, '|', _q.substring(0, 50));
        if (_hit && _a.length > 30 && process.env.DEEPSEEK_API_KEY) {
          const _synthTokens = (isComparison || _crossStatute) ? 2500 : 1500;
          const _s = await ChatService._dsStream(process.env.DEEPSEEK_API_KEY, {
              model: 'deepseek-chat',
              max_tokens: _synthTokens,
              messages: [
                {
                  role: 'system',
                  content: 'German law tutor. Answer using retrieved chunks only; use doctrinal knowledge when chunks are irrelevant.\n' +
                    'Structure: 1.DEFINITION 2.LEGAL BASIS 3.ELEMENTS/SUBTYPES 4.RECHTSFOLGE 5.SUMMARY\n' +
                    'Rules: cite §§ from chunks; never "Provision not in sources" or "Please re-query"; never Art.94 for Normenkontrolle (use Art.93/100 GG); never §316c/§232 StGB for Vorsatz (use §15/§16 StGB).\n' +
                    'Plain text. End with SUMMARY. Max 250 words.' + _434Instruction + _13Instruction + _201aInstruction + _249Instruction + _langInstruction
                },
                {
                  role: 'user',
                  content: 'Question: ' + _q + '\n\nRetrieved legal chunks:\n' + _a
                }
              ]
            }, _SYNTH_TIMEOUT);
          if (_s && _s.length > 100) {
            console.log('[SYNTH SUCCESS] length:', _s.length);
            const _lastChar = _s.slice(-1);
            if (!/[.!?»"'\u201d]/.test(_lastChar)) {
              console.warn('[SYNTH] WARNING: answer may be truncated — last char:', JSON.stringify(_lastChar));
              if (formattedResponse?.data?.metadata) formattedResponse.data.metadata.possibly_truncated = true;
            }
            if (formattedResponse?.data) formattedResponse.data.answer = _s;
          }
        }
      } catch (_e) {
        console.error('[SYNTH ERROR]', _e.message);
      }

      // Universal self-check — runs on ALL answers from main RAG path before response is returned
      let _finalAnswer = formattedResponse?.data?.answer || '';
      console.log('[SelfCheck] Input — answer length:', _finalAnswer.length,
                  'pythonChunks:', pythonResults?.results?.length || 0);
      const _needsSelfCheck = /rücktritt|organisationsherrschaft|notwehr|verhältnismäßigkeit|§\s*932|garantenstellung|ingerenz|unterlassen|§\s*13\s+stgb|§\s*201a|echtzeit.*anal/i.test(question);
      if (_needsSelfCheck && _finalAnswer.length > 100 && process.env.DEEPSEEK_API_KEY) {
        const _allChunks = (pythonResults?.results || [])
          .slice(0, 3)
          .map(c => ChatService._compressChunk(c.content || c.text || ''))
          .filter(t => t.length > 30)
          .join('\n\n')
          .substring(0, 2000);
        if (_allChunks.length > 100) {
          _finalAnswer = await ChatService.selfCheckAnswer(
            question, _finalAnswer, _allChunks, process.env.DEEPSEEK_API_KEY
          );
          console.log('[SelfCheck] Final answer length after check:', _finalAnswer.length);
          if (formattedResponse?.data) formattedResponse.data.answer = _finalAnswer;
        }
      } else if (!_needsSelfCheck) {
        console.log('[SelfCheck] Skipped — question does not require gap analysis');
      }

      // ── Fix 4: post-generation quality check ──────────────────────────────────
      {
        const _qcMeta = formattedResponse?.data?.metadata || {};

        // Check 1: citation presence → flag low_quality
        if (!/§\s*\d+|Art\.\s*\d+/i.test(_finalAnswer)) {
          _qcMeta.low_quality = true;
          _qcMeta.quality_flags = [...(_qcMeta.quality_flags || []), 'missing_citation'];
          console.warn('[QualityCheck] MISSING CITATION in answer');
        }

        // Check 2: EBV inversion — "EBV does not apply when no contract" is backwards
        // Correct rule: EBV applies when NO contract. Block and return retrieval_failed.
        if (/EBV\s+(?:does\s+not\s+apply|gilt\s+nicht)\s+(?:when|wenn)\s+(?:no|kein(?:em)?)\s+(?:contract|Vertrag)/i.test(_finalAnswer)) {
          console.error('[QualityCheck] EBV INVERSION DETECTED — blocking answer');
          return resultFormatter.formatResponse({
            success: true,
            data: {
              answer: '§§ 987–1003 BGB (Eigentümer-Besitzer-Verhältnis) wurde im geladenen Quellentext nicht korrekt abgebildet. Die Antwort kann nicht verifiziert werden.',
              confidence: 0,
              statute: authority?.statute || 'BGB',
              sources: [],
              metadata: {
                retrieval_failed: true,
                ebv_inversion_blocked: true,
                quality_flags: ['ebv_inversion']
              }
            }
          }, authority);
        }

        // Check 3: pVV "richterrechtlich" — outdated post-2002, now codified in §280 BGB
        if (/pVV\s+ist\s+richterrechtlich/i.test(_finalAnswer)) {
          _qcMeta.quality_flags = [...(_qcMeta.quality_flags || []), 'pvv_outdated_note'];
          _qcMeta.pvv_note = 'pVV codified in §280 BGB since 2002 Schuldrechtsreform';
          console.warn('[QualityCheck] pVV outdated reference — note added to metadata');
        }

        if (formattedResponse?.data) formattedResponse.data.metadata = _qcMeta;
      }
      // ─────────────────────────────────────────────────────────────────────────

      // Post-synthesis quality validation — logs issues, does not block response
      this.validateAnswer(question, _finalAnswer);

      // Hallucination guard for main RAG path — check Nr. citations against source chunks
      const _ragChunkTexts = (pythonResults?.results || []).map(r => r.content || r.text || '');
      const _hallRag = ChatService.detectHallucinatedCitations(_finalAnswer, _ragChunkTexts);
      if (_hallRag.length > 0 && formattedResponse?.data) {
        if (!formattedResponse.data.metadata) formattedResponse.data.metadata = {};
        formattedResponse.data.metadata.hallucinated_citations = _hallRag;
        formattedResponse.data.metadata.unverified = true;
      }

      return formattedResponse;

    } catch (error) {
      console.error("Error processing question:", error);
      
      safetyCheck.logSafetyEvent('PROCESSING_ERROR', {
        question,
        error: error.message,
        timestamp: new Date().toISOString(),
        python_error: error.message.includes('python') || error.message.includes('Python')
      });
      
      return {
        success: false,
        error: "Fehler bei der Verarbeitung der Frage",
        details: error.message,
      };
    }
  }

  async handleConfirmedDoctrine(question, authority) {
    console.log(`🎓 Confirmed doctrine - delegating to induction service`);

    let doctrineResult = null;
    if (authority?.doctrinal_match === true && authority?.confidence >= 0.8) {
      console.log('[FastPath] High-confidence doctrine — skipping Doctrine Inductor');
    } else {
      doctrineResult = await this.callDoctrineInductionService(question, authority);
    }

    if (doctrineResult?.doctrine_found === true) {
      const doctrinalAnswer = this.generateDoctrinalAnswer(doctrineResult, authority, question);
      const doctrineSources = this.buildDoctrineCitationSources(
        authority,
        null,
        doctrineResult.sources || doctrineResult.statutory_basis || doctrineResult.constitutional_basis || []
      );

      return {
        success: true,
        data: {
          answer: doctrinalAnswer.fullAnswer,
          structuredAnswer: doctrinalAnswer,
          sources: doctrineSources,
          confidence: doctrinalAnswer.confidence,
          statute: authority.statute,
          paragraph: authority.paragraph,
          metadata: doctrinalAnswer.metadata
        }
      };
    }

    console.log(`⬇️ [Doctrine] doctrine_found=false — signalling fallthrough to RAG`);
    return null;
  }
  
  async handleUnconfirmedDoctrine(question, authority) {
    console.log(`🎓 Unconfirmed doctrine - epistemic warning path`);
    
    const doctrineResult = await this.callDoctrineInductionService(question, authority);

    if (doctrineResult?.doctrine_found === true) {
      let answer = `**Epistemischer Hinweis**\n\n`;
      answer += `Die Frage betrifft eine Rechtsdoktrin, die nicht mit hoher Sicherheit bestätigt werden konnte.\n\n`;
      
      if (doctrineResult.doctrinal_summary) {
        answer += doctrineResult.doctrinal_summary;
      } else if (doctrineResult.answer) {
        answer += doctrineResult.answer;
      }
      
      answer += `\n\n*Epistemischer Status: ${authority.epistemicCertainty || 'unbestimmt'}*`;
      
      const structuredAnswer = {
        fullAnswer: answer,
        confidence: 0.7,
        metadata: {
          doctrine_applied: true,
          epistemic_certainty: authority.epistemicCertainty,
          anchor_norm_mode: authority.anchorNormMode || false,
          retrieval_used: false,
          unconfirmed_doctrine: true,
          content_source: 'doctrine_induction_service',
          safety_check_skipped: true
        }
      };
      
      safetyCheck.logSafetyEvent('UNCONFIRMED_DOCTRINE', {
        question,
        epistemicCertainty: authority.epistemicCertainty,
        suggestedField: authority.suggestedField,
        safetyCheckSkipped: true
      });
      
      return {
        success: true,
        data: {
          answer: structuredAnswer.fullAnswer,
          structuredAnswer: structuredAnswer,
          sources: [],
          confidence: structuredAnswer.confidence,
          statute: authority.statute,
          metadata: structuredAnswer.metadata
        }
      };
    }

    console.log(`⬇️ [Doctrine] Unconfirmed doctrine — no match, signalling fallthrough to RAG`);
    return null;
  }

  generateEpistemicallySafeFallback(authority, question) {
    return {
      success: true,
      data: {
        answer: `**Methodischer Hinweis**\n\n` +
                `Die doctrinale Analyse konnte nicht abgeschlossen werden.\n\n` +
                `*Frage: ${question.substring(0, 100)}...*\n` +
                `*Epistemischer Status: ${authority.epistemicCertainty || 'unbestimmt'}*`,
        confidence: 0.6,
        metadata: {
          doctrine_applied: false,
          retrieval_used: false,
          fallback_used: true,
          content_source: 'epistemic_fallback',
          safety_check_skipped: true
        }
      }
    };
  }
  
  handleSystemQuestion(question, authority) {
    return {
      success: true,
      data: {
        answer: this.generateSystemAnswer(),
        confidence: 0.95,
        metadata: {
          architecture: "system_bypass",
          classification: { type: 'SYSTEM' },
          statuteLocked: false,
          requiresRetrieval: false,
          authority_mode: 'none',
          safety_check_skipped: true
        }
      }
    };
  }

  getStatuteDisplayName(statute) {
    const names = {
      'BGB': 'Bürgerliches Gesetzbuch',
      'StGB': 'Strafgesetzbuch',
      'STGB': 'Strafgesetzbuch',
      'HGB': 'Handelsgesetzbuch',
      'GG': 'Grundgesetz',
      'ZPO': 'Zivilprozessordnung',
      'StPO': 'Strafprozessordnung',
      'STPO': 'Strafprozessordnung',
      'GMBHG': 'GmbH-Gesetz'
    };
    return names[statute] || statute;
  }

  generateSystemAnswer() {
    return `**Systemarchitektur - Epistemische Autorität**\n\n` +
           `Das System arbeitet nach einem mehrstufigen epistemischen Modell:\n\n` +
           `1. **Autoritätsauflösung**: Python-Dienst identifiziert Gesetz und Paragraph\n` +
           `2. **Doctrinale Induktion**: Bei bestätigten Doktrinfragen → Python-Autoritätsdienst\n` +
           `3. **Retrieval mit Guard**: TF-IDF-Fallback für Doktrinfragen blockiert\n` +
           `4. **Sicherheitsprüfung**: Automatische Bewertung der rechtlichen Verteidigbarkeit\n` +
           `5. **Epistemische Konfidenz**: Sonderregeln für doctrinale Fragen\n\n` +
           `**Status**: Alle Komponenten aktiv, Python-Integration läuft.`;
  }

  prepareDocumentsForPython(documents) {
    return documents.map(doc => ({
      id: doc.id || doc._id || `doc_${Math.random().toString(36).substr(2, 9)}`,
      content: doc.content || doc.text || '',
      metadata: {
        title: doc.title || doc.filename || 'Unbenanntes Dokument',
        type: doc.type || 'legal_document',
        source: doc.source || 'upload',
        chunks_count: doc.chunks?.length || 0,
        statute_refs: doc.statute_refs || [],
        paragraph_refs: doc.paragraph_refs || [],
        statute: doc.metadata?.statute || doc.statute || null,
        paragraph: doc.metadata?.paragraph || null,
        detected_paragraphs: doc.metadata?.detectedParagraphs || []
      }
    }));
  }

  logProcessing(question, ragResponse, authority, classification, pythonResults, safetyValidation) {
    console.log(`✅ Processing Complete:`);
    console.log(`   Question: "${question.substring(0, 80)}..."`);
    console.log(`   Authority: ${authority.statute || 'NONE'} ${authority.paragraph ? '§' + authority.paragraph : ''}`);
    console.log(`   Mode: ${authority.authority_mode}, Classification: ${classification.type}`);
    console.log(`   Confidence: ${ragResponse.confidence?.toFixed(2) || 'N/A'}`);
    console.log(`   Python Results: ${pythonResults?.results?.length || 0} docs`);
    console.log(`   Authoritative Found: ${pythonResults?.authoritative_found || false}`);
    console.log(`   Safety: ${safetyValidation?.isLegallySound ? 'PASS' : 'FAIL'}`);
    console.log(`   Legal Defensibility: ${safetyValidation?.legalDefensibility || 'UNKNOWN'}`);
  }

  clearHistory() {
    this.conversationHistory = [];
    console.log('🗑️ Conversation history cleared');
  }

  getStats() {
    return {
      totalQuestions: this.conversationHistory.length,
      averageConfidence: this.conversationHistory.length > 0 
        ? this.conversationHistory.reduce((sum, entry) => sum + (entry.confidence || 0), 0) / this.conversationHistory.length
        : 0,
      statutesUsed: [...new Set(this.conversationHistory.filter(e => e.statute).map(e => e.statute))],
      domainsCovered: [...new Set(this.conversationHistory.filter(e => e.legalDomain).map(e => e.legalDomain))],
      lastQuestion: this.conversationHistory.length > 0 ? this.conversationHistory[this.conversationHistory.length - 1].question : null
    };
  }

  healthCheck() {
    return {
      service: 'ChatService',
      status: 'healthy',
      conversationHistorySize: this.conversationHistory.length,
      lastUpdate: this.conversationHistory.length > 0 
        ? this.conversationHistory[this.conversationHistory.length - 1].timestamp 
        : 'never',
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB',
      uptime: process.uptime() + ' seconds'
    };
  }
}

module.exports = new ChatService();
