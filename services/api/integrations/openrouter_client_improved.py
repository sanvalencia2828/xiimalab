"""
openrouter_client.py — Xiimalab
Integration with OpenRouter API to access multiple AI models (DeepSeek, Llama, etc.).
Optimized for Premium applications with retry logic and exponential backoff.
"""

import json
import logging
import os
import random
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Configurable retry parameters
MAX_RETRIES = int(os.environ.get("OPENROUTER_MAX_RETRIES", "3"))
RETRY_DELAY_BASE = float(os.environ.get("OPENROUTER_RETRY_DELAY_BASE", "1.0"))
MAX_RETRY_DELAY = float(os.environ.get("OPENROUTER_MAX_RETRY_DELAY", "60.0"))


class OpenRouterClient:
    def __init__(self, api_key: str = OPENROUTER_API_KEY):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://xiimalab.ai",
            "X-Title": "Xiimalab",
        }

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        **kwargs
    ) -> Optional[httpx.Response]:
        """Executes HTTP request with exponential backoff retry and jitter."""
        last_exception = None

        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.request(method, url, **kwargs)

                    # Retry on server errors (5xx) and rate limiting (429)
                    if resp.status_code < 500 and resp.status_code != 429:
                        return resp

                    logger.warning(f"Attempt {attempt + 1}: HTTP {resp.status_code}, retrying...")

            except httpx.TimeoutException as exc:
                logger.warning(f"Attempt {attempt + 1}: Timeout, retrying...")
                last_exception = exc
            except httpx.ConnectError as exc:
                logger.warning(f"Attempt {attempt + 1}: Connection error {exc}, retrying...")
                last_exception = exc
            except httpx.RequestError as exc:
                logger.warning(f"Attempt {attempt + 1}: Request error {exc}, retrying...")
                last_exception = exc
            except Exception as exc:
                logger.error(f"Unexpected error on attempt {attempt + 1}: {exc}")
                last_exception = exc
                # For unexpected errors, we might want to stop retrying
                if attempt == MAX_RETRIES - 1:
                    break

            # Calculate delay with exponential backoff and jitter
            if attempt < MAX_RETRIES - 1:
                # Exponential backoff: base_delay * (2^attempt)
                delay = RETRY_DELAY_BASE * (2 ** attempt)
                # Cap the delay to prevent excessive waits
                delay = min(delay, MAX_RETRY_DELAY)
                # Add jitter: delay ± 25%
                jitter = random.uniform(-0.25, 0.25) * delay
                delay = max(0.1, delay + jitter)  # Minimum 0.1 seconds

                logger.info(f"Waiting {delay:.2f}s before retry {attempt + 2}")
                import asyncio
                await asyncio.sleep(delay)

        # Log final failure
        logger.error("All retries exhausted for OpenRouter request")
        if last_exception:
            logger.error(f"Last exception: {last_exception}")

        return None

    async def complete(
        self,
        messages: List[Dict[str, str]],
        model: str = "deepseek/deepseek-chat",
        max_tokens: int = 1000,
        temperature: float = 0.7,
    ) -> Optional[str]:
        """
        Sends a chat completion request to OpenRouter with retry logic.
        """
        if not self.api_key:
            logger.error("OPENROUTER_API_KEY not set")
            return None

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        resp = await self._request_with_retry(
            "POST",
            OPENROUTER_URL,
            headers=self.headers,
            json=payload
        )

        if not resp:
            logger.error("All retries exhausted for OpenRouter request")
            return None

        try:
            resp.raise_for_status()
            data = resp.json()

            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"]

            logger.warning("OpenRouter response did not contain choices: %s", data)
            return None

        except httpx.HTTPStatusError as exc:
            logger.error("OpenRouter API error: %s - %s", exc.response.status_code, exc.response.text)
            return None
        except Exception as exc:
            logger.error("Unexpected error connecting to OpenRouter: %s", exc)
            return None

    async def complete_json(
        self,
        messages: List[Dict[str, str]],
        model: str = "deepseek/deepseek-chat",
        max_tokens: int = 1000,
    ) -> Optional[Dict[str, Any]]:
        """
        Attempts to get a JSON response and parse it.
        """
        content = await self.complete(messages, model, max_tokens)
        if not content:
            return None

        try:
            # Basic cleanup in case of markdown blocks
            clean_content = content.replace("```json", "").replace("```", "").strip()
            return json.loads(clean_content)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse JSON from OpenRouter: %s", exc)
            logger.debug("Raw content: %s", content)
            return None