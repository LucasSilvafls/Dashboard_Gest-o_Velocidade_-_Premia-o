"""
Camada de repositório e consultas analíticas para o banco de dados.
Serve dados diretamente da base relacional para a API e exportação do dashboard.
"""

import json
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import bcrypt
from sqlalchemy import asc, desc, func, select
from sqlalchemy.orm import Session

from database.models import Alerta, LoteIngestao, Motorista, Usuario, UserRole, Veiculo


def get_summary_stats(session: Session) -> Dict[str, Any]:
    """Retorna estatísticas consolidadas da base relacional."""
    total_alertas = session.scalar(select(func.count(Alerta.id))) or 0
    total_velocidade = session.scalar(
        select(func.count(Alerta.id)).where(Alerta.is_velocidade == True)
    ) or 0
    total_veiculos = session.scalar(select(func.count(Veiculo.id))) or 0
    total_motoristas = session.scalar(select(func.count(Motorista.id))) or 0

    # Distribuição por tipo de alerta
    tipos_rows = session.execute(
        select(Alerta.tipo, func.count(Alerta.id))
        .group_by(Alerta.tipo)
        .order_by(desc(func.count(Alerta.id)))
    ).all()
    telemetry_dist = {tipo: count for tipo, count in tipos_rows}

    # Período de apuração
    min_date = session.scalar(select(func.min(Alerta.data_evento)))
    max_date = session.scalar(select(func.max(Alerta.data_evento)))

    period_str = ""
    if min_date and max_date:
        period_str = f"{min_date.strftime('%d/%m/%Y')} a {max_date.strftime('%d/%m/%Y')}"

    return {
        "total_alertas": total_alertas,
        "total_velocidade": total_velocidade,
        "total_veiculos": total_veiculos,
        "total_motoristas": total_motoristas,
        "periodo": period_str,
        "distribuicao_telemetria": telemetry_dist,
    }


def get_dashboard_data(session: Session) -> Dict[str, Any]:
    """
    Recupera e consolida todos os dados do dashboard diretamente da base relacional.
    Zero dependência de arquivos físicos locais.
    Retorna o formato estruturado com meta e records exigido pelo frontend.
    """
    # 1. Busca todos os alertas de velocidade ordenados por data e hora
    speed_alerts = session.scalars(
        select(Alerta)
        .where(Alerta.is_velocidade == True)
        .order_by(Alerta.data_evento.asc(), Alerta.hora_evento.asc())
    ).all()

    records = [alert.to_dashboard_dict() for alert in speed_alerts]

    # Reindexa IDs de 1 a N para compatibilidade de UI
    for idx, r in enumerate(records, start=1):
        r["id"] = idx

    # 2. Distribuição geral de telemetria de toda a frota
    tipos_query = session.execute(
        select(Alerta.tipo, func.count(Alerta.id))
        .group_by(Alerta.tipo)
        .order_by(desc(func.count(Alerta.id)))
    ).all()
    telemetry_summary = {tipo: cnt for tipo, cnt in tipos_query}

    # 3. Categorias e veículos cadastrados
    veiculos = session.scalars(select(Veiculo).order_by(Veiculo.placa)).all()
    category_plates_map = defaultdict(set)
    all_categories_set = set()

    for v in veiculos:
        cat = v.categoria or "Não Classificado"
        all_categories_set.add(cat)
        if v.placa and v.placa != "N/I":
            category_plates_map[cat].add(v.placa)

    all_file_categories = sorted(list(all_categories_set))
    category_plates_json = {
        k: sorted(list(v)) for k, v in category_plates_map.items()
    }

    # 4. Listas únicas para os filtros
    placas_list = sorted(list(set(r["placa"] for r in records if r["placa"] and r["placa"] != "N/I")))
    motoristas_list = sorted(list(set(r["motorista"] for r in records if r["motorista"])))
    tipos_list = ["EXCESSO_VELOCIDADE", "EXCESSO_VELOCIDADE_POR_VIA"]

    # Top logradouros
    logradouros_counts = defaultdict(int)
    for r in records:
        log = r["logradouro"]
        if log and log != "Não Informado":
            logradouros_counts[log] += 1
    logradouros_list = [
        item[0]
        for item in sorted(logradouros_counts.items(), key=lambda x: x[1], reverse=True)[:25]
    ]

    # Datas ordenadas
    def date_sort_key(d: str) -> str:
        parts = d.split("/")
        return f"{parts[2]}-{parts[1]}-{parts[0]}" if len(parts) == 3 else d

    datas_list = sorted(list(set(r["data"] for r in records if r["data"])), key=date_sort_key)
    period_str = f"{datas_list[0]} a {datas_list[-1]}" if datas_list else "Setembro a Outubro de 2026"

    total_file_alerts = session.scalar(select(func.count(Alerta.id))) or len(records)

    return {
        "meta": {
            "app_name": "Controle_Velocidade_CSG",
            "total_file_alerts": total_file_alerts,
            "total_speed_alerts": len(records),
            "period": period_str,
            "uo": "CASAGRANDE",
            "telemetry_distribution": telemetry_summary,
            "categorias": all_file_categories,
            "category_plates": category_plates_json,
            "placas": placas_list,
            "motoristas": motoristas_list,
            "tipos": tipos_list,
            "logradouros": logradouros_list,
            "datas": datas_list,
        },
        "records": records,
    }


