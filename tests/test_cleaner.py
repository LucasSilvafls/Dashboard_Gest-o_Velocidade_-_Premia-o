"""
Testes unitários para o módulo de higienização e normalização (cleaner.py).
"""

from datetime import date, datetime, time
import pytest

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


class TestParseNumClean:
    def test_pure_numbers(self):
        assert parse_num_clean(100) == 100.0
        assert parse_num_clean(85.5) == 85.5
        assert parse_num_clean("92.4") == 92.4

    def test_numbers_with_units(self):
        assert parse_num_clean("102 km/h") == 102.0
        assert parse_num_clean("80 kmh") == 80.0
        assert parse_num_clean("+15 km/h") == 15.0
        assert parse_num_clean("2500 rpm") == 2500.0
        assert parse_num_clean("0,5 g") == 0.5
        assert parse_num_clean("15 seg") == 15.0

    def test_comma_decimal(self):
        assert parse_num_clean("102,5") == 102.5
        assert parse_num_clean("80,0 km/h") == 80.0

    def test_empty_and_null_values(self):
        assert parse_num_clean(None) is None
        assert parse_num_clean("") is None
        assert parse_num_clean("-") is None
        assert parse_num_clean(" - ") is None
        assert parse_num_clean("nan") is None
        assert parse_num_clean("NaN") is None


class TestParseSec:
    def test_hh_mm_ss_format(self):
        assert parse_sec("00:02:15") == 135
        assert parse_sec("01:00:00") == 3600
        assert parse_sec("00:00:45") == 45

    def test_mm_ss_format(self):
        assert parse_sec("05:30") == 330
        assert parse_sec("01:10") == 70

    def test_time_object(self):
        t = time(0, 3, 20)
        assert parse_sec(t) == 200

    def test_numeric_seconds(self):
        assert parse_sec(120) == 120
        assert parse_sec("45") == 45

    def test_invalid_and_empty(self):
        assert parse_sec(None) == 0
        assert parse_sec("") == 0
        assert parse_sec("-") == 0

    def test_format_duration_str(self):
        assert format_duration_str(135) == "00:02:15"
        assert format_duration_str(3665) == "01:01:05"
        assert format_duration_str(0) == "00:00:00"


class TestFixCoord:
    def test_standard_coordinates(self):
        assert fix_coord(-21.503626, is_lat=True) == -21.503626
        assert fix_coord("-50.031464", is_lat=False) == -50.031464

    def test_coordinates_missing_decimal_dot(self):
        assert fix_coord("-21503626", is_lat=True) == -21.503626
        assert fix_coord("-50031464", is_lat=False) == -50.031464

    def test_coordinates_with_thousands_dots(self):
        # Como visto no CSV de telemetria: -21.503.626
        assert fix_coord("-21.503.626", is_lat=True) == -21.503626
        assert fix_coord("-50.031.464", is_lat=False) == -50.031464

    def test_invalid_coords(self):
        assert fix_coord(None) is None
        assert fix_coord("-") is None
        assert fix_coord("0.0") is None
        assert fix_coord(0) is None


class TestParseDateValue:
    def test_brazilian_format(self):
        assert parse_date_value("25/10/2026") == date(2026, 10, 25)
        assert parse_date_value("05/03/2026") == date(2026, 3, 5)

    def test_iso_format(self):
        assert parse_date_value("2026-10-25") == date(2026, 10, 25)

    def test_datetime_object(self):
        dt = datetime(2026, 10, 25, 14, 30)
        assert parse_date_value(dt) == date(2026, 10, 25)

    def test_excel_serial_number(self):
        # 46320 é aprox data em 2026
        res = parse_date_value(46320)
        assert res is not None
        assert res.year == 2026

    def test_empty_dates(self):
        assert parse_date_value(None) is None
        assert parse_date_value("") is None
        assert parse_date_value("-") is None


class TestParseTimeValue:
    def test_string_time(self):
        time_str, hour_int = parse_time_value("16:47:33")
        assert time_str == "16:47:33"
        assert hour_int == 16

    def test_datetime_time(self):
        t = time(9, 15, 0)
        time_str, hour_int = parse_time_value(t)
        assert time_str == "09:15:00"
        assert hour_int == 9

    def test_fraction_of_day(self):
        # 0.5 = 12:00:00
        time_str, hour_int = parse_time_value(0.5)
        assert time_str == "12:00:00"
        assert hour_int == 12


class TestTextNormalization:
    def test_fix_text_encoding(self):
        assert fix_text_encoding("CA\u00c7AMBA") == "CAÇAMBA"
        assert fix_text_encoding("JO\u00c3O") == "JOÃO"
        assert fix_text_encoding("Pen\xe1polis") == "Penápolis"

    def test_normalize_driver_name(self):
        assert normalize_driver_name("NATALINO DA SILVA") == "NATALINO DA SILVA"
        assert normalize_driver_name("  JOÃO   SILVA  ") == "JOÃO SILVA"
        assert normalize_driver_name("-") == "Sem Identificação"
        assert normalize_driver_name("") == "Sem Identificação"
        assert normalize_driver_name("Identificação de condutor pendente") == "Sem Identificação"

    def test_normalize_category(self):
        assert normalize_category("CAVALO") == "CAVALO"
        assert normalize_category("CAÇAMBA") == "CAÇAMBA"
        assert normalize_category("LEVE") == "LEVE"
        assert normalize_category("PIPA") == "PIPA"
        assert normalize_category("COMBOIO") == "COMBOIO"
        assert normalize_category("MUNCK") == "MUNK"
        assert normalize_category("ÔNIBUS") == "ONIBUS"
        assert normalize_category("-") == "Não Classificado"
        assert normalize_category("") == "Não Classificado"


class TestRiskAndHash:
    def test_risk_level_calculation(self):
        # Delta >= 20 -> ALTO
        assert calculate_risk_level(None, delta=22.0) == "ALTO"
        # 10 <= Delta < 20 -> MEDIO
        assert calculate_risk_level(None, delta=15.0) == "MEDIO"
        # Delta < 10 -> BAIXO
        assert calculate_risk_level(None, delta=5.0) == "BAIXO"
        # Explicit override
        assert calculate_risk_level("ALTO", delta=5.0) == "ALTO"
        assert calculate_risk_level("BAIXO", delta=25.0) == "BAIXO"

    def test_compute_alert_hash_determinism(self):
        h1 = compute_alert_hash(
            placa="UGY5G31",
            tipo="EXCESSO_VELOCIDADE",
            data_str="2026-10-25",
            hora_str="14:30:00",
            velocidade=95.0,
            duracao_sec=60,
            lat=-21.5036,
            lng=-50.0314,
        )
        h2 = compute_alert_hash(
            placa="UGY5G31",
            tipo="EXCESSO_VELOCIDADE",
            data_str="2026-10-25",
            hora_str="14:30:00",
            velocidade=95.0,
            duracao_sec=60,
            lat=-21.5036,
            lng=-50.0314,
        )
        assert h1 == h2
        assert len(h1) == 64  # SHA-256
