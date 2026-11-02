/**
 * ============================================================================
 * ORQUESTRADOR PRINCIPAL DO DASHBOARD DE TELEMETRIA CSG
 * Casagrande Locações e Transportes • Unidade Operacional CSG
 * ============================================================================
 */

let allRecords = typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.records ? INITIAL_DATA.records : [];
let metaData = typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.meta ? INITIAL_DATA.meta : {};
let filteredRecords = [...allRecords];

let currentPage = 1;
let pageSize = 25;
let sortColumn = 'id';
let sortDirection = 'asc';
let searchQuery = '';
let selectedAdminFile = null;

const _esc = typeof escapeHTML === 'function' ? escapeHTML : (s) => {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
};

// Toast Feedback System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item pointer-events-auto px-4 py-3 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2.5 max-w-sm border ${
        type === 'success' ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40' :
        type === 'error' ? 'bg-red-950/90 text-red-200 border-red-500/40' :
        'bg-slate-900/90 text-slate-200 border-slate-700'
    }`;

    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info';
    toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i><span>${message}</span>`;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

// Theme Management
function toggleTheme() {
    const current = isLightMode() ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(next);
    try { localStorage.setItem('color-scheme', next); } catch (e) {}
    syncThemeUI();
    if (typeof updateChartsColors === 'function') updateChartsColors();
}

function syncThemeUI() {
    const light = isLightMode();
    const lightIcon = document.getElementById('theme-icon-light');
    const darkIcon = document.getElementById('theme-icon-dark');
    const label = document.getElementById('theme-label');
    if (light) {
        if (lightIcon) lightIcon.classList.remove('hidden');
        if (darkIcon) darkIcon.classList.add('hidden');
        if (label) label.textContent = 'Tema Claro';
    } else {
        if (lightIcon) lightIcon.classList.add('hidden');
        if (darkIcon) darkIcon.classList.remove('hidden');
        if (label) label.textContent = 'Tema Escuro';
    }
}

function getRiskBadgeHTML(nivel) {
    if (nivel === 'ALTO') {
        return '<span class="risk-badge risk-badge-high">Alta / Crítica</span>';
    }
    if (nivel === 'MEDIO') {
        return '<span class="risk-badge risk-badge-med">Média / Alerta</span>';
    }
    return '<span class="risk-badge risk-badge-low">Baixa / Leve</span>';
}

