"""
Script de Migração de Dados do SQLite Local (telemetria.db) para o Supabase.
Migra Veículos, Motoristas e Eventos com higienização de texto e deduplicação.
"""

import sqlite3
import json
import os
import urllib.request
import urllib.error
from pathlib import Path

# Configurações do Supabase
BASE_DIR = Path(__file__).resolve().parent.parent
SUPABASE_URL = "https://rmtacyjdumcwmasksvqz.supabase.co"
SUPABASE_KEY = "sb_publishable_EpVfAIR5fdX3J3Jo3bUY8Q_1gwerDPe"

def fix_text(val):
    if not val:
        return val
    s = str(val).strip()
    s = s.replace('\ufffd', 'Ç').replace('CAAMBA', 'CAÇAMBA').replace('CA?AMBA', 'CAÇAMBA')
    s = s.replace('ONIBUS', 'ÔNIBUS')
    return s

def supabase_post(endpoint, data_list):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates,return=minimal"
    }
    req = urllib.request.Request(url, data=json.dumps(data_list).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        print(f"Erro ao inserir em {endpoint}: HTTP {e.code} - {e.read().decode()}")
        return None

def migrate():
    db_path = BASE_DIR / "telemetria.db"
    if not db_path.exists():
        print(f"Erro: {db_path} não encontrado.")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    print("[*] Iniciando migracao para o Supabase...")

    # 1. Migrar Veículos
    print("\n[+] 1. Migrando Veiculos...")
    cursor.execute("SELECT placa, prefixo, categoria, uo FROM veiculos")
    veiculos = []
    for row in cursor.fetchall():
        veiculos.append({
            "placa": row["placa"],
            "prefixo": row["prefixo"],
            "categoria": fix_text(row["categoria"]),
            "uo": row["uo"] or "CASAGRANDE"
        })
    if veiculos:
        supabase_post("veiculos", veiculos)
        print(f"   [OK] {len(veiculos)} veiculos sincronizados com sucesso.")

    # 2. Migrar Motoristas
    print("\n[+] 2. Migrando Motoristas...")
    cursor.execute("SELECT DISTINCT motorista, cpf FROM alertas WHERE motorista IS NOT NULL AND motorista != ''")
    motoristas = []
    seen = set()
    for row in cursor.fetchall():
        nome = fix_text(row["motorista"])
        cpf = row["cpf"] or "-"
        key = (nome, cpf)
        if key not in seen:
            seen.add(key)
            motoristas.append({
                "nome": nome,
                "cpf": cpf
            })
    if motoristas:
        supabase_post("motoristas", motoristas)
        print(f"   [OK] {len(motoristas)} motoristas unicos sincronizados.")

    # 3. Migrar Eventos de Telemetria em Lotes de 500
    print("\n[+] 3. Migrando Eventos de Telemetria (16.067 registros)...")
    cursor.execute("""
        SELECT 
            hash_id, placa, prefixo, categoria, motorista, cpf, uo, tipo, nivel,
            limiar, velocidade, delta, pct, duracao_str, duracao_segundos,
            logradouro, cidade, estado, latitude, longitude,
            data_evento, hora_evento, hora_inteira, status
        FROM alertas
    """)

    batch_size = 500
    batch = []
    total_migrados = 0

    for row in cursor.fetchall():
        item = {
            "hash_dedup": row["hash_id"] or f"{row['placa']}_{row['data_evento']}_{row['hora_evento']}_{row['velocidade']}",
            "placa": row["placa"],
            "prefixo": row["prefixo"],
            "categoria": fix_text(row["categoria"]),
            "motorista": fix_text(row["motorista"]) or "Sem Identificação",
            "cpf": row["cpf"] or "-",
            "uo": row["uo"] or "CASAGRANDE",
            "tipo": row["tipo"] or "EXCESSO_VELOCIDADE",
            "nivel": row["nivel"] or "MEDIO",
            "limiar": float(row["limiar"]) if row["limiar"] is not None else 80.0,
            "velocidade": float(row["velocidade"]) if row["velocidade"] is not None else 0.0,
            "delta": float(row["delta"]) if row["delta"] is not None else 0.0,
            "pct": float(row["pct"]) if row["pct"] is not None else 0.0,
            "duracao_str": row["duracao_str"] or "00:00:00",
            "duracao_sec": int(row["duracao_segundos"] or 0),
            "logradouro": fix_text(row["logradouro"]) or "Não Informado",
            "cidade": fix_text(row["cidade"]) or "Não Informado",
            "estado": fix_text(row["estado"]) or "Não Informado",
            "lat": float(row["latitude"]) if row["latitude"] is not None else None,
            "lng": float(row["longitude"]) if row["longitude"] is not None else None,
            "data_evento": row["data_evento"],
            "hora_evento": row["hora_evento"],
            "hour": int(row["hora_inteira"] or 0),
            "status": row["status"] or "NOVO"
        }
        batch.append(item)

        if len(batch) >= batch_size:
            res = supabase_post("eventos_telemetria", batch)
            if res:
                total_migrados += len(batch)
                print(f"   [...] Progresso: {total_migrados} registros migrados...")
            batch = []

    # Envia o restante se houver
    if batch:
        res = supabase_post("eventos_telemetria", batch)
        if res:
            total_migrados += len(batch)
            print(f"   [...] Progresso: {total_migrados} registros migrados...")

    print(f"\n[SUCESSO] Migracao finalizada! Total sincronizado no Supabase: {total_migrados} eventos.")
    conn.close()

if __name__ == "__main__":
    migrate()
