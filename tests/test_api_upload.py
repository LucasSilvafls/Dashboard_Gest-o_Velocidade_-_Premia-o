"""
Testes automatizados para Upload de Planilhas e Controle de Permissão (Admin vs Viewer).
Garante que apenas Administradores autenticados conseguem enviar planilhas (Task 1).
"""

import io
import pandas as pd
import pytest
from fastapi import status


def create_sample_excel_bytes() -> bytes:
    """Gera planilha Excel em memória com colunas canônicas da telemetria CSG."""
    df = pd.DataFrame([
        {
            "Veículo": "UGY5G31",
            "Prefixo": "Z8852D",
            "Categoria": "CAVALO",
            "Motorista": "SENIVALDO COSTA RODRIGUES",
            "CPF": "96521430149",
            "Tipo": "EXCESSO DE VELOCIDADE",
            "Nível": "ALTO",
            "Limiar": "80 km/h",
            "Valor": "98 km/h",
            "Delta": "18 km/h",
            "Duração": "00:02:10",
            "Logradouro": "MS-436",
            "Cidade": "Camapuã",
            "Data": "25/10/2026",
            "Hora": "16:20:00",
        }
    ])
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Telemetria")
    return buf.getvalue()


class TestUploadAndIngestionAPI:
    def test_upload_unauthenticated_rejected(self, client):
        """Verifica que requisição de upload sem token é rejeitada com 401."""
        sample_bytes = create_sample_excel_bytes()
        response = client.post(
            "/api/upload",
            files={"file": ("teste.xlsx", sample_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_upload_as_viewer_forbidden(self, client, viewer_headers):
        """
        REGRA CRÍTICA DE NEGÓCIO:
        Verifica que usuário com papel 'viewer' é terminantemente bloqueado (403 Forbidden).
        Apenas 'admin' pode fazer upload de novas planilhas.
        """
        sample_bytes = create_sample_excel_bytes()
        response = client.post(
            "/api/upload",
            files={"file": ("planilha_outubro.xlsx", sample_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=viewer_headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
        data = response.json()
        assert "Acesso negado" in data["detail"]
        assert "admin" in data["detail"]

    def test_upload_as_admin_invalid_file_extension(self, client, admin_headers):
        """Verifica que arquivos não suportados (ex: .txt) são rejeitados com 400 Bad Request."""
        text_bytes = b"conteudo de texto nao suportado"
        response = client.post(
            "/api/upload",
            files={"file": ("dados.txt", text_bytes, "text/plain")},
            headers=admin_headers,
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Formato de arquivo não suportado" in response.json()["detail"]

    def test_upload_as_admin_success(self, client, admin_headers):
        """
        Verifica que usuário autenticado como 'admin' consegue fazer upload de planilha Excel,
        acionando o pipeline ETL e retornando estatísticas do processamento.
        """
        sample_bytes = create_sample_excel_bytes()
        response = client.post(
            "/api/upload?mode=upsert&export_json=false",
            files={"file": ("planilha_oficial_csg.xlsx", sample_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=admin_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["arquivo"] == "planilha_oficial_csg.xlsx"
        assert data["lote_id"] > 0
        assert data["total_lidas"] == 1
        assert data["status"] == "SUCESSO"
        assert data["uploaded_by"] == "admin"
        assert "processada e banco de dados sincronizado" in data["message"]

    def test_list_lotes_ingestao(self, client, viewer_headers, admin_headers):
        """Verifica histórico de auditoria de lotes de ingestão."""
        # Viewer pode consultar auditoria
        resp_viewer = client.get("/api/upload/lotes", headers=viewer_headers)
        assert resp_viewer.status_code == status.HTTP_200_OK
        assert isinstance(resp_viewer.json(), list)

        # Admin também pode consultar auditoria
        resp_admin = client.get("/api/upload/lotes", headers=admin_headers)
        assert resp_admin.status_code == status.HTTP_200_OK
