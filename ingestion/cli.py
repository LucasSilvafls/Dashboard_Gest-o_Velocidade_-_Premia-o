"""
Interface de Linha de Comando (CLI) para Ingestão de Planilhas e Sincronização do Banco.
"""

import argparse
import sys
from pathlib import Path

# Configura encoding UTF-8 seguro para consoles Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from database.connection import get_db, init_db
from database.repository import export_dashboard_json, get_summary_stats
from ingestion.etl import TelemetryETLPipeline


def main():
    parser = argparse.ArgumentParser(
        description="Módulo de Ingestão de Planilhas Excel e Sincronização com Banco de Dados CSG"
    )
    parser.add_argument(
        "file",
        type=str,
        help="Caminho para o arquivo Excel (.xlsx) ou CSV de telemetria",
    )
    parser.add_argument(
        "--mode",
        choices=["upsert", "clean_insert", "replace"],
        default="upsert",
        help="Modo de carga: 'upsert' (atualiza existentes e insere novos) ou 'clean_insert' (limpa e insere)",
    )
    parser.add_argument(
        "--db",
        type=str,
        default=None,
        help="URL de conexão com o banco de dados (ex: sqlite:///telemetria.db ou postgresql://...)",
    )
    parser.add_argument(
        "--export-json",
        action="store_true",
        default=True,
        help="Exporta automaticamente o arquivo dashboard_data.json atualizado a partir do banco",
    )
    parser.add_argument(
        "--output-json",
        type=str,
        default="data/dashboard_data.json",
        help="Caminho de saída para o JSON do dashboard (padrão: data/dashboard_data.json)",
    )

    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        candidate_data = Path("data") / args.file
        candidate_base = Path(__file__).resolve().parent.parent / "data" / args.file
        if candidate_data.exists():
            file_path = candidate_data
        elif candidate_base.exists():
            file_path = candidate_base
        else:
            print(f"[ERRO] Arquivo não encontrado: {file_path}", file=sys.stderr)
            sys.exit(1)

    print("=" * 60)
    print(f">> INGESTAO DE TELEMETRIA CSG")
    print(f"[*] Arquivo: {file_path.name} ({file_path.stat().st_size / 1024:.1f} KB)")
    print(f"[*] Modo: {args.mode}")
    print(f"[*] Banco: {args.db or 'sqlite:///telemetria.db'}")
    print("=" * 60)

    try:
        pipeline = TelemetryETLPipeline(db_url=args.db)
        result = pipeline.ingest_file(filepath=file_path, mode=args.mode)

        print("\n[OK] INGESTAO CONCLUIDA COM SUCESSO!")
        print(f"   * Lote de Auditoria ID: {result.lote_id}")
        print(f"   * Linhas Lidas: {result.total_lidas}")
        print(f"   * Registros Inseridos: {result.inseridos}")
        print(f"   * Registros Atualizados: {result.atualizados}")
        print(f"   * Alertas de Velocidade: {result.total_velocidade}")
        print(f"   * Tempo Decorrido: {result.tempo_segundos:.2f}s")
        print(f"   * Status: {result.status}")

        if result.erros:
            print(f"   [AVISO] Avisos/Erros pontuais ({len(result.erros)}):")
            for err in result.erros:
                print(f"      - {err}")

        # Estatísticas do Banco
        with get_db(args.db) as session:
            stats = get_summary_stats(session)
            print("\n[STATS] ESTATISTICAS DO BANCO RELACIONAL:")
            print(f"   * Total de Alertas na Base: {stats['total_alertas']}")
            print(f"   * Total de Alertas de Velocidade: {stats['total_velocidade']}")
            print(f"   * Veiculos Ativos: {stats['total_veiculos']}")
            print(f"   * Condutores Registrados: {stats['total_motoristas']}")
            print(f"   * Periodo Geral: {stats['periodo']}")

            if args.export_json:
                print(f"\n[EXPORT] Exportando dados para '{args.output_json}'...")
                export_dashboard_json(session, output_path=args.output_json)
                print(f"[OK] Arquivo '{args.output_json}' gerado com sucesso a partir do banco!")

        print("\n[CONCLUIDO] Processo finalizado com exito!")

    except Exception as e:
        print(f"\n[ERRO] FALHA DURANTE A INGESTAO: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
