#!/usr/bin/env python
"""
Script de inicialização do servidor de API FastAPI CSG Telemetria.
Execução:
    python server.py
    python server.py --port 8000 --reload
"""

import argparse
import sys
import uvicorn

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Inicia o servidor de API FastAPI de Telemetria e Velocidades CSG"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="0.0.0.0",
        help="Endereço de escuta do servidor (padrão: 0.0.0.0)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Porta TCP do servidor (padrão: 8000)",
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Ativa recarregamento automático ao alterar código (desenvolvimento)",
    )

    args = parser.parse_args()

    print("=" * 65)
    print(">> SERVIDOR BACKEND API - CASAGRANDE CSG")
    print(f"[*] Escutando em: http://{args.host}:{args.port}")
    print(f"[*] Documentacao Swagger UI: http://localhost:{args.port}/docs")
    print(f"[*] Documentacao ReDoc:      http://localhost:{args.port}/redoc")
    print(f"[*] Health Check:            http://localhost:{args.port}/api/health")
    print("=" * 65)

    uvicorn.run(
        "backend.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )
