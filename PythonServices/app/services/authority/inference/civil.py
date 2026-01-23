"""inference/civil.py - Civil law (BGB) paragraph inference with anchor norm support.

ARCHITECTURAL INVARIANTS:
1. Anchor norm logic assumes resolver has already decided anchor-norm mode is allowed
2. Paragraph inference MUST NEVER be called when authorityState is STATUTE_CONFIRMED_PARAGRAPH_OPEN
3. Content selection is separate from authority determination
4. Overview ≠ Interpretation, Anchor norms ≠ inferred paragraphs
"""

from typing import Dict, List, Optional, Tuple, Literal

# Inference type taxonomy
InferenceType = Literal["exact", "doctrinal", "domain_anchor", "consequence", "doctrinal_definition"]

# BGB civil topic → paragraph mapping
CIVIL_PARAGRAPH_MAP = {
    'contract_formation': {
        'paragraph': '311', 
        'offenses': ['contract', 'vertrag', 'agreement', 'formation', 'obligation'],
        'doctrine': 'contract formation'
    },
    'damages_liability': {
        'paragraph': '823', 
        'offenses': [
            'damages', 'schaden', 'liability', 'compensate', 'compensation',
            'duty to compensate', 'tort liability', 'unlawfully injures',
            'negligently injures', 'delictual liability', 'haftung',
            'injury', 'harm', 'loss', 'damage claim'
        ],
        'doctrine': 'delictual liability (§ 823)'
    },
    'contract_damages': {
        'paragraph': '280', 
        'offenses': [
            'breach of contract', 'contract damages', 'contractual liability',
            'non-performance', 'performance failure', 'contract breach',
            'default', 'mangelhafte leistung'
        ],
        'doctrine': 'damages for breach of contract (§ 280)'
    },
    'property_rights': {
        'paragraph': '903', 
        'offenses': ['property', 'eigentum', 'ownership', 'possess', 'possession'],
        'doctrine': 'property rights'
    },
    'sale_of_goods': {
        'paragraph': '433', 
        'offenses': [
            'sale', 'kauf', 'purchase', 'buy', 'seller', 'buyer',
            'sale contract', 'purchase agreement', 'goods', 'ware'
        ],
        'doctrine': 'contract of sale (§ 433)'
    },
    'marriage': {
        'paragraph': '1353', 
        'offenses': ['marriage', 'ehe', 'spouse', 'married', 'marital'],
        'doctrine': 'marriage obligations'
    },
    'inheritance': {
        'paragraph': '1922', 
        'offenses': ['inheritance', 'erbschaft', 'inherit', 'heir', 'will', 'testament'],
        'doctrine': 'inheritance'
    },
    'general_obligations': {
        'paragraph': '241', 
        'offenses': [
            'obligation', 'verpflichtung', 'duty', 'obligations', 
            'general duty', 'general obligation'
        ],
        'doctrine': 'general obligations (§ 241)'
    },
    'good_faith': {
        'paragraph': '242', 
        'offenses': [
            'good faith', 'treu und glauben', 'fair dealing', 'honesty',
            'loyalty', 'trust', 'reliance'
        ],
        'doctrine': 'performance according to good faith (§ 242)'
    },
    'possession': {
        'paragraph': '854',
        'offenses': ['possession', 'besitz', 'acquisition of possession', 'possessory right'],
        'doctrine': 'acquisition of possession (§ 854)'
    },
    'restitution': {
        'paragraph': '812',
        'offenses': ['restitution', 'unjust enrichment', 'ungerechtfertigte bereicherung', 'return of benefit'],
        'doctrine': 'unjust enrichment (§ 812)'
    },
    'warranty': {
        'paragraph': '437',
        'offenses': ['warranty', 'gewährleistung', 'defect', 'mangel', 'guarantee', 'product liability'],
        'doctrine': 'warranty rights in sale (§ 437)'
    },
    'lease': {
        'paragraph': '535',
        'offenses': ['lease', 'miete', 'rental', 'landlord', 'tenant', 'vermietung'],
        'doctrine': 'lease contract (§ 535)'
    },
    'loan': {
        'paragraph': '488',
        'offenses': ['loan', 'darlehen', 'credit', 'borrow', 'lending', 'kredit'],
        'doctrine': 'loan contract (§ 488)'
    },
    'agency': {
        'paragraph': '164',
        'offenses': ['agency', 'vertretung', 'representative', 'authority', 'power of attorney', 'vollmacht'],
        'doctrine': 'agency (§ 164)'
    }
}

