from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)


class ResponseParser:
    def parse(self, response_content: str) -> dict:
        if not response_content or not response_content.strip():
            raise ValueError("Empty response from LLM")

        text = response_content.strip()

        # 1. Direct JSON parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 2. Extract from ```json ... ``` code block
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.find("```", start)
            if end != -1:
                try:
                    return json.loads(text[start:end].strip())
                except json.JSONDecodeError:
                    pass

        # 3. Extract from ``` ... ``` code block
        if "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            if end != -1:
                try:
                    return json.loads(text[start:end].strip())
                except json.JSONDecodeError:
                    pass

        # 4. Find JSON by matching braces
        start_idx = text.find("{")
        if start_idx != -1:
            brace_count = 0
            for i in range(start_idx, len(text)):
                if text[i] == "{":
                    brace_count += 1
                elif text[i] == "}":
                    brace_count -= 1
                    if brace_count == 0:
                        try:
                            return json.loads(text[start_idx : i + 1])
                        except json.JSONDecodeError:
                            break

        raise ValueError(f"Could not parse JSON from response: {text[:200]}")