// Navegação entre Abas
function switchTab(tabId) {
    // Regra de Segurança: Apenas Admin pode acessar a aba admin
    if (tabId === 'admin' && (!currentAuth.user || currentAuth.user.role !== 'admin')) {
        showToast('Acesso Restrito: Apenas administradores podem acessar o Painel Admin.', 'error');
        tabId = 'overview';
    }

    ['overview', 'safety', 'fleet', 'table-view', 'premiacao', 'audit', 'admin'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        const content = document.getElementById(`view-${t}`);
        if (btn) btn.classList.remove('active');
        if (content) content.classList.add('hidden');
    });

    const activeBtn = document.getElementById(`tab-${tabId}`);
    const activeContent = document.getElementById(`view-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.remove('hidden');

    // Controle da Toolbar Superior por contexto
    const globalToolbar = document.getElementById('global-analytics-toolbar');
    const kpiSummary = document.getElementById('kpi-summary-section');
    if (globalToolbar && kpiSummary) {
        if (tabId === 'admin') {
            globalToolbar.classList.add('hidden');
        } else if (tabId === 'premiacao' || tabId === 'audit') {
            globalToolbar.classList.remove('hidden');
            kpiSummary.classList.add('hidden');
        } else {
            globalToolbar.classList.remove('hidden');
            kpiSummary.classList.remove('hidden');
        }
    }

    if (tabId === 'premiacao' && typeof updatePremiacaoView === 'function') {
        updatePremiacaoView();
    } else if (tabId === 'audit' && typeof updateAuditTab === 'function') {
        updateAuditTab();
    } else if (tabId === 'admin') {
        if (typeof fetchLotesHistory === 'function') fetchLotesHistory();
        if (typeof fetchUsersList === 'function') fetchUsersList();
    }

    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 60);
}

// Atualização Mestra das Visualizações
function updateAllViews() {
    updateKPIs();
    if (typeof updateDailyTrendChart === 'function') updateDailyTrendChart();
    if (typeof updateHourlyChart === 'function') updateHourlyChart();
    if (typeof updateLimitsChart === 'function') updateLimitsChart();
    if (typeof updateDeltasChart === 'function') updateDeltasChart();
    if (typeof updateDurationsChart === 'function') updateDurationsChart();
    updateExtremeCasesTable();
    if (typeof updateTelemetryContextChart === 'function') updateTelemetryContextChart();
    if (typeof updateTopVehiclesChart === 'function') updateTopVehiclesChart();
    if (typeof updateTopDriversChart === 'function') updateTopDriversChart();
    renderVehicleProfile();
    renderTable();
    if (typeof updatePremiacaoView === 'function') updatePremiacaoView();
    if (typeof updateAuditTab === 'function') updateAuditTab();

    const counterEl = document.getElementById('filter-counter');
    if (counterEl) {
        counterEl.textContent = `EXIBINDO: ${filteredRecords.length.toLocaleString('pt-BR')} DE ${allRecords.length.toLocaleString('pt-BR')} OCORRÊNCIAS`;
    }
    if (window.lucide) lucide.createIcons();
}

function updateKPIs() {
    const total = filteredRecords.length;
    const kpiTotal = document.getElementById('kpi-total');
    if (kpiTotal) kpiTotal.textContent = total.toLocaleString('pt-BR');

    const baseTotal = metaData.total_file_alerts || 16067;
    const sharePct = ((total / baseTotal) * 100).toFixed(1).replace('.', ',');
    const shareEl = document.getElementById('kpi-total-share');
    if (shareEl) shareEl.textContent = `${sharePct}% do total`;

    if (total === 0) {
        const kMax = document.getElementById('kpi-max-speed');
        const kDesc = document.getElementById('kpi-max-speed-desc');
        const kAvg = document.getElementById('kpi-avg-delta');
        const kRisk = document.getElementById('kpi-high-risk');
        const kDur = document.getElementById('kpi-total-duration');
        const kLong = document.getElementById('kpi-long-duration');
        const kUnid = document.getElementById('kpi-unidentified');

        if (kMax) kMax.innerHTML = `<span class="text-2xl font-bold font-mono metric-danger tracking-tight">0</span> <span class="text-xs font-mono font-semibold text-tech-muted">km/h</span>`;
        if (kDesc) kDesc.innerHTML = `<span class="font-mono text-tech-muted">Nenhuma ocorrência</span>`;
        if (kAvg) kAvg.innerHTML = `<span class="text-2xl font-bold font-mono metric-warning tracking-tight">0,0</span> <span class="text-xs font-mono font-semibold text-tech-muted">km/h</span>`;
        if (kRisk) kRisk.innerHTML = `<span class="text-2xl font-bold font-mono metric-danger tracking-tight">0</span> <span class="text-xs font-mono font-semibold text-tech-muted">(0%)</span>`;
        if (kDur) kDur.textContent = `0h 00m`;
        if (kLong) kLong.textContent = `0 vezes`;
        if (kUnid) kUnid.innerHTML = `<span class="text-2xl font-bold font-mono metric-warning tracking-tight">0</span> <span class="text-xs font-mono font-semibold text-tech-muted">(0%)</span>`;
        return;
    }

    let maxRec = filteredRecords[0];
    let sumDelta = 0;
    let highRiskCount = 0;
    let totalSec = 0;
    let longSecCount = 0;
    let unidentifiedCount = 0;

    filteredRecords.forEach(r => {
        if ((r.velocidade || 0) > (maxRec.velocidade || 0)) maxRec = r;
        sumDelta += (r.delta || 0);
        if (r.nivel === 'ALTO') highRiskCount++;
        totalSec += (r.duracao_sec || 0);
        if (r.duracao_sec >= 600) longSecCount++;
        if (r.motorista === 'Sem Identificação') unidentifiedCount++;
    });

    const maxSpeed = maxRec.velocidade || 0;
    const kMax = document.getElementById('kpi-max-speed');
    const kDesc = document.getElementById('kpi-max-speed-desc');
    const kAvg = document.getElementById('kpi-avg-delta');
    const kRisk = document.getElementById('kpi-high-risk');
    const kDur = document.getElementById('kpi-total-duration');
    const kLong = document.getElementById('kpi-long-duration');
    const kUnid = document.getElementById('kpi-unidentified');

    if (kMax) kMax.innerHTML = `<span class="text-2xl font-bold font-mono metric-danger tracking-tight">${maxSpeed}</span> <span class="text-xs font-mono font-semibold text-tech-muted">km/h</span>`;
    if (kDesc) kDesc.innerHTML = `<span class="font-mono font-bold text-main">${_esc(maxRec.placa)}</span> <span class="text-tech-muted truncate ml-1.5">na ${_esc(maxRec.logradouro)}</span>`;

    const avgDelta = (sumDelta / total).toFixed(1).replace('.', ',');
    if (kAvg) kAvg.innerHTML = `<span class="text-2xl font-bold font-mono metric-warning tracking-tight">+${avgDelta}</span> <span class="text-xs font-mono font-semibold text-tech-muted">km/h</span>`;

    const highRiskPct = ((highRiskCount / total) * 100).toFixed(1).replace('.', ',');
    if (kRisk) kRisk.innerHTML = `<span class="text-2xl font-bold font-mono metric-danger tracking-tight">${highRiskCount.toLocaleString('pt-BR')}</span> <span class="text-xs font-mono font-semibold text-tech-muted">(${highRiskPct}%)</span>`;

    const totalHours = Math.floor(totalSec / 3600);
    const totalMinutes = Math.floor((totalSec % 3600) / 60);
    if (kDur) kDur.textContent = `${totalHours}h ${String(totalMinutes).padStart(2, '0')}m`;
    if (kLong) kLong.textContent = `${longSecCount.toLocaleString('pt-BR')} vezes`;

    const unIdPct = ((unidentifiedCount / total) * 100).toFixed(1).replace('.', ',');
    if (kUnid) kUnid.innerHTML = `<span class="text-2xl font-bold font-mono metric-warning tracking-tight">${unidentifiedCount.toLocaleString('pt-BR')}</span> <span class="text-xs font-mono font-semibold text-tech-muted">(${unIdPct}%)</span>`;
}

function updateExtremeCasesTable() {
    const tbody = document.getElementById('extreme-cases-table');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sorted = [...filteredRecords].sort((a, b) => (b.velocidade || 0) - (a.velocidade || 0)).slice(0, 10);
    const recBadge = document.getElementById('badge-extreme-record');
    if (recBadge) {
        const topVel = sorted.length ? (sorted[0].velocidade || 0) : 0;
        recBadge.textContent = `Recorde: ${topVel} km/h`;
    }

    sorted.forEach(r => {
        const tr = document.createElement('tr');
        const isAnon = r.motorista === 'Sem Identificação';
        const escPlaca = _esc(r.placa);
        const escCat = _esc(r.categoria);
        const escMot = _esc(isAnon ? 'Sem Crachá' : r.motorista);
        const escLog = _esc(r.logradouro);
        const escData = _esc(r.data);
        const escHora = _esc(r.hora);
        tr.innerHTML = `
            <td class="font-mono text-sub text-xs whitespace-nowrap">${escData} <span class="text-tech-muted">${escHora}</span></td>
            <td class="font-mono font-bold text-main">${escPlaca}</td>
            <td><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">${escCat}</span></td>
            <td class="${isAnon ? 'metric-warning font-semibold' : 'text-sub'} text-xs truncate max-w-[150px]">${escMot}</td>
            <td class="font-mono text-right text-tech-muted">${Number(r.limiar) || 0} km/h</td>
            <td class="font-mono text-right font-bold metric-danger">${Number(r.velocidade) || 0} km/h</td>
            <td class="font-mono text-right font-bold metric-warning">+${Number(r.delta) || 0} km/h</td>
            <td class="text-sub truncate max-w-[160px] text-xs" title="${escLog}">${escLog}</td>
        `;
        tr.onclick = () => openDetailModal(r.id);
        tr.className = 'cursor-pointer hover:bg-hover transition-colors';
        tbody.appendChild(tr);
    });
}

function renderVehicleProfile() {
    const select = document.getElementById('profile-vehicle-select');
    const targetPlaca = select ? select.value : (metaData.placas?.[0] || '');
    const content = document.getElementById('vehicle-profile-content');
    if (!content || !targetPlaca) return;

    const recs = allRecords.filter(r => r.placa === targetPlaca);
    if (!recs.length) return;

    const total = recs.length;
    const categoria = recs[0].categoria || 'Não Classificado';
    const countAlto = recs.filter(r => r.nivel === 'ALTO').length;
    const countMedio = recs.filter(r => r.nivel === 'MEDIO').length;
    const countBaixo = recs.filter(r => r.nivel === 'BAIXO').length;
    const maxSpeed = Math.max(0, ...recs.map(r => r.velocidade || 0));
    const sumDelta = recs.reduce((acc, r) => acc + (r.delta || 0), 0);
    const avgDelta = (sumDelta / total).toFixed(1).replace('.', ',');

    content.innerHTML = `
        <div class="panel-subsurface p-3.5">
            <span class="text-[10px] uppercase font-bold text-tech-muted block mb-1">Identificação:</span>
            <span class="font-mono font-bold text-main text-base block">${targetPlaca}</span>
            <span class="font-mono text-tech-muted text-xs block">${categoria}</span>
        </div>
        <div class="panel-subsurface p-3.5">
            <span class="text-[10px] uppercase font-bold text-tech-muted block mb-1">Total de Excessos:</span>
            <span class="font-mono font-bold metric-warning text-base block">${total.toLocaleString('pt-BR')}</span>
            <span class="text-tech-muted text-xs block">Ocorrências registradas</span>
        </div>
        <div class="panel-subsurface p-3.5">
            <span class="text-[10px] uppercase font-bold text-tech-muted block mb-1">Velocidade Máxima:</span>
            <span class="font-mono font-bold metric-danger text-base block">${maxSpeed} km/h</span>
            <span class="text-tech-muted text-xs block">Média: +${avgDelta} km/h</span>
        </div>
        <div class="panel-subsurface p-3.5">
            <span class="text-[10px] uppercase font-bold text-tech-muted block mb-1">Severidade Alta:</span>
            <span class="font-mono font-bold metric-danger text-base block">${countAlto}</span>
            <span class="text-tech-muted text-xs block">Média: ${countMedio} | Leve: ${countBaixo}</span>
        </div>
        <div class="panel-subsurface p-3.5">
            <span class="text-[10px] uppercase font-bold text-tech-muted block mb-1">Participação na Frota:</span>
            <span class="font-mono font-bold metric-brand text-base block">${((total / allRecords.length) * 100).toFixed(1).replace('.', ',')}%</span>
            <span class="text-tech-muted text-xs block">Do volume de excessos</span>
        </div>
    `;
}

// Renderização da Tabela de Ocorrências com Paginação
function renderTable() {
    const tbody = document.getElementById('alerts-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let dataset = filteredRecords;
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        dataset = dataset.filter(r =>
            r.placa.toLowerCase().includes(q) ||
            r.categoria.toLowerCase().includes(q) ||
            r.motorista.toLowerCase().includes(q) ||
            r.tipo.toLowerCase().includes(q) ||
            r.logradouro.toLowerCase().includes(q) ||
            r.cidade.toLowerCase().includes(q) ||
            r.data.includes(q)
        );
    }

    dataset.sort((a, b) => {
        if (sortColumn === 'data') {
            const toChrono = (rec) => {
                const p = String(rec.data || '').split('/');
                const isoD = p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : String(rec.data || '');
                return `${isoD} ${rec.hora || '00:00:00'}`;
            };
            const cA = toChrono(a), cB = toChrono(b);
            if (cA < cB) return sortDirection === 'asc' ? -1 : 1;
            if (cA > cB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        }
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const total = dataset.length;
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageData = dataset.slice(startIdx, endIdx);

    pageData.forEach(r => {
        const tr = document.createElement('tr');
        const riskBadge = getRiskBadgeHTML(r.nivel);
        const isAnon = r.motorista === 'Sem Identificação';
        const escId = _esc(r.id);
        const escData = _esc(r.data);
        const escHora = _esc(r.hora);
        const escPlaca = _esc(r.placa);
        const escCat = _esc(r.categoria);
        const escMot = _esc(isAnon ? 'Sem Crachá' : r.motorista);
        const escDur = _esc(r.duracao_str);
        const escLog = _esc(r.logradouro);
        const escCid = _esc(r.cidade);

        tr.innerHTML = `
            <td class="font-mono text-tech-muted text-[11px]">#${String(escId).padStart(5, '0')}</td>
            <td class="font-mono whitespace-nowrap text-sub text-xs">${escData} <span class="text-tech-muted">${escHora}</span></td>
            <td class="font-mono font-bold text-main">${escPlaca}</td>
            <td><span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">${escCat}</span></td>
            <td class="${isAnon ? 'metric-warning font-semibold' : 'text-sub'} text-xs">${escMot}</td>
            <td class="font-mono text-right text-tech-muted text-xs">${Number(r.limiar) || 0} km/h</td>
            <td class="font-mono text-right font-bold metric-danger text-xs">${Number(r.velocidade) || 0} km/h</td>
            <td class="font-mono text-right font-bold metric-warning text-xs">+${Number(r.delta) || 0} km/h</td>
            <td class="font-mono text-right metric-brand text-xs">${escDur}</td>
            <td>${riskBadge}</td>
            <td class="text-sub truncate max-w-[150px] text-xs" title="${escLog}">${escLog}</td>
            <td class="text-tech-muted text-xs">${escCid}</td>
            <td class="text-center">
                <button type="button" onclick="openDetailModal(${Number(r.id)})" class="btn-industrial px-2 py-1 text-[11px] font-semibold" title="Ver ficha da ocorrência">
                    Ver
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const info = document.getElementById('table-pagination-info');
    if (info) {
        info.textContent = total > 0 ? `Mostrando ${startIdx + 1} a ${endIdx} de ${total.toLocaleString('pt-BR')} ocorrências` : 'Nenhum registro encontrado';
    }

    const btnContainer = document.getElementById('table-pagination-buttons');
    if (btnContainer) {
        btnContainer.innerHTML = '';
        const totalPages = Math.ceil(total / pageSize) || 1;

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.textContent = 'Anterior';
        prevBtn.className = 'btn-industrial px-2.5 py-1 text-xs font-semibold';
        prevBtn.disabled = (currentPage === 1);
        prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
        btnContainer.appendChild(prevBtn);

        const pageSpan = document.createElement('span');
        pageSpan.className = 'font-mono text-xs px-2 text-main';
        pageSpan.textContent = `Página ${currentPage} de ${totalPages}`;
        btnContainer.appendChild(pageSpan);

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.textContent = 'Próxima';
        nextBtn.className = 'btn-industrial px-2.5 py-1 text-xs font-semibold';
        nextBtn.disabled = (currentPage >= totalPages);
        nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };
        btnContainer.appendChild(nextBtn);
    }
    if (window.lucide) lucide.createIcons();
}

