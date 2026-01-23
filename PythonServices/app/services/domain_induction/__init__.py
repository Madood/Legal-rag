"""
Domain Induction Module
=======================
Determines which legal domain a question belongs to.

Primary responsibility:
- Detect legal domain from question text
- Suggest candidate statutes
- Calculate domain confidence

Key principle: SUGGESTS domains, doesn't lock statutes.
Statute authority resolution happens later in authority module.
"""

from .domain_discovery import DomainDiscovery, domain_discovery
from .domain_profiles import DomainProfiles, domain_profiles
from .domain_confidence import DomainConfidence, domain_confidence

__all__ = [
    'DomainDiscovery',
    'domain_discovery',
    'DomainProfiles',
    'domain_profiles',
    'DomainConfidence',
    'domain_confidence'
]

# Version
__version__ = "1.0.0"