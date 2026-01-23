"""
Structural segmentation engine.
Breaks text into addressable, structurally‑preserved chunks.
No semantics. No authority. No embeddings.
"""
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Generator
import re


class ChunkType(Enum):
    """Type of structural element this chunk represents."""
    PARAGRAPH = "paragraph"
    HEADING = "heading"
    LIST = "list"
    TABLE = "table"
    ARTICLE = "article"  # For detected legal articles
    SECTION = "section"  # For detected legal sections
    UNKNOWN = "unknown"


@dataclass
class Chunk:
    """A single addressable text segment."""
    text: str
    index: int  # Sequential position in document
    chunk_type: ChunkType
    metadata: dict  # parent_context, char_offset_start, char_offset_end, etc.

    @property
    def parent_context(self) -> Optional[str]:
        return self.metadata.get("parent_context")

    @property
    def char_offset_start(self) -> int:
        return self.metadata.get("char_offset_start", 0)

    @property
    def char_offset_end(self) -> int:
        return self.metadata.get("char_offset_end", 0)


def create_chunks(
    text: str,
    max_chunk_size: int = 1000,
    min_chunk_size: int = 50,
    overlap: int = 50,
) -> List[Chunk]:
    """
    Primary chunking function. Splits by structural boundaries first,
    then by size if needed, preserving legal sentence integrity.
    """
    if not text or max_chunk_size <= min_chunk_size:
        return []

    # 1. First, segment by clear structural boundaries (paragraphs, headings)
    structural_segments = _split_by_structure(text)

    # 2. Further split oversized segments, respecting sentence boundaries
    all_chunks = []
    global_index = 0
    for segment in structural_segments:
        if len(segment.text) <= max_chunk_size:
            chunk = Chunk(
                text=segment.text,
                index=global_index,
                chunk_type=segment.chunk_type,
                metadata=segment.metadata,
            )
            all_chunks.append(chunk)
            global_index += 1
        else:
            # Segment is too large → split by sentences, respecting max_chunk_size
            subchunks = _split_oversized_segment(
                segment.text,
                max_chunk_size,
                min_chunk_size,
                overlap,
                base_metadata=segment.metadata,
                chunk_type=segment.chunk_type,
                start_index=global_index,
            )
            all_chunks.extend(subchunks)
            global_index += len(subchunks)

    return all_chunks


# -----------------------------------------------------------------------------
# Internal structural splitting (private helpers)
# -----------------------------------------------------------------------------

@dataclass
class _Segment:
    """Internal representation during segmentation."""
    text: str
    chunk_type: ChunkType
    metadata: dict


def _split_by_structure(text: str) -> List[_Segment]:
    """
    First pass: split by paragraphs, headings, lists, etc.
    Returns list of _Segment objects.
    """
    segments = []
    lines = text.split("\n")

    buffer = []
    current_type = ChunkType.UNKNOWN
    char_offset = 0

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # Detect heading (heuristic: short, ends with no period, maybe bold/uppercase in source)
        if _looks_like_heading(line):
            # Flush previous buffer
            if buffer:
                segments.append(_Segment(
                    text="\n".join(buffer),
                    chunk_type=current_type,
                    metadata={"char_offset_start": char_offset - sum(len(l) + 1 for l in buffer)}
                ))
                buffer = []
            # Heading as its own segment
            segments.append(_Segment(
                text=line,
                chunk_type=ChunkType.HEADING,
                metadata={"char_offset_start": char_offset}
            ))
            char_offset += len(line) + 1
            i += 1
            continue

        # Detect list item (starts with bullet, number, or legal enumeration)
        if re.match(r"^(\d+[\.\)]|[\-•*]|\§\s*\d+)", line):
            # For simplicity, we treat lists as separate segments
            if buffer:
                segments.append(_Segment(
                    text="\n".join(buffer),
                    chunk_type=current_type,
                    metadata={"char_offset_start": char_offset - sum(len(l) + 1 for l in buffer)}
                ))
                buffer = []
            segments.append(_Segment(
                text=line,
                chunk_type=ChunkType.LIST,
                metadata={"char_offset_start": char_offset}
            ))
            char_offset += len(line) + 1
            i += 1
            continue

        # Detect legal article (e.g., "Article 1", "Art. 1", "§ 1")
        article_match = re.match(r"^(Article\s+\d+|Art\.\s*\d+|\§\s*\d+)", line, re.IGNORECASE)
        if article_match:
            if buffer:
                segments.append(_Segment(
                    text="\n".join(buffer),
                    chunk_type=current_type,
                    metadata={"char_offset_start": char_offset - sum(len(l) + 1 for l in buffer)}
                ))
                buffer = []
            segments.append(_Segment(
                text=line,
                chunk_type=ChunkType.ARTICLE,
                metadata={"char_offset_start": char_offset}
            ))
            char_offset += len(line) + 1
            i += 1
            continue

        # Normal paragraph line
        buffer.append(line)
        current_type = ChunkType.PARAGRAPH
        char_offset += len(line) + 1
        i += 1

    # Flush remaining buffer
    if buffer:
        segments.append(_Segment(
            text="\n".join(buffer),
            chunk_type=current_type,
            metadata={"char_offset_start": char_offset - sum(len(l) + 1 for l in buffer)}
        ))

    # Add char_offset_end to metadata
    for seg in segments:
        seg.metadata["char_offset_end"] = seg.metadata["char_offset_start"] + len(seg.text)

    return segments


