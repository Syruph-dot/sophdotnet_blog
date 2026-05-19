from __future__ import annotations

from concurrent.futures import Future, TimeoutError
from dataclasses import dataclass
import json
import queue
import random
import shutil
import tempfile
import threading
from pathlib import Path
from typing import Callable
import zipfile

from flask import Flask, jsonify, request
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer


@dataclass(frozen=True)
class GenerationRequest:
    prompt: str
    mode: str
    history: list[dict]


class QueueFullError(RuntimeError):
    pass


class InferenceQueue:
    def __init__(self, generate: Callable[[GenerationRequest], str], *, max_queue_size: int = 1) -> None:
        self._generate = generate
        self._queue: queue.Queue[tuple[GenerationRequest | None, Future[str] | None]] = queue.Queue(
            maxsize=max_queue_size
        )
        self._thread: threading.Thread | None = None
        self._stopped = threading.Event()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stopped.clear()
        self._thread = threading.Thread(target=self._run, name="poemist-inference-worker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stopped.set()
        if self._thread and self._thread.is_alive():
            try:
                self._queue.put_nowait((None, None))
            except queue.Full:
                pass
            self._thread.join(timeout=2.0)

    def submit(self, generation_request: GenerationRequest) -> Future[str]:
        future: Future[str] = Future()
        try:
            self._queue.put_nowait((generation_request, future))
        except queue.Full as exc:
            raise QueueFullError("poemist inference queue is full") from exc
        return future

    def _run(self) -> None:
        while not self._stopped.is_set():
            generation_request, future = self._queue.get()
            if generation_request is None or future is None:
                self._queue.task_done()
                break
            if future.set_running_or_notify_cancel():
                try:
                    future.set_result(self._generate(generation_request))
                except Exception as error:
                    future.set_exception(error)
            self._queue.task_done()


def create_runtime_app(
    generate: Callable[[GenerationRequest], str],
    *,
    max_queue_size: int = 1,
    request_timeout_seconds: float = 30.0,
    bundle_path: Path | None = None,
) -> Flask:
    app = Flask(__name__)
    inference_queue = InferenceQueue(generate, max_queue_size=max_queue_size)
    inference_queue.start()
    app.config["POEMIST_QUEUE"] = inference_queue
    app.config["POEMIST_BUNDLE"] = str(bundle_path) if bundle_path else None

    @app.post("/api/generate")
    def generate_route():
        data = request.get_json(silent=True) or {}
        prompt = str(data.get("prompt") or "").strip()
        if not prompt:
            return jsonify({"error": "prompt is required"}), 400

        generation_request = GenerationRequest(
            prompt=prompt,
            mode=str(data.get("mode") or "multi"),
            history=data.get("history") if isinstance(data.get("history"), list) else [],
        )

        try:
            future = inference_queue.submit(generation_request)
        except QueueFullError:
            return jsonify({"error": "Poemist runtime is busy; please retry shortly"}), 503

        try:
            return jsonify({"completion": future.result(timeout=request_timeout_seconds)})
        except TimeoutError:
            return jsonify({"error": "Poemist runtime timed out; please retry shortly"}), 503
        except Exception as error:
            return jsonify({"error": str(error)}), 500

    @app.get("/api/health")
    def health_route():
        return jsonify({"ok": True, "bundle": app.config["POEMIST_BUNDLE"]})

    return app


def build_prefix(history: list[dict], prompt: str, mode: str) -> str:
    if mode == "single":
        return prompt

    lines: list[str] = []
    for message in history:
        text = str(message.get("text", ""))
        if message.get("role") == "user":
            lines.append(f"user: {text}")
        else:
            lines.append(text)
    lines.append(prompt)
    return "\n".join(lines)


class OnnxPoemistGenerator:
    def __init__(self, bundle_path: Path) -> None:
        self.bundle_path = Path(bundle_path).resolve()
        if not self.bundle_path.is_file():
            raise FileNotFoundError(f"Poemist model bundle does not exist: {self.bundle_path}")

        self._temp_dir = tempfile.mkdtemp(prefix="poemist-runtime-")
        self.artifact_dir = Path(self._temp_dir)
        self._extract_bundle(self.bundle_path, self.artifact_dir)

        manifest = json.loads((self.artifact_dir / "manifest.json").read_text(encoding="utf-8"))
        self._require_bundle_file(manifest["model_file"])
        self._require_bundle_file(manifest["tokenizer_file"])
        self._require_bundle_file(manifest["generation_config_file"])

        generation_config = json.loads(
            (self.artifact_dir / manifest["generation_config_file"]).read_text(encoding="utf-8")
        )
        self.max_seq_len = int(manifest["max_seq_len"])
        self.pad_id = int(manifest["pad_id"])
        self.max_new_tokens = int(generation_config["max_new_tokens"])
        self.top_k = int(generation_config["top_k"])
        self.temperature = float(generation_config["temperature"])
        self.stop_tokens = set(generation_config.get("stop_tokens", []))
        self.tokenizer = Tokenizer.from_file(str(self.artifact_dir / manifest["tokenizer_file"]))
        self.session = ort.InferenceSession(
            str(self.artifact_dir / manifest["model_file"]),
            providers=["CPUExecutionProvider"],
        )

    def close(self) -> None:
        shutil.rmtree(self._temp_dir, ignore_errors=True)

    def _extract_bundle(self, bundle_path: Path, artifact_dir: Path) -> None:
        with zipfile.ZipFile(bundle_path) as bundle:
            names = set(bundle.namelist())
            if "manifest.json" not in names:
                raise FileNotFoundError("uploaded Poemist bundle is missing manifest.json")
            bundle.extractall(artifact_dir)

    def _require_bundle_file(self, relative_path: str) -> None:
        if not (self.artifact_dir / relative_path).is_file():
            raise FileNotFoundError(f"uploaded Poemist bundle is missing {relative_path}")

    def generate(self, generation_request: GenerationRequest) -> str:
        prefix = build_prefix(generation_request.history, generation_request.prompt, generation_request.mode)
        token_ids = self.tokenizer.encode(prefix).ids
        if not token_ids:
            unk_id = self.tokenizer.token_to_id("<UNK>")
            token_ids = [unk_id if unk_id is not None else 0]

        for _ in range(self.max_new_tokens):
            prefix_ids = token_ids[-self.max_seq_len:]
            padded_ids = prefix_ids + [self.pad_id] * (self.max_seq_len - len(prefix_ids))
            input_ids = np.array([padded_ids], dtype=np.int64)
            lengths = np.array([len(prefix_ids)], dtype=np.int64)
            logits = self.session.run(["logits"], {"input_ids": input_ids, "lengths": lengths})[0][0]
            next_id = self._sample_next(logits)
            token_ids.append(next_id)
            if self.tokenizer.decode([next_id], skip_special_tokens=True) in self.stop_tokens:
                break

        full_text = self.tokenizer.decode(token_ids, skip_special_tokens=True)
        return full_text[len(prefix):] if full_text.startswith(prefix) else full_text

    def _sample_next(self, logits: np.ndarray) -> int:
        if self.temperature <= 0:
            return int(np.argmax(logits))

        scaled = logits.astype(np.float64) / self.temperature
        if 0 < self.top_k < scaled.size:
            indices = np.argpartition(scaled, -self.top_k)[-self.top_k:]
            values = scaled[indices]
        else:
            indices = np.arange(scaled.size)
            values = scaled

        values = values - np.max(values)
        probs = np.exp(values)
        probs = probs / probs.sum()
        return int(random.choices(indices.tolist(), weights=probs.tolist(), k=1)[0])