# NEW: Doctrinal anchor maps for DEFINITION_DOCTRINAL questions
# These are MANDATORY anchors that cannot be bypassed
DOCTRINAL_ANCHOR_MAP = {
    'property_law': {
        'primary_anchor': '903',
        'mandatory_anchors': ['903'],
        'supporting_anchors': ['985', '1004', '854', '929'],
        'statute': 'BGB_Sachenrecht',  # NOT just "BGB"
        'doctrinal_field': 'property_law',
        'allow_expansion': False,  # CRITICAL: No expansion to other BGB sections
        'answer_requirements': [
            'formal_definition',
            'normative_basis',  # Must cite §903
            'ownership_rights',
            'limitations',
            'distinction_from_possession'
        ]
    },
    'contract_law': {
        'primary_anchor': '311',
        'mandatory_anchors': ['311'],
        'supporting_anchors': ['241', '242', '280'],
        'statute': 'BGB_Schuldrecht',
        'doctrinal_field': 'contract_law',
        'allow_expansion': False
    },
    'liability_law': {
        'primary_anchor': '823',
        'mandatory_anchors': ['823'],
        'supporting_anchors': ['249', '280', '276'],
        'statute': 'BGB_Schuldrecht',
        'doctrinal_field': 'liability_law',
        'allow_expansion': False
    }
}

# Anchor norms for property law (core BGB norms for overview questions)
# Textbook Sachenrecht anchor set
ANCHOR_NORMS = {
    'property_law': [
        {
            'section': '903',
            'title': 'Inhalt des Eigentums',
            'relevance': 'core_property',
            'description': 'Content of ownership - defines owner\'s rights',
            'confidence_weight': 1.0,
            'order': 1
        },
        {
            'section': '985',
            'title': 'Herausgabeanspruch',
            'relevance': 'possession_recovery',
            'description': 'Claim for recovery of possession',
            'confidence_weight': 0.9,
            'order': 2
        },
        {
            'section': '1004',
            'title': 'Beseitigungs- und Unterlassungsanspruch',
            'relevance': 'property_protection',
            'description': 'Claim for removal and injunction (property protection)',
            'confidence_weight': 0.9,
            'order': 3
        },
        {
            'section': '854',
            'title': 'Erwerb des Besitzes',
            'relevance': 'possession_acquisition',
            'description': 'Acquisition of possession',
            'confidence_weight': 0.8,
            'order': 4
        },
        {
            'section': '929',
            'title': 'Übereignung einer beweglichen Sache',
            'relevance': 'property_transfer',
            'description': 'Transfer of movable property',
            'confidence_weight': 0.85,
            'order': 5
        },
        {
            'section': '873',
            'title': 'Erwerb von Grundstücksrechten',
            'relevance': 'real_property',
            'description': 'Acquisition of rights in land',
            'confidence_weight': 0.8,
            'order': 6
        }
    ],
    'contract_law': [
        {
            'section': '311',
            'title': 'Begründung von Schuldverhältnissen',
            'relevance': 'contract_formation',
            'description': 'Formation of obligations',
            'confidence_weight': 1.0,
            'order': 1
        },
        {
            'section': '433',
            'title': 'Kaufvertrag',
            'relevance': 'sales_contract',
            'description': 'Contract of sale',
            'confidence_weight': 0.9,
            'order': 2
        },
        {
            'section': '535',
            'title': 'Mietvertrag',
            'relevance': 'lease_contract',
            'description': 'Lease contract',
            'confidence_weight': 0.85,
            'order': 3
        }
    ],
    'liability_law': [
        {
            'section': '823',
            'title': 'Schadensersatzpflicht',
            'relevance': 'tort_liability',
            'description': 'Duty to compensate damages (tort liability)',
            'confidence_weight': 1.0,
            'order': 1
        },
        {
            'section': '280',
            'title': 'Schadensersatz wegen Pflichtverletzung',
            'relevance': 'contract_liability',
            'description': 'Damages for breach of duty',
            'confidence_weight': 0.9,
            'order': 2
        },
        {
            'section': '249',
            'title': 'Art und Umfang des Schadensersatzes',
            'relevance': 'damages_calculation',
            'description': 'Nature and extent of damages',
            'confidence_weight': 0.8,
            'order': 3
        }
    ]
}


