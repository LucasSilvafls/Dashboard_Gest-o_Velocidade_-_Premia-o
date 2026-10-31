"""
Módulo de leitura robusta de planilhas Excel (.xlsx, .xls) e arquivos de telemetria.
Utiliza pandas e openpyxl para carregar, inspecionar e normalizar headers de planilhas operacionais.
"""

import os
import re
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import pandas as pd


# Dicionário de sinônimos/aliases para normalização de colunas
COLUMN_ALIASES: Dict[str, str] = {
    "PLACA": "PLACA",
    "VEICULO": "PLACA",
    "PLACA VEICULO": "PLACA",
    "CATEGORIA": "CATEGORIA",
    "CATEGORIA VEICULO": "CATEGORIA",
    "CATEGORIA DO VEICULO": "CATEGORIA",
    "TIPO VEICULO": "CATEGORIA",
    "PREFIXO": "PREFIXO",
    "ID EQUIPAMENTO": "PREFIXO",
    "EQUIPAMENTO": "PREFIXO",
    "MOTORISTA": "MOTORISTA",
    "CONDUTOR": "MOTORISTA",
    "NOME MOTORISTA": "MOTORISTA",
    "NOME CONDUTOR": "MOTORISTA",
    "CPF": "CPF",
    "CPF MOTORISTA": "CPF",
    "CPF CONDUTOR": "CPF",
    "UO": "UO",
    "UNIDADE": "UO",
    "UNIDADE OPERACIONAL": "UO",
    "TIPO": "TIPO",
    "TIPO ALERTA": "TIPO",
    "TIPO DE ALERTA": "TIPO",
    "EVENTO": "TIPO",
    "NIVEL": "NIVEL",
    "GRAVIDADE": "NIVEL",
    "SEVERIDADE": "NIVEL",
    "LIMIAR": "LIMIAR",
    "LIMITE": "LIMIAR",
    "VELOCIDADE LIMITE": "LIMIAR",
    "VELOCIDADE REGULAMENTAR": "LIMIAR",
    "EXCESSO": "EXCESSO",
    "VELOCIDADE": "EXCESSO",
    "VELOCIDADE REGISTRADA": "EXCESSO",
    "VELOCIDADE MAXIMA": "EXCESSO",
    "VALOR": "EXCESSO",
    "DURACAO": "DURACAO",
    "TEMPO": "DURACAO",
    "DURACAO EVENTO": "DURACAO",
    "LOGRADOURO": "LOGRADOURO",
    "VIA": "LOGRADOURO",
    "RODOVIA": "LOGRADOURO",
    "RUA": "LOGRADOURO",
    "LOCAL": "LOGRADOURO",
    "CIDADE": "CIDADE",
    "MUNICIPIO": "CIDADE",
    "ESTADO": "ESTADO",
    "UF": "ESTADO",
    "LATITUDE": "LATITUDE",
    "LAT": "LATITUDE",
    "LONGITUDE": "LONGITUDE",
    "LONG": "LONGITUDE",
    "LNG": "LONGITUDE",
    "DATA": "DATA",
    "DATA EVENTO": "DATA",
    "DATA DO EVENTO": "DATA",
    "HORA": "HORA",
    "HORA EVENTO": "HORA",
    "HORARIO": "HORA",
    "STATUS": "STATUS",
    "GRUPO": "GRUPO",
    "ROTULO": "ROTULO",
    "ROTULO_SISTEMA": "ROTULO",
    "PONTO_REFERENCIA": "PONTO_REFERENCIA",
    "PONTO DE REFERENCIA": "PONTO_REFERENCIA",
    "CERCA ELETRONICA": "CERCA_ELETRONICA",
    "CERCA": "CERCA_ELETRONICA",
    "ATRIBUIDO": "ATRIBUIDO",
    "VISUALIZADO POR": "VISUALIZADO_POR",
    "FEEDBACK VIDEO": "FEEDBACK_VIDEO",
    "USUARIO FEEDBACK": "USUARIO_FEEDBACK",
    "ULTIMO_COMENTARIO": "ULTIMO_COMENTARIO",
    "COMENTARIO": "ULTIMO_COMENTARIO",
    "INTEGRADOR": "INTEGRADOR",
    "ALERTA DESCONSIDERADO": "ALERTA_DESCONSIDERADO",
    "DESCONSIDERADO POR": "DESCONSIDERADO_POR",
    "DESCONSIDERADO EM": "DESCONSIDERADO_EM",
}


def normalize_header_text(header: str) -> str:
    """
    Remove acentos, caracteres especiais e espaços extras para comparação de colunas.
    """
    if not header or not isinstance(header, str):
        return ""
    # Converte unicode para forma decomposta e remove marcas não espaçadas (acentos)
    nfkd = unicodedata.normalize("NFKD", header)
    clean = "".join(c for c in nfkd if not unicodedata.combining(c))
    # Remove pontuação estranha exceto espaço e sublinhado
    clean = re.sub(r"[^\w\s]", " ", clean)
    clean = re.sub(r"\s+", " ", clean).strip().upper()
    return clean


