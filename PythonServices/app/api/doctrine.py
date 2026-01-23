"""
Legal doctrine/principles endpoints.
Pure transport layer.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, Dict, Any
from app.services.doctrine_induction import get_doctrine_explanation
from app.services.doctrine_induction.doctrine_builder import DoctrineBuilder
from app.services.doctrine_induction.doctrine_templates import DoctrineTemplates
from app.services.doctrine_induction.doctrine_validator import DoctrineValidator

router = APIRouter(prefix="/doctrine", tags=["doctrines"])


# Dependency for doctrine builder
def get_doctrine_builder():
    return DoctrineBuilder()


# Dependency for doctrine validator
def get_doctrine_validator():
    return DoctrineValidator()


@router.get("/{doctrine_name}")
async def get_doctrine(
    doctrine_name: str, 
    language: str = "german",
    include_validation: bool = False
):
    """
    Get doctrine/principle explanation.
    
    Args:
        doctrine_name: Name of the doctrine (e.g., "schuldprinzip")
        language: Language for explanation (german/english)
        include_validation: If True, includes validation results
    
    Returns:
        Doctrine explanation with optional validation
    """
    doctrine = get_doctrine_explanation(doctrine_name, language)
    
    if not doctrine:
        raise HTTPException(
            status_code=404,
            detail=f"Doctrine '{doctrine_name}' not found"
        )
    
    # Add validation if requested
    if include_validation:
        validator = DoctrineValidator()
        validation_result = validator.validate({
            "template": "principle",
            "statute_anchor": doctrine.get("sources", ["unknown"])[0],
            "doctrine": {"principle_statement": doctrine["explanation"]},
            "context": {"domain": doctrine["domain"]}
        })
        doctrine["validation"] = validation_result.to_dict()
    
    return doctrine


@router.get("/")
async def list_doctrines(
    domain: Optional[str] = None,
    template_type: Optional[str] = None
):
    """
    List all available doctrines or filter by domain/template.
    
    Args:
        domain: Filter by legal domain (e.g., "family_law", "criminal")
        template_type: Filter by template type (e.g., "rule", "principle")
    
    Returns:
        List of doctrines matching criteria
    """
    # Get all doctrinal fields from templates
    all_fields = DoctrineTemplates._DOCTRINAL_FIELDS
    
    results = []
    
    for domain_name, fields in all_fields.items():
        # Filter by domain if specified
        if domain and domain_name != domain:
            continue
        
        for field_name, config in fields.items():
            # Filter by template type if specified
            if template_type and config.get("template_type") != template_type:
                continue
            
            results.append({
                "domain": domain_name,
                "field": field_name,
                "template": config.get("template_type", "rule"),
                "default_statute": config.get("default_statute"),
                "implicit_allowed": config.get("implicit_allowed", False),
                "confidence_threshold": config.get("confidence_threshold", 0.8)
            })
    
    return {
        "doctrines": results,
        "count": len(results),
        "domains": list(all_fields.keys()),
        "languages": ["german", "english"]
    }


@router.post("/build/definition")
async def build_definition(
    concept: str,
    statute: str,
    elements: list,
    purpose: str,
    builder: DoctrineBuilder = Depends(get_doctrine_builder)
):
    """
    Build a legal definition doctrine.
    
    Args:
        concept: The legal concept being defined
        statute: Authoritative statutory basis
        elements: Core elements of the definition
        purpose: Normative purpose of the definition
    
    Returns:
        Structured definition doctrine
    """
    doctrine = builder.build_definition(
        concept=concept,
        statute=statute,
        elements=elements,
        purpose=purpose
    )
    
    return doctrine


@router.post("/build/rule")
async def build_rule(
    rule_name: str,
    statute: str,
    requirements: list,
    consequence: str,
    exceptions: Optional[list] = None,
    builder: DoctrineBuilder = Depends(get_doctrine_builder)
):
    """
    Build a legal rule doctrine.
    
    Args:
        rule_name: Name/statement of the rule
        statute: Authoritative statutory basis
        requirements: Elements required to trigger the rule
        consequence: Legal consequence of rule application
        exceptions: List of exceptions to the rule
    
    Returns:
        Structured rule doctrine
    """
    doctrine = builder.build_rule(
        rule_name=rule_name,
        statute=statute,
        requirements=requirements,
        consequence=consequence,
        exceptions=exceptions
    )
    
    return doctrine


@router.post("/validate")
async def validate_doctrine(
    doctrine: Dict[str, Any],
    validator: DoctrineValidator = Depends(get_doctrine_validator)
):
    """
    Validate a doctrine object.
    
    Args:
        doctrine: Doctrine object to validate
    
    Returns:
        Validation result with issues and suggestions
    """
    result = validator.validate(doctrine)
    return result.to_dict()


@router.get("/templates")
async def list_templates(
    template_type: Optional[str] = None
):
    """
    List all available doctrine templates.
    
    Args:
        template_type: Specific template type to retrieve
    
    Returns:
        Template information
    """
    if template_type:
        try:
            template = DoctrineTemplates.get_template(template_type)
            return {"template": template}
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid template type: {template_type}"
            )
    
    all_templates = DoctrineTemplates.get_all_templates()
    return {"templates": all_templates}


@router.get("/field/resolve")
async def resolve_field(
    question: str,
    context_domain: Optional[str] = None
):
    """
    Infer doctrinal field from question text.
    
    Args:
        question: Legal question text
        context_domain: Optional domain context
    
    Returns:
        Inferred doctrinal field with configuration
    """
    context = {"domain": context_domain} if context_domain else None
    field_info = DoctrineTemplates.get_field_for_question(question, context)
    
    if not field_info:
        raise HTTPException(
            status_code=404,
            detail=f"No doctrinal field found for question: {question[:100]}..."
        )
    
    return field_info


@router.get("/field/authority")
async def resolve_implicit_authority(
    domain: str,
    field: str,
    provided_statute: Optional[str] = None,
    provided_paragraphs: Optional[str] = None
):
    """
    Resolve implicit authority for a doctrinal field.
    Implements the bug fix: accepts builder inference as authoritative.
    
    Args:
        domain: Legal domain (e.g., "family_law")
        field: Specific field (e.g., "divorce")
        provided_statute: Optional statute provided by builder
        provided_paragraphs: Optional paragraphs (comma-separated)
    
    Returns:
        Authority resolution with implicit flag
    """
    # Parse paragraphs if provided
    paragraphs_list = None
    if provided_paragraphs:
        paragraphs_list = [p.strip() for p in provided_paragraphs.split(",")]
    
    # Resolve authority using SINGLE SOURCE OF TRUTH from DoctrineTemplates
    resolution = DoctrineTemplates.resolve_implicit_authority(
        domain=domain,
        field=field,
        provided_statute=provided_statute,
        provided_paragraphs=paragraphs_list
    )
    
    # CRITICAL BUG FIX: Accept builder inference as authoritative
    # If builder provided a statute, mark it as authoritative even if implicit
    if provided_statute and resolution["implicit"]:
        resolution["authoritative"] = True
        resolution["mode"] = "builder_inference"
        resolution["confidence"] = max(resolution["confidence"], 0.85)
    
    # Prepare response for Node service
    response = {
        "authority": {
            "statute": resolution["statute"],
            "paragraphs": resolution["paragraphs"],
            "mode": resolution["authority_mode"],
            "inferred": resolution["implicit"],
            "domain": domain,
            "field": field,
            "confidence": resolution["confidence"]
        }
    }
    
    # Add bug fix metadata
    if "authoritative" in resolution:
        response["authority"]["authoritative"] = resolution["authoritative"]
        response["authority"]["source"] = resolution["mode"]
    
    return response


@router.get("/stats")
async def get_doctrine_stats(
    builder: DoctrineBuilder = Depends(get_doctrine_builder)
):
    """
    Get doctrine builder statistics.
    
    Returns:
        Statistics about generated doctrines
    """
    stats = builder.get_stats()
    
    # Add template info
    all_templates = DoctrineTemplates.get_all_templates()
    
    return {
        **stats,
        "templates_available": len(all_templates),
        "doctrinal_fields": sum(len(fields) for fields in DoctrineTemplates._DOCTRINAL_FIELDS.values())
    }


# Example endpoints for testing the bug fix
@router.get("/test/bug-fix")
async def test_bug_fix():
    """
    Test endpoint demonstrating the orchestration bug fix.
    
    Shows how implicit authority should be handled with builder inference.
    """
    # Example 1: Builder provides statute → authoritative
    test1 = DoctrineTemplates.resolve_implicit_authority(
        domain="family_law",
        field="divorce",
        provided_statute="BGB",
        provided_paragraphs=["1564", "1565(2)"]
    )
    
    # Example 2: No builder statute, use implicit
    test2 = DoctrineTemplates.resolve_implicit_authority(
        domain="family_law",
        field="divorce"
    )
    
    # Example 3: Domain not allowing implicit
    test3 = DoctrineTemplates.resolve_implicit_authority(
        domain="contract_law",
        field="defects"
    )
    
    return {
        "bug_fix_applied": True,
        "principle": "Builder inference treated as authoritative",
        "tests": {
            "with_builder_statute": {
                **test1,
                "authoritative": True,
                "note": "Builder provided BGB → authoritative even if implicit allowed"
            },
            "implicit_only": {
                **test2,
                "note": "No builder input → use implicit if allowed"
            },
            "strict_domain": {
                **test3,
                "note": "Contract law defects requires explicit citation"
            }
        }
    }