function handleTableSearch() {
    searchQuery = document.getElementById('table-search-input')?.value.trim() || '';
    currentPage = 1;
    renderTable();
}

function sortTable(col) {
    if (sortColumn === col) {
        sortDirection = (sortDirection === 'asc') ? 'desc' : 'asc';
    } else {
        sortColumn = col;
        sortDirection = 'asc';
    }
    renderTable();
}

function changePageSize(val) {
    pageSize = parseInt(val, 10) || 25;
    currentPage = 1;
    renderTable();
}

// Modal de Detalhe da Ocorrência
function openDetailModal(recordId) {
    const rec = allRecords.find(r => r.id === recordId);
    if (!rec) return;

    document.getElementById('modal-alert-id').textContent = `Ocorrência #${String(rec.id).padStart(5, '0')} - ${rec.tipo === 'EXCESSO_VELOCIDADE' ? 'Limite da Frota' : 'Placa da Via'}`;
    document.getElementById('modal-alert-date').textContent = `Data: ${rec.data} às ${rec.hora} • Unidade: ${rec.uo || 'CASAGRANDE'}`;
    document.getElementById('modal-placa').textContent = rec.placa;
    document.getElementById('modal-prefixo').textContent = `Categoria: ${rec.categoria} • Prefixo: ${rec.prefixo || '-'}`;
    document.getElementById('modal-motorista').textContent = rec.motorista === 'Sem Identificação' ? 'Não identificado (iButton não passado)' : rec.motorista;
    document.getElementById('modal-cpf').textContent = `CPF: ${rec.cpf || '-'}`;

    document.getElementById('modal-limite').textContent = `${rec.limiar} km/h`;
    document.getElementById('modal-velocidade').textContent = `${rec.velocidade} km/h`;
    document.getElementById('modal-delta').textContent = `+${rec.delta} km/h (+${rec.pct}%)`;
    document.getElementById('modal-duracao').textContent = `${rec.duracao_str} (${rec.duracao_sec} segundos seguidos)`;
    document.getElementById('modal-local').textContent = `${rec.logradouro}, ${rec.cidade} - ${rec.estado}`;

    const mapsLink = document.getElementById('modal-maps-link');
    if (rec.lat && rec.lng) {
        document.getElementById('modal-coords').textContent = `${rec.lat.toFixed(6)}, ${rec.lng.toFixed(6)}`;
        mapsLink.href = `https://www.google.com/maps?q=${rec.lat},${rec.lng}`;
        mapsLink.classList.remove('hidden');
    } else {
        document.getElementById('modal-coords').textContent = 'Localização GPS não disponível no evento';
        mapsLink.classList.add('hidden');
    }

    document.getElementById('modal-risk-pill').innerHTML = getRiskBadgeHTML(rec.nivel);

    const badge = document.getElementById('modal-severity-badge');
    if (badge) {
        if (rec.nivel === 'ALTO') {
            badge.className = 'w-9 h-9 rounded flex items-center justify-center risk-badge-high';
        } else if (rec.nivel === 'MEDIO') {
            badge.className = 'w-9 h-9 rounded flex items-center justify-center risk-badge-med';
        } else {
            badge.className = 'w-9 h-9 rounded flex items-center justify-center risk-badge-low';
        }
    }

    document.getElementById('modal-detail').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closeDetailModal() {
    document.getElementById('modal-detail')?.classList.add('hidden');
}

// Drag & Drop do Admin
function setupAdminDropZone() {
    const dropZone = document.getElementById('admin-drop-zone');
    if (!dropZone) return;

    dropZone.onclick = () => document.getElementById('admin-file-input')?.click();

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('border-brand-accent');
    };
    dropZone.ondragleave = () => {
        dropZone.classList.remove('border-brand-accent');
    };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-brand-accent');
        if (e.dataTransfer.files.length) {
            processSelectedAdminFile(e.dataTransfer.files[0]);
        }
    };
}

