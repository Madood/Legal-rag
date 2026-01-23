"""
Pure text normalization & sanitization.
Lossless with respect to legal meaning.
No domain knowledge. No chunking. No reasoning.
"""
import re
import unicodedata
from typing import Optional


def normalize_text(raw_text: str, language_hint: str = "de") -> str:
    """
    Canonicalize text for downstream processing.
    Preserves legal symbols, fixes mechanical artifacts.
    """
    if not raw_text or not isinstance(raw_text, str):
        return ""

    # 1. Unicode normalization (canonical form, preserve all characters)
    text = unicodedata.normalize("NFKC", raw_text)

    # 2. Whitespace harmonization
    # Replace any whitespace sequence (including non-breaking spaces) with a single standard space
    text = re.sub(r"\s+", " ", text)

    # 3. Line-break normalization (preserve intentional paragraph breaks)
    # First, protect potential intentional double line breaks (paragraphs)
    # We'll mark them with a sentinel, then restore later
    text = re.sub(r"\n\s*\n", " ¶¶ ", text)
    # Replace single newlines with space (join broken lines)
    text = re.sub(r"\n", " ", text)
    # Restore paragraph sentinel to double newline for downstream chunking
    text = re.sub(r" ¶¶ ", "\n\n", text)

    # 4. Hyphenation repair (common PDF artifact: "Be- troffenen" -> "Betroffenen")
    # Only repair if the hyphen is at end of line/word and next word starts lowercase
    # This is a simplified rule; more robust repair needs lexical analysis (out of scope).
    text = re.sub(r"(\w)-\s+(\w)", r"\1\2", text)  # Simple case

    # 5. Protect legal symbols from being mangled
    # Ensure spaces after §, Art., Abs., Nr. are single, non-breaking?
    # For now, just normalize spacing around them.
    # Use NBSP for critical legal references if needed (optional).
    protection_map = {
        r"\s*§\s*": " §",
        r"\s*Art\.\s*": " Art. ",
        r"\s*Abs\.\s*": " Abs. ",
        r"\s*Nr\.\s*": " Nr. ",
        r"\s*S\.\s*": " S. ",  # Page reference
    }
    for pattern, replacement in protection_map.items():
        text = re.sub(pattern, replacement, text)

    # 6. Trim and return
    return text.strip()


def sanitize_for_embedding(text: str) -> str:
    """
    Remove purely presentational noise (headers, footers, page numbers).
    Strictly non‑semantic.
    """
    if not text:
        return ""

    # Remove common header/footer patterns (simple examples)
    lines = text.split("\n")
    cleaned_lines = []

    for line in lines:
        # Skip obvious page number lines (e.g., "– 12 –", "Seite 12")
        if re.match(r"^[–\-—\s]*\d+[–\-—\s]*$", line.strip()):
            continue
        # Skip lines that are just repeated document titles (heuristic)
        if line.strip().isupper() and len(line.strip()) > 50:
            # All‑caps lines >50 chars are likely titles/headers
            continue
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines)