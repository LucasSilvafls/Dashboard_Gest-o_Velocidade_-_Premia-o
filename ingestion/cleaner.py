"""
Módulo de Limpeza, Higienização e Normalização de Dados de Telemetria.
Trata inconsistências de formatos numéricos, datas, coordenadas, textos e codificações.
"""

import hashlib
import re
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd


# Mapeamento de correções comuns de encoding corrompido (CP1252 / ISO-8859-1 misturado com UTF-8)
ENCODING_REPLACEMENTS = {
    "\ufffd": "",
    "CA\u00c7AMBA": "CAÇAMBA",
    "CA\xc7AMBA": "CAÇAMBA",
    "CAAMBA": "CAÇAMBA",
    "CAÇAMBA": "CAÇAMBA",
    "JO\u00c3O": "JOÃO",
    "JO\xc3O": "JOÃO",
    "JOO": "JOÃO",
    "JOÃO": "JOÃO",
    "FRAN\u00c7A": "FRANÇA",
    "FRAN\xc7A": "FRANÇA",
    "FRANA": "FRANÇA",
    "FRANÇA": "FRANÇA",
    "Penpolis": "Penápolis",
    "Pen\xe1polis": "Penápolis",
    "So Paulo": "São Paulo",
    "S\xe3o Paulo": "São Paulo",
    "Trs Lagoas": "Três Lagoas",
    "Tr\xeas Lagoas": "Três Lagoas",
    "Inocncia": "Inocência",
    "Inoc\xeancia": "Inocência",
    "ELETRNICA": "ELETRÔNICA",
    "ELETR\xd4NICA": "ELETRÔNICA",
    "RTULO": "RÓTULO",
    "R\xd3TULO": "RÓTULO",
    "NO ANALISADO": "NÃO ANALISADO",
    "N\xc3O ANALISADO": "NÃO ANALISADO",
    "Identifica\u00e7\u00e3o": "Identificação",
    "Identifica\xe7\xe3o": "Identificação",
    "Identificao": "Identificação",
}

# Categorias oficiais da frota Casagrande
CATEGORIAS_VALIDAS = {
    "CAVALO": "CAVALO",
    "CAÇAMBA": "CAÇAMBA",
    "CACAMBA": "CAÇAMBA",
    "LEVE": "LEVE",
    "PIPA": "PIPA",
    "COMBOIO": "COMBOIO",
    "MUNK": "MUNK",
    "MUNCK": "MUNK",
    "ONIBUS": "ONIBUS",
    "ÔNIBUS": "ONIBUS",
}


def fix_text_encoding(val: Any) -> str:
    """
    Higieniza strings corrigindo ruídos de codificação, caracteres de substituição e pontuações estranhas.
    """
    if val is None or pd.isna(val):
        return ""
    s = str(val).strip()
    if s == "-" or s.lower() == "nan" or s.lower() == "null":
        return ""

    if s.upper() in ("NO", "N\xc3O"):
        return "NÃO"

    for bad, good in ENCODING_REPLACEMENTS.items():
        if bad in s:
            s = s.replace(bad, good)

    # Substituição isolada de palavra inteira NO por NÃO (evita afetar nomes como NATALINO)
    s = re.sub(r"\bNO\b", "NÃO", s)
    s = re.sub(r"\bN\xc3O\b", "NÃO", s)

    return s.strip()


def parse_num_clean(v: Any) -> Optional[float]:
    """
    Extrai e converte valores numéricos contidos em strings com unidades
    (ex: '102 km/h', '+15 km/h', '2500 rpm', '0,5 g', '90.0').
    """
    if v is None or pd.isna(v):
        return None
    if isinstance(v, (int, float)):
        return float(v) if pd.notna(v) else None

    s = str(v).strip()
    if not s or s in ("-", " - ", "nan", "NaN", "null", "None"):
        return None

    # Remove unidades usuais de telemetria
    s = re.sub(r"(?i)km/h/s|km/h|kmh|rpm|segundos|seg|s|g|[%+]", "", s).strip()
    if not s or s == "-":
        return None

    # Normaliza separador decimal de vírgula para ponto
    s = s.replace(",", ".")
    try:
        n = float(s)
        return n if pd.notna(n) else None
    except ValueError:
        return None


def parse_sec(v: Any) -> int:
    """
    Converte duração (string 'HH:MM:SS', 'MM:SS', float de fração de dia do Excel ou segundos) em total de segundos inteiros.
    """
    if v is None or pd.isna(v):
        return 0

    if isinstance(v, (int, float)):
        # Se for fração de dia do Excel (ex: 0.0015625)
        if 0 < v < 1:
            return int(round(v * 86400))
        return int(v)

    if isinstance(v, time):
        return v.hour * 3600 + v.minute * 60 + v.second

    s = str(v).strip()
    if not s or s in ("-", "nan", "0"):
        return 0

    # Formato HH:MM:SS ou MM:SS
    if ":" in s:
        parts = s.split(":")
        try:
            if len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(float(parts[2]))
            if len(parts) == 2:
                return int(parts[0]) * 60 + int(float(parts[1]))
        except ValueError:
            return 0

    # Se for string numérica pura
    try:
        cleaned = re.sub(r"[^\d\.]", "", s)
        if cleaned:
            return int(float(cleaned))
    except ValueError:
        pass

    return 0


def format_duration_str(seconds: int) -> str:
    """Formata total de segundos em HH:MM:SS."""
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def fix_coord(raw: Any, is_lat: bool = True) -> Optional[float]:
    """
    Valida e normaliza coordenadas geográficas (WGS84).
    Lida com pontos suprimidos de exportações legadas (ex: '-21503626' ou '-21.503.626' -> -21.503626).
    """
    if raw is None or pd.isna(raw):
        return None

    if isinstance(raw, (int, float)):
        val = float(raw)
        # Se já é um float válido dentro da faixa do Brasil/Mundo
        max_bound = 90.0 if is_lat else 180.0
        if -max_bound <= val <= max_bound and val != 0.0:
            return round(val, 6)
        raw = str(raw)

    s = str(raw).strip()
    if not s or s in ("-", "nan", "0.0", "0"):
        return None

    negative = s.startswith("-")
    digits = re.sub(r"[^\d]", "", s)
    if not digits:
        return None

    # Se já tinha um ponto único e valor na faixa aceitável
    if s.count(".") == 1 and not s.count(",") > 0:
        try:
            val = float(s)
            max_bound = 90.0 if is_lat else 180.0
            if -max_bound <= val <= max_bound and val != 0.0:
                return round(val, 6)
        except ValueError:
            pass

    # Reconstrução para números com ponto suprimido (ex: 21503626 -> 21.503626)
    if len(digits) >= 2:
        val = float(digits[:2] + "." + digits[2:])
        final_val = -val if negative else val
        max_bound = 90.0 if is_lat else 180.0
        if -max_bound <= final_val <= max_bound:
            return round(final_val, 6)

    return None


def parse_date_value(raw: Any) -> Optional[date]:
    """
    Converte múltiplos formatos de data para um objeto datetime.date nativo.
    Suporta:
    - datetime.date ou datetime.datetime
    - Números de série do Excel (ex: 45224)
    - Strings DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
    """
    if raw is None or pd.isna(raw):
        return None

    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw

    # Serial do Excel (número de dias desde 1899-12-30)
    if isinstance(raw, (int, float)):
        try:
            # Excel base date
            excel_base = datetime(1899, 12, 30)
            return (excel_base + pd.to_timedelta(raw, unit="D")).date()
        except Exception:
            return None

    s = str(raw).strip()
    if not s or s in ("-", "nan", "null"):
        return None

    # Remove horário se acoplado na data
    if " " in s:
        s = s.split(" ")[0].strip()
    if "T" in s:
        s = s.split("T")[0].strip()

    # Padrão DD/MM/YYYY ou DD-MM-YYYY
    m_dmy = re.match(r"^(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})$", s)
    if m_dmy:
        p1, p2, yr = int(m_dmy.group(1)), int(m_dmy.group(2)), int(m_dmy.group(3))
        if yr < 100:
            yr = 1900 + yr if yr >= 70 else 2000 + yr
        # Tratamento se veio invertido como MM/DD/YYYY
        if p1 > 12 and p2 <= 12:
            d, m = p1, p2
        elif p2 > 12 and p1 <= 12:
            d, m = p2, p1
        else:
            d, m = p1, p2  # Assume padrão brasileiro DD/MM/YYYY
        try:
            return date(yr, m, d)
        except ValueError:
            return None

    # Padrão ISO YYYY-MM-DD
    m_ymd = re.match(r"^(\d{4})[/\-\.](\d{1,2})[/\-\.](\d{1,2})$", s)
    if m_ymd:
        yr, m, d = int(m_ymd.group(1)), int(m_ymd.group(2)), int(m_ymd.group(3))
        try:
            return date(yr, m, d)
        except ValueError:
            return None

    return None


