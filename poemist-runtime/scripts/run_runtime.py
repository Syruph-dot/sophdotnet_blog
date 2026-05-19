"""Run the Sophdotnet Poemist inference service.

This process loads the committed data/poemist/poemist.poemist bundle and exposes
the local API that app.js proxies at /poemist/api/generate.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parents[1] / "src"
DEFAULT_BUNDLE = ROOT / "data" / "poemist" / "poemist.poemist"

if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from poemist_runtime import OnnxPoemistGenerator, create_runtime_app


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the committed Poemist model bundle.")
    parser.add_argument("--bundle", type=Path, default=DEFAULT_BUNDLE)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--max-queue", type=int, default=1)
    parser.add_argument("--timeout", type=float, default=30.0)
    args = parser.parse_args()

    generator = OnnxPoemistGenerator(args.bundle)
    app = create_runtime_app(
        generator.generate,
        max_queue_size=args.max_queue,
        request_timeout_seconds=args.timeout,
        bundle_path=generator.bundle_path,
    )
    app.run(host=args.host, port=args.port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
