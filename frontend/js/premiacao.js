/**
 * ============================================================================
 * PROGRAMA DE PREMIAÇÃO MOTORISTA X CAMINHÃO (TETO 80 KM/H E GOVERNANÇA)
 * Casagrande Locações e Transportes • Unidade Operacional CSG
 * ============================================================================
 */

let premiacaoThreshold = 80;
let premiacaoScope = 'TRUCKS';
let premiacaoStatusFilter = 'ALL';
let premiacaoSearchQuery = '';
let premiacaoCurrentPage = 1;
let premiacaoPageSize = 10;
let chartPremiacaoDrivers = null;
let chartPremiacaoCategories = null;

function isTruckCategory(cat) {
    if (!cat) return false;
    const u = String(cat).toUpperCase();
    return u.includes('CAVALO') || u.includes('CAÇAMBA') || u.includes('CACAMBA') || u.includes('CAAMBA') || u.includes('MUNK') || u.includes('MUNCK') || u.includes('PIPA') || u.includes('COMBOIO') || u.includes('ONIBUS') || u.includes('ÔNIBUS');
}

function setPremiacaoScope(scope) {
    premiacaoScope = scope;
    document.querySelectorAll('.premiacao-scope-btn').forEach(btn => {
        if (btn.dataset.scope === scope) {
            btn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-600');
            btn.classList.remove('panel-subsurface', 'text-tech-muted');
        } else {
            btn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-600');
            btn.classList.add('panel-subsurface', 'text-tech-muted');
        }
    });
    premiacaoCurrentPage = 1;
    updatePremiacaoView();
}

function setPremiacaoStatusFilter(status) {
    premiacaoStatusFilter = status;
    document.querySelectorAll('.premiacao-status-btn').forEach(btn => {
        if (btn.dataset.status === status) {
            btn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-600');
            btn.classList.remove('panel-subsurface', 'text-tech-muted');
        } else {
            btn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-600');
            btn.classList.add('panel-subsurface', 'text-tech-muted');
        }
    });
    premiacaoCurrentPage = 1;
    renderPremiacaoTable();
}

function setPremiacaoThreshold(val) {
    val = parseFloat(val);
    if (isNaN(val) || val <= 0) val = 80;
    premiacaoThreshold = val;
    const input = document.getElementById('premiacao-threshold-input');
    if (input) input.value = val;

    document.querySelectorAll('.premiacao-thresh-btn').forEach(btn => {
        if (parseFloat(btn.dataset.thresh) === val) {
            btn.classList.add('bg-emerald-600', 'text-white');
            btn.classList.remove('panel-subsurface', 'text-tech-muted');
        } else {
            btn.classList.remove('bg-emerald-600', 'text-white');
            btn.classList.add('panel-subsurface', 'text-tech-muted');
        }
    });

    updatePremiacaoView();
}

function handlePremiacaoSearch() {
    const el = document.getElementById('premiacao-search-input');
    premiacaoSearchQuery = el ? el.value.toLowerCase().trim() : '';
    premiacaoCurrentPage = 1;
    renderPremiacaoTable();
}

function changePremiacaoPageSize(val) {
    premiacaoPageSize = parseInt(val, 10) || 10;
    premiacaoCurrentPage = 1;
    renderPremiacaoTable();
}

function prevPremiacaoPage() {
    if (premiacaoCurrentPage > 1) {
        premiacaoCurrentPage--;
        renderPremiacaoTable();
    }
}

function nextPremiacaoPage() {
    premiacaoCurrentPage++;
    renderPremiacaoTable();
}