def export_dashboard_json(
    session: Session, output_path: str = "data/dashboard_data.json"
) -> Dict[str, Any]:
    """
    Gera o arquivo dashboard_data.json a partir dos registros do banco de dados relacional.
    Garante sincronização total entre o banco e o dashboard HTML autossuficiente.
    """
    payload = get_dashboard_data(session)

    out_file = Path(output_path)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    return payload


def get_filter_options(session: Session) -> Dict[str, Any]:
    """Retorna opções disponíveis para os filtros do dashboard a partir do banco."""
    # Categorias e placas
    veiculos = session.scalars(select(Veiculo).order_by(Veiculo.placa)).all()
    category_plates_map = defaultdict(set)
    all_categories = set()
    all_plates = set()

    for v in veiculos:
        cat = v.categoria or "Não Classificado"
        all_categories.add(cat)
        if v.placa and v.placa != "N/I":
            category_plates_map[cat].add(v.placa)
            all_plates.add(v.placa)

    # Motoristas com alertas
    motoristas = session.scalars(
        select(Alerta.motorista)
        .where(Alerta.motorista != "Sem Identificação")
        .distinct()
        .order_by(Alerta.motorista)
    ).all()

    # Tipos de alerta
    tipos = session.scalars(select(Alerta.tipo).distinct().order_by(Alerta.tipo)).all()

    # Datas registradas
    datas_raw = session.scalars(
        select(Alerta.data_evento)
        .where(Alerta.data_evento != None)
        .distinct()
        .order_by(Alerta.data_evento)
    ).all()
    datas_fmt = [d.strftime("%d/%m/%Y") for d in datas_raw if d]

    return {
        "categorias": sorted(list(all_categories)),
        "category_plates": {k: sorted(list(v)) for k, v in category_plates_map.items()},
        "placas": sorted(list(all_plates)),
        "motoristas": sorted(list(set(motoristas))),
        "tipos": sorted(list(set(tipos))),
        "datas": datas_fmt,
    }


def get_paginated_alerts(
    session: Session,
    page: int = 1,
    page_size: int = 50,
    placa: Optional[str] = None,
    categoria: Optional[str] = None,
    motorista: Optional[str] = None,
    tipo: Optional[str] = None,
    nivel: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    min_velocidade: Optional[float] = None,
    is_velocidade: Optional[bool] = None,
) -> Dict[str, Any]:
    """Consulta paginada e filtrada de alertas diretamente na base relacional."""
    query = select(Alerta)

    if is_velocidade is not None:
        query = query.where(Alerta.is_velocidade == is_velocidade)
    if placa:
        query = query.where(Alerta.placa.ilike(f"%{placa.strip()}%"))
    if categoria:
        query = query.where(Alerta.categoria.ilike(f"%{categoria.strip()}%"))
    if motorista:
        query = query.where(Alerta.motorista.ilike(f"%{motorista.strip()}%"))
    if tipo:
        query = query.where(Alerta.tipo == tipo)
    if nivel:
        query = query.where(Alerta.nivel == nivel)
    if data_inicio:
        query = query.where(Alerta.data_evento >= data_inicio)
    if data_fim:
        query = query.where(Alerta.data_evento <= data_fim)
    if min_velocidade is not None:
        query = query.where(Alerta.velocidade >= min_velocidade)

    # Conta o total de registros correspondentes aos filtros
    count_query = select(func.count()).select_from(query.subquery())
    total = session.scalar(count_query) or 0

    # Ordenação decrescente por data e hora do evento
    query = query.order_by(desc(Alerta.data_evento), desc(Alerta.hora_evento))

    # Paginação
    offset = max(0, (page - 1) * page_size)
    items_raw = session.scalars(query.offset(offset).limit(page_size)).all()
    items = [alert.to_dashboard_dict() for alert in items_raw]

    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }


def get_rankings(session: Session, limit: int = 10) -> Dict[str, Any]:
    """Retorna ranking dos motoristas e veículos mais reincidentes."""
    # Top Motoristas em excesso de velocidade
    top_motoristas_rows = session.execute(
        select(
            Alerta.motorista,
            func.count(Alerta.id).label("total_alertas"),
            func.max(Alerta.velocidade).label("pico_velocidade"),
            func.avg(Alerta.delta).label("delta_medio"),
            func.sum(Alerta.duracao_segundos).label("duracao_total_sec"),
        )
        .where(Alerta.is_velocidade == True, Alerta.motorista != "Sem Identificação")
        .group_by(Alerta.motorista)
        .order_by(desc("total_alertas"))
        .limit(limit)
    ).all()

    top_motoristas = [
        {
            "motorista": row.motorista,
            "total_alertas": row.total_alertas,
            "pico_velocidade": round(row.pico_velocidade, 1) if row.pico_velocidade else 0.0,
            "delta_medio": round(row.delta_medio, 1) if row.delta_medio else 0.0,
            "duracao_total_sec": row.duracao_total_sec or 0,
        }
        for row in top_motoristas_rows
    ]

    # Top Veículos em excesso de velocidade
    top_veiculos_rows = session.execute(
        select(
            Alerta.placa,
            Alerta.categoria,
            func.count(Alerta.id).label("total_alertas"),
            func.max(Alerta.velocidade).label("pico_velocidade"),
            func.avg(Alerta.delta).label("delta_medio"),
        )
        .where(Alerta.is_velocidade == True, Alerta.placa != "N/I")
        .group_by(Alerta.placa, Alerta.categoria)
        .order_by(desc("total_alertas"))
        .limit(limit)
    ).all()

    top_veiculos = [
        {
            "placa": row.placa,
            "categoria": row.categoria,
            "total_alertas": row.total_alertas,
            "pico_velocidade": round(row.pico_velocidade, 1) if row.pico_velocidade else 0.0,
            "delta_medio": round(row.delta_medio, 1) if row.delta_medio else 0.0,
        }
        for row in top_veiculos_rows
    ]

    return {
        "top_motoristas": top_motoristas,
        "top_veiculos": top_veiculos,
    }


def get_premiacao_data(
    session: Session, threshold_kmh: float = 80.0
) -> List[Dict[str, Any]]:
    """
    Consolida o status dos motoristas x caminhões em relação à regra de premiação (teto de 80 km/h).
    Considera categorias pesadas: CAVALO, CAÇAMBA, PIPA, COMBOIO, MUNK, ÔNIBUS.
    """
    categorias_pesadas = [
        "CAVALO", "CAÇAMBA", "CACAMBA", "PIPA", "COMBOIO", "MUNK", "MUNCK", "ONIBUS", "ÔNIBUS"
    ]

    rows = session.execute(
        select(
            Alerta.motorista,
            func.count(Alerta.id).label("total_excessos"),
            func.max(Alerta.velocidade).label("velocidade_maxima"),
            func.avg(Alerta.delta).label("delta_medio"),
        )
        .where(
            Alerta.is_velocidade == True,
            Alerta.motorista != "Sem Identificação",
            Alerta.categoria.in_(categorias_pesadas),
            Alerta.velocidade > threshold_kmh,
        )
        .group_by(Alerta.motorista)
        .order_by(asc("total_excessos"))
    ).all()

    # Todos os condutores identificados em veículos pesados com velocidade máxima geral registrada
    condutores_max_rows = session.execute(
        select(
            Alerta.motorista,
            func.max(Alerta.velocidade).label("velocidade_maxima_geral"),
        )
        .where(
            Alerta.motorista != "Sem Identificação",
            Alerta.categoria.in_(categorias_pesadas),
        )
        .group_by(Alerta.motorista)
    ).all()

    max_vel_map = {
        r.motorista: round(r.velocidade_maxima_geral, 1) if r.velocidade_maxima_geral else 0.0
        for r in condutores_max_rows
    }
    todos_condutores = list(max_vel_map.keys())

    infraction_map = {row.motorista: row for row in rows}

    resultado = []
    thresh_int = int(threshold_kmh)
    for condutor in sorted(todos_condutores):
        pico_geral = max_vel_map.get(condutor, 0.0)
        if condutor in infraction_map:
            row = infraction_map[condutor]
            pico = round(row.velocidade_maxima, 1) if row.velocidade_maxima else pico_geral
            resultado.append({
                "motorista": condutor,
                "total_excessos": row.total_excessos,
                "velocidade_maxima": pico,
                "delta_medio": round(row.delta_medio, 1) if row.delta_medio else 0.0,
                "elegivel": row.total_excessos == 0,
                "status_premiacao": f"Desqualificado (>{thresh_int} km/h)" if row.total_excessos > 0 else "Elegível 100%",
            })
        else:
            resultado.append({
                "motorista": condutor,
                "total_excessos": 0,
                "velocidade_maxima": pico_geral,
                "delta_medio": 0.0,
                "elegivel": True,
                "status_premiacao": "Elegível 100%",
            })

    # Ordena: elegíveis primeiro, depois por menor número de excessos
    resultado.sort(key=lambda x: (not x["elegivel"], x["total_excessos"]))
    return resultado