def determine_inference_type(
    inferred_paragraph: Optional[str] = None,
    anchor_norm_mode: bool = False,
    suggested_field: Optional[str] = None,
    is_exact_match: bool = False,
    is_doctrinal_match: bool = False,
    is_doctrinal_definition: bool = False  # NEW parameter
) -> InferenceType:
    """
    Determine the type of inference being performed.
    
    This is the CRITICAL function that satisfies the requirement:
    "Inference should trigger at the legal domain level, not only at consequence/keyword level."
    
    Args:
        inferred_paragraph: The paragraph number inferred (if any)
        anchor_norm_mode: Whether anchor norm mode is active
        suggested_field: The legal field suggested (e.g., 'property_law')
        is_exact_match: Whether this is an exact keyword match
        is_doctrinal_match: Whether this is a doctrinal inference
        is_doctrinal_definition: NEW - Whether this is a DEFINITION_DOCTRINAL question
        
    Returns:
        The inference type: "exact", "doctrinal", "domain_anchor", "doctrinal_definition", or "consequence"
    """
    # NEW: Doctrinal definition inference (highest priority)
    if is_doctrinal_definition and suggested_field:
        return "doctrinal_definition"
    
    # Domain-anchor inference: When anchor norms are triggered for a legal domain
    if anchor_norm_mode and suggested_field:
        return "domain_anchor"
    
    # Exact keyword inference: Direct keyword matching
    if is_exact_match:
        return "exact"
    
    # Doctrinal inference: Legal doctrine/principle based inference
    if is_doctrinal_match:
        return "doctrinal"
    
    # Consequence inference: Default fallback (least preferred)
    return "consequence"


def get_anchor_norms(field: str = None) -> List[Dict[str, any]]:
    """
    Get anchor norms for a specific legal field or all fields.
    
    RESOLVER'S RESPONSIBILITY: Determine if anchor-norm mode is allowed
    INFERENCE'S RESPONSIBILITY: Provide anchor norms when asked
    
    Args:
        field: Legal field ('property_law', 'contract_law', 'liability_law') or None for all
    
    Returns:
        List of anchor norm dictionaries
    """
    if field:
        norms = ANCHOR_NORMS.get(field, [])
        # Sort by order
        return sorted(norms, key=lambda x: x.get('order', 99))
    
    # Return all anchor norms
    all_norms = []
    for field_norms in ANCHOR_NORMS.values():
        all_norms.extend(field_norms)
    return sorted(all_norms, key=lambda x: x.get('order', 99))


def is_anchor_norm_question_simple(question: str) -> bool:
    """
    MINIMAL check: Is this question likely about anchor norm concepts?
    
    IMPORTANT: This function does NOT re-decide legal intent.
    It assumes the resolver has already authorized anchor-norm mode.
    
    This is a content relevance check, not an authority check.
    """
    lower_question = question.lower()
    
    # VERY minimal keywords that suggest overview questions
    # (Not comprehensive intent detection)
    overview_indicators = [
        'overview', 'überblick', 'basics', 'grundlagen',
        'explain', 'erklären', 'describe', 'beschreiben',
        'what is', 'was ist', 'introduction', 'einführung',
        'rights of', 'rechte des', 'protection of', 'schutz des'
    ]
    
    # Check for any overview indicator
    for indicator in overview_indicators:
        if indicator in lower_question:
            return True
    
    # Check for VERY general property/contract/liability questions
    # (This is not intent detection - just content matching)
    general_patterns = [
        'property law', 'eigentumsrecht',
        'contract law', 'vertragsrecht', 
        'liability law', 'haftungsrecht'
    ]
    
    for pattern in general_patterns:
        if pattern in lower_question:
            return True
    
    return False