def _looks_like_heading(line: str) -> bool:
    """Heuristic detection of headings."""
    length = len(line)
    # Short, ends without period, may be in uppercase (for German legal texts)
    if length < 100 and not line.endswith("."):
        # Check if it's likely a title/heading
        if line.isupper() or re.search(r"^[A-ZÄÖÜ][a-zäöüß]+(\s+[A-ZÄÖÜ][a-zäöüß]+)*$", line):
            return True
    return False


def _split_oversized_segment(
    text: str,
    max_size: int,
    min_size: int,
    overlap: int,
    base_metadata: dict,
    chunk_type: ChunkType,
    start_index: int,
) -> List[Chunk]:
    """
    Split a large segment by sentence boundaries, respecting size limits.
    """
    sentences = re.split(r'(?<=[.!?])\s+', text)  # Simple sentence split
    chunks = []
    current_chunk = []
    current_size = 0
    index = start_index

    i = 0
    while i < len(sentences):
        sent = sentences[i]
        sent_len = len(sent)

        if current_size + sent_len <= max_size:
            current_chunk.append(sent)
            current_size += sent_len + 1  # +1 for space
            i += 1
        else:
            if current_chunk:  # Flush current chunk
                chunk_text = " ".join(current_chunk)
                if len(chunk_text) >= min_size:
                    meta = base_metadata.copy()
                    meta["split_from_oversized"] = True
                    chunks.append(Chunk(
                        text=chunk_text,
                        index=index,
                        chunk_type=chunk_type,
                        metadata=meta,
                    ))
                    index += 1
                # Overlap: keep last `overlap` chars for next chunk
                overlap_text = chunk_text[-overlap:] if overlap > 0 else ""
                current_chunk = [overlap_text] if overlap_text else []
                current_size = len(overlap_text)
                # Do NOT increment i; re‑evaluate current sentence with fresh chunk
            else:
                # Single sentence longer than max_size → hard split (should be rare for legal text)
                # Split by words
                words = sent.split()
                temp_chunk = []
                temp_size = 0
                for word in words:
                    if temp_size + len(word) + 1 <= max_size:
                        temp_chunk.append(word)
                        temp_size += len(word) + 1
                    else:
                        if temp_chunk:
                            chunk_text = " ".join(temp_chunk)
                            meta = base_metadata.copy()
                            meta["split_from_oversized"] = True
                            chunks.append(Chunk(
                                text=chunk_text,
                                index=index,
                                chunk_type=chunk_type,
                                metadata=meta,
                            ))
                            index += 1
                        temp_chunk = [word]
                        temp_size = len(word)
                if temp_chunk:
                    chunk_text = " ".join(temp_chunk)
                    meta = base_metadata.copy()
                    meta["split_from_oversized"] = True
                    chunks.append(Chunk(
                        text=chunk_text,
                        index=index,
                        chunk_type=chunk_type,
                        metadata=meta,
                    ))
                    index += 1
                i += 1

    # Final chunk
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        if len(chunk_text) >= min_size:
            meta = base_metadata.copy()
            meta["split_from_oversized"] = True
            chunks.append(Chunk(
                text=chunk_text,
                index=index,
                chunk_type=chunk_type,
                metadata=meta,
            ))

    return chunks