#!/usr/bin/env python
"""
Ponto de entrada amigável para ingestão de planilhas de telemetria.
Execução: python ingest.py [caminho_da_planilha.xlsx] [--mode upsert|replace]
"""

import sys
from ingestion.cli import main

if __name__ == "__main__":
    main()
