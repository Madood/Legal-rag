"""
QUESTION UNDERSTANDING PACKAGE

Front gate of the legal reasoning system.
Ensures the system never answers a question it has not fully understood.

ARCHITECTURAL RULE:
- Detectors: Pure epistemic modules
- Orchestrator: Pure mechanical composer
- No decision logic in this layer
"""

from .intent_detector import detect_intent, INTENT_TYPES, IntentResult
from .abstraction_level import detect_abstraction_level, ABSTRACTION_LEVELS, AbstractionResult
from .ambiguity_detector import detect_ambiguity, AMBIGUITY_FLAGS, AmbiguityResult
from .question_orchestrator import orchestrate_understanding, get_transport_package, UnderstandingSignals, OrchestrationError

__all__ = [
    # Detectors (epistemic)
    "detect_intent",
    "detect_abstraction_level", 
    "detect_ambiguity",
    
    # Orchestrator (mechanical)
    "orchestrate_understanding",
    "get_transport_package",
    "UnderstandingSignals",
    
    # Types and errors
    "IntentResult",
    "AbstractionResult", 
    "AmbiguityResult",
    "OrchestrationError",
    
    # Constants
    "INTENT_TYPES",
    "ABSTRACTION_LEVELS",
    "AMBIGUITY_FLAGS",
]

__version__ = "2.0.0"  # Major version for architectural clarity