def parse_time_value(raw: Any) -> Tuple[str, int]:
    """
    Normaliza o horário para a string 'HH:MM:SS' e extrai a hora inteira (0 a 23).
    """
    if raw is None or pd.isna(raw):
        return "00:00:00", 0

    if isinstance(raw, datetime):
        return raw.strftime("%H:%M:%S"), raw.hour

    if isinstance(raw, time):
        return raw.strftime("%H:%M:%S"), raw.hour

    # Fração de dia do Excel (ex: 0.5 -> 12:00:00)
    if isinstance(raw, float) and 0 <= raw < 1:
        total_sec = int(round(raw * 86400))
        h = (total_sec // 3600) % 24
        m = (total_sec % 3600) // 60
        s = total_sec % 60
        return f"{h:02d}:{m:02d}:{s:02d}", h

    s = str(raw).strip()
    if not s or s in ("-", "nan"):
        return "00:00:00", 0

    if " " in s:
        s = s.split(" ")[-1].strip()

    parts = s.split(":")
    try:
        h = int(parts[0]) if len(parts) >= 1 else 0
        m = int(parts[1]) if len(parts) >= 2 else 0
        s_part = int(float(parts[2])) if len(parts) >= 3 else 0
        h = max(0, min(23, h))
        m = max(0, min(59, m))
        s_part = max(0, min(59, s_part))
        return f"{h:02d}:{m:02d}:{s_part:02d}", h
    except (ValueError, IndexError):
        return "00:00:00", 0


def normalize_driver_name(raw: Any) -> str:
    """
    Padroniza o nome do motorista, atribuindo 'Sem Identificação' quando não identificado.
    """
    s = fix_text_encoding(raw)
    if not s or s in ("-", "N/I", "SEM CONDUTOR"):
        return "Sem Identificação"
    if "identifica" in s.lower() or "pendente" in s.lower():
        return "Sem Identificação"
    # Capitalização e limpeza de múltiplos espaços
    return " ".join(w for w in s.split() if w)


def normalize_category(raw: Any) -> str:
    """
    Padroniza a categoria operacional do veículo.
    """
    s = fix_text_encoding(raw).upper().strip()
    if not s or s in ("-", "N/I", "NAN", "NULL"):
        return "Não Classificado"

    for key, normalized in CATEGORIAS_VALIDAS.items():
        if key in s:
            return normalized

    return s


def calculate_risk_level(raw_level: Any, delta: float) -> str:
    """
    Determina o nível de risco ('ALTO', 'MEDIO', 'BAIXO') conforme o CTB e regras da CSG.
    """
    s = str(raw_level or "").strip().upper()
    if s in ("ALTO", "MEDIO", "MÉDIO"):
        return "ALTO" if s == "ALTO" else "MEDIO"
    if s == "BAIXO":
        return "BAIXO"

    if delta >= 20.0:
        return "ALTO"
    if delta >= 10.0:
        return "MEDIO"
    return "BAIXO"


def compute_alert_hash(
    placa: str,
    tipo: str,
    data_str: str,
    hora_str: str,
    velocidade: Optional[float],
    duracao_sec: int,
    lat: Optional[float],
    lng: Optional[float],
) -> str:
    """
    Gera hash SHA-256 exclusivo e determinístico para o evento de telemetria.
    Permite upsert idempotente evitando duplicação em reimportações.
    """
    vel_str = f"{velocidade:.1f}" if velocidade is not None else "0.0"
    lat_str = f"{lat:.5f}" if lat is not None else "0"
    lng_str = f"{lng:.5f}" if lng is not None else "0"

    raw_signature = f"{placa.strip().upper()}|{tipo.strip().upper()}|{data_str}|{hora_str}|{vel_str}|{duracao_sec}|{lat_str}|{lng_str}"
    return hashlib.sha256(raw_signature.encode("utf-8")).hexdigest()
