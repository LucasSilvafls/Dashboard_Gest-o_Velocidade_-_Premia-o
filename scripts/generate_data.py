import pandas as pd
import json
import re
import os
import sys

print("Building Controle_Velocidade_CSG dataset with vehicle category support...")

def load_dataset(filepath='Historico_Alertas.csv'):
    for enc in ('cp1252', 'latin1', 'utf-8-sig', 'utf-8'):
        try:
            return pd.read_csv(filepath, sep=';', encoding=enc)
        except Exception:
            try:
                return pd.read_csv(filepath, sep=None, engine='python', encoding=enc)
            except Exception:
                continue
    return pd.read_csv(filepath, sep=';', encoding='cp1252')

def resolve_input_path(raw_path: str = 'Historico_Alertas.csv') -> str:
    for candidate in [
        raw_path,
        os.path.join('data', raw_path),
        os.path.join('..', 'data', raw_path),
        os.path.join(os.path.dirname(__file__), '..', 'data', raw_path),
    ]:
        if os.path.exists(candidate):
            return candidate
    return raw_path

raw_arg = sys.argv[1] if len(sys.argv) > 1 else 'Historico_Alertas.csv'
input_path = resolve_input_path(raw_arg)
df = load_dataset(input_path)
print(f"Loaded {len(df)} total alerts from {input_path}")

def parse_num_clean(v):
    if v is None or pd.isna(v):
        return None
    s = str(v).strip()
    if not s or s == '-' or s == ' - ' or s.lower() == 'nan':
        return None
    s = re.sub(r'(?i)km/h/s|km/h|kmh|rpm|g|segundos|seg|s|[%+]', '', s).strip()
    if not s or s == '-':
        return None
    s = s.replace(',', '.')
    try:
        n = float(s)
        return n if pd.notna(n) else None
    except:
        return None

def parse_sec(v):
    try:
        p = str(v).strip().split(':')
        if len(p) == 3:
            return int(p[0]) * 3600 + int(p[1]) * 60 + int(p[2])
        if len(p) == 2:
            return int(p[0]) * 60 + int(p[1])
        return 0
    except:
        return 0

def fix_coord(raw, is_lat=True):
    if raw is None or pd.isna(raw):
        return None
    s = str(raw).strip()
    if not s or s == '-' or s.lower() == 'nan' or s == '0.0':
        return None
    negative = s.startswith('-')
    digits = re.sub(r'[^\d]', '', s)
    if not digits:
        return None
    if len(digits) >= 2:
        val = float(digits[:2] + '.' + digits[2:])
        return round(-val if negative else val, 6)
    return None

def parse_date_components_br(raw_val):
    if raw_val is None or pd.isna(raw_val):
        return None
    if hasattr(raw_val, 'day') and hasattr(raw_val, 'month') and hasattr(raw_val, 'year'):
        return {'c1': int(raw_val.day), 'c2': int(raw_val.month), 'y': int(raw_val.year), 'source': 'datetime', 'raw': ''}
    s = str(raw_val).strip()
    if not s or s == '-' or s.lower() == 'nan':
        return None
    if 'T' in s:
        s = s.split('T')[0].strip()
    elif ' ' in s:
        s = s.split(' ')[0].strip()

    m_dmy = re.match(r'^(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})$', s)
    if m_dmy:
        p1, p2, yr = int(m_dmy.group(1)), int(m_dmy.group(2)), int(m_dmy.group(3))
        if yr < 100:
            yr = 1900 + yr if yr >= 70 else 2000 + yr
        return {'c1': p1, 'c2': p2, 'y': yr, 'source': 'slash', 'raw': s}

    m_ymd = re.match(r'^(\d{4})[/\-\.](\d{1,2})[/\-\.](\d{1,2})$', s)
    if m_ymd:
        yr, m_part, d_part = int(m_ymd.group(1)), int(m_ymd.group(2)), int(m_ymd.group(3))
        if m_part > 12 and d_part <= 12:
            return {'c1': m_part, 'c2': d_part, 'y': yr, 'source': 'iso', 'raw': s}
        return {'c1': d_part, 'c2': m_part, 'y': yr, 'source': 'iso', 'raw': s}

    return {'c1': None, 'c2': None, 'y': None, 'source': 'unknown', 'raw': s}

