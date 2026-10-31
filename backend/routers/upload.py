"""
Router de Upload e Ingestão de Novas Planilhas de Telemetria.
Protegido por RBAC: Exclusivo para usuários com papel 'admin'.
Aciona o pipeline ETL da Task 1 e atualiza o banco de dados relacional.
"""

import shutil
import time
from pathlib import Path
from typing import List, Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from backend.config import (
    ALLOWED_EXTENSIONS,
    BASE_DIR,
    DATA_DIR,
    DATABASE_URL,
    MAX_UPLOAD_SIZE_BYTES,
    UPLOAD_DIR,
)
from backend.dependencies import (
    get_db_session,
    require_admin,
    require_viewer_or_admin,
)
from backend.schemas.ingestion import LoteResponse, UploadResultResponse
from database.models import Usuario
from database.repository import export_dashboard_json, get_lotes_history
from ingestion.etl import TelemetryETLPipeline

router = APIRouter(prefix="/upload", tags=["Upload & Ingestão de Planilhas"])


@router.post(
    "",
    response_model=UploadResultResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload e ingestão de nova planilha de telemetria (Apenas Admin)",
    description=(
        "Endpoint restrito para envio de planilhas nos formatos Excel (.xlsx, .xls) ou CSV. "
        "Apenas usuários com papel **admin** têm permissão para acessar esta rota. "
        "Usuários com perfil **viewer** recebem HTTP 403 Forbidden. "
        "O arquivo é processado pelo pipeline ETL da Task 1 com auditoria, normalização e upsert idempotente."
    ),
)
async def upload_telemetry_spreadsheet(
    file: UploadFile = File(..., description="Arquivo de planilha Excel (.xlsx, .xls) ou CSV"),
    mode: Literal["upsert", "clean_insert", "replace"] = Query(
        "upsert",
        description="Modo de carga: 'upsert' (atualiza e insere) ou 'clean_insert'/'replace' (limpa alertas e recarrega)",
    ),
    export_json: bool = Query(
        True,
        description="Atualiza automaticamente o arquivo estático dashboard_data.json após o banco",
    ),
    current_admin: Usuario = Depends(require_admin),
    session: Session = Depends(get_db_session),
) -> UploadResultResponse:
    """Processa upload seguro de planilhas e dispara o pipeline ETL."""
    # 1. Validação de extensão do arquivo
    original_filename = file.filename or "planilha_sem_nome.xlsx"
    file_ext = Path(original_filename).suffix.lower()

    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Formato de arquivo não suportado: '{file_ext}'. "
                f"Envie uma planilha com uma das seguintes extensões: {list(ALLOWED_EXTENSIONS)}"
            ),
        )

    # 2. Gravação do arquivo temporário com segurança
    timestamp_prefix = int(time.time())
    safe_filename = f"{timestamp_prefix}_{original_filename.replace(' ', '_')}"
    destination_path = UPLOAD_DIR / safe_filename

    total_bytes = 0
    try:
        with open(destination_path, "wb") as buffer:
            while chunk := await file.read(1024 * 64):  # 64 KB chunks
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Arquivo excede o limite máximo permitido de {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB.",
                    )
                buffer.write(chunk)
    except HTTPException:
        if destination_path.exists():
            destination_path.unlink()
        raise
    except Exception as e:
        if destination_path.exists():
            destination_path.unlink()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao salvar arquivo no servidor: {str(e)}",
        )

    # 3. Execução do Pipeline ETL (Task 1)
    try:
        pipeline = TelemetryETLPipeline(db_url=DATABASE_URL)
        result = pipeline.ingest_file(filepath=destination_path, mode=mode)

        # Opcional: sincroniza exportação do dashboard_data.json na pasta data/
        if export_json:
            export_dashboard_json(session, output_path=str(DATA_DIR / "dashboard_data.json"))

        return UploadResultResponse(
            arquivo=original_filename,
            lote_id=result.lote_id,
            modo=result.modo,
            total_lidas=result.total_lidas,
            inseridos=result.inseridos,
            atualizados=result.atualizados,
            total_velocidade=result.total_velocidade,
            tempo_segundos=round(result.tempo_segundos, 2),
            status=result.status,
            erros=result.erros,
            uploaded_by=current_admin.username,
            message=f"Planilha '{original_filename}' processada e banco de dados sincronizado com sucesso.",
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erro durante a execução do pipeline ETL: {str(err)}",
        )


@router.get(
    "/lotes",
    response_model=List[LoteResponse],
    summary="Histórico de auditoria dos lotes de ingestão",
    description="Exibe os lotes de planilhas processados, quantidades de linhas, registros inseridos/atualizados e status.",
)
def list_ingestion_batches(
    limit: int = Query(50, ge=1, le=200, description="Limite de registros retornados"),
    _user: Usuario = Depends(require_viewer_or_admin),
    session: Session = Depends(get_db_session),
) -> List[LoteResponse]:
    """Retorna histórico de auditoria dos lotes ingeridos."""
    lotes = get_lotes_history(session, limit=limit)
    return [LoteResponse(**l) for l in lotes]
