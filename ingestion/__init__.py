"""
Pacote do Módulo de Ingestão de Planilhas da Telemetria CSG.
"""

from ingestion.cleaner import (
    calculate_risk_level,
    compute_alert_hash,
    fix_coord,
    fix_text_encoding,
    format_duration_str,
    normalize_category,
    normalize_driver_name,
    parse_date_value,
    parse_num_clean,
    parse_sec,
    parse_time_value,
)
from ingestion.etl import (
    IngestionResult,
    TelemetryETLPipeline,
    compute_file_hash,
    ingest_spreadsheet,
)
from ingestion.excel_reader import (
    ExcelTelemetryReader,
    map_columns,
    normalize_header_text,
    read_excel_telemetry,
)

__all__ = [
    "ExcelTelemetryReader",
    "read_excel_telemetry",
    "map_columns",
    "normalize_header_text",
    "parse_num_clean",
    "parse_sec",
    "format_duration_str",
    "fix_coord",
    "parse_date_value",
    "parse_time_value",
    "normalize_driver_name",
    "normalize_category",
    "calculate_risk_level",
    "compute_alert_hash",
    "TelemetryETLPipeline",
    "ingest_spreadsheet",
    "IngestionResult",
    "compute_file_hash",
]