function handleAdminFileSelect(e) {
    if (e.target.files.length) {
        processSelectedAdminFile(e.target.files[0]);
    }
}

function processSelectedAdminFile(file) {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
        showToast(`Formato .${ext} não suportado. Envie um arquivo Excel (.xlsx, .xls) ou .csv.`, 'error');
        return;
    }

    selectedAdminFile = file;

    const card = document.getElementById('admin-selected-file-card');
    const nameEl = document.getElementById('admin-selected-filename');
    const sizeEl = document.getElementById('admin-selected-filesize');

    if (card) card.classList.remove('hidden');
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) {
        const mb = (file.size / (1024 * 1024)).toFixed(2);
        sizeEl.textContent = `${mb} MB (${file.size.toLocaleString('pt-BR')} bytes)`;
    }

    const dropText = document.getElementById('admin-drop-text');
    if (dropText) dropText.innerHTML = `Arquivo selecionado: <strong class="text-csg-400">${file.name}</strong>`;
    showToast(`Arquivo "${file.name}" preparado para upload.`, 'info');
    if (window.lucide) lucide.createIcons();
}

function clearAdminSelectedFile() {
    selectedAdminFile = null;
    const card = document.getElementById('admin-selected-file-card');
    if (card) card.classList.add('hidden');

    const fileInput = document.getElementById('admin-file-input');
    if (fileInput) fileInput.value = '';

    const dropText = document.getElementById('admin-drop-text');
    if (dropText) dropText.innerHTML = 'Arraste a planilha (.xlsx / .csv) aqui ou <span class="text-csg-400 underline">clique para procurar</span>';
}

