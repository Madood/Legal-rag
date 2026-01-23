"""
DOCTRINE INDUCTION MODULE
========================

Purpose:
Formalizes doctrinal reasoning as a first-class system layer in legal AI systems.

Core Responsibility:
Transforms statutory material and authoritative norms into structured legal principles,
rules, definitions, and tests that explain HOW the law operates.

Key Features:
- Doctrine synthesis from norms
- Structural validation
- Template-based doctrinal framing
- Exam-grade legal reasoning preparation
- Automated doctrine orchestration (NEW)

Architectural Position:
This module sits BETWEEN authority/norm retrieval and answer composition.
It receives authoritative content and outputs structured doctrine.

STRICT BOUNDARIES:
- NEVER retrieves documents
- NEVER ranks authorities
- NEVER decides jurisdiction
- ONLY structures legal reasoning

Version: 2.0.0 (Now includes DoctrineInductor orchestration)
"""

from .doctrine_builder import DoctrineBuilder, LegalElement, DoctrinalTest
from .doctrine_validator import DoctrineValidator, ValidationResult, ValidationRule
from .doctrine_templates import (
    DoctrineTemplates, 
    TemplateType, 
    DefinitionTemplate,
    RuleTemplate,
    PrincipleTemplate,
    TestTemplate
)
from typing import Dict
from .doctrine_inductor import (
    DoctrineInductor,
    InductionConfig,
    InductionContext,
    DoctrineInductionResult,
    create_doctrine_inductor,
    get_default_inductor
)

__all__ = [
    # Builder
    "DoctrineBuilder",
    "LegalElement",
    "DoctrinalTest",
    
    # Validator
    "DoctrineValidator",
    "ValidationResult",
    "ValidationRule",
    
    # Templates
    "DoctrineTemplates",
    "TemplateType",
    "DefinitionTemplate",
    "RuleTemplate",
    "PrincipleTemplate",
    "TestTemplate",
    
    # Inductor (NEW - Complete Orchestration Layer)
    "DoctrineInductor",
    "InductionConfig",
    "InductionContext",
    "DoctrineInductionResult",
    "create_doctrine_inductor",
    "get_default_inductor"
]

__version__ = "2.0.0"

# Module metadata for system integration
MODULE_METADATA = {
    "name": "doctrine_induction",
    "version": __version__,
    "description": "Transforms norms into structured legal doctrine with automated orchestration",
    "dependencies": [],
    "input_requirements": ["authoritative_content", "norm_context", "question_context"],
    "output_type": "structured_doctrine_with_orchestration",
    "strict_boundaries": {
        "no_retrieval": True,
        "no_authority_ranking": True,
        "no_jurisdiction_decisions": True,
        "no_answer_composition": True
    },
    "components": {
        "builder": "Synthesizes doctrine from authoritative materials",
        "validator": "Validates doctrinal legitimacy and completeness",
        "templates": "Defines doctrinal structures and field rules (single source of truth)",
        "inductor": "Orchestrates doctrine application from question to examiner-ready output"
    },
    "capabilities": {
        "field_detection": "Automatically identifies applicable doctrinal fields",
        "doctrine_synthesis": "Builds structured doctrine from norms",
        "validation": "Ensures legal correctness and prevents hallucination",
        "examiner_grading": "Prepares doctrine for exam-level legal reasoning",
        "confidence_scoring": "Calculates reliability scores for doctrine application",
        "implicit_authority": "Handles implicit statutory references per civil law"
    },
    "integration_points": {
        "retrieval_service": "Receives authority-contracted retrieval results",
        "answer_composer": "Provides validated doctrine for answer construction",
        "question_analyzer": "Accepts question context for field determination"
    }
}

# Public API functions
def get_doctrine_explanation(doctrine_name: str, language: str = 'german'):
    """Get doctrine/principle explanation."""
    DOCTRINES = {
        'schuldprinzip': {
            'type': 'PRINCIPLE',
            'domain': 'criminal',
            'explanation': {
                'german': """**Das Schuldprinzip (Guilt Principle / *nulla poena sine culpa*)**

**Rechtsnatur:** Fundamental principle of German criminal law.

**Constitutional Basis:** Human dignity (Art. 1 GG) and rule of law (Art. 20 GG).

**Core:** "No punishment without guilt" – requires personal responsibility.

**Practice:** Intent requirement (§ 15 StGB), criminal capacity (§ 20 StGB).""",
                'english': """**The Schuldprinzip (Guilt Principle / *nulla poena sine culpa*)**

**Legal Nature:** Fundamental principle of German criminal law.

**Constitutional Basis:** Human dignity (Art. 1 GG) and rule of law (Art. 20 GG).

**Core:** "No punishment without guilt" – requires personal responsibility.

**Practice:** Intent requirement (§ 15 StGB), criminal capacity (§ 20 StGB)."""
            },
            'sources': ['GG Art. 1', 'GG Art. 20', 'StGB implied']
        },
        'verhältnismäßigkeitsprinzip': {
            'type': 'PRINCIPLE',
            'domain': 'constitutional',
            'explanation': {
                'german': 'Das Verhältnismäßigkeitsprinzip verlangt, dass staatliche Maßnahmen geeignet, erforderlich und angemessen sein müssen.',
                'english': 'The proportionality principle requires that state measures must be suitable, necessary, and appropriate.'
            },
            'sources': ['GG Art. 20']
        }
    }
    
    doctrine = DOCTRINES.get(doctrine_name.lower())
    
    if not doctrine:
        return None
    
    return {
        'type': doctrine['type'],
        'domain': doctrine['domain'],
        'explanation': doctrine['explanation'].get(language, doctrine['explanation']['german']),
        'sources': doctrine['sources']
    }


def create_induction_pipeline(strict_mode: bool = True) -> DoctrineInductor:
    """
    Create a complete doctrine induction pipeline.
    
    This is the main entry point for external services.
    
    Args:
        strict_mode: Whether to enforce strict validation standards
        
    Returns:
        Configured DoctrineInductor ready for use
    """
    return create_doctrine_inductor(strict_mode=strict_mode)


def diagnose_question(question_text: str) -> Dict:
    """
    Diagnostic function to see how a question is processed.
    
    Args:
        question_text: The legal question
        
    Returns:
        Diagnostic information including field detection and authority resolution
    """
    return DoctrineTemplates.diagnose_question(question_text)


# Version compatibility helpers
def is_compatible_with_version(version: str) -> bool:
    """
    Check if the module is compatible with a given version.
    
    Args:
        version: Version string (e.g., "2.0.0")
        
    Returns:
        True if compatible
    """
    current_parts = __version__.split('.')
    target_parts = version.split('.')
    
    # Major version must match
    return current_parts[0] == target_parts[0]


# Quick access to default inductor
default_inductor = get_default_inductor()

# Export common templates for convenience
TEMPLATES = {
    "definition": DoctrineTemplates.definition(),
    "rule": DoctrineTemplates.rule(),
    "principle": DoctrineTemplates.principle(),
    "test": DoctrineTemplates.test(),
    "standard": DoctrineTemplates.standard(),
    "exception": DoctrineTemplates.exception(),
    "presumption": DoctrineTemplates.presumption()
}

# Add to __all__
__all__.extend([
    "create_induction_pipeline",
    "diagnose_question",
    "is_compatible_with_version",
    "default_inductor",
    "TEMPLATES"
])