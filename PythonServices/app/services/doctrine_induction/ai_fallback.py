"""
AI Doctrine Fallback
====================
Called when a doctrine name has no entry in the hardcoded DOCTRINES dict inside
get_doctrine_explanation().

Provider chain (tried in order):
  1. DeepSeek Chat  (deepseek-chat model)  — DEEPSEEK_API_KEY
  2. Google Gemini Flash                   — GEMINI_API_KEY

Each provider returns the same dict shape as get_doctrine_explanation():
  {type, domain, explanation (str), sources (list), ai_source (str)}

Returns None if both providers fail or neither key is configured.
"""
import os
from typing import Optional

import httpx

# ---------------------------------------------------------------------------
# Configuration (loaded once at import time; service restart picks up changes)
# ---------------------------------------------------------------------------
_DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
_DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
_GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

_TIMEOUT = 20.0  # seconds per provider

# ---------------------------------------------------------------------------
# Shared prompt template
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = (
    "Du bist ein deutscher Rechtsprofessor und beantwortest eine vollständig eigenständige "
    "Rechtsfrage. Es gibt KEINEN vorherigen Gesprächskontext, KEINE hochgeladenen Texte, "
    "KEINE angehängten Dokumente und KEINE zuvor gestellten Fragen. "
    "Antworte ausschließlich auf Basis deines juristischen Fachwissens. "
    "Erkläre die angefragte Rechtsdoktrin präzise und auf Examens-Niveau in Markdown. "
    "Gliedere die Antwort in: (1) Begriff/Definition, (2) gesetzliche Grundlage mit §§-Angaben, "
    "(3) Voraussetzungen/Tatbestand, (4) Rechtsfolge. Zitiere stets die einschlägigen Paragraphen."
)

def _build_user_prompt(doctrine_name: str, language: str) -> str:
    lang_note = "" if language == "german" else " (Please answer in English.)"
    return (
        f"Gib eine vollständige rechtliche Erklärung zum deutschen Rechtsbegriff "
        f"'{doctrine_name}' aus eigenem juristischen Fachwissen "
        f"(kein Bezug auf Dokumente oder Gesprächshistorie).{lang_note}"
    )


# ---------------------------------------------------------------------------
# Provider 1: DeepSeek Chat
# ---------------------------------------------------------------------------
async def _call_deepseek(doctrine_name: str, language: str) -> Optional[dict]:
    """Call DeepSeek Chat API. Returns result dict or None on any failure."""
    if not _DEEPSEEK_API_KEY:
        return None

    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": _build_user_prompt(doctrine_name, language)},
        ],
        "max_tokens": 900,
        "temperature": 0.15,
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                f"{_DEEPSEEK_BASE_URL}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {_DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            text: str = data["choices"][0]["message"]["content"].strip()

        print(f"📚 [DoctrineAI] DeepSeek answered for '{doctrine_name}' ({len(text)} chars)")
        return {
            "type": "RULE",
            "domain": "ai_generated",
            "explanation": text,
            "sources": [],
            "ai_source": "deepseek",
        }

    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        # 429 = quota exceeded, 402 = payment required — don't log body, just status
        print(f"⚠️  [DoctrineAI] DeepSeek HTTP {status} for '{doctrine_name}' — trying Gemini")
        return None
    except Exception as exc:
        print(f"⚠️  [DoctrineAI] DeepSeek error for '{doctrine_name}': {exc!r} — trying Gemini")
        return None


# ---------------------------------------------------------------------------
# Provider 2: Google Gemini Flash
# ---------------------------------------------------------------------------
_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/gemini-1.5-flash:generateContent"
)

async def _call_gemini(doctrine_name: str, language: str) -> Optional[dict]:
    """Call Gemini Flash API. Returns result dict or None on any failure."""
    if not _GEMINI_API_KEY:
        return None

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{_SYSTEM_PROMPT}\n\n{_build_user_prompt(doctrine_name, language)}"}
                ]
            }
        ],
        "generationConfig": {
            "maxOutputTokens": 900,
            "temperature": 0.15,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(
                _GEMINI_URL,
                params={"key": _GEMINI_API_KEY},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            text: str = (
                data["candidates"][0]["content"]["parts"][0]["text"].strip()
            )

        print(f"📚 [DoctrineAI] Gemini answered for '{doctrine_name}' ({len(text)} chars)")
        return {
            "type": "RULE",
            "domain": "ai_generated",
            "explanation": text,
            "sources": [],
            "ai_source": "gemini",
        }

    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        print(f"⚠️  [DoctrineAI] Gemini HTTP {status} for '{doctrine_name}'")
        return None
    except Exception as exc:
        print(f"⚠️  [DoctrineAI] Gemini error for '{doctrine_name}': {exc!r}")
        return None


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
async def get_ai_doctrine_explanation(
    doctrine_name: str,
    language: str = "german",
) -> Optional[dict]:
    """
    Try DeepSeek (primary) then Gemini (fallback).

    Returns the same shape as get_doctrine_explanation():
        {type, domain, explanation (str), sources (list), ai_source (str)}

    Returns None if both providers fail or neither API key is set.
    """
    result = await _call_deepseek(doctrine_name, language)
    if result is not None:
        return result

    result = await _call_gemini(doctrine_name, language)
    if result is not None:
        return result

    print(f"❌ [DoctrineAI] Both providers failed for '{doctrine_name}'")
    return None