function exportFilteredCSV() {
    if (!filteredRecords.length) {
        showToast('Nenhuma ocorrência filtrada para exportar.', 'error');
        return;
    }

    const headers = ['ID', 'Data', 'Hora', 'Placa', 'Categoria', 'Motorista', 'CPF', 'Tipo', 'Limite_kmh', 'Velocidade_kmh', 'Delta_kmh', 'Nivel', 'Duracao_s', 'Logradouro', 'Cidade', 'Estado', 'Lat', 'Lng'];
    const rows = filteredRecords.map(r => [
        r.id,
        `"${r.data}"`,
        `"${r.hora}"`,
        `"${r.placa}"`,
        `"${r.categoria}"`,
        `"${r.motorista}"`,
        `"${r.cpf || ''}"`,
        `"${r.tipo}"`,
        r.limiar,
        r.velocidade,
        r.delta,
        `"${r.nivel}"`,
        r.duracao_sec,
        `"${(r.logradouro || '').replace(/"/g, '""')}"`,
        `"${(r.cidade || '').replace(/"/g, '""')}"`,
        `"${r.estado || ''}"`,
        r.lat || '',
        r.lng || ''
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ocorrencias_Filtradas_CSG_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exportadas ${filteredRecords.length} ocorrências com sucesso.`, 'success');
}

// Inicialização Principal
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    if (typeof initCharts === 'function') initCharts();
    setupAdminDropZone();
    syncThemeUI();

    if (allRecords && allRecords.length > 0) {
        populateFilterDropdowns();
        updateAllViews();
    } else {
        fetchDashboardData();
    }

    if (window.lucide) lucide.createIcons();
});
