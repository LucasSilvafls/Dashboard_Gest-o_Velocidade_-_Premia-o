/**
 * ============================================================================
 * API CLIENT & COMUNICAÇÃO RESTful CSG
 * Casagrande Locações e Transportes
 * ============================================================================
 */

const API_BASE_URL = window.location.origin.includes('http') && !window.location.protocol.startsWith('file:')
    ? window.location.origin
    : 'http://localhost:8000';

/**
 * Sanitiza strings para renderização segura no DOM (Prevenção contra XSS)
 */
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
if (typeof window !== 'undefined') {
    window.escapeHTML = escapeHTML;
}

function getAuthHeaders() {
    const headers = {
        'Accept': 'application/json'
    };
    if (typeof currentAuth !== 'undefined' && currentAuth.token) {
        headers['Authorization'] = `Bearer ${currentAuth.token}`;
    }
    return headers;
}

/**
 * Consulta o dataset consolidado completo da API (/api/dashboard/data)
 */
async function fetchDashboardData(manualTrigger = false) {
    const statusDot = document.getElementById('api-status-dot');
    const statusText = document.getElementById('api-status-text');

    if (statusText) statusText.textContent = 'Sincronizando...';
    if (statusDot) {
        statusDot.className = 'w-2 h-2 rounded-full bg-amber-400 pulse-live shrink-0';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/data`, {
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            if (manualTrigger) {
                showToast('Autenticação necessária para consultar a API.', 'error');
                openLoginModal();
            }
            if (statusText) statusText.textContent = 'Login Necessário';
            if (statusDot) statusDot.className = 'w-2 h-2 rounded-full bg-red-500 shrink-0';
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Falha ao buscar dados da API`);
        }

        const data = await response.json();

        if (data && data.records) {
            allRecords = data.records;
            metaData = data.meta || {};
            filteredRecords = [...allRecords];

            // Atualiza componentes e visualizações em cascata
            if (typeof populateFilterDropdowns === 'function') populateFilterDropdowns();
            if (typeof updateAllViews === 'function') updateAllViews();
            if (typeof updateHeaderBadges === 'function') updateHeaderBadges();

            if (statusText) statusText.textContent = `API Conectada (${allRecords.length})`;
            if (statusDot) statusDot.className = 'w-2 h-2 rounded-full bg-emerald-500 shrink-0';

            if (manualTrigger) {
                showToast(`Dashboard atualizado dinamicamente! ${allRecords.length} ocorrências sincronizadas.`, 'success');
            }
        }
    } catch (err) {
        console.warn('Erro ao conectar na API:', err);
        if (statusText) statusText.textContent = 'API Offline (Cache Local)';
        if (statusDot) statusDot.className = 'w-2 h-2 rounded-full bg-amber-500 shrink-0';

        if (manualTrigger) {
            showToast(`Não foi possível conectar a ${API_BASE_URL}. Usando base em memória.`, 'error');
        }
    }
}

/**
 * Consulta o histórico de lotes ingeridos na base relacional (/api/upload/lotes)
 */
