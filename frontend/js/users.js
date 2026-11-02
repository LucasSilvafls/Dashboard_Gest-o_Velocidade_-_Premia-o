/**
 * ============================================================================
 * GESTÃO DE USUÁRIOS E CONTROLE DE ACESSO (RBAC) - PAINEL ADMINISTRATIVO
 * Casagrande Locações e Transportes
 * ============================================================================
 */

async function fetchUsersList() {
    const tbody = document.getElementById('admin-users-tbody');
    const counter = document.getElementById('users-counter');
    if (!tbody) return;

    if (!currentAuth.user || currentAuth.user.role !== 'admin') {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-6 text-tech-muted">
                    Acesso restrito ao perfil Administrador.
                </td>
            </tr>
        `;
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Falha ao listar usuários`);
        }

        const users = await response.json();

        if (counter) counter.textContent = `${users.length} USUÁRIOS`;

        if (!users || users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-6 text-tech-muted">
                        Nenhum usuário cadastrado.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = users.map(u => {
            const isAdmin = u.role === 'admin';
            const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '-';
            const esc = typeof escapeHTML === 'function' ? escapeHTML : (s) => String(s || '');
            const safeId = esc(u.id);
            const safeUsername = esc(u.username);
            const safeNome = esc(u.nome_completo || '-');
            const safeEmail = esc(u.email || '-');
            const safeRole = esc(u.role ? u.role.toUpperCase() : '');
            return `
                <tr>
                    <td class="font-mono font-bold text-main">#${safeId}</td>
                    <td class="font-mono text-main font-semibold">${safeUsername}</td>
                    <td class="text-sub">${safeNome}</td>
                    <td class="text-tech-muted font-mono text-[11px]">${safeEmail}</td>
                    <td>
                        <span class="risk-badge ${isAdmin ? 'risk-badge-low' : 'risk-badge-med'}">
                            ${safeRole}
                        </span>
                    </td>
                    <td class="font-mono text-tech-muted text-[11px]">${esc(dateStr)}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.warn('Erro ao carregar lista de usuários:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-6 text-red-400">
                    Falha ao carregar usuários da API.
                </td>
            </tr>
        `;
    }
}

async function handleCreateUserSubmit(e) {
    if (e) e.preventDefault();

    if (!currentAuth.user || currentAuth.user.role !== 'admin') {
        showToast('Acesso negado: Apenas administradores podem cadastrar usuários.', 'error');
        return;
    }

    const username = document.getElementById('new-user-username')?.value.trim();
    const nomeCompleto = document.getElementById('new-user-nome')?.value.trim();
    const email = document.getElementById('new-user-email')?.value.trim();
    const password = document.getElementById('new-user-password')?.value;
    const role = document.getElementById('new-user-role')?.value || 'viewer';

    if (!username || !password) {
        showToast('Preencha os campos obrigatórios (Usuário e Senha).', 'error');
        return;
    }

    const btn = document.getElementById('new-user-submit-btn');
    if (btn) btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                nome_completo: nomeCompleto,
                email: email || undefined,
                role
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `Erro HTTP ${response.status}`);
        }

        const created = await response.json();
        showToast(`Usuário "${created.username}" cadastrado com sucesso (${created.role.toUpperCase()})!`, 'success');

        // Limpa formulário
        document.getElementById('create-user-form')?.reset();

        // Atualiza tabela de usuários
        await fetchUsersList();
    } catch (err) {
        showToast(err.message || 'Falha ao cadastrar usuário', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}
