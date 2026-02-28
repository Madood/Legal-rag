import re
from typing import List

class ParagraphNormalizer:
    """Canonical paragraph normalization preserving alphanumeric suffixes"""
    
    @staticmethod
    def normalize_paragraph(paragraph: str) -> str:
        """Extract canonical paragraph identifier while preserving letters"""
        if not paragraph:
            return ""
        
        clean = paragraph.replace('§', '').strip()
        match = re.match(r'(\d+)([a-z])?', clean, re.IGNORECASE)
        
        if match:
            base_num = match.group(1)
            letter_suffix = match.group(2)
            if letter_suffix:
                return base_num + letter_suffix.lower()
            return base_num
        
        return clean
    
    @staticmethod
    def normalize_paragraph_list(paragraphs: List[str]) -> List[str]:
        """Normalize a list of paragraphs"""
        return [ParagraphNormalizer.normalize_paragraph(p) for p in paragraphs if p]
    
    @staticmethod
    def paragraph_matches(target: str, candidate: str) -> bool:
        """Check if paragraphs match after canonical normalization"""
        return ParagraphNormalizer.normalize_paragraph(target).lower() == \
               ParagraphNormalizer.normalize_paragraph(candidate).lower()

class ParagraphExtractor:
    """Extract ALL paragraph references from legal questions"""
    
    @staticmethod
    def extract_all_paragraphs(question: str) -> List[str]:
        """Extract all paragraph references with semantic guard"""
        paragraphs = []
        
        german_pattern = r'§+\s*(\d+[a-z]?)(?!\s*%)'
        matches = re.findall(german_pattern, question)
        if matches:
            paragraphs.extend(matches)
        
        spelled_pattern = r'(?:paragraph|paragraphen|art\.|artikel|§)\s+(\d+[a-z]?)(?!\s*%)'
        spelled_matches = re.findall(spelled_pattern, question, re.IGNORECASE)
        if spelled_matches:
            for match in spelled_matches:
                if match not in paragraphs:
                    paragraphs.append(match)
        
        range_pattern = r'(\d+[a-z]?)(?!\s*%)\s*(?:-|–|bis|ff\.|\.\.\.)\s*(\d+[a-z]?)(?!\s*%)'
        range_matches = re.findall(range_pattern, question)
        if range_matches:
            for start, end in range_matches:
                try:
                    start_num = int(re.sub(r'[a-z]', '', start))
                    end_num = int(re.sub(r'[a-z]', '', end))
                    for num in range(start_num, end_num + 1):
                        para = str(num) + (start[-1] if start[-1].isalpha() else '')
                        if para not in paragraphs:
                            paragraphs.append(para)
                except:
                    if start not in paragraphs:
                        paragraphs.append(start)
                    if end not in paragraphs:
                        paragraphs.append(end)
        
        unique_paragraphs = []
        for para in paragraphs:
            if para not in unique_paragraphs:
                unique_paragraphs.append(para)
        
        unique_paragraphs = [p for p in unique_paragraphs if p and p.strip()]
        
        filtered_paragraphs = []
        for para in unique_paragraphs:
            percentage_patterns = [
                rf'\b{para}\b\s*%',
                rf'\b{para}\b\s*prozent',
                rf'\b{para}\b\s*percent',
                rf'\b{para}\b\s*percentile',
            ]
            
            is_percentage = False
            for pattern in percentage_patterns:
                if re.search(pattern, question, re.IGNORECASE):
                    is_percentage = True
                    break
            
            if not is_percentage:
                filtered_paragraphs.append(para)
        
        return filtered_paragraphs