def get_anchor_norms_for_field(
    field: str, 
    question: str = ""
) -> Tuple[List[Dict[str, any]], float, InferenceType]:
    """
    Get anchor norms for a specific field with relevance to question.
    
    Returns explicit inference_type = "domain_anchor" when retrieving anchor norms.
    
    Args:
        field: Legal field ('property_law', 'contract_law', 'liability_law')
        question: Optional question for relevance scoring
    
    Returns:
        Tuple of (anchor_norms, confidence_score, inference_type)
    """
    norms = get_anchor_norms(field)
    
    if not question:
        return norms, 0.7, "domain_anchor"  # Default confidence with explicit type
    
    # Simple relevance scoring based on keyword presence
    lower_question = question.lower()
    relevance_score = 0.0
    
    # Property law keywords
    if field == 'property_law':
        property_keywords = ['property', 'eigentum', 'ownership', 'possess', 'besitz']
        for keyword in property_keywords:
            if keyword in lower_question:
                relevance_score += 0.2
    
    # Contract law keywords
    elif field == 'contract_law':
        contract_keywords = ['contract', 'vertrag', 'agreement', 'vereinbarung']
        for keyword in contract_keywords:
            if keyword in lower_question:
                relevance_score += 0.2
    
    # Liability law keywords
    elif field == 'liability_law':
        liability_keywords = ['liability', 'haftung', 'damages', 'schaden', 'compensation']
        for keyword in liability_keywords:
            if keyword in lower_question:
                relevance_score += 0.2
    
    confidence = 0.65 + (relevance_score * 0.3)  # 0.65-0.95 range
    confidence = min(confidence, 0.95)
    
    return norms, confidence, "domain_anchor"


