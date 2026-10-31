"""
Testes automatizados para Endpoints do Dashboard de Velocidade e Telemetria.
Garante que os dados são servidos diretamente do banco relacional.
"""

import pytest
from fastapi import status


class TestDashboardAPI:
    def test_get_dashboard_data_unauthenticated(self, client):
        """Verifica que o endpoint de dados exige autenticação (401)."""
        response = client.get("/api/dashboard/data")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_dashboard_data_as_viewer(self, client, viewer_headers):
        """Verifica que Viewer tem acesso ao dataset consolidado do banco de dados."""
        response = client.get("/api/dashboard/data", headers=viewer_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "meta" in data
        assert "records" in data
        assert data["meta"]["app_name"] == "Controle_Velocidade_CSG"
        assert len(data["records"]) > 0

        # Valida campos de um registro de alerta
        record = data["records"][0]
        assert "placa" in record
        assert "categoria" in record
        assert "motorista" in record
        assert "velocidade" in record
        assert "limiar" in record
        assert "delta" in record

    def test_get_dashboard_data_as_admin(self, client, admin_headers):
        """Verifica que Admin também acessa o dataset normalmente."""
        response = client.get("/api/dashboard/data", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK

    def test_get_summary_stats(self, client, viewer_headers):
        """Verifica endpoint de KPIs consolidados da frota."""
        response = client.get("/api/dashboard/summary", headers=viewer_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "total_alertas" in data
        assert "total_velocidade" in data
        assert "total_veiculos" in data
        assert "total_motoristas" in data
        assert "distribuicao_telemetria" in data
        assert data["total_alertas"] >= 2

    def test_get_filter_options(self, client, viewer_headers):
        """Verifica opções para os filtros da interface gráfica."""
        response = client.get("/api/dashboard/filters", headers=viewer_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "categorias" in data
        assert "category_plates" in data
        assert "placas" in data
        assert "motoristas" in data
        assert "datas" in data
        assert "CAVALO" in data["categorias"]

    def test_list_alerts_paginated(self, client, viewer_headers):
        """Verifica paginação e parâmetros de consulta de alertas."""
        response = client.get(
            "/api/dashboard/alerts?page=1&page_size=1",
            headers=viewer_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 1
        assert len(data["items"]) == 1
        assert data["total"] >= 2

    def test_list_alerts_with_filter(self, client, viewer_headers):
        """Verifica filtragem por placa específica."""
        response = client.get(
            "/api/dashboard/alerts?placa=UGY5G31",
            headers=viewer_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        for item in data["items"]:
            assert item["placa"] == "UGY5G31"

    def test_get_rankings(self, client, viewer_headers):
        """Verifica ranking de condutores e veículos."""
        response = client.get("/api/dashboard/rankings", headers=viewer_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "top_motoristas" in data
        assert "top_veiculos" in data
        assert len(data["top_motoristas"]) > 0

    def test_get_premiacao(self, client, viewer_headers):
        """Verifica apuração do Programa de Premiação 80 km/h."""
        response = client.get(
            "/api/dashboard/premiacao?limite_kmh=80.0",
            headers=viewer_headers,
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        item = data[0]
        assert "motorista" in item
        assert "total_excessos" in item
        assert "elegivel" in item
        assert "status_premiacao" in item

    def test_public_health_and_root(self, client):
        """Verifica endpoints públicos de monitoramento e documentação."""
        resp_health = client.get("/api/health")
        assert resp_health.status_code == status.HTTP_200_OK
        assert resp_health.json()["status"] == "healthy"

        resp_root = client.get("/")
        assert resp_root.status_code == status.HTTP_200_OK
        assert "documentacao_swagger" in resp_root.json()

    def test_openapi_schema_available(self, client):
        """Verifica geração automática da especificação OpenAPI (Swagger)."""
        response = client.get("/openapi.json")
        assert response.status_code == status.HTTP_200_OK
        openapi = response.json()
        assert openapi["openapi"].startswith("3.")
        assert "paths" in openapi
        assert "/api/dashboard/data" in openapi["paths"]
        assert "/api/upload" in openapi["paths"]
        assert "/api/auth/login" in openapi["paths"]
