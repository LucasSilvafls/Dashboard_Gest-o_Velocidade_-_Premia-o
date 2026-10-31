"""
Testes unitários para o módulo de leitura de planilhas Excel (excel_reader.py).
"""

from pathlib import Path
import openpyxl
import pytest

from ingestion.excel_reader import ExcelTelemetryReader, map_columns, normalize_header_text


class TestHeaderNormalization:
    def test_normalize_header_text(self):
        assert normalize_header_text("RÓTULO") == "ROTULO"
        assert normalize_header_text("CERCA ELETRÔNICA") == "CERCA ELETRONICA"
        assert normalize_header_text("  Placa do Veículo  ") == "PLACA DO VEICULO"
        assert normalize_header_text("CATEGORIA.1") == "CATEGORIA 1"

    def test_map_columns(self):
        raw_cols = ["Placa", "Categoria", "Motorista", "Excesso", "Limiar", "Duração", "Tipo de Alerta"]
        mapping, missing = map_columns(raw_cols)

        assert mapping["Placa"] == "PLACA"
        assert mapping["Categoria"] == "CATEGORIA"
        assert mapping["Motorista"] == "MOTORISTA"
        assert mapping["Excesso"] == "EXCESSO"
        assert mapping["Limiar"] == "LIMIAR"
        assert mapping["Duração"] == "DURACAO"
        assert mapping["Tipo de Alerta"] == "TIPO"
        assert len(missing) == 0

    def test_missing_mandatory_columns(self):
        raw_cols = ["Motorista", "Data", "Hora"]
        mapping, missing = map_columns(raw_cols)
        assert "PLACA" in missing
        assert "TIPO" in missing


class TestExcelTelemetryReader:
    @pytest.fixture
    def sample_excel_file(self, tmp_path: Path) -> Path:
        """Cria uma planilha Excel real (.xlsx) usando openpyxl para teste."""
        file_path = tmp_path / "test_telemetria.xlsx"
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Telemetria"

        # Cabeçalhos
        headers = [
            "PLACA", "CATEGORIA", "PREFIXO", "MOTORISTA", "CPF", "UO",
            "TIPO", "NIVEL", "LIMIAR", "EXCESSO", "DURACAO", "LOGRADOURO",
            "CIDADE", "ESTADO", "LATITUDE", "LONGITUDE", "DATA", "HORA", "STATUS"
        ]
        ws.append(headers)

        # Linha 1 válida de excesso de velocidade
        ws.append([
            "UGY5G31", "CAVALO", "Z8852D89A", "SENIVALDO COSTA", "96521430149", "CASAGRANDE",
            "EXCESSO_VELOCIDADE", "ALTO", "80 km/h", "102 km/h", "00:02:15", "MS-112",
            "Inocência", "MS", -21.503626, -50.031464, "25/10/2026", "10:12:29", "NOVO"
        ])

        # Linha 2 válida de excesso por via
        ws.append([
            "RVH9A52", "CAÇAMBA", "Z12345678", "JOÃO SILVA", "12345678900", "CASAGRANDE",
            "EXCESSO_VELOCIDADE_POR_VIA", "MEDIO", "60 km/h", "75 km/h", "00:01:00", "MS-436",
            "Camapuã", "MS", -19.532100, -53.284500, "25/10/2026", "11:00:00", "NOVO"
        ])

        # Linha 3: linha vazia
        ws.append([None] * len(headers))

        # Linha 4: linha sem placa (deve ser descartada)
        ws.append([
            "", "LEVE", "Z999", "PEDRO", "", "CASAGRANDE",
            "EXCESSO_VELOCIDADE", "BAIXO", "90", "95", "00:00:30", "MS-320",
            "Paraíso", "MS", -19.0, -53.0, "25/10/2026", "12:00:00", "NOVO"
        ])

        wb.save(file_path)
        return file_path

    def test_read_valid_xlsx(self, sample_excel_file: Path):
        reader = ExcelTelemetryReader(sample_excel_file)
        df, info = reader.read_spreadsheet()

        # Deve ter lido as 2 linhas válidas (descartando linha vazia e linha sem placa)
        assert len(df) == 2
        assert "PLACA" in df.columns
        assert "TIPO" in df.columns
        assert df["PLACA"].tolist() == ["UGY5G31", "RVH9A52"]
        assert len(info["colunas_faltantes_obrigatorias"]) == 0

    def test_file_not_found_error(self):
        with pytest.raises(FileNotFoundError):
            ExcelTelemetryReader("arquivo_inexistente_12345.xlsx")