def infer_civil_paragraph_with_type(
    question: str, 
    allow_anchor_fallback: bool = False,
    classification_info: Optional[Dict] = None  # NEW: Classification metadata from JS
) -> Tuple[Optional[str], InferenceType, Optional[str], Optional[Dict]]:
    """
    Infer BGB paragraph from topic keywords and legal concepts WITH explicit inference type.
    
    WARNING: This function must NEVER be called when:
    authorityState == STATUTE_CONFIRMED_PARAGRAPH_OPEN
    
    Args:
        question: The legal question
        allow_anchor_fallback: If True, may return anchor norms as fallback
        classification_info: NEW - Classification metadata from questionClassifier.js
    
    Returns:
        Tuple of (paragraph_number, inference_type, suggested_field, doctrinal_info)
    """
    lower_question = question.lower()
    
    # NEW: CRITICAL - Check for doctrinal definition classification FIRST
    if classification_info and classification_info.get('type') == 'DEFINITION_DOCTRINAL':
        print(f"🔒 [Civil.py] DOCTRINAL DEFINITION DETECTED - Forcing anchor norms")
        
        # Determine doctrinal field from question
        if 'property' in lower_question or 'eigentum' in lower_question:
            field = 'property_law'
        elif 'contract' in lower_question or 'vertrag' in lower_question:
            field = 'contract_law'
        elif 'liability' in lower_question or 'haftung' in lower_question or 'damage' in lower_question:
            field = 'liability_law'
        else:
            # Default to property law for definition questions
            field = 'property_law'
        
        # Get doctrinal anchor configuration
        doctrinal_info = DOCTRINAL_ANCHOR_MAP.get(field, DOCTRINAL_ANCHOR_MAP['property_law'])
        
        print(f"   Doctrinal field: {field}")
        print(f"   Mandatory anchor: §{doctrinal_info['primary_anchor']}")
        print(f"   Statute lock: {doctrinal_info['statute']}")
        print(f"   Allow expansion: {doctrinal_info['allow_expansion']}")
        
        # Return doctrinal definition inference type
        return doctrinal_info['primary_anchor'], "doctrinal_definition", field, doctrinal_info
    
    # Track all matches for potential ranking
    matches = []
    suggested_field = None
    
    # Check for exact keyword matches first
    for topic, data in CIVIL_PARAGRAPH_MAP.items():
        for keyword in data['offenses']:
            if keyword in lower_question:
                # Calculate match quality
                quality_score = 1.0
                
                # Boost for complete phrase matches
                if len(keyword.split()) > 1 and keyword in lower_question:
                    quality_score *= 1.5
                    # Exact match detection for keyword inference
                    if keyword == lower_question.strip():
                        quality_score *= 2.0  # Strong boost for exact keyword match
                
                # Boost for doctrinal keywords
                if 'doctrine' in data and any(doctrinal in data['doctrine'] for doctrinal in ['liability', 'damages', 'tort']):
                    quality_score *= 1.2
                
                matches.append({
                    'paragraph': data['paragraph'],
                    'topic': topic,
                    'doctrine': data.get('doctrine', ''),
                    'quality': quality_score,
                    'matched_keyword': keyword,
                    'is_exact': keyword == lower_question.strip(),
                    'is_doctrinal': 'doctrine' in data
                })
    
    # Additional contextual inference for specific legal phrases
    if 'duty to' in lower_question:
        if 'compensate' in lower_question or 'damage' in lower_question:
            matches.append({
                'paragraph': '823',
                'topic': 'damages_liability',
                'doctrine': 'delictual liability (§ 823)',
                'quality': 1.8,
                'matched_keyword': 'duty to compensate',
                'is_exact': False,
                'is_doctrinal': True
            })
    
    if 'liability for' in lower_question and ('damage' in lower_question or 'harm' in lower_question):
        matches.append({
            'paragraph': '823',
            'topic': 'damages_liability',
            'doctrine': 'delictual liability (§ 823)',
            'quality': 1.7,
            'matched_keyword': 'liability for damage',
            'is_exact': False,
            'is_doctrinal': True
        })
    
    if 'tort' in lower_question:
        matches.append({
            'paragraph': '823',
            'topic': 'damages_liability',
            'doctrine': 'delictual liability (§ 823)',
            'quality': 1.6,
            'matched_keyword': 'tort',
            'is_exact': False,
            'is_doctrinal': True
        })
    
    if 'breach of contract' in lower_question:
        matches.append({
            'paragraph': '280',
            'topic': 'contract_damages',
            'doctrine': 'damages for breach of contract (§ 280)',
            'quality': 1.9,
            'matched_keyword': 'breach of contract',
            'is_exact': False,
            'is_doctrinal': True
        })
    
    if 'good faith' in lower_question or 'treu und glauben' in lower_question:
        matches.append({
            'paragraph': '242',
            'topic': 'good_faith',
            'doctrine': 'performance according to good faith (§ 242)',
            'quality': 1.7,
            'matched_keyword': 'good faith',
            'is_exact': False,
            'is_doctrinal': True
        })
    
    # Return the best match with inference type
    if matches:
        # Sort by quality score (highest first)
        matches.sort(key=lambda x: x['quality'], reverse=True)
        best_match = matches[0]
        
        # Determine inference type
        if best_match['is_exact']:
            inference_type = "exact"
        elif best_match['is_doctrinal']:
            inference_type = "doctrinal"
        else:
            inference_type = "consequence"
        
        # Map topic to field for potential domain inference
        if best_match['topic'] in ['property_rights', 'possession']:
            suggested_field = 'property_law'
        elif best_match['topic'] in ['contract_formation', 'sale_of_goods', 'contract_damages', 'lease', 'loan']:
            suggested_field = 'contract_law'
        elif best_match['topic'] in ['damages_liability']:
            suggested_field = 'liability_law'
        
        print(f"📚 Civil inference matched '{best_match['matched_keyword']}' to BGB §{best_match['paragraph']} ({best_match['doctrine']})")
        print(f"   Inference type: {inference_type}, Suggested field: {suggested_field}")
        
        return best_match['paragraph'], inference_type, suggested_field, None
    
    # Anchor norm fallback ONLY if explicitly allowed
    if allow_anchor_fallback:
        if 'property' in lower_question or 'eigentum' in lower_question:
            suggested_field = 'property_law'
            norms, confidence = get_anchor_norms_for_field('property_law', question)[:2]
            if norms:
                best_norm = max(norms, key=lambda x: x.get('confidence_weight', 0))
                print(f"📚 Civil anchor norm fallback: property question → BGB §{best_norm['section']} ({best_norm['title']})")
                print(f"   Inference type: domain_anchor, Suggested field: {suggested_field}")
                return best_norm['section'], "domain_anchor", suggested_field, None
    
    return None, "consequence", None, None


