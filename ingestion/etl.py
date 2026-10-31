"""
Módulo de Pipeline ETL (Extract, Transform, Load) para Telemetria.
Executa ingestão validada, resolução referencial (Veículos, Motoristas)
e carga com suporte a Upsert Idempotente ou Inserção Limpa.
"""

import hashlib
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from database.connection import get_db, init_db
from database.models import Alerta, LoteIngestao, Motorista, Veiculo
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
from ingestion.excel_reader import read_excel_telemetry


@dataclass
class IngestionResult:
    """Resultado estruturado da execução do pipeline ETL."""
    arquivo: str
    lote_id: int
    modo: str
    total_lidas: int
    inseridos: int
    atualizados: int
    total_velocidade: int
    tempo_segundos: float
    status: str
    erros: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "arquivo": self.arquivo,
            "lote_id": self.lote_id,
            "modo": self.modo,
            "total_lidas": self.total_lidas,
            "inseridos": self.inseridos,
            "atualizados": self.atualizados,
            "total_velocidade": self.total_velocidade,
            "tempo_segundos": round(self.tempo_segundos, 2),
            "status": self.status,
            "erros": self.erros,
        }


def compute_file_hash(filepath: Union[str, Path]) -> str:
    """Gera hash SHA-256 do arquivo físico para controle de duplicidade de ingestão."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class TelemetryETLPipeline:
    """
    Pipeline principal para Ingestão e Processamento de dados de telemetria da Casagrande.
    """

    def __init__(self, db_url: Optional[str] = None, batch_size: int = 1000):
        self.db_url = db_url
        self.batch_size = batch_size

    def ingest_file(
        self,
        filepath: Union[str, Path],
        mode: str = "upsert",
        sheet_name: Optional[Union[str, int]] = 0,
    ) -> IngestionResult:
        """
        Executa o pipeline completo:
        1. Leitura e validação da planilha (.xlsx / .xls)
        2. Registro do Lote de Auditoria
        3. Normalização e Higienização de dados
        4. Upsert / Inserção limpa no banco de dados relacional
        5. Atualização de estatísticas do lote
        """
        start_time = time.time()
        file_path = Path(filepath)
        if not file_path.exists():
            raise FileNotFoundError(f"Arquivo não localizado: {file_path}")

        file_size = file_path.stat().st_size
        file_hash = compute_file_hash(file_path)

        # 1. Leitura da planilha
        df_raw, info = read_excel_telemetry(file_path, sheet_name=sheet_name)
        total_rows = len(df_raw)

        # Garante inicialização das tabelas no banco de dados configurado
        init_db(self.db_url)

        with get_db(self.db_url) as session:
            try:
                # Se for modo de substituição total limpa
                if mode in ("clean_insert", "replace"):
                    session.query(Alerta).delete()
                    session.flush()

                # Cria registro do lote
                lote = LoteIngestao(
                    nome_arquivo=file_path.name,
                    tamanho_bytes=file_size,
                    hash_arquivo=file_hash,
                    total_linhas_lidas=total_rows,
                    status="PROCESSANDO",
                )
                session.add(lote)
                session.flush()

                lote_id = lote.id
                inserted_count = 0
                updated_count = 0
                speed_count = 0
                errors = []

                # Caches em memória para evitar queries repetidas de Veículo e Motorista
                veiculos_cache: Dict[str, Veiculo] = {
                    v.placa: v for v in session.scalars(select(Veiculo)).all()
                }
                motoristas_cache: Dict[str, Motorista] = {
                    m.nome: m for m in session.scalars(select(Motorista)).all()
                }

                # Dicionário de registros únicos por hash_id para deduplicação interna da planilha
                rows_data = df_raw.to_dict(orient="records")
                unique_records: Dict[str, Dict[str, Any]] = {}

                for row in rows_data:
                    try:
                        rec_dict, is_vel = self._transform_row(
                            row, session, veiculos_cache, motoristas_cache, lote_id
                        )
                        if rec_dict:
                            h = rec_dict["hash_id"]
                            if h in unique_records:
                                # Linha duplicada na mesma planilha: atualiza dados mantendo unicidade
                                unique_records[h].update(rec_dict)
                            else:
                                unique_records[h] = rec_dict
                                if is_vel:
                                    speed_count += 1
                    except Exception as e:
                        errors.append(f"Erro linha: {str(e)[:100]}")

                chunked_records = list(unique_records.values())

                # Processamento em lotes dos registros transformados
                for i in range(0, len(chunked_records), self.batch_size):
                    batch = chunked_records[i : i + self.batch_size]
                    ins, upd = self._save_batch(session, batch, mode)
                    inserted_count += ins
                    updated_count += upd

                # Atualiza status e métricas do lote
                elapsed = time.time() - start_time
                lote.total_alertas_inseridos = inserted_count
                lote.total_alertas_atualizados = updated_count
                lote.total_alertas_velocidade = speed_count
                lote.tempo_execucao_segundos = round(elapsed, 2)
                lote.status = "SUCESSO" if not errors else ("PARCIAL" if inserted_count > 0 else "ERRO")
                if errors:
                    lote.mensagem_erro = f"{len(errors)} erros durante o processamento. Primeiro: {errors[0]}"

                session.commit()
            except Exception as exc:
                session.rollback()
                try:
                    with get_db(self.db_url) as err_session:
                        err_lote = LoteIngestao(
                            nome_arquivo=file_path.name,
                            tamanho_bytes=file_size,
                            hash_arquivo=file_hash,
                            total_linhas_lidas=total_rows,
                            status="ERRO",
                            mensagem_erro=str(exc)[:500],
                            tempo_execucao_segundos=round(time.time() - start_time, 2),
                        )
                        err_session.add(err_lote)
                        err_session.commit()
                except Exception:
                    pass
                raise

            return IngestionResult(
                arquivo=file_path.name,
                lote_id=lote_id,
                modo=mode,
                total_lidas=total_rows,
                inseridos=inserted_count,
                atualizados=updated_count,
                total_velocidade=speed_count,
                tempo_segundos=elapsed,
                status=lote.status,
                erros=errors[:5],
            )

    def _transform_row(
        self,
        row: Dict[str, Any],
        session: Session,
        veiculos_cache: Dict[str, Veiculo],
        motoristas_cache: Dict[str, Motorista],
        lote_id: int,
    ) -> Tuple[Optional[Dict[str, Any]], bool]:
        """Transforma e higieniza uma linha bruta em um dicionário compatível com Alerta."""
        placa_raw = str(row.get("PLACA") or "").strip().upper()
        if not placa_raw or placa_raw == "-" or placa_raw == "NAN":
            return None, False

        tipo_raw = str(row.get("TIPO") or "").strip().upper()
        if not tipo_raw or tipo_raw == "NAN":
            return None, False

        # Categoria do veículo
        categoria = normalize_category(row.get("CATEGORIA"))
        prefixo = fix_text_encoding(row.get("PREFIXO")) or None
        uo = fix_text_encoding(row.get("UO")) or "CASAGRANDE"

        # Resolução de Veículo no cache/banco
        if placa_raw not in veiculos_cache:
            novo_veiculo = Veiculo(
                placa=placa_raw, prefixo=prefixo, categoria=categoria, uo=uo
            )
            session.add(novo_veiculo)
            session.flush()
            veiculos_cache[placa_raw] = novo_veiculo
        else:
            veiculo_existente = veiculos_cache[placa_raw]
            if categoria != "Não Classificado" and veiculo_existente.categoria == "Não Classificado":
                veiculo_existente.categoria = categoria

        veiculo_id = veiculos_cache[placa_raw].id

        # Motorista
        motorista_nome = normalize_driver_name(row.get("MOTORISTA"))
        cpf_val = fix_text_encoding(row.get("CPF")) or None
        if cpf_val in ("-", "N/I", "nan"):
            cpf_val = None

        if motorista_nome not in motoristas_cache:
            novo_motorista = Motorista(nome=motorista_nome, cpf=cpf_val)
            session.add(novo_motorista)
            session.flush()
            motoristas_cache[motorista_nome] = novo_motorista
        else:
            if cpf_val and not motoristas_cache[motorista_nome].cpf:
                motoristas_cache[motorista_nome].cpf = cpf_val

        motorista_id = motoristas_cache[motorista_nome].id

        # Métricas numéricas
        vel = parse_num_clean(row.get("EXCESSO"))
        lim = parse_num_clean(row.get("LIMIAR"))
        dur_sec = parse_sec(row.get("DURACAO"))
        dur_str = format_duration_str(dur_sec)

        delta = round(vel - lim, 1) if (vel is not None and lim is not None) else 0.0
        pct = round((delta / lim) * 100, 1) if (lim and lim > 0) else 0.0

        # Nível de risco
        nivel = calculate_risk_level(row.get("NIVEL"), delta)

        # Coordenadas
        lat = fix_coord(row.get("LATITUDE"), is_lat=True)
        lon = fix_coord(row.get("LONGITUDE"), is_lat=False)

        # Data e Hora
        data_evento = parse_date_value(row.get("DATA"))
        hora_str, hour_int = parse_time_value(row.get("HORA"))

        # Combinação DateTime
        data_hora = None
        if data_evento:
            try:
                parts = hora_str.split(":")
                h, m, s = int(parts[0]), int(parts[1]), int(parts[2])
                data_hora = datetime(
                    data_evento.year, data_evento.month, data_evento.day, h, m, s
                )
            except Exception:
                pass

        # Textos higienizados
        logradouro = fix_text_encoding(row.get("LOGRADOURO")) or "Não Informado"
        cidade = fix_text_encoding(row.get("CIDADE")) or "Não Informada"
        estado = fix_text_encoding(row.get("ESTADO")) or "MS"

        # Flag de excesso de velocidade
        is_velocidade = ("VELOCIDADE" in tipo_raw) and ("RPM" not in tipo_raw)

        # Hash SHA-256 para upsert idempotente
        data_str = data_evento.strftime("%Y-%m-%d") if data_evento else "NO_DATE"
        hash_id = compute_alert_hash(
            placa=placa_raw,
            tipo=tipo_raw,
            data_str=data_str,
            hora_str=hora_str,
            velocidade=vel,
            duracao_sec=dur_sec,
            lat=lat,
            lng=lon,
        )

        rec = {
            "hash_id": hash_id,
            "veiculo_id": veiculo_id,
            "motorista_id": motorista_id,
            "lote_id": lote_id,
            "placa": placa_raw,
            "prefixo": prefixo,
            "categoria": categoria,
            "motorista": motorista_nome,
            "cpf": cpf_val,
            "uo": uo,
            "tipo": tipo_raw,
            "nivel": nivel,
            "limiar": lim,
            "velocidade": vel,
            "delta": delta,
            "pct": pct,
            "duracao_str": dur_str,
            "duracao_segundos": dur_sec,
            "logradouro": logradouro,
            "cidade": cidade,
            "estado": estado,
            "latitude": lat,
            "longitude": lon,
            "data_evento": data_evento,
            "hora_evento": hora_str,
            "data_hora": data_hora,
            "hora_inteira": hour_int,
            "status": fix_text_encoding(row.get("STATUS")) or "NOVO",
            "ponto_referencia": fix_text_encoding(row.get("PONTO_REFERENCIA")) or None,
            "cerca_eletronica": fix_text_encoding(row.get("CERCA_ELETRONICA")) or None,
            "rotulo": fix_text_encoding(row.get("ROTULO")) or None,
            "grupo": fix_text_encoding(row.get("GRUPO")) or None,
            "atribuido": fix_text_encoding(row.get("ATRIBUIDO")) or None,
            "visualizado_por": fix_text_encoding(row.get("VISUALIZADO_POR")) or None,
            "feedback_video": fix_text_encoding(row.get("FEEDBACK_VIDEO")) or None,
            "usuario_feedback": fix_text_encoding(row.get("USUARIO_FEEDBACK")) or None,
            "ultimo_comentario": fix_text_encoding(row.get("ULTIMO_COMENTARIO")) or None,
            "integrador": fix_text_encoding(row.get("INTEGRADOR")) or None,
            "alerta_desconsiderado": fix_text_encoding(row.get("ALERTA_DESCONSIDERADO")) or "NÃO",
            "desconsiderado_por": fix_text_encoding(row.get("DESCONSIDERADO_POR")) or None,
            "desconsiderado_em": fix_text_encoding(row.get("DESCONSIDERADO_EM")) or None,
            "is_velocidade": is_velocidade,
        }

        return rec, is_velocidade

    def _save_batch(
        self, session: Session, batch: List[Dict[str, Any]], mode: str
    ) -> Tuple[int, int]:
        """Salva lote no banco com suporte a upsert ou inserção direta."""
        if not batch:
            return 0, 0

        if mode in ("clean_insert", "replace"):
            session.bulk_insert_mappings(Alerta, batch)
            return len(batch), 0

        # Modo upsert: busca registros já existentes por hash_id
        hashes = [item["hash_id"] for item in batch]
        existing_alerts = session.scalars(
            select(Alerta).where(Alerta.hash_id.in_(hashes))
        ).all()
        existing_map = {a.hash_id: a for a in existing_alerts}

        to_insert: List[Dict[str, Any]] = []
        updated_count = 0

        for item in batch:
            h = item["hash_id"]
            if h in existing_map:
                # Atualiza registro existente
                existing_obj = existing_map[h]
                for k, v in item.items():
                    if k != "hash_id":
                        setattr(existing_obj, k, v)
                updated_count += 1
            else:
                to_insert.append(item)

        if to_insert:
            session.bulk_insert_mappings(Alerta, to_insert)

        session.flush()
        return len(to_insert), updated_count


def ingest_spreadsheet(
    filepath: Union[str, Path],
    mode: str = "upsert",
    db_url: Optional[str] = None,
    sheet_name: Optional[Union[str, int]] = 0,
) -> IngestionResult:
    """Função de conveniência para disparo rápido de ingestão."""
    pipeline = TelemetryETLPipeline(db_url=db_url)
    return pipeline.ingest_file(filepath=filepath, mode=mode, sheet_name=sheet_name)
