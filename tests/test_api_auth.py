"""
Testes automatizados para Autenticação, Tokens JWT e Controle de Acesso (RBAC).
"""

import pytest
from fastapi import status


class TestAuthenticationAPI:
    def test_login_admin_success(self, client):
        """Verifica login com sucesso do usuário Administrador."""
        response = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "admin123"},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["role"] == "admin"
        assert data["username"] == "admin"

    def test_login_viewer_success(self, client):
        """Verifica login com sucesso do usuário Visualizador."""
        response = client.post(
            "/api/auth/login",
            json={"username": "viewer", "password": "viewer123"},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["role"] == "viewer"
        assert data["username"] == "viewer"

    def test_login_invalid_password(self, client):
        """Verifica rejeição (401) com senha incorreta."""
        response = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "senha_errada_123"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Credenciais incorretas" in response.json()["detail"]

    def test_login_nonexistent_user(self, client):
        """Verifica rejeição (401) para usuário inexistente."""
        response = client.post(
            "/api/auth/login",
            json={"username": "usuario_fantasma", "password": "qualquer_senha"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_oauth2_form(self, client):
        """Verifica compatibilidade com o formato OAuth2 do Swagger UI (/api/auth/token)."""
        response = client.post(
            "/api/auth/token",
            data={"username": "admin", "password": "admin123"},
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["role"] == "admin"

    def test_me_endpoint_with_valid_token(self, client, admin_headers, viewer_headers):
        """Verifica recuperação do próprio perfil logado."""
        # Admin
        resp_admin = client.get("/api/auth/me", headers=admin_headers)
        assert resp_admin.status_code == status.HTTP_200_OK
        assert resp_admin.json()["username"] == "admin"
        assert resp_admin.json()["role"] == "admin"

        # Viewer
        resp_viewer = client.get("/api/auth/me", headers=viewer_headers)
        assert resp_viewer.status_code == status.HTTP_200_OK
        assert resp_viewer.json()["username"] == "viewer"
        assert resp_viewer.json()["role"] == "viewer"

    def test_me_endpoint_without_token(self, client):
        """Verifica bloqueio (401) ao tentar acessar sem token."""
        response = client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_endpoint_with_invalid_token(self, client):
        """Verifica bloqueio (401) para token forjado ou corrompido."""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer token.completamente.invalido"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_admin_can_list_users(self, client, admin_headers):
        """Verifica que perfil Admin consegue listar todos os usuários."""
        response = client.get("/api/auth/users", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        users = response.json()
        usernames = [u["username"] for u in users]
        assert "admin" in usernames
        assert "viewer" in usernames

    def test_viewer_cannot_list_users(self, client, viewer_headers):
        """Verifica que perfil Viewer NÃO tem permissão para listar usuários (403 Forbidden)."""
        response = client.get("/api/auth/users", headers=viewer_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Acesso negado" in response.json()["detail"]

    def test_admin_can_create_user(self, client, admin_headers):
        """Verifica criação de novo usuário por um Admin."""
        new_user_payload = {
            "username": "operador1",
            "password": "senhaForte123",
            "role": "viewer",
            "email": "operador1@casagrande.com.br",
            "nome_completo": "Operador Sala de Controle",
        }
        response = client.post(
            "/api/auth/users",
            json=new_user_payload,
            headers=admin_headers,
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["username"] == "operador1"
        assert data["role"] == "viewer"

        # Testa login com o novo usuário criado
        login_resp = client.post(
            "/api/auth/login",
            json={"username": "operador1", "password": "senhaForte123"},
        )
        assert login_resp.status_code == status.HTTP_200_OK
        assert login_resp.json()["role"] == "viewer"

    def test_viewer_cannot_create_user(self, client, viewer_headers):
        """Verifica que perfil Viewer NÃO pode cadastrar novos usuários (403 Forbidden)."""
        response = client.post(
            "/api/auth/users",
            json={"username": "hacker", "password": "123", "role": "admin"},
            headers=viewer_headers,
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