def map_columns(columns: List[str]) -> Tuple[Dict[str, str], List[str]]:
    """
    Mapeia nomes de colunas encontrados na planilha para os nomes canônicos do sistema.
    Retorna (dicionário {coluna_original: nome_canonico}, colunas_obrigatorias_faltantes).
    """
    column_mapping: Dict[str, str] = {}
    matched_canonicals = set()

    for orig_col in columns:
        norm = normalize_header_text(orig_col)
        # Verifica correspondência exata nos aliases
        if norm in COLUMN_ALIASES:
            canon = COLUMN_ALIASES[norm]
            column_mapping[orig_col] = canon
            matched_canonicals.add(canon)
        else:
            # Caso não mapeado, guarda versão limpa
            safe_name = norm.replace(" ", "_")
            column_mapping[orig_col] = safe_name

    # Colunas essenciais mínimas para uma análise de telemetria
    mandatory = ["PLACA", "TIPO"]
    missing = [col for col in mandatory if col not in matched_canonicals]

    return column_mapping, missing


class ExcelTelemetryReader:
    """
    Leitor especializado para planilhas Excel (.xlsx, .xls) contendo dados de telemetria.
    """

    def __init__(self, filepath: Union[str, Path]):
        self.filepath = Path(filepath)
        if not self.filepath.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {self.filepath}")

    def read_spreadsheet(
        self, sheet_name: Optional[Union[str, int]] = 0
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Lê a planilha Excel, aplica auto-detecção de cabeçalho, limpa linhas vazias
        e renomeia colunas para o padrão canônico do sistema.
        """
        ext = self.filepath.suffix.lower()

        if ext in (".xlsx", ".xlsm", ".xltx", ".xltm"):
            df_raw = self._read_excel_file(sheet_name)
        elif ext == ".xls":
            df_raw = pd.read_excel(self.filepath, sheet_name=sheet_name)
        elif ext in (".csv", ".txt"):
            df_raw = self._read_csv_fallback()
        else:
            raise ValueError(f"Formato não suportado: {ext}. Use .xlsx, .xls ou .csv")

        return self._process_dataframe(df_raw)

    def _read_excel_file(self, sheet_name: Optional[Union[str, int]]) -> pd.DataFrame:
        """Lê arquivo Excel via engine openpyxl."""
        try:
            # Lê inicialmente sem cabeçalho para validar se a primeira linha é título
            df_raw = pd.read_excel(
                self.filepath,
                sheet_name=sheet_name,
                engine="openpyxl",
                dtype=object,  # Mantém tipos originais para tratamento posterior
            )
            return df_raw
        except Exception as e:
            raise RuntimeError(f"Erro ao ler arquivo Excel via openpyxl: {e}")

    def _read_csv_fallback(self) -> pd.DataFrame:
        """Fallback para arquivos CSV legados."""
        for enc in ("utf-8-sig", "utf-8", "cp1252", "latin1"):
            for sep in (";", ",", "\t"):
                try:
                    df = pd.read_csv(self.filepath, sep=sep, encoding=enc, dtype=object)
                    if len(df.columns) > 3:
                        return df
                except Exception:
                    continue
        # Tentativa com engine python automática
        return pd.read_csv(self.filepath, sep=None, engine="python", encoding="cp1252", dtype=object)

    def _process_dataframe(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Inspeciona colunas, detecta linha de cabeçalho real se houver linhas de metadados antes,
        remove linhas totalmente vazias e normaliza nomes de colunas.
        """
        # Se as colunas atuais não parecerem com telemetria, procura na primeira linha que tiver 'PLACA' ou 'TIPO'
        cols_text = " ".join([str(c) for c in df.columns]).upper()
        if "PLACA" not in cols_text and "TIPO" not in cols_text:
            header_row_idx = None
            for idx, row in df.head(10).iterrows():
                row_str = " ".join([str(val) for val in row.values if pd.notna(val)]).upper()
                if "PLACA" in row_str and ("TIPO" in row_str or "DATA" in row_str):
                    header_row_idx = idx
                    break

            if header_row_idx is not None:
                new_headers = df.iloc[header_row_idx].tolist()
                df = df.iloc[header_row_idx + 1 :].copy()
                df.columns = new_headers

        # Remove linhas totalmente vazias
        df = df.dropna(how="all").copy()

        # Mapeia e normaliza nomes de colunas
        mapping, missing_mandatory = map_columns([str(c) for c in df.columns])
        df = df.rename(columns=mapping)

        # Remove duplicidade de colunas idênticas (ex: CATEGORIA.1)
        df = df.loc[:, ~df.columns.duplicated()].copy()

        # Remove linhas sem PLACA ou com valores vazios/inválidos na placa
        if "PLACA" in df.columns:
            df = df[
                df["PLACA"].notna()
                & (df["PLACA"].astype(str).str.strip() != "")
                & (df["PLACA"].astype(str).str.strip() != "-")
            ].copy()

        info = {
            "total_linhas": len(df),
            "colunas_detectadas": list(df.columns),
            "colunas_faltantes_obrigatorias": missing_mandatory,
        }

        return df, info


def read_excel_telemetry(
    filepath: Union[str, Path], sheet_name: Optional[Union[str, int]] = 0
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Função de conveniência para ler planilhas de telemetria."""
    reader = ExcelTelemetryReader(filepath)
    return reader.read_spreadsheet(sheet_name=sheet_name)
