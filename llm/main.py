import os
import time
import json
import re
import ast
import torch
import logging
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
from threading import Thread
import uvicorn

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("llm-service")

app = FastAPI(title="EPCFlow LLM Inference Service")

class LLMRequest(BaseModel):
    ocr_json: Dict[str, Any]

class LLMAgent:
    def __init__(self, model_id="Qwen/Qwen3-1.7B"):
        logger.info(f"Loading model: {model_id} (CPU Mode)...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_id, device_map="cpu", torch_dtype=torch.float32,
            trust_remote_code=True, low_cpu_mem_usage=True
        )
        logger.info("Model loaded successfully.")

    def _extract_full_text(self, full_ocr_json: Dict[str, Any]) -> str:
        full_text = ""
        for page in full_ocr_json.get("pages", []):
            full_text += f"\n--- Page {page.get('page')} ---\n"
            for row in page.get("rows", []):
                full_text += row.get("rendered_line", "") + "\n"
        return full_text

    def _clean_response(self, raw_response: str) -> str:
        """Extracts the first complete JSON object from noisy model output."""
        text = (raw_response or "").strip()
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()
        text = text.replace("```json", "```").replace("```JSON", "```")

        fenced = re.search(r"```(?:\s*)(\{.*?\})(?:\s*)```", text, flags=re.DOTALL)
        if fenced:
            return fenced.group(1).strip()

        start_idx = text.find("{")
        if start_idx == -1:
            return text

        depth = 0
        in_string = False
        escaped = False
        for idx in range(start_idx, len(text)):
            char = text[idx]
            if escaped:
                escaped = False
                continue
            if char == "\\":
                escaped = True
                continue
            if char == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return text[start_idx:idx + 1].strip()

        return text[start_idx:].strip()

    def _repair_json_heuristics(self, json_text: str) -> str:
        """Repairs common model JSON mistakes without changing valid JSON."""
        repaired = json_text.strip()
        repaired = repaired.replace("\u201c", '"').replace("\u201d", '"')
        repaired = repaired.replace("\u2018", "'").replace("\u2019", "'")
        repaired = re.sub(r"//.*?$", "", repaired, flags=re.MULTILINE)
        repaired = re.sub(r"/\*.*?\*/", "", repaired, flags=re.DOTALL)
        repaired = re.sub(r",\s*([}\]])", r"\1", repaired)
        repaired = self._quote_unquoted_json_keys(repaired)
        repaired = self._close_incomplete_json(repaired)
        
        chars = []
        in_string = False
        escaped = False
        for char in repaired:
            if escaped:
                chars.append(char)
                escaped = False
                continue
            if char == "\\":
                chars.append(char)
                escaped = True
                continue
            if char == '"':
                chars.append(char)
                in_string = not in_string
                continue
            if char == "\n" and in_string:
                chars.append("\\n")
                continue
            chars.append(char)
        return "".join(chars)

    def _quote_unquoted_json_keys(self, json_text: str) -> str:
        chars = []
        in_string = False
        escaped = False
        idx = 0
        while idx < len(json_text):
            char = json_text[idx]
            if escaped:
                chars.append(char)
                escaped = False
                idx += 1
                continue
            if char == "\\":
                chars.append(char)
                escaped = True
                idx += 1
                continue
            if char == '"':
                chars.append(char)
                in_string = not in_string
                idx += 1
                continue
            if not in_string and char in "{,":
                chars.append(char)
                idx += 1
                while idx < len(json_text) and json_text[idx].isspace():
                    chars.append(json_text[idx])
                    idx += 1
                key_start = idx
                if idx < len(json_text) and re.match(r"[A-Za-z_]", json_text[idx]):
                    idx += 1
                    while idx < len(json_text) and re.match(r"[A-Za-z0-9_ -]", json_text[idx]):
                        idx += 1
                    key = json_text[key_start:idx].strip()
                    lookahead = idx
                    while lookahead < len(json_text) and json_text[lookahead].isspace():
                        lookahead += 1
                    if key and lookahead < len(json_text) and json_text[lookahead] == ":":
                        chars.append(json.dumps(key))
                        idx = lookahead
                        continue
                    chars.append(json_text[key_start:idx])
                    continue
                continue
            chars.append(char)
            idx += 1
        return "".join(chars)

    def _close_incomplete_json(self, json_text: str) -> str:
        stack = []
        in_string = False
        escaped = False
        for char in json_text:
            if escaped:
                escaped = False
                continue
            if char == "\\":
                escaped = True
                continue
            if char == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if char == "{":
                stack.append("}")
            elif char == "[":
                stack.append("]")
            elif char in "}]":
                if stack and stack[-1] == char:
                    stack.pop()
        if in_string:
            json_text += '"'
        return json_text + "".join(reversed(stack))

    def _parse_python_literal_response(self, json_text: str) -> Dict[str, Any]:
        parsed = ast.literal_eval(json_text)
        if not isinstance(parsed, dict):
            raise ValueError("Parsed literal is not an object")
        return parsed

    def _parse_json_response(self, raw_response: str) -> Dict[str, Any]:
        cleaned = self._clean_response(raw_response)
        if "{" not in cleaned:
            raise ValueError("No JSON object found in model response")
        decoder = json.JSONDecoder()
        candidates = [
            cleaned[cleaned.find("{"):],
            self._repair_json_heuristics(cleaned[cleaned.find("{"):]),
        ]
        last_error = None
        for candidate in candidates:
            try:
                parsed, _ = decoder.raw_decode(candidate)
                return parsed
            except Exception as exc:
                last_error = exc
            try:
                return self._parse_python_literal_response(candidate)
            except Exception as exc:
                last_error = exc
        raise last_error or ValueError("Unable to parse JSON response")

    def infer(self, full_ocr_json: Dict[str, Any]) -> Dict[str, Any]:
        start_time = time.time()
        full_text = self._extract_full_text(full_ocr_json)
        
        system_instruction = (
            "You are a document field allocation engine. "
            "Read the OCR text in order and map each visible label/value pair to the correct semantic key. "
            "Return ONLY valid JSON. Do not include markdown, comments, explanations, or thinking text. "
            "The response must start with { and end with }. "
            "Return exactly this top-level shape: { \"extracted_fields\": { ... } }. "
        )
        user_prompt = (
            "Allocate the OCR text below into the correct extracted_fields keys.\n\n"
            f"OCR TEXT:\n{full_text}"
        )

        messages = [{"role": "system", "content": system_instruction}, {"role": "user", "content": user_prompt}]
        text = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        model_inputs = self.tokenizer([text], return_tensors="pt").to("cpu")
        
        streamer = TextIteratorStreamer(self.tokenizer, skip_prompt=True, skip_special_tokens=True)
        generate_kwargs = dict(
            **model_inputs,
            streamer=streamer,
            max_new_tokens=384,
            do_sample=False,
            repetition_penalty=1.05,
        )
        
        thread = Thread(target=self.model.generate, kwargs=generate_kwargs)
        thread.start()
        response_text = "".join(list(streamer))
        thread.join()
        
        try:
            return self._parse_json_response(response_text)
        except Exception as e:
            logger.error(f"Inference parsing failed: {e}")
            raise e

# Global agent instance
agent = None

@app.on_event("startup")
def startup_event():
    global agent
    agent = LLMAgent()

@app.post("/infer")
async def infer(request: LLMRequest):
    try:
        result = agent.infer(request.ocr_json)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