def resolve_dates_br(parsed_list):
    dmy_unambig = sum(1 for x in parsed_list if x and x['source'] == 'slash' and x['c1'] and x['c1'] > 12 and x['c2'] <= 12)
    mdy_unambig = sum(1 for x in parsed_list if x and x['source'] == 'slash' and x['c2'] and x['c2'] > 12 and x['c1'] <= 12)
    is_global_mdy = (mdy_unambig > 0 and dmy_unambig == 0)

    resolved = []
    for x in parsed_list:
        if not x or x['c1'] is None:
            resolved.append({'d': None, 'm': None, 'y': None, 'raw': x['raw'] if x else ''})
            continue
        c1, c2, y = x['c1'], x['c2'], x['y']
        if c1 > 12 and c2 <= 12:
            resolved.append({'d': c1, 'm': c2, 'y': y, 'raw': x['raw']})
        elif c2 > 12 and c1 <= 12:
            resolved.append({'d': c2, 'm': c1, 'y': y, 'raw': x['raw']})
        elif is_global_mdy and x['source'] == 'slash':
            resolved.append({'d': c2, 'm': c1, 'y': y, 'raw': x['raw']})
        else:
            resolved.append({'d': c1, 'm': c2, 'y': y, 'raw': x['raw']})

    return [
        f"{r['d']:02d}/{r['m']:02d}/{r['y']:04d}" if r['d'] is not None else r['raw']
        for r in resolved
    ]

def fix_text_encoding(val):
    if val is None or pd.isna(val):
        return ''
    s = str(val).strip()
    s = s.replace('\ufffd', '').replace('CA\u00c7AMBA', 'CAÇAMBA').replace('CA\xc7AMBA', 'CAÇAMBA').replace('CAÇAMBA', 'CAÇAMBA')
    s = s.replace('JO\u00c3O', 'JOÃO').replace('JO\xc3O', 'JOÃO').replace('JOÃO', 'JOÃO')
    s = s.replace('FRAN\u00c7A', 'FRANÇA').replace('FRAN\xc7A', 'FRANÇA').replace('FRANÇA', 'FRANÇA')
    s = s.replace('Identifica\u00e7\u00e3o', 'Identificação').replace('Identifica\xe7\xe3o', 'Identificação').replace('Identificao', 'Identificação')
    return s

# Speed alerts extraction: EXCESSO_VELOCIDADE and EXCESSO_VELOCIDADE_POR_VIA
speed_df = df[df['TIPO'].str.contains('VELOCIDADE', na=False) & ~df['TIPO'].str.contains('RPM', na=False)].copy()
print(f"Extracted {len(speed_df)} speed excess alerts.")

records = []
parsed_dates = []

for idx, row in speed_df.iterrows():
    tipo = str(row.get('TIPO') or '').strip().upper()
    vel = parse_num_clean(row.get('EXCESSO'))
    lim = parse_num_clean(row.get('LIMIAR'))
    dur_str = str(row.get('DURACAO') or '00:00:00').strip()
    dur_sec = parse_sec(dur_str)

    delta = round(vel - lim, 1) if (vel is not None and lim is not None) else 0.0
    pct = round((delta / lim) * 100, 1) if (lim and lim > 0) else 0.0

    # Risk level from CSV or delta threshold
    nivel_raw = str(row.get('NIVEL') or '').strip().upper()
    if nivel_raw in ('ALTO', 'MEDIO', 'BAIXO'):
        nivel = nivel_raw
    else:
        nivel = 'ALTO' if delta >= 20 else ('MEDIO' if delta >= 10 else 'BAIXO')

    lat = fix_coord(row.get('LATITUDE'), is_lat=True)
    lon = fix_coord(row.get('LONGITUDE'), is_lat=False)

    hora_str = str(row.get('HORA') or '00:00:00').strip()
    hour = int(hora_str.split(':')[0]) if ':' in hora_str else 0
    parsed_dates.append(parse_date_components_br(row.get('DATA')))

    motorista = str(row.get('MOTORISTA') or '').strip()
    if not motorista or motorista == '-' or 'identifica' in motorista.lower():
        motorista = 'Sem Identificação'
    else:
        motorista = fix_text_encoding(motorista)

    logradouro = str(row.get('LOGRADOURO') or '').strip()
    if not logradouro or logradouro == '-':
        logradouro = 'Não Informado'
    else:
        logradouro = fix_text_encoding(logradouro)

    cidade = str(row.get('CIDADE') or '').strip()
    if not cidade or cidade == '-':
        cidade = 'Não Informada'
    else:
        cidade = fix_text_encoding(cidade)

    # Vehicle Category from the new CATEGORIA column
    categoria = str(row.get('CATEGORIA') or '').strip()
    if not categoria or categoria == '-' or categoria.lower() == 'nan':
        categoria = 'Não Classificado'
    else:
        categoria = fix_text_encoding(categoria)

    rec = {
        'id': int(idx + 1),
        'placa': str(row.get('PLACA') or 'N/I').strip(),
        'prefixo': str(row.get('PREFIXO') or '-').strip(),
        'categoria': categoria,
        'motorista': motorista,
        'cpf': str(row.get('CPF') or '-').strip(),
        'uo': str(row.get('UO') or 'CASAGRANDE').strip(),
        'tipo': tipo,
        'nivel': nivel,
        'limiar': lim,
        'limiar_str': f"{lim:.0f} km/h" if lim is not None else '-',
        'velocidade': vel,
        'valor': vel,
        'valor_str': f"{vel:.0f} km/h" if vel is not None else '-',
        'delta': delta,
        'delta_str': f"+{delta:.0f} km/h" if delta is not None else '-',
        'pct': pct,
        'duracao_str': dur_str,
        'duracao_sec': dur_sec,
        'logradouro': logradouro,
        'cidade': cidade,
        'estado': str(row.get('ESTADO') or 'MS').strip(),
        'lat': lat,
        'lng': lon,
        'data': '',
        'hora': hora_str,
        'hour': hour,
        'status': str(row.get('STATUS') or 'NOVO').strip()
    }
    records.append(rec)

