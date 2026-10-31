/**
 * ============================================================================
 * GESTÃO DE AUTENTICAÇÃO, TOKENS JWT E PERMISSÕES RBAC
 * Casagrande Locações e Transportes • Unidade Operacional CSG
 * ============================================================================
 */

const TOKEN_STORAGE_KEY = 'csg_telemetria_token';
const USER_STORAGE_KEY = 'csg_telemetria_user';

let currentAuth = {
    token: null,
    user: null,
    isAuthenticated: false
};

function initAuth() {
    try {
        const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
        const storedUser = localStorage.getItem(USER_STORAGE_KEY);

        if (storedToken && storedUser) {
            currentAuth.token = storedToken;
            currentAuth.user = JSON.parse(storedUser);
            currentAuth.isAuthenticated = true;
            applyUserPermissions(currentAuth.user);
            updateAuthUI();
            return;
        }
    } catch (e) {
        console.warn('Erro ao restaurar sessão:', e);
    }

    currentAuth = { token: null, user: null, isAuthenticated: false };
    applyUserPermissions(null);
    updateAuthUI();
}

function updateAuthUI() {
    const authBox = document.getElementById('user-authenticated-box');
    const unauthBox = document.getElementById('user-unauthenticated-box');
    const userNameDisplay = document.getElementById('user-name-display');
    const userRoleBadge = document.getElementById('user-role-badge');

    if (currentAuth.isAuthenticated && currentAuth.user) {
        if (authBox) authBox.classList.remove('hidden');
        if (unauthBox) unauthBox.classList.add('hidden');

        if (userNameDisplay) userNameDisplay.textContent = currentAuth.user.nome_completo || currentAuth.user.username;
        if (userRoleBadge) {
            const isAdmin = currentAuth.user.role === 'admin';
            userRoleBadge.textContent = isAdmin ? 'ADMIN' : 'VIEWER';
            userRoleBadge.className = `font-mono text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                isAdmin
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`;
        }
    } else {
        if (authBox) authBox.classList.add('hidden');
        if (unauthBox) unauthBox.classList.remove('hidden');
    }
}

function applyUserPermissions(user) {
    const isAdmin = !!(user && user.role === 'admin');

    document.querySelectorAll('.admin-only').forEach(el => {
        if (isAdmin) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    const activeAdminTab = document.getElementById('tab-admin');
    if (!isAdmin && activeAdminTab && activeAdminTab.classList.contains('active')) {
        if (typeof switchTab === 'function') switchTab('overview');
    }
}

function openLoginModal() {
    const modal = document.getElementById('modal-login');
    if (modal) modal.classList.remove('hidden');
    const errBanner = document.getElementById('login-error-banner');
    if (errBanner) errBanner.classList.add('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeLoginModal() {
    const modal = document.getElementById('modal-login');
    if (modal) modal.classList.add('hidden');
}

function togglePasswordVisibility() {
    const pwdInput = document.getElementById('login-password');
    const toggleText = document.getElementById('toggle-pwd-text');
    if (!pwdInput) return;
    const isPassword = pwdInput.type === 'password';
    pwdInput.type = isPassword ? 'text' : 'password';
    if (toggleText) toggleText.textContent = isPassword ? 'Ocultar' : 'Mostrar';
}

function quickFillAndLogin(username, password) {
    const uInput = document.getElementById('login-username');
    const pInput = document.getElementById('login-password');
    if (uInput) uInput.value = username;
    if (pInput) pInput.value = password;
    executeLogin(username, password);
}

async function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    await executeLogin(username, password);
}

async function executeLogin(username, password) {
    const submitBtn = document.getElementById('login-submit-btn');
    const btnText = document.getElementById('login-btn-text');
    const errBanner = document.getElementById('login-error-banner');
    const errMsg = document.getElementById('login-error-msg');

    if (!username || !password) {
        if (errBanner && errMsg) {
            errMsg.textContent = 'Informe usuário e senha para continuar.';
            errBanner.classList.remove('hidden');
        }
        return;
    }

    if (errBanner) errBanner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Autenticando...';
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || 'Usuário ou senha inválidos.');
        }

        const data = await response.json();

        currentAuth.token = data.access_token;
        currentAuth.user = {
            username: data.username,
            role: data.role,
            nome_completo: data.nome_completo || data.username
        };
        currentAuth.isAuthenticated = true;

        const remember = document.getElementById('login-remember')?.checked;
        if (remember) {
            localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentAuth.user));
        }

        applyUserPermissions(currentAuth.user);
        updateAuthUI();
        closeLoginModal();

        showToast(`Bem-vindo, ${currentAuth.user.nome_completo}! Perfil: ${currentAuth.user.role.toUpperCase()}`, 'success');

        await fetchDashboardData();

        if (currentAuth.user.role === 'admin') {
            await fetchLotesHistory();
            if (typeof fetchUsersList === 'function') await fetchUsersList();
        }
    } catch (err) {
        if (errBanner && errMsg) {
            errMsg.textContent = err.message || 'Falha na autenticação. Verifique o servidor.';
            errBanner.classList.remove('hidden');
        }
        showToast(err.message || 'Erro de autenticação', 'error');
    } finally {
        if (btnText) btnText.textContent = 'Entrar no Sistema';
        if (submitBtn) submitBtn.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function logoutUser() {
    currentAuth = { token: null, user: null, isAuthenticated: false };
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    applyUserPermissions(null);
    updateAuthUI();
    showToast('Sessão encerrada com sucesso.', 'info');
    openLoginModal();
}