def infer_civil_paragraph_with_classification(
    question: str,
    classification: Dict  # Full classification object from questionClassifier.js
) -> Dict[str, any]:
    """
    NEW: Main inference function that receives classification metadata.
    
    This is the function that should be called from the main pipeline.
    It ensures doctrinal definitions get proper anchor enforcement.
    
    Args:
        question: The legal question
        classification: Full classification object from questionClassifier.js
    
    Returns:
        Complete inference result with doctrinal constraints
    """
    print(f"🎯 [Civil.py] Inference with classification:")
    print(f"   Question type: {classification.get('type')}")
    print(f"   Authority mode: {classification.get('authorityMode')}")
    print(f"   Retrieval mode: {classification.get('retrievalMode', {}).get('mode')}")
    
    # Extract classification metadata
    question_type = classification.get('type')
    authority_mode = classification.get('authorityMode')
    
    # Handle DEFINITION_DOCTRINAL with forced anchors
    if question_type == 'DEFINITION_DOCTRINAL':
        lower_question = question.lower()
        
        # Determine doctrinal field
        if 'property' in lower_question or 'eigentum' in lower_question:
            field = 'property_law'
        elif 'contract' in lower_question or 'vertrag' in lower_question:
            field = 'contract_law'
        elif 'liability' in lower_question or 'haftung' in lower_question:
            field = 'liability_law'
        else:
            # Default based on classification metadata
            if 'property' in classification.get('metadata', {}).get('pythonAuthoritySignal', '').lower():
                field = 'property_law'
            elif 'contract' in classification.get('metadata', {}).get('pythonAuthoritySignal', '').lower():
                field = 'contract_law'
            else:
                field = 'property_law'  # Safest default
        
        # Get doctrinal anchor configuration
        doctrinal_info = DOCTRINAL_ANCHOR_MAP.get(field, DOCTRINAL_ANCHOR_MAP['property_law'])
        
        # Build complete inference result
        result = {
            "inferredParagraph": doctrinal_info['primary_anchor'],
            "inference_type": "doctrinal_definition",
            "suggestedField": field,
            "doctrinalInfo": doctrinal_info,
            "classification": classification,
            "statute": doctrinal_info['statute'],
            "allowExpansion": doctrinal_info['allow_expansion'],
            "mandatoryAnchors": doctrinal_info['mandatory_anchors'],
            "supportingAnchors": doctrinal_info['supporting_anchors'],
            "answerRequirements": doctrinal_info.get('answer_requirements', []),
            "reasoning": f"Doctrinal definition detected - Forcing §{doctrinal_info['primary_anchor']} as mandatory anchor",
            "confidence": 0.95  # High confidence for doctrinal definitions
        }
        
        print(f"🔒 [Civil.py] DOCTRINAL ENFORCEMENT:")
        print(f"   Field: {field}")
        print(f"   Statute: {doctrinal_info['statute']}")
        print(f"   Mandatory: §{doctrinal_info['primary_anchor']}")
        print(f"   Allow expansion: {doctrinal_info['allow_expansion']}")
        
        return result
    
    # Handle other question types with regular inference
    paragraph, inference_type, suggested_field, _ = infer_civil_paragraph_with_type(
        question, 
        allow_anchor_fallback=True,
        classification_info=classification
    )
    
    # Build result
    result = {
        "inferredParagraph": paragraph,
        "inference_type": inference_type,
        "suggestedField": suggested_field,
        "classification": classification,
        "statute": "BGB",  # Default
        "allowExpansion": True,
        "confidence": 0.8
    }
    
    # Adjust for authority mode
    if authority_mode == 'ANCHOR_NORM_SELECTION' and suggested_field:
        result['anchorNorms'] = get_anchor_norms(suggested_field)
        result['statute'] = f"BGB_{suggested_field.replace('_', '')}"
        result['allowExpansion'] = True
    
    elif authority_mode == 'EXACT_REFERENCE_RESOLUTION':
        result['allowExpansion'] = False
    
    return result


# Legacy function for backward compatibility
def infer_civil_paragraph(question: str, allow_anchor_fallback: bool = False) -> Optional[str]:
    """
    Legacy function: Infer BGB paragraph (without inference type).
    
    Args:
        question: The legal question
        allow_anchor_fallback: If True, may return anchor norms as fallback
    
    Returns:
        Paragraph number or None
    """
    paragraph, inference_type, _, _ = infer_civil_paragraph_with_type(question, allow_anchor_fallback)
    return paragraph


