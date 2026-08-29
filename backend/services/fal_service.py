"""
services/fal_service.py

Generates a visual asset (moodboard / mockup image) via Fal.ai Flux Schnell.
"""

from services.clients import FAL_KEY, FAL_MODEL, MissingAPIKeyError, UpstreamServiceError
import fal_client


def generate_visual_asset(prompt: str) -> str:
    """
    Submit `prompt` to fal-ai/flux/schnell and return the generated image URL.
    Blocking (fal_client.subscribe polls synchronously) — call via
    starlette.concurrency.run_in_threadpool from the route handler.

    Raises MissingAPIKeyError / UpstreamServiceError on failure; callers
    decide how to respond (HTTPException vs. mock fallback).
    """
    if not FAL_KEY:
        raise MissingAPIKeyError("FAL_KEY is not configured.")

    try:
        result = fal_client.subscribe(
            FAL_MODEL,
            arguments={
                "prompt": prompt,
                "image_size": "landscape_16_9",
                "num_inference_steps": 4,
            },
        )
    except Exception as exc:
        raise UpstreamServiceError(f"Fal.ai request failed: {exc}") from exc

    images = result.get("images") or []
    if not images or not images[0].get("url"):
        raise UpstreamServiceError(f"Fal.ai response did not contain an image URL: {result}")

    return images[0]["url"]
