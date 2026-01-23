# clarification.py
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from pydantic import BaseModel

router = APIRouter(prefix="/clarification", tags=["clarification"])

class ClarificationRequest(BaseModel):
    question: str
    context: Dict[str, Any]
    clarification_type: str | None = None

class ClarificationResponse(BaseModel):
    clarification_needed: bool
    clarification_question: str
    clarification_options: List[str]
    clarification_type: str

@router.post("/request", response_model=ClarificationResponse)
async def request_clarification(request: ClarificationRequest):
    """
    Request clarification for ambiguous legal questions.
    
    Args:
        request: Contains the user's question, context, and optional clarification type
        
    Returns:
        A response indicating whether clarification is needed and providing
        clarification questions/options if needed
    """
    try:
        # Basic validation
        if not request.question or not request.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty")
        
        # For now, this is a simple mock implementation
        # In a real system, you would:
        # 1. Analyze the question for ambiguity
        # 2. Check context for missing information
        # 3. Determine the type of clarification needed
        # 4. Generate appropriate clarification options
        
        # Mock logic: Always return clarification for demonstration
        # You can customize this based on the actual question/context
        clarification_type = request.clarification_type or "general_legal_area"
        
        # Different clarification types could have different questions/options
        if clarification_type == "jurisdiction":
            clarification_question = "Which jurisdiction are you referring to?"
            clarification_options = [
                "United States",
                "European Union",
                "United Kingdom",
                "Canada",
                "Australia",
                "Other"
            ]
        elif clarification_type == "legal_entity":
            clarification_question = "What type of legal entity is involved?"
            clarification_options = [
                "Individual",
                "Corporation",
                "Partnership",
                "Non-profit",
                "Government Agency"
            ]
        else:  # general_legal_area (default)
            clarification_question = "Which legal area are you referring to?"
            clarification_options = [
                "Civil Law",
                "Criminal Law", 
                "Commercial Law",
                "Data Protection Law",
                "Intellectual Property",
                "Employment Law",
                "Family Law",
                "Contract Law"
            ]
        
        return ClarificationResponse(
            clarification_needed=True,
            clarification_question=clarification_question,
            clarification_options=clarification_options,
            clarification_type=clarification_type
        )
        
    except Exception as e:
        # Log the error for debugging
        print(f"Error in request_clarification: {str(e)}")
        # Return a generic error response
        raise HTTPException(
            status_code=500, 
            detail=f"An error occurred while processing the clarification request: {str(e)}"
        )