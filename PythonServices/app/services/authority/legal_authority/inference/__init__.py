# Inference module for legal reference inference
from .gdpr import infer_gdpr_article, GDPR_ARTICLE_MAP
from .criminal import infer_criminal_paragraph, CRIMINAL_PARAGRAPH_MAP
from .civil import infer_civil_paragraph, CIVIL_PARAGRAPH_MAP

__all__ = [
    'infer_gdpr_article',
    'GDPR_ARTICLE_MAP',
    'infer_criminal_paragraph',
    'CRIMINAL_PARAGRAPH_MAP',
    'infer_civil_paragraph',
    'CIVIL_PARAGRAPH_MAP'
]