function getPremiacaoAggregates() {
    const threshold = premiacaoThreshold || 80;

    let baseRecs = (typeof filteredRecords !== 'undefined' ? filteredRecords : allRecords)
        .filter(r => r.motorista && r.motorista !== 'Sem Identificação');

    if (premiacaoScope === 'TRUCKS') {
        baseRecs = baseRecs.filter(r => isTruckCategory(r.categoria));
    }

    const driversMap = {};
    const pairsMap = {};
    const truckPlatesMap = {};

    baseRecs.forEach(r => {
        const m = r.motorista;
        const p = r.placa;
        const pairKey = `${m}:::${p}`;

        if (!driversMap[m]) {
            driversMap[m] = {
                motorista: m,
                cpf: r.cpf || '-',
                uo: r.uo || 'CASAGRANDE',
                plates: new Set(),
                categories: new Set(),
                records: [],
                maxSpeed: 0,
                maxRecord: null,
                totalAlerts: 0,
                excessOverThreshold: 0
            };
        }

        driversMap[m].plates.add(p);
        if (r.categoria) driversMap[m].categories.add(r.categoria);
        driversMap[m].records.push(r);
        driversMap[m].totalAlerts++;

        const vel = r.velocidade || 0;
        if (vel > driversMap[m].maxSpeed) {
            driversMap[m].maxSpeed = vel;
            driversMap[m].maxRecord = r;
        }
        if (vel > threshold) {
            driversMap[m].excessOverThreshold++;
        }

        if (!pairsMap[pairKey]) {
            pairsMap[pairKey] = {
                motorista: m,
                placa: p,
                categoria: r.categoria,
                maxSpeed: 0,
                count: 0,
                countOverThreshold: 0
            };
        }
        pairsMap[pairKey].count++;
        if (vel > pairsMap[pairKey].maxSpeed) pairsMap[pairKey].maxSpeed = vel;
        if (vel > threshold) pairsMap[pairKey].countOverThreshold++;

        truckPlatesMap[p] = (truckPlatesMap[p] || 0) + 1;
    });

    const driversList = Object.values(driversMap).map(d => {
        const isEligible = d.excessOverThreshold === 0 && d.maxSpeed <= threshold;
        return {
            ...d,
            isEligible,
            status: isEligible ? 'APTO' : 'INAPTO',
            platesCount: d.plates.size,
            platesList: Array.from(d.plates).sort().join(', '),
            categoriesList: Array.from(d.categories).sort().join(', ')
        };
    });

    const eligibleCount = driversList.filter(d => d.isEligible).length;
    const ineligibleCount = driversList.filter(d => !d.isEligible).length;

    return {
        threshold,
        scope: premiacaoScope,
        totalDrivers: driversList.length,
        eligibleCount,
        ineligibleCount,
        eligiblePct: driversList.length > 0 ? ((eligibleCount / driversList.length) * 100).toFixed(1) : 0,
        driversList,
        pairsList: Object.values(pairsMap),
        truckPlatesCount: Object.keys(truckPlatesMap).length
    };
}

function updatePremiacaoView() {
    const data = getPremiacaoAggregates();

    const kpiThresh = document.getElementById('premiacao-kpi-threshold');
    const kpiEligible = document.getElementById('premiacao-kpi-eligible');
    const kpiIneligible = document.getElementById('premiacao-kpi-ineligible');
    const kpiRate = document.getElementById('premiacao-kpi-rate');
    const badgeThresh = document.getElementById('premiacao-badge-threshold');

    if (kpiThresh) kpiThresh.textContent = `${data.threshold} km/h`;
    if (kpiEligible) kpiEligible.textContent = data.eligibleCount;
    if (kpiIneligible) kpiIneligible.textContent = data.ineligibleCount;
    if (kpiRate) kpiRate.textContent = `${data.eligiblePct}%`;
    if (badgeThresh) badgeThresh.textContent = `${data.threshold} km/h`;

    renderPremiacaoTable(data);
    updatePremiacaoCharts(data);
}