def get_lotes_history(session: Session, limit: int = 50) -> List[Dict[str, Any]]:
    """Retorna histórico de auditoria dos lotes de ingestão de planilhas."""
    lotes = session.scalars(
        select(LoteIngestao).order_by(desc(LoteIngestao.id)).limit(limit)
    ).all()
    return [lote.to_dict() for lote in lotes]


# -------------------------------------------------------------------------
# Gestão de Usuários e Autenticação (RBAC)
# -------------------------------------------------------------------------

def get_usuario_by_username(session: Session, username: str) -> Optional[Usuario]:
    """Busca usuário pelo nome de usuário único."""
    return session.scalar(select(Usuario).where(Usuario.username == username.strip()))


def get_usuario_by_id(session: Session, user_id: int) -> Optional[Usuario]:
    """Busca usuário pelo identificador numérico ID."""
    return session.scalar(select(Usuario).where(Usuario.id == user_id))


def list_usuarios(session: Session) -> List[Usuario]:
    """Lista todos os usuários cadastrados."""
    return session.scalars(select(Usuario).order_by(Usuario.username)).all()


def create_usuario(
    session: Session,
    username: str,
    raw_password: str,
    role: str = UserRole.VIEWER.value,
    email: Optional[str] = None,
    nome_completo: Optional[str] = None,
) -> Usuario:
    """Cria um novo usuário com senha criptografada via bcrypt."""
    hashed = bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    usuario = Usuario(
        username=username.strip(),
        email=email.strip() if email else None,
        hashed_password=hashed,
        role=role.lower().strip(),
        nome_completo=nome_completo.strip() if nome_completo else None,
        ativo=True,
    )
    session.add(usuario)
    session.flush()
    return usuario


def seed_default_users(
    session: Session,
    default_admin_pass: str = "admin123",
    default_viewer_pass: str = "viewer123",
    default_corporate_pass: str = "Casagrande@2026",
) -> Dict[str, str]:
    """
    Inicializa os usuários padrão do sistema (Admin, Viewer e Contas Corporativas CCO) se ainda não existirem.
    - admin / admin123 (Role: admin -> permissão de upload e dashboards)
    - viewer / viewer123 (Role: viewer -> permissão de visualização e filtros)
    - admincasagrande / Casagrande@2026 (Role: admin)
    - rafaelcasagrande / Casagrande@2026 (Role: admin)
    - rafael / Casagrande@2026 (Role: admin)
    - operadorcasagrande / Casagrande@2026 (Role: viewer)
    """
    seeded = {}

    admin_user = get_usuario_by_username(session, "admin")
    if not admin_user:
        create_usuario(
            session=session,
            username="admin",
            raw_password=default_admin_pass,
            role=UserRole.ADMIN.value,
            email="admin@casagrandelocacoes.com.br",
            nome_completo="Administrador CSG",
        )
        seeded["admin"] = "Criado com sucesso (role=admin)"

    viewer_user = get_usuario_by_username(session, "viewer")
    if not viewer_user:
        create_usuario(
            session=session,
            username="viewer",
            raw_password=default_viewer_pass,
            role=UserRole.VIEWER.value,
            email="visualizador@casagrandelocacoes.com.br",
            nome_completo="Visualizador CSG",
        )
        seeded["viewer"] = "Criado com sucesso (role=viewer)"

    corporate_accounts = [
        ("admincasagrande", UserRole.ADMIN.value, "admincasagrande@casagrandetransportes.com.br", "Administrador CCO"),
        ("rafaelcasagrande", UserRole.ADMIN.value, "rafaelcasagrande@casagrandetransportes.com.br", "Rafael Casagrande"),
        ("rafael", UserRole.ADMIN.value, "rafael@casagrandetransportes.com.br", "Rafael Casagrande"),
        ("operadorcasagrande", UserRole.VIEWER.value, "operadorcasagrande@casagrandetransportes.com.br", "Operador CCO"),
    ]

    for uname, role_val, email_val, nome_val in corporate_accounts:
        existing_corp = get_usuario_by_username(session, uname)
        if not existing_corp:
            create_usuario(
                session=session,
                username=uname,
                raw_password=default_corporate_pass,
                role=role_val,
                email=email_val,
                nome_completo=nome_val,
            )
            seeded[uname] = f"Criado com sucesso (role={role_val})"

    return seeded
