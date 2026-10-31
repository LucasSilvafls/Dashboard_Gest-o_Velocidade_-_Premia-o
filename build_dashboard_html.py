# -*- coding: utf-8 -*-
"""
Compilador do Dashboard de Velocidade e Painel Administrativo CSG.
Monta a arquitetura modular da pasta frontend/ (HTML components, CSS tokens e JS modules)
e compila o arquivo autônomo executável dashboard_velocidade.html com logos em Base64
e dataset embutido para visualização offline.
"""

import base64
import json
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

print(">> Compilando Painel de Controle de Velocidade e Telemetria CSG (Arquitetura Modular)...")

frontend_dir = BASE_DIR / "frontend"
template_file = BASE_DIR / "dashboard_template.html"

# Dataset compilado (busca em data/ ou na raiz para retrocompatibilidade)
data_file = BASE_DIR / "data" / "dashboard_data.json"
if not data_file.exists():
    data_file = BASE_DIR / "dashboard_data.json"

# Logotipos da identidade visual (busca em frontend/assets/ ou na raiz)
logo_light_file = BASE_DIR / "frontend" / "assets" / "logo_casagrande.png"
if not logo_light_file.exists():
    logo_light_file = BASE_DIR / "logo_casagrande.png"

logo_dark_file = BASE_DIR / "frontend" / "assets" / "logo_casagrande_dark.png"
if not logo_dark_file.exists():
    logo_dark_file = BASE_DIR / "logo_casagrande_dark.png"

output_file = BASE_DIR / "dashboard_velocidade.html"

if frontend_dir.exists() and (frontend_dir / "index.html").exists():
    print("   [+] Montando template a partir dos módulos em frontend/...")

    with open(frontend_dir / "index.html", "r", encoding="utf-8") as f:
        master_template = f.read()

    # 1. Carrega Componentes HTML
    components = {
        "<!-- {{TAB_OVERVIEW}} -->": "tab_overview.html",
        "<!-- {{TAB_CRITICAL}} -->": "tab_critical.html",
        "<!-- {{TAB_RANKINGS}} -->": "tab_rankings.html",
        "<!-- {{TAB_OCCURRENCES}} -->": "tab_occurrences.html",
        "<!-- {{TAB_PREMIACAO}} -->": "tab_premiacao.html",
        "<!-- {{TAB_AUDIT}} -->": "tab_audit.html",
        "<!-- {{TAB_ADMIN}} -->": "tab_admin.html",
        "<!-- {{MODALS}} -->": "modals.html",
    }

    comp_dir = frontend_dir / "components"
    for placeholder, filename in components.items():
        comp_path = comp_dir / filename
        if comp_path.exists():
            with open(comp_path, "r", encoding="utf-8") as cf:
                master_template = master_template.replace(placeholder, cf.read())
        else:
            print(f"   [!] Aviso: Componente '{filename}' não encontrado em {comp_dir}")

    # 2. Carrega CSS Bundles
    css_files = ["tokens.css", "components.css"]
    css_bundle_parts = []
    css_dir = frontend_dir / "css"
    for cf in css_files:
        c_path = css_dir / cf
        if c_path.exists():
            with open(c_path, "r", encoding="utf-8") as f:
                css_bundle_parts.append(f.read())
    css_bundle = "\n\n".join(css_bundle_parts)
    master_template = master_template.replace("/* {{CSS_BUNDLE}} */", css_bundle)

    # 3. Carrega JS Bundles
    js_files = [
        "api.js",
        "auth.js",
        "users.js",
        "audit.js",
        "charts.js",
        "filters.js",
        "premiacao.js",
        "app.js",
    ]
    js_bundle_parts = []
    js_dir = frontend_dir / "js"
    for jf in js_files:
        j_path = js_dir / jf
        if j_path.exists():
            with open(j_path, "r", encoding="utf-8") as f:
                js_bundle_parts.append(f"// Módulo: {jf}\n" + f.read())
    js_bundle = "\n\n".join(js_bundle_parts)
    master_template = master_template.replace("/* {{JS_BUNDLE}} */", js_bundle)

    template = master_template

    # Atualiza o arquivo dashboard_template.html para retrocompatibilidade
    with open(template_file, "w", encoding="utf-8") as f:
        f.write(template)
    print(f"   [OK] dashboard_template.html sincronizado com os módulos.")

else:
    print("   [+] Lendo dashboard_template.html existente...")
    if not template_file.exists():
        raise FileNotFoundError(f"Template '{template_file}' nao encontrado.")
    with open(template_file, "r", encoding="utf-8") as f:
        template = f.read()

# Carrega dataset consolidado
with open(data_file, "r", encoding="utf-8") as f:
    data_json_str = f.read()

# Carrega logotipos em Base64
with open(logo_light_file, "rb") as f:
    logo_light_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")

with open(logo_dark_file, "rb") as f:
    logo_dark_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")

# Injeta os assets e dataset no HTML autônomo
html_compiled = template.replace("__LOGO_DARK_B64__", logo_dark_b64) \
                        .replace("__LOGO_LIGHT_B64__", logo_light_b64) \
                        .replace("__INITIAL_DATA_JSON__", data_json_str)

with open(output_file, "w", encoding="utf-8") as f:
    f.write(html_compiled)

size_mb = output_file.stat().st_size / (1024 * 1024)
print(f"[OK] Arquivo autônomo compilado com sucesso: {output_file.name} ({size_mb:.2f} MB)")