def get_civil_paragraph_info(paragraph: str) -> Optional[Dict[str, any]]:
    """
    Get detailed information about a BGB paragraph.
    
    Args:
        paragraph: The paragraph number
    
    Returns:
        Dictionary with paragraph information or None if not found
    """
    # Search in CIVIL_PARAGRAPH_MAP
    for topic, data in CIVIL_PARAGRAPH_MAP.items():
        if data['paragraph'] == paragraph:
            return {
                'paragraph': paragraph,
                'topic': topic,
                'doctrine': data.get('doctrine', ''),
                'related_keywords': data.get('offenses', []),
                'source': 'CIVIL_PARAGRAPH_MAP'
            }
    
    # Search in anchor norms
    for field, norms in ANCHOR_NORMS.items():
        for norm in norms:
            if norm['section'] == paragraph:
                return {
                    'paragraph': paragraph,
                    'title': norm['title'],
                    'description': norm.get('description', ''),
                    'relevance': norm.get('relevance', ''),
                    'field': field,
                    'source': 'ANCHOR_NORMS'
                }
    
    return None


# ============================================================================
# DOMAIN-LEVEL INFERENCE SUPPORT FUNCTIONS
# ============================================================================

def get_domain_anchor_output(
    field: str,
    question: str = "",
    include_inference_type: bool = True
) -> Dict[str, any]:
    """
    Generate complete domain-anchor inference output with explicit labeling.
    
    This function satisfies the requirement:
    "inference_type = 'domain_anchor'" when domain-level inference occurs.
    
    Args:
        field: Legal field ('property_law', 'contract_law', 'liability_law')
        question: Optional question for context
        include_inference_type: Whether to include inference_type in output
    
    Returns:
        Complete inference output dictionary
    """
    anchor_norms, confidence, inference_type = get_anchor_norms_for_field(field, question)
    
    output = {
        "inferredParagraph": None,  # No single paragraph inferred
        "anchorNorms": anchor_norms,
        "suggestedField": field,
        "confidence": confidence,
        "domain": field.replace('_', ' ').title(),
        "reasoning": f"Domain-level inference triggered for {field.replace('_', ' ')}"
    }
    
    # CRITICAL: Add explicit inference type label
    if include_inference_type:
        output["inference_type"] = inference_type
    
    return output


def is_domain_level_question(question: str) -> Tuple[bool, Optional[str]]:
    """
    Detect if a question is at the domain level (overview/basics).
    
    Returns:
        Tuple of (is_domain_question, suggested_field)
    """
    lower_question = question.lower()
    
    # Domain-level indicators
    domain_indicators = [
        ('property law', 'property_law'),
        ('eigentumsrecht', 'property_law'),
        ('sachenrecht', 'property_law'),
        ('contract law', 'contract_law'),
        ('vertragsrecht', 'contract_law'),
        ('liability law', 'liability_law'),
        ('haftungsrecht', 'liability_law')
    ]
    
    for indicator, field in domain_indicators:
        if indicator in lower_question:
            # Check if it's a general question about the domain
            if any(phrase in lower_question for phrase in ['what is', 'overview', 'basics', 'explain', 'describe']):
                return True, field
    
    return False, None


# NEW: Function to check if a paragraph is a doctrinal anchor
def is_doctrinal_anchor(paragraph: str, field: str) -> bool:
    """
    Check if a paragraph is a doctrinal anchor for a given field.
    
    Args:
        paragraph: The paragraph number
        field: The legal field
    
    Returns:
        True if the paragraph is a doctrinal anchor
    """
    doctrinal_info = DOCTRINAL_ANCHOR_MAP.get(field)
    if not doctrinal_info:
        return False
    
    return paragraph in doctrinal_info['mandatory_anchors'] or paragraph in doctrinal_info['supporting_anchors']


# NEW: Function to get doctrinal anchor configuration
def get_doctrinal_anchor_config(field: str) -> Optional[Dict]:
    """
    Get doctrinal anchor configuration for a field.
    
    Args:
        field: The legal field
    
    Returns:
        Doctrinal anchor configuration or None if not found
    """
    return DOCTRINAL_ANCHOR_MAP.get(field)


# NEW: Simple standalone check for doctrinal property questions
def is_doctrinal_property_question(question: str) -> bool:
    """
    Simple check for doctrinal property definition questions.
    
    Args:
        question: The legal question
    
    Returns:
        True if this is a doctrinal property definition question
    """
    lower_question = question.lower()
    
    doctrinal_patterns = [
        'was ist eigentum',
        'what is property',
        'eigentum im deutschen recht',
        'property in german law',
        'definition of property',
        'definition eigentum',
        'erklären sie eigentum',
        'explain property'
    ]
    
    return any(pattern in lower_question for pattern in doctrinal_patterns)