async function fetchLotesHistory() {
    const tbody = document.getElementById('admin-lotes-tbody');
    const counter = document.getElementById('lotes-counter');
    if (!tbody) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/upload/lotes?limit=50`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const lotes = await response.json();

        if (counter) counter.textContent = `${lotes.length} LOTES REGISTRADOS`;

        if (!lotes || lotes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-8 text-tech-muted">
                        Nenhum lote registrado ainda na base de dados.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = lotes.map(l => {
            const rawDate = l.data_ingestao || l.data_inicio;
            const dataStr = rawDate ? new Date(rawDate).toLocaleString('pt-BR') : '-';
            const isSuccess = l.status === 'SUCESSO';
            return `
                <tr>
                    <td class="font-mono font-bold text-main">#${l.id}</td>
                    <td class="font-mono text-tech-muted text-[11px]">${dataStr}</td>
                    <td class="font-mono text-main font-semibold truncate max-w-[140px]" title="${l.nome_arquivo || ''}">${l.nome_arquivo || '-'}</td>
                    <td class="font-mono font-bold text-main">${(l.total_linhas_lidas || 0).toLocaleString('pt-BR')}</td>
                    <td class="font-mono font-bold metric-warning">${(l.total_velocidade || 0).toLocaleString('pt-BR')}</td>
                    <td>
                        <span class="risk-badge ${isSuccess ? 'risk-badge-low' : 'risk-badge-high'}">
                            ${l.status}
                        </span>
                    </td>
                    <td class="font-mono text-[10px] text-tech-muted">${l.usuario_upload || 'SISTEMA'}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.warn('Erro ao carregar histórico de lotes:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-tech-muted">
                    Conecte-se à API para visualizar o histórico de lotes.
                </td>
            </tr>
        `;
    }
}

/**
 * Envia uma nova planilha de telemetria (.xlsx ou .csv) para o pipeline ETL da API
 */
async function submitAdminUpload() {
    if (!currentAuth.user || currentAuth.user.role !== 'admin') {
        showToast('Acesso negado: Perfil sem privilégios de administrador.', 'error');
        return;
    }

    if (!selectedAdminFile) {
        showToast('Selecione uma planilha (.xlsx ou .csv) antes de enviar.', 'error');
        return;
    }

    const uploadBtn = document.getElementById('admin-upload-btn');
    const btnText = document.getElementById('admin-upload-btn-text');
    const statusBox = document.getElementById('admin-upload-status');
    const progressBar = document.getElementById('admin-progress-bar');
    const progressPct = document.getElementById('admin-progress-pct');
    const progressLabel = document.getElementById('admin-progress-label');
    const resultBox = document.getElementById('admin-result-box');

    if (statusBox) statusBox.classList.remove('hidden');
    if (uploadBtn) uploadBtn.disabled = true;
    if (btnText) btnText.textContent = 'Processando Pipeline ETL...';
    if (resultBox) resultBox.innerHTML = '';

    // Progresso 1: Envio
    if (progressBar) progressBar.style.width = '35%';
    if (progressPct) progressPct.textContent = '35%';
    if (progressLabel) progressLabel.textContent = '1/3: Enviando planilha para o servidor...';

    const mode = document.getElementById('admin-upload-mode')?.value || 'upsert';
    const exportJson = !!document.getElementById('admin-export-json')?.checked;

    const formData = new FormData();
    formData.append('file', selectedAdminFile);

    try {
        if (progressBar) progressBar.style.width = '65%';
        if (progressPct) progressPct.textContent = '65%';
        if (progressLabel) progressLabel.textContent = '2/3: Executando pipeline ETL e atualizando base relacional...';

        const response = await fetch(`${API_BASE_URL}/api/upload?mode=${mode}&export_json=${exportJson}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAuth.token}`,
                'Accept': 'application/json'
            },
            body: formData
        });

        if (response.status === 403) {
            throw new Error('Acesso negado (HTTP 403): O seu perfil atual não tem permissão para upload.');
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || `Erro no servidor (HTTP ${response.status})`);
        }

        const result = await response.json();

        // Progresso 3: Sucesso
        if (progressBar) progressBar.style.width = '100%';
        if (progressPct) progressPct.textContent = '100%';
        if (progressLabel) progressLabel.textContent = '3/3: Ingestão finalizada com sucesso!';

        if (resultBox) {
            resultBox.className = 'p-3.5 rounded-lg border font-mono text-xs bg-emerald-950/30 border-emerald-500/40 text-emerald-300 space-y-2';
            resultBox.innerHTML = `
                <div class="flex items-center gap-2 font-bold text-emerald-400">
                    <i data-lucide="check-circle" class="w-4 h-4"></i>
                    <span>PLANILHA INGERIDA COM SUCESSO!</span>
                </div>
                <p class="text-[11px] text-emerald-200">${result.message || 'Dados persistidos com sucesso no banco relacional.'}</p>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-emerald-500/20 text-[10px]">
                    <div><span class="text-tech-muted block">LOTE ID:</span><strong class="text-white">#${result.lote_id}</strong></div>
                    <div><span class="text-tech-muted block">LINHAS LIDAS:</span><strong class="text-white">${(result.total_lidas || 0).toLocaleString('pt-BR')}</strong></div>
                    <div><span class="text-tech-muted block">INSERIDOS:</span><strong class="text-white">${(result.inseridos || 0).toLocaleString('pt-BR')}</strong></div>
                    <div><span class="text-tech-muted block">ATUALIZADOS:</span><strong class="text-white">${(result.atualizados || 0).toLocaleString('pt-BR')}</strong></div>
                    <div><span class="text-tech-muted block">VELOCIDADE:</span><strong class="text-amber-400">${(result.total_velocidade || 0).toLocaleString('pt-BR')}</strong></div>
                    <div><span class="text-tech-muted block">TEMPO ETL:</span><strong class="text-white">${result.tempo_segundos}s</strong></div>
                    <div><span class="text-tech-muted block">MODO:</span><strong class="text-white uppercase">${result.modo}</strong></div>
                    <div><span class="text-tech-muted block">OPERADOR:</span><strong class="text-emerald-400">${result.uploaded_by}</strong></div>
                </div>
                <div class="pt-2 flex justify-end">
                    <button type="button" onclick="fetchDashboardData(true)" class="btn-primary-green px-3 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                        <i data-lucide="refresh-cw" class="w-3 h-3"></i>
                        <span>Recarregar Painel Agora</span>
                    </button>
                </div>
            `;
        }

        showToast(`Sucesso! Lote #${result.lote_id} processado (${result.total_velocidade} alertas de velocidade).`, 'success');
        clearAdminSelectedFile();

        // Hot-Refresh Reativo imediato em todas as abas sem F5
        await fetchDashboardData();
        await fetchLotesHistory();
    } catch (err) {
        if (progressBar) progressBar.style.width = '100%';
        if (progressPct) progressPct.textContent = 'Falha';
        if (progressLabel) progressLabel.textContent = 'Erro durante processamento da planilha';

        if (resultBox) {
            resultBox.className = 'p-3.5 rounded-lg border font-mono text-xs bg-red-950/40 border-red-500/40 text-red-300 space-y-1.5';
            resultBox.innerHTML = `
                <div class="flex items-center gap-2 font-bold text-red-400">
                    <i data-lucide="alert-octagon" class="w-4 h-4"></i>
                    <span>FALHA NA INGESTÃO DA PLANILHA</span>
                </div>
                <p class="text-[11px] text-red-200">${err.message}</p>
            `;
        }
        showToast(err.message, 'error');
    } finally {
        if (uploadBtn) uploadBtn.disabled = false;
        if (btnText) btnText.textContent = 'Iniciar Upload e Ingestão';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
