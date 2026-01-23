"""
Architectural firewall for the utility layer.
Exposes only approved, stable helpers.
"""

from .text_processor import normalize_text, sanitize_for_embedding
from .chunker import create_chunks, Chunk, ChunkType

__all__ = [
    "normalize_text",
    "sanitize_for_embedding",
    "create_chunks",
    "Chunk",
    "ChunkType",
]