"""Command line: `mlviz serve` and `mlviz demo <dir>`."""

from __future__ import annotations

import argparse
import os


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="mlviz")
    sub = parser.add_subparsers(dest="cmd", required=True)
    serve = sub.add_parser("serve", help="serve the tool for one project")
    serve.add_argument("--project", default=os.environ.get("MLVIZ_PROJECT", "."))
    serve.add_argument("--host", default=os.environ.get("MLVIZ_HOST", "127.0.0.1"))
    serve.add_argument("--port", type=int, default=int(os.environ.get("MLVIZ_PORT", "8765")))
    demo = sub.add_parser("demo", help="write a synthetic demo project")
    demo.add_argument("directory")
    args = parser.parse_args(argv)

    if args.cmd == "demo":
        from .fixture import make_project

        print(make_project(args.directory))
        return
    import uvicorn

    from .server import create_app

    uvicorn.run(create_app(args.project), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
