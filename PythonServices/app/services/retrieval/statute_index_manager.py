import re
from typing import List, Dict, Any
from datetime import datetime
from .paragraph_identity import ParagraphNormalizer

STATUTE_CHAINS = {
    "BGB": {
        "119": ["121", "122"],
        "433": ["434", "437", "440"],
        "823": ["826", "249", "253"],
        "985": ["986", "987", "1004"],
    },
    "StGB": {
        "211": ["212", "213"],
        "223": ["224", "226"],
        "242": ["243", "244"],
    }
}

class StatuteFirstIndexer:
    """Statute indexing and management"""
    
    @staticmethod
    def extract_stgb_paragraphs(text: str, statute: str = "StGB") -> List[Dict]:
        """Extract paragraphs from StGB text"""
        documents = []
        paragraph_pattern = r'(?:§|Artikel)\s*(\d+[a-z]?)'
        lines = text.split('\n')
        current_paragraph = None
        current_content = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            match = re.match(paragraph_pattern, line)
            if match:
                if current_paragraph and current_content:
                    doc = {
                        "content": ' '.join(current_content),
                        "statute": statute,
                        "paragraph": current_paragraph,
                        "paragraph_base": ParagraphNormalizer.normalize_paragraph(current_paragraph),
                        "norm_type": "criminal_offense",
                        "is_normative": True,
                        "authority_level": "statutory"
                    }
                    documents.append(doc)
                
                current_paragraph = match.group(1)
                current_content = [line]
            elif current_paragraph:
                current_content.append(line)
        
        if current_paragraph and current_content:
            doc = {
                "content": ' '.join(current_content),
                "statute": statute,
                "paragraph": current_paragraph,
                "paragraph_base": ParagraphNormalizer.normalize_paragraph(current_paragraph),
                "norm_type": "criminal_offense",
                "is_normative": True,
                "authority_level": "statutory"
            }
            documents.append(doc)
        
        return documents
    
    @staticmethod
    def extract_bgb_paragraphs(text: str, statute: str = "BGB") -> List[Dict]:
        """Extract BGB paragraphs"""
        documents = []
        lines = text.split('\n')
        current_paragraph = None
        current_content = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith('§'):
                parts = line.split()
                if parts and parts[0] == '§' and len(parts) > 1:
                    if current_paragraph and current_content:
                        doc = {
                            "content": ' '.join(current_content),
                            "statute": statute,
                            "paragraph": current_paragraph,
                            "paragraph_base": ParagraphNormalizer.normalize_paragraph(current_paragraph),
                            "norm_type": "civil_norm",
                            "is_normative": True,
                            "authority_level": "statutory"
                        }
                        documents.append(doc)
                    
                    current_paragraph = parts[1].rstrip('.')
                    current_content = [line]
            elif current_paragraph:
                current_content.append(line)
        
        if current_paragraph and current_content:
            doc = {
                "content": ' '.join(current_content),
                "statute": statute,
                "paragraph": current_paragraph,
                "paragraph_base": ParagraphNormalizer.normalize_paragraph(current_paragraph),
                "norm_type": "civil_norm",
                "is_normative": True,
                "authority_level": "statutory"
            }
            documents.append(doc)
        
        return documents

class StatuteFirstValidator:
    """Validate that responses have proper statutory authority"""
    
    @staticmethod
    def validate_response(response_text: str, statute: str, paragraph: str) -> Dict:
        """Validate that response cites correct statute and paragraph"""
        validation = {
            "is_valid": False,
            "statute_found": False,
            "paragraph_found": False,
            "security_score": 0,
            "issues": []
        }
        
        if statute.upper() in response_text.upper():
            validation["statute_found"] = True
        
        paragraph_base = ParagraphNormalizer.normalize_paragraph(paragraph)
        response_paragraphs = re.findall(r'§\s*(\d+[a-z]?)', response_text)
        
        for resp_para in response_paragraphs:
            if ParagraphNormalizer.paragraph_matches(resp_para, paragraph):
                validation["paragraph_found"] = True
                break
        
        if not validation["paragraph_found"]:
            para_patterns = [
                rf'paragraph\s+{paragraph_base}\b',
                rf'art\.\s*{paragraph_base}\b',
                rf'artikel\s+{paragraph_base}\b'
            ]
            for pattern in para_patterns:
                if re.search(pattern, response_text, re.IGNORECASE):
                    validation["paragraph_found"] = True
                    break
        
        validation["is_valid"] = validation["statute_found"] and validation["paragraph_found"]
        
        if validation["is_valid"]:
            validation["security_score"] = 95
        elif validation["statute_found"] and not validation["paragraph_found"]:
            validation["security_score"] = 40
            validation["issues"].append("Paragraph not cited")
        elif not validation["statute_found"] and validation["paragraph_found"]:
            validation["security_score"] = 30
            validation["issues"].append("Statute not cited")
        else:
            validation["security_score"] = 0
            validation["issues"].append("No statutory authority cited")
        
        return validation