resolved_dates = resolve_dates_br(parsed_dates)
for i, r in enumerate(records):
    r['data'] = resolved_dates[i]

# Global telemetry context across the whole file
telemetry_summary = df['TIPO'].value_counts().to_dict()

# Unique vehicle categories from entire file
all_file_categories = sorted(list(set(fix_text_encoding(str(c).strip()) for c in df['CATEGORIA'].dropna() if str(c).strip() and str(c).strip() != '-' and str(c).strip().lower() != 'nan')))

# Mapping category -> plates across the entire dataset
category_plates_map = {}
for idx, row in df[['CATEGORIA', 'PLACA']].drop_duplicates().iterrows():
    c = fix_text_encoding(str(row['CATEGORIA']).strip())
    p = str(row['PLACA']).strip()
    if c and p and c != '-' and p != 'N/I':
        category_plates_map.setdefault(c, set()).add(p)
category_plates_json = {k: sorted(list(v)) for k, v in category_plates_map.items()}

placas_list = sorted(list(set(r['placa'] for r in records if r['placa'] and r['placa'] != 'N/I')))
motoristas_list = sorted(list(set(r['motorista'] for r in records if r['motorista'])))
tipos_list = ['EXCESSO_VELOCIDADE', 'EXCESSO_VELOCIDADE_POR_VIA']
logradouros_list = [item[0] for item in pd.Series([r['logradouro'] for r in records]).value_counts().head(25).items() if item[0] != 'Não Informado']

def date_sort_key(d):
    p = d.split('/')
    return f"{p[2]}-{p[1]}-{p[0]}" if len(p) == 3 else d

datas_list = sorted(list(set(r['data'] for r in records if r['data'])), key=date_sort_key)
period_str = f"{datas_list[0]} a {datas_list[-1]}" if datas_list else "Setembro a Outubro de 2026"

data_payload = {
    'meta': {
        'app_name': 'Controle_Velocidade_CSG',
        'total_file_alerts': len(df),
        'total_speed_alerts': len(records),
        'period': period_str,
        'uo': 'CASAGRANDE',
        'telemetry_distribution': telemetry_summary,
        'categorias': all_file_categories,
        'category_plates': category_plates_json,
        'placas': placas_list,
        'motoristas': motoristas_list,
        'tipos': tipos_list,
        'logradouros': logradouros_list,
        'datas': datas_list
    },
    'records': records
}

print(f"Dataset generated: {len(records)} speed records across {len(placas_list)} vehicles, {len(all_file_categories)} categories, {len(motoristas_list)} drivers.")
print("Categories and plate count:")
for c in all_file_categories:
    cnt_alerts = sum(1 for r in records if r['categoria'] == c)
    cnt_plates = len(category_plates_json.get(c, []))
    print(f"  {c}: {cnt_alerts} speed alerts, {cnt_plates} vehicles")

out_path = 'data/dashboard_data.json' if os.path.exists('data') else 'dashboard_data.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(data_payload, f, ensure_ascii=False)

print(f"{out_path} created successfully!")