function renderPremiacaoTable(precomputedData) {
    const data = precomputedData || getPremiacaoAggregates();
    const tbody = document.getElementById('premiacao-table-body');
    if (!tbody) return;

    let list = data.driversList;

    if (premiacaoStatusFilter !== 'ALL') {
        list = list.filter(d => d.status === premiacaoStatusFilter);
    }

    if (premiacaoSearchQuery) {
        list = list.filter(d =>
            d.motorista.toLowerCase().includes(premiacaoSearchQuery) ||
            d.platesList.toLowerCase().includes(premiacaoSearchQuery) ||
            d.categoriesList.toLowerCase().includes(premiacaoSearchQuery)
        );
    }

    list.sort((a, b) => {
        if (a.isEligible && !b.isEligible) return -1;
        if (!a.isEligible && b.isEligible) return 1;
        return a.maxSpeed - b.maxSpeed;
    });

    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / premiacaoPageSize) || 1;
    if (premiacaoCurrentPage > totalPages) premiacaoCurrentPage = totalPages;

    const startIdx = (premiacaoCurrentPage - 1) * premiacaoPageSize;
    const pageItems = list.slice(startIdx, startIdx + premiacaoPageSize);

    const pageInd = document.getElementById('premiacao-page-indicator');
    const prevBtn = document.getElementById('premiacao-prev-btn');
    const nextBtn = document.getElementById('premiacao-next-btn');

    if (pageInd) pageInd.textContent = `Página ${premiacaoCurrentPage} de ${totalPages} (${totalItems} condutores)`;
    if (prevBtn) prevBtn.disabled = premiacaoCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = premiacaoCurrentPage >= totalPages;

    if (pageItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-tech-muted font-mono text-xs">
                    Nenhum motorista encontrado para os filtros selecionados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = pageItems.map(d => {
        const isApto = d.isEligible;
        const statusBadge = isApto
            ? '<span class="risk-badge risk-badge-low"><i data-lucide="award" class="w-3 h-3 inline"></i> APTO À BONIFICAÇÃO</span>'
            : `<span class="risk-badge risk-badge-high"><i data-lucide="x-circle" class="w-3 h-3 inline"></i> INAPTO (> ${data.threshold} km/h)</span>`;

        return `
            <tr class="hover:bg-hover transition-colors cursor-pointer" onclick="openPremiacaoAuditModal('${d.motorista.replace(/'/g, "\\'")}')">
                <td class="font-bold text-main whitespace-nowrap">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full ${isApto ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} flex items-center justify-center font-bold text-[10px]">
                            ${d.motorista.charAt(0)}
                        </div>
                        <span>${d.motorista}</span>
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td class="font-mono text-right font-bold ${isApto ? 'metric-brand' : 'metric-danger'}">${d.maxSpeed} km/h</td>
                <td class="font-mono text-right text-tech-muted font-semibold">${d.excessOverThreshold}</td>
                <td class="font-mono text-right text-sub">${d.totalAlerts}</td>
                <td class="text-xs text-sub truncate max-w-[200px]" title="${d.platesList}">
                    <span class="font-mono font-bold text-main">${d.platesCount}</span> veículo(s): <span class="font-mono text-[11px]">${d.platesList}</span>
                </td>
                <td class="text-center">
                    <button type="button" class="btn-industrial px-2 py-1 text-[11px] font-bold text-main hover:text-brand-accent">
                        Ver Dossiê
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function updatePremiacaoCharts(data) {
    // Top Drivers Chart
    const canvasDrivers = document.getElementById('chart-premiacao-drivers');
    if (canvasDrivers) {
        const sorted = [...data.driversList].sort((a, b) => b.maxSpeed - a.maxSpeed).slice(0, 8);
        if (chartPremiacaoDrivers) chartPremiacaoDrivers.destroy();

        const isLight = isLightMode();
        const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
        const textColor = isLight ? '#64748b' : '#94a3b8';

        chartPremiacaoDrivers = new Chart(canvasDrivers, {
            type: 'bar',
            data: {
                labels: sorted.map(d => d.motorista.split(' ')[0]),
                datasets: [{
                    label: 'Pico de Velocidade (km/h)',
                    data: sorted.map(d => d.maxSpeed),
                    backgroundColor: sorted.map(d => d.isEligible ? '#22c55e' : '#ef4444'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { size: 10 } },
                        suggestedMax: 100
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

function openPremiacaoAuditModal(driverName) {
    const data = getPremiacaoAggregates();
    const driver = data.driversList.find(d => d.motorista === driverName);
    if (!driver) return;

    const modal = document.getElementById('modal-premiacao-audit');
    if (!modal) return;

    const elName = document.getElementById('audit-modal-name');
    const elCpf = document.getElementById('audit-modal-cpf');
    const elStatus = document.getElementById('audit-modal-status');
    const elMaxSpeed = document.getElementById('audit-modal-max-speed');
    const elThreshold = document.getElementById('audit-modal-threshold');
    const elVehicles = document.getElementById('audit-modal-vehicles');
    const tbody = document.getElementById('audit-modal-events-tbody');

    if (elName) elName.textContent = driver.motorista;
    if (elCpf) elCpf.textContent = `CPF: ${driver.cpf} • Unidade CSG Florestal`;
    if (elThreshold) elThreshold.textContent = `${data.threshold} km/h`;
    if (elMaxSpeed) {
        elMaxSpeed.textContent = `${driver.maxSpeed} km/h`;
        elMaxSpeed.className = `font-mono text-base font-bold ${driver.isEligible ? 'metric-brand' : 'metric-danger'}`;
    }
    if (elVehicles) elVehicles.textContent = driver.platesList;

    if (elStatus) {
        elStatus.className = driver.isEligible
            ? 'px-3 py-1 rounded text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'px-3 py-1 rounded text-xs font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30';
        elStatus.textContent = driver.isEligible ? '🏆 APTO À BONIFICAÇÃO' : '❌ DESQUALIFICADO';
    }

    if (tbody) {
        const sortedRecs = [...driver.records].sort((a, b) => (b.velocidade || 0) - (a.velocidade || 0));
        tbody.innerHTML = sortedRecs.map((r, i) => {
            const isOver = (r.velocidade || 0) > data.threshold;
            return `
                <tr>
                    <td class="font-mono text-tech-muted text-xs">#${i + 1}</td>
                    <td class="font-mono text-sub text-xs">${r.data} ${r.hora || ''}</td>
                    <td class="font-mono font-bold text-main">${r.placa}</td>
                    <td class="text-xs text-sub">${r.categoria || '-'}</td>
                    <td class="font-mono font-bold ${isOver ? 'metric-danger' : 'metric-brand'} text-right">${r.velocidade} km/h</td>
                    <td class="font-mono text-tech-muted text-right">${data.threshold} km/h</td>
                    <td class="text-xs text-sub truncate max-w-[150px]" title="${r.logradouro || ''}">${r.logradouro || '-'}</td>
                </tr>
            `;
        }).join('');
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
}

function closePremiacaoAuditModal() {
    const modal = document.getElementById('modal-premiacao-audit');
    if (modal) modal.classList.add('hidden');
}

function printAuditModal() {
    window.print();
}

function exportPremiacaoCSV() {
    const data = getPremiacaoAggregates();
    const headers = ['Motorista', 'Status', 'Teto Regulamentar (km/h)', 'Pico de Velocidade (km/h)', 'Excessos Acima do Teto', 'Total de Registros', 'Veículos Conduzidos'];
    const rows = data.driversList.map(d => [
        `"${d.motorista}"`,
        d.status,
        data.threshold,
        d.maxSpeed,
        d.excessOverThreshold,
        d.totalAlerts,
        `"${d.platesList}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Apuracao_Premiacao_CSG_${data.threshold}kmh_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Lista de Premiação exportada com sucesso (${data.driversList.length} motoristas).`, 'success');
}
