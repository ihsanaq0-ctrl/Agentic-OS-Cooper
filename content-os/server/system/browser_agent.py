#!/usr/bin/env python3
"""
browser_agent.py — Python Bridge for Cooper (Agentic OS)
Drives Chrome / Chromium via browser-use (CDP) for autonomous web actions,
project UI walkthroughs, clicking, typing, and deep automation.
"""

import sys
import os
import json
import argparse
from pathlib import Path

# Add browser-use repo to sys.path if not installed in site-packages
CURRENT_DIR = Path(__file__).resolve().parent
CONTENT_OS_DIR = CURRENT_DIR.parent.parent
BROWSER_USE_DIR = CONTENT_OS_DIR / "Github Repos" / "browser-use-main" / "browser-use-main"

if str(BROWSER_USE_DIR) not in sys.path:
    sys.path.insert(0, str(BROWSER_USE_DIR))

# Load .env from content-os root (without reading into conversation)
try:
    from dotenv import load_dotenv
    env_file = CONTENT_OS_DIR / ".env"
    if env_file.exists():
        load_dotenv(env_file)
except ImportError:
    pass

def get_llm(model_override=None):
    """
    Resolves the best available LLM from content-os configuration.
    Priority:
      1. GEMINI_API_KEY -> ChatGoogle (gemini-2.5-flash / gemini-1.5-flash)
      2. OPENROUTER_API_KEY -> ChatOpenAI via OpenRouter
      3. OPENAI_API_KEY -> ChatOpenAI (gpt-4o)
      4. OLLAMA_BASE_URL -> ChatOpenAI (local offline)
    """
    from browser_use import ChatGoogle, ChatOpenAI

    gemini_key = os.getenv("GEMINI_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    ollama_url = os.getenv("OLLAMA_BASE_URL")

    if gemini_key:
        model = model_override or "gemini-2.5-flash"
        return ChatGoogle(model=model, api_key=gemini_key)

    if openrouter_key:
        model = model_override or os.getenv("OPENROUTER_TEXT_MODEL", "google/gemini-2.5-flash")
        return ChatOpenAI(
            model=model,
            base_url="https://openrouter.ai/api/v1",
            api_key=openrouter_key
        )

    if openai_key:
        model = model_override or "gpt-4o"
        return ChatOpenAI(model=model, api_key=openai_key)

    if ollama_url:
        model = model_override or os.getenv("OLLAMA_MODEL", "llama3.3")
        return ChatOpenAI(
            model=model,
            base_url=ollama_url,
            api_key="ollama"
        )

    # Fallback to default
    return None

def run_task(prompt, url=None, browser_type="chromium", headless=False, duration_seconds=None, model_override=None):
    """
    Executes a browser-use task with the requested browser and options.
    """
    from browser_use import Agent, Browser

    # Construct the full prompt
    full_prompt = prompt.strip()
    if url and url not in full_prompt:
        full_prompt = f"Navigate to {url}. Then: {full_prompt}"

    if duration_seconds:
        full_prompt += f" Spend approximately {duration_seconds} seconds interacting with and demonstrating the features before finishing."

    llm = get_llm(model_override)

    # Initialize browser with fallback
    chosen_browser = (browser_type or "chromium").lower()
    try:
        browser_instance = Browser(kind=chosen_browser, headless=headless)
    except Exception as e:
        sys.stderr.write(f"[browser_agent] Failed to attach to {chosen_browser} ({e}), falling back to chromium...\n")
        browser_instance = Browser(kind="chromium", headless=headless)

    try:
        agent = Agent(
            task=full_prompt,
            llm=llm,
            browser=browser_instance,
        )

        result = agent.run_sync()
        final_text = getattr(result, "text", None) or (result.final_result() if hasattr(result, "final_result") else str(result))
        steps = getattr(result, "steps", 1)
        duration_s = getattr(result, "duration_s", 0.0)
        status = getattr(result, "status", "completed")

        return {
            "success": status == "completed",
            "result": final_text,
            "steps": steps,
            "duration_s": round(duration_s, 2),
            "status": status,
            "error": getattr(result, "error", None)
        }
    except Exception as e:
        return {
            "success": False,
            "result": None,
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description="Cooper Browser Agent runner via browser-use")
    parser.add_argument("--prompt", type=str, required=True, help="Instruction for the browser agent")
    parser.add_argument("--url", type=str, default=None, help="Initial URL to open")
    parser.add_argument("--browser", type=str, choices=["chrome", "chromium"], default="chromium", help="Browser type")
    parser.add_argument("--headless", action="store_true", default=False, help="Run browser in headless mode")
    parser.add_argument("--duration", type=int, default=None, help="Duration in seconds for interactive demos")
    parser.add_argument("--model", type=str, default=None, help="LLM model override")

    args = parser.parse_args()

    result = run_task(
        prompt=args.prompt,
        url=args.url,
        browser_type=args.browser,
        headless=args.headless,
        duration_seconds=args.duration,
        model_override=args.model
    )

    # Output JSON result for the Node.js bridge to consume
    print(json.dumps(result))

if __name__ == "__main__":
    main()
