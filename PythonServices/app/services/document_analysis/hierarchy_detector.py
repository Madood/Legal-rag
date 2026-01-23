"""
HIERARCHY DETECTOR
=================

Infers internal authority hierarchy within documents.
Reuses existing hierarchy.py logic when available.
"""

from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import re
import logging
import sys
import os

# Add the parent directory to the path to find hierarchy module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

logger = logging.getLogger(__name__)


class HierarchyLevel(Enum):
    """Hierarchy levels based on authority."""
    SUPREME = "supreme"          # Constitution, Charter
    PRIMARY = "primary"          # Statutes, Acts, Codes
    SECONDARY = "secondary"      # Regulations, Decrees
    TERTIARY = "tertiary"        # Rules, Guidelines
    INTERPRETIVE = "interpretive" # Commentary, Case law
    ADMINISTRATIVE = "administrative"  # Forms, Schedules


@dataclass
class AuthorityNode:
    """Node in the authority hierarchy."""
    id: str
    element_type: str
    marker: str
    position: int
    authority_level: HierarchyLevel
    authority_score: float  # 0-100
    parent_id: Optional[str] = None
    children: List[str] = None
    override_flags: List[str] = None
    normative_strength: float = 0.0  # How normative (binding) it is
    
    def __post_init__(self):
        if self.children is None:
            self.children = []
        if self.override_flags is None:
            self.override_flags = []
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "type": self.element_type,
            "marker": self.marker,
            "position": self.position,
            "authority_level": self.authority_level.value,
            "authority_score": round(self.authority_score, 1),
            "parent_id": self.parent_id,
            "children": self.children,
            "override_flags": self.override_flags,
            "normative_strength": round(self.normative_strength, 2)
        }


class HierarchyDetector:
    """
    Detects internal hierarchy and authority relationships.
    """
    
    # Override indicators (higher authority overrides lower)
    OVERRIDE_INDICATORS = {
        "notwithstanding": {
            "pattern": r"notwithstanding\s+(?:the\s+)?(?:provisions\s+of\s+)?",
            "strength": 1.0,
            "scope": "broad"
        },
        "subject_to": {
            "pattern": r"subject\s+to\s+(?:the\s+)?(?:provisions\s+of\s+)?",
            "strength": 0.8,
            "scope": "specific"
        },
        "save_as": {
            "pattern": r"save\s+as\s+(?:otherwise\s+)?(?:provided\s+)?",
            "strength": 0.7,
            "scope": "general"
        },
        "without_prejudice": {
            "pattern": r"without\s+prejudice\s+to",
            "strength": 0.9,
            "scope": "specific"
        },
        "except_as": {
            "pattern": r"except\s+as\s+(?:otherwise\s+)?(?:provided\s+)?",
            "strength": 0.6,
            "scope": "specific"
        }
    }
    
    # Authority level mappings
    ELEMENT_AUTHORITY = {
        # Supreme level
        "preamble": (HierarchyLevel.SUPREME, 95),
        "title": (HierarchyLevel.PRIMARY, 90),
        
        # Primary level
        "chapter": (HierarchyLevel.PRIMARY, 85),
        "part": (HierarchyLevel.PRIMARY, 80),
        
        # Secondary level
        "article": (HierarchyLevel.SECONDARY, 75),
        "section": (HierarchyLevel.SECONDARY, 70),
        
        # Tertiary level
        "subsection": (HierarchyLevel.TERTIARY, 65),
        "paragraph": (HierarchyLevel.TERTIARY, 60),
        "subparagraph": (HierarchyLevel.TERTIARY, 55),
        
        # Interpretive level
        "clause": (HierarchyLevel.INTERPRETIVE, 50),
        "recital": (HierarchyLevel.INTERPRETIVE, 45),
        
        # Administrative level
        "definitions": (HierarchyLevel.ADMINISTRATIVE, 40),
        "annex": (HierarchyLevel.ADMINISTRATIVE, 35),
        "schedule": (HierarchyLevel.ADMINISTRATIVE, 30),
        "appendix": (HierarchyLevel.ADMINISTRATIVE, 25),
        "form": (HierarchyLevel.ADMINISTRATIVE, 20),
    }
    
    # Normative language boosters
    NORMATIVE_BOOSTERS = {
        "shall": 0.3,
        "must": 0.4,
        "required": 0.3,
        "obliged": 0.3,
        "prohibited": 0.4,
        "may_not": 0.3,
        "shall_not": 0.4,
    }
    
    # Permissive language reducers
    PERMISSIVE_REDUCERS = {
        "may": -0.2,
        "can": -0.1,
        "could": -0.15,
        "might": -0.2,
        "option": -0.1,
        "discretion": -0.15,
    }
    
    def __init__(self, use_existing_hierarchy: bool = True):
        """
        Initialize hierarchy detector.
        
        Args:
            use_existing_hierarchy: Whether to try importing existing hierarchy.py
        """
        self.use_existing_hierarchy = use_existing_hierarchy
        self.existing_resolver = None
        
        if use_existing_hierarchy:
            self._try_import_existing()
    
    def _try_import_existing(self):
        """Try to import existing hierarchy resolver."""
        try:
            # Try absolute import with path adjustment
            from services.authority.statute.hierarchy import HierarchyResolver
            self.existing_resolver = HierarchyResolver()
            logger.info("Successfully imported existing HierarchyResolver")
        except ImportError as e:
            logger.warning(f"Could not import existing hierarchy resolver: {e}")
            self.existing_resolver = None
        except Exception as e:
            logger.error(f"Error importing hierarchy resolver: {e}")
            self.existing_resolver = None
    
    def detect(self, structure_analysis: Dict, text: str) -> Dict[str, Any]:
        """
        Detect hierarchy and authority relationships.
        
        Args:
            structure_analysis: Output from StructureDetector
            text: Full document text
            
        Returns:
            Hierarchy analysis with authority levels
        """
        if self.existing_resolver and self.use_existing_hierarchy:
            try:
                return self._use_existing_hierarchy(structure_analysis, text)
            except Exception as e:
                logger.error(f"Existing hierarchy failed: {e}")
        
        return self._fallback_hierarchy_detection(structure_analysis, text)
    
    def _use_existing_hierarchy(self, structure_analysis: Dict, text: str) -> Dict:
        """Use existing hierarchy resolver."""
        # Prepare input for existing resolver
        input_data = {
            "document": text,
            "structure": structure_analysis,
            "elements": structure_analysis.get("elements", [])
        }
        
        result = self.existing_resolver.resolve(input_data)
        
        # Convert to our format if needed
        if "hierarchy" in result and "authority_levels" in result:
            return {
                "method": "existing_resolver",
                "hierarchy": result.get("hierarchy", []),
                "authority_map": result.get("authority_levels", {}),
                "conflicts": result.get("conflicts", []),
                "overrides": result.get("overrides", []),
                "metadata": {
                    "resolver_version": getattr(self.existing_resolver, '__version__', 'unknown'),
                    "success": True
                }
            }
        
        # Fallback if format doesn't match
        return self._fallback_hierarchy_detection(structure_analysis, text)
    
    def _fallback_hierarchy_detection(self, structure_analysis: Dict, text: str) -> Dict[str, Any]:
        """Fallback hierarchy detection."""
        elements = structure_analysis.get("elements", [])
        text_lines = text.split('\n')
        
        # Create authority nodes
        authority_nodes = []
        node_map = {}
        
        for element in elements:
            node = self._create_authority_node(element, text_lines)
            authority_nodes.append(node)
            node_map[node.id] = node
        
        # Determine parent-child relationships
        self._determine_parent_relationships(authority_nodes, structure_analysis.get("hierarchy", []))
        
        # Detect override clauses
        override_clauses = self._detect_override_clauses(text)
        
        # Detect conflicts
        conflicts = self._detect_conflicts(authority_nodes, text)
        
        # Calculate authority distribution
        authority_distribution = self._calculate_authority_distribution(authority_nodes)
        
        # Build hierarchy tree
        hierarchy_tree = self._build_authority_tree(authority_nodes)
        
        return {
            "method": "fallback_detection",
            "nodes": [node.to_dict() for node in authority_nodes],
            "hierarchy_tree": hierarchy_tree,
            "authority_distribution": authority_distribution,
            "override_clauses": override_clauses,
            "conflicts": conflicts,
            "summary": {
                "total_nodes": len(authority_nodes),
                "hierarchy_depth": self._calculate_hierarchy_depth(hierarchy_tree),
                "has_clear_hierarchy": len(hierarchy_tree) > 0 and len(hierarchy_tree[0].get("children", [])) > 0,
                "authority_range": self._calculate_authority_range(authority_nodes),
                "override_count": len(override_clauses),
                "conflict_count": len(conflicts),
            },
            "metadata": {
                "detection_method": "fallback",
                "use_existing": self.use_existing_hierarchy and self.existing_resolver is not None,
                "existing_success": False,
            }
        }
    
    def _create_authority_node(self, element: Dict, text_lines: List[str]) -> AuthorityNode:
        """Create an authority node from structure element."""
        element_type = element.get("type", "")
        marker = element.get("marker", "")
        position = element.get("position", 0)
        
        # Get base authority
        authority_level, base_score = self.ELEMENT_AUTHORITY.get(
            element_type.lower(), 
            (HierarchyLevel.ADMINISTRATIVE, 10)
        )
        
        # Calculate ID
        node_id = f"{element_type}_{position}"
        
        # Get text context
        context = self._get_element_context(text_lines, position)
        
        # Adjust score based on normative language
        normative_adjustment = self._calculate_normative_adjustment(context)
        final_score = min(100, max(0, base_score + normative_adjustment))
        
        # Calculate normative strength
        normative_strength = self._calculate_normative_strength(context)
        
        # Check for override flags
        override_flags = self._detect_override_flags(context)
        
        return AuthorityNode(
            id=node_id,
            element_type=element_type,
            marker=marker,
            position=position,
            authority_level=authority_level,
            authority_score=final_score,
            override_flags=override_flags,
            normative_strength=normative_strength
        )
    
    def _get_element_context(self, text_lines: List[str], position: int, window: int = 5) -> str:
        """Get context around an element."""
        start = max(0, position - window)
        end = min(len(text_lines), position + window + 1)
        return "\n".join(text_lines[start:end])
    
    def _calculate_normative_adjustment(self, context: str) -> float:
        """Calculate adjustment based on normative language."""
        adjustment = 0.0
        context_lower = context.lower()
        
        # Boost for normative language
        for term, boost in self.NORMATIVE_BOOSTERS.items():
            if re.search(r'\b' + term.replace('_', r'\s*') + r'\b', context_lower):
                adjustment += boost
        
        # Reduce for permissive language
        for term, reduction in self.PERMISSIVE_REDUCERS.items():
            if re.search(r'\b' + term + r'\b', context_lower):
                adjustment += reduction
        
        return adjustment
    
    def _calculate_normative_strength(self, context: str) -> float:
        """Calculate how normative (binding) the text is."""
        context_lower = context.lower()
        strength = 0.5  # Neutral baseline
        
        # Strong indicators
        strong_terms = ["shall", "must", "required", "obliged", "prohibited", "forbidden"]
        for term in strong_terms:
            if re.search(r'\b' + term + r'\b', context_lower):
                strength = min(1.0, strength + 0.2)
        
        # Weak indicators
        weak_terms = ["may", "can", "could", "might", "optional", "discretionary"]
        for term in weak_terms:
            if re.search(r'\b' + term + r'\b', context_lower):
                strength = max(0.0, strength - 0.1)
        
        # Override indicators boost strength
        for indicator in self.OVERRIDE_INDICATORS.values():
            if re.search(indicator["pattern"], context_lower, re.IGNORECASE):
                strength = min(1.0, strength + 0.3)
        
        return round(strength, 2)
    
    def _detect_override_flags(self, context: str) -> List[str]:
        """Detect override flags in context."""
        flags = []
        context_lower = context.lower()
        
        for flag_name, indicator in self.OVERRIDE_INDICATORS.items():
            if re.search(indicator["pattern"], context_lower, re.IGNORECASE):
                flags.append(flag_name)
        
        return flags
    
    def _determine_parent_relationships(self, nodes: List[AuthorityNode], structure_hierarchy: List[Dict]):
        """Determine parent-child relationships."""
        # Sort by position
        nodes.sort(key=lambda x: x.position)
        
        # Simple parent determination based on type hierarchy
        for i, node in enumerate(nodes):
            # Look for potential parent (higher level, earlier position)
            potential_parents = [
                n for n in nodes[:i] 
                if n.authority_level.value < node.authority_level.value
                and n.position < node.position
            ]
            
            if potential_parents:
                # Choose the closest parent
                parent = min(potential_parents, key=lambda x: node.position - x.position)
                node.parent_id = parent.id
                parent.children.append(node.id)
    
    def _detect_override_clauses(self, text: str) -> List[Dict]:
        """Detect override clauses in text."""
        clauses = []
        lines = text.split('\n')
        
        for line_num, line in enumerate(lines):
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            for flag_name, indicator in self.OVERRIDE_INDICATORS.items():
                if re.search(indicator["pattern"], line_stripped, re.IGNORECASE):
                    # Find what is being overridden
                    override_target = self._extract_override_target(line_stripped, lines, line_num)
                    
                    clauses.append({
                        "flag": flag_name,
                        "clause": line_stripped[:200] + "..." if len(line_stripped) > 200 else line_stripped,
                        "line_number": line_num + 1,
                        "strength": indicator["strength"],
                        "scope": indicator["scope"],
                        "override_target": override_target,
                    })
        
        return clauses
    
    def _extract_override_target(self, line: str, lines: List[str], line_num: int) -> str:
        """Extract what is being overridden."""
        # Look for references like "Article X" or "Section Y"
        patterns = [
            r"(?:Article|Art\.|Section|Sec\.|§|Clause|Cl\.)\s+\d+[a-z]?",
            r"\b[aA]rticle\s+\d+",
            r"\b[sS]ection\s+\d+",
            r"\b[cC]lause\s+\d+",
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, line)
            if matches:
                return matches[0]
        
        # Look in next few lines
        for i in range(line_num + 1, min(line_num + 3, len(lines))):
            for pattern in patterns:
                matches = re.findall(pattern, lines[i])
                if matches:
                    return matches[0]
        
        return "unknown"
    
    def _detect_conflicts(self, nodes: List[AuthorityNode], text: str) -> List[Dict]:
        """Detect potential conflicts in hierarchy."""
        conflicts = []
        
        # Group by similar markers
        marker_groups = {}
        for node in nodes:
            if node.marker not in marker_groups:
                marker_groups[node.marker] = []
            marker_groups[node.marker].append(node)
        
        # Check for duplicate markers with different types
        for marker, group in marker_groups.items():
            if len(group) > 1:
                types = set(n.element_type for n in group)
                if len(types) > 1:
                    conflicts.append({
                        "type": "duplicate_marker_different_type",
                        "marker": marker,
                        "elements": [n.to_dict() for n in group],
                        "description": f"Marker '{marker}' appears with multiple types: {', '.join(types)}"
                    })
        
        # Check for authority inversions
        sorted_nodes = sorted(nodes, key=lambda x: x.position)
        for i in range(1, len(sorted_nodes)):
            prev = sorted_nodes[i-1]
            curr = sorted_nodes[i]
            
            if prev.authority_level.value < curr.authority_level.value:
                # Lower authority element comes after higher authority
                if curr.position - prev.position < 10:  # Close proximity
                    conflicts.append({
                        "type": "authority_inversion",
                        "higher": prev.to_dict(),
                        "lower": curr.to_dict(),
                        "description": f"{curr.element_type} (lower authority) follows {prev.element_type} (higher authority) too closely"
                    })
        
        return conflicts
    
    def _calculate_authority_distribution(self, nodes: List[AuthorityNode]) -> Dict[str, float]:
        """Calculate distribution of authority levels."""
        distribution = {}
        total = len(nodes)
        
        if total == 0:
            return {}
        
        for level in HierarchyLevel:
            count = sum(1 for node in nodes if node.authority_level == level)
            if count > 0:
                percentage = (count / total) * 100
                distribution[level.value] = round(percentage, 1)
        
        return distribution
    
    def _build_authority_tree(self, nodes: List[AuthorityNode]) -> List[Dict]:
        """Build hierarchical tree from authority nodes."""
        # Find root nodes (no parent)
        root_nodes = [n for n in nodes if n.parent_id is None]
        
        def build_tree(node: AuthorityNode) -> Dict:
            """Recursively build tree."""
            tree_node = node.to_dict()
            tree_node["children"] = []
            
            # Find children
            for child_id in node.children:
                child_node = next((n for n in nodes if n.id == child_id), None)
                if child_node:
                    tree_node["children"].append(build_tree(child_node))
            
            return tree_node
        
        return [build_tree(root) for root in root_nodes]
    
    def _calculate_hierarchy_depth(self, tree: List[Dict]) -> int:
        """Calculate maximum depth of hierarchy tree."""
        def max_depth(node: Dict, current_depth: int) -> int:
            if not node.get("children"):
                return current_depth
            
            child_depths = [max_depth(child, current_depth + 1) for child in node.get("children", [])]
            return max(child_depths) if child_depths else current_depth
        
        if not tree:
            return 0
        
        depths = [max_depth(node, 1) for node in tree]
        return max(depths) if depths else 1
    
    def _calculate_authority_range(self, nodes: List[AuthorityNode]) -> Dict[str, float]:
        """Calculate range of authority scores."""
        if not nodes:
            return {"min": 0, "max": 0, "avg": 0}
        
        scores = [n.authority_score for n in nodes]
        return {
            "min": round(min(scores), 1),
            "max": round(max(scores), 1),
            "avg": round(sum(scores) / len(scores), 1),
            "std": round(self._std_dev(scores), 1) if len(scores) > 1 else 0
        }
    
    def _std_dev(self, values: List[float]) -> float:
        """Calculate standard deviation."""
        if len(values) < 2:
            return 0.0
        
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        return variance ** 0.5
    
    def find_supreme_elements(self, hierarchy_analysis: Dict, count: int = 5) -> List[Dict]:
        """Find the most authoritative elements."""
        nodes = hierarchy_analysis.get("nodes", [])
        if not nodes:
            return []
        
        # Sort by authority score
        sorted_nodes = sorted(nodes, key=lambda x: x.get("authority_score", 0), reverse=True)
        return sorted_nodes[:count]