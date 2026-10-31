"""
Testes automatizados para a Refatoração do Frontend SPA e Painel Admin (Task 3).
Garante a integridade dos componentes visuais, templates, autenticação e rotas.
"""

from pathlib import Path
import pytest
from fastapi import status

from backend.config import BASE_DIR


@pytest.fixture(scope="module")
def dashboard_html():
    """Lê o HTML compilado do dashboard uma única vez para assertions de UI rápidas."""
    path = BASE_DIR / "dashboard_velocidade.html"
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


class TestFrontendSPAAndAdminPanel:
    def test_root_endpoint_contains_dashboard_link(self):
        """Verifica que a raiz da API disponibiliza o atalho para a SPA do Dashboard."""
        from backend.main import root
        data = root()
        assert "dashboard" in data
        assert data["dashboard"] == "/dashboard"

    def test_dashboard_endpoint_serves_html(self):
        """Verifica que /dashboard serve o HTML da SPA compilada com 200 OK e text/html."""
        from backend.main import get_dashboard_html
        response = get_dashboard_html()
        assert response.status_code == status.HTTP_200_OK
        assert "text/html" in response.media_type
        assert len(response.body) > 100_000

    def test_dashboard_contains_login_modal_and_presets(self, dashboard_html):
        """Verifica presença da tela/modal de login corporativo e atalhos de perfis."""
        # Modal de login e campos
        assert 'id="modal-login"' in dashboard_html
        assert 'id="login-username"' in dashboard_html
        assert 'id="login-password"' in dashboard_html
        assert 'id="login-submit-btn"' in dashboard_html
        assert 'id="login-error-banner"' in dashboard_html

        # Atalhos para teste de Admin e Viewer
        assert "quickFillAndLogin('admin', 'admin123')" in dashboard_html
        assert "quickFillAndLogin('viewer', 'viewer123')" in dashboard_html

    def test_dashboard_contains_api_status_indicator(self, dashboard_html):
        """Verifica chip de conectividade dinâmica com a API RESTful."""
        assert 'id="api-status-chip"' in dashboard_html
        assert 'id="api-status-dot"' in dashboard_html
        assert 'id="api-status-text"' in dashboard_html
        assert "fetchDashboardData(true)" in dashboard_html

    def test_dashboard_contains_user_auth_widget(self, dashboard_html):
        """Verifica widget de perfil do usuário com badge de permissão (RBAC)."""
        assert 'id="user-auth-container"' in dashboard_html
        assert 'id="user-authenticated-box"' in dashboard_html
        assert 'id="user-unauthenticated-box"' in dashboard_html
        assert 'id="user-name-display"' in dashboard_html
        assert 'id="user-role-badge"' in dashboard_html
        assert 'onclick="logoutUser()"' in dashboard_html

    def test_dashboard_contains_admin_restricted_tab(self, dashboard_html):
        """Verifica que a 6ª aba (Painel Admin) possui a classe restritiva admin-only."""
        assert 'id="tab-admin"' in dashboard_html
        assert 'class="tab-btn admin-only' in dashboard_html
        assert "6. Painel Admin & Upload" in dashboard_html

    def test_dashboard_contains_admin_upload_and_audit_panel(self, dashboard_html):
        """Verifica a estrutura restrita do Painel de Upload e Auditoria da Task 3."""
        # Visão da aba Admin
        assert 'id="view-admin"' in dashboard_html

        # Área de Drag & Drop para .xlsx e .csv
        assert 'id="admin-drop-zone"' in dashboard_html
        assert 'id="admin-file-input"' in dashboard_html
        assert 'accept=".xlsx,.xls,.csv"' in dashboard_html

        # Configurações de ingestão
        assert 'id="admin-upload-mode"' in dashboard_html
        assert 'value="upsert"' in dashboard_html
        assert 'value="clean_insert"' in dashboard_html
        assert 'value="replace"' in dashboard_html
        assert 'id="admin-export-json"' in dashboard_html
        assert 'id="admin-upload-btn"' in dashboard_html

        # Feedback visual de progresso e métricas
        assert 'id="admin-upload-status"' in dashboard_html
        assert 'id="admin-progress-bar"' in dashboard_html
        assert 'id="admin-result-box"' in dashboard_html

        # Tabela de Auditoria de Lotes
        assert 'id="admin-lotes-tbody"' in dashboard_html
        assert 'fetchLotesHistory()' in dashboard_html

    def test_dashboard_contains_dynamic_fetch_and_rbac_logic(self, dashboard_html):
        """Verifica funções essenciais de JavaScript para consumo dinâmico HTTP e segurança."""
        assert "API_BASE_URL" in dashboard_html
        assert "fetchDashboardData" in dashboard_html
        assert "/api/dashboard/data" in dashboard_html
        assert "submitAdminUpload" in dashboard_html
        assert "/api/upload" in dashboard_html
        assert "fetchLotesHistory" in dashboard_html
        assert "/api/upload/lotes" in dashboard_html
        assert "applyUserPermissions" in dashboard_html
        assert "initAuth" in dashboard_html
        assert "showToast" in dashboard_html

    def test_template_and_compiler_files_exist(self):
        """Verifica integridade dos arquivos de compilação da arquitetura desacoplada."""
        template_path = BASE_DIR / "dashboard_template.html"
        compiler_path = BASE_DIR / "build_dashboard_html.py"
        output_path = BASE_DIR / "dashboard_velocidade.html"

        assert template_path.exists(), "dashboard_template.html deve existir"
        assert compiler_path.exists(), "build_dashboard_html.py deve existir"
        assert output_path.exists(), "dashboard_velocidade.html deve existir"
        assert output_path.stat().st_size > 100_000, "dashboard_velocidade.html deve ter conteúdo compilado"

    def test_dashboard_contains_unidentified_driver_audit_tab(self, dashboard_html):
        """Verifica a presença da nova Aba 6 de Auditoria de Veículos Sem Identificação."""
        assert 'id="tab-audit"' in dashboard_html
        assert 'id="view-audit"' in dashboard_html
        assert 'id="audit-kpi-total"' in dashboard_html
        assert 'id="audit-kpi-frota"' in dashboard_html
        assert 'id="audit-kpi-pico"' in dashboard_html
        assert 'id="audit-placas-tbody"' in dashboard_html
        assert 'id="chart-audit-hours"' in dashboard_html
        assert "exportAuditReport()" in dashboard_html
        assert "updateAuditTab" in dashboard_html

    def test_dashboard_contains_user_management_panel(self, dashboard_html):
        """Verifica a presença do painel de Gestão de Usuários (RBAC) no Painel Administrativo."""
        assert 'id="create-user-form"' in dashboard_html
        assert 'id="new-user-username"' in dashboard_html
        assert 'id="new-user-password"' in dashboard_html
        assert 'id="new-user-role"' in dashboard_html
        assert 'id="admin-users-tbody"' in dashboard_html
        assert "fetchUsersList()" in dashboard_html
        assert "handleCreateUserSubmit" in dashboard_html

    def test_frontend_modular_directory_structure_exists(self):
        """Verifica que a pasta frontend/ modularizada e seus componentes estão íntegros."""
        frontend_dir = BASE_DIR / "frontend"
        assert (frontend_dir / "index.html").exists()
        assert (frontend_dir / "css" / "tokens.css").exists()
        assert (frontend_dir / "css" / "components.css").exists()
        assert (frontend_dir / "js" / "api.js").exists()
        assert (frontend_dir / "js" / "auth.js").exists()
        assert (frontend_dir / "js" / "audit.js").exists()
        assert (frontend_dir / "js" / "users.js").exists()
        assert (frontend_dir / "components" / "tab_overview.html").exists()
        assert (frontend_dir / "components" / "tab_audit.html").exists()
        assert (frontend_dir / "components" / "tab_admin.html").exists()
        assert (frontend_dir / "components" / "modals.html").exists()
