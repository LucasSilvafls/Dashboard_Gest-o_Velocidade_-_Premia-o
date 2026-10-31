/**
 * ============================================================================
 * AUDITORIA DE CONDUÇÃO SEM IDENTIFICAÇÃO (iButton / Crachá Eletrônico)
 * Casagrande Locações e Transportes • Unidade Operacional CSG
 * ============================================================================
 */

let auditChartInstance = null;

function getUnidentifiedRecords() {
    const records = typeof filteredRecords !== 'undefined' && filteredRecords.length ? filteredRecords : (typeof allRecords !== 'undefined' ? allRecords : []);
    return records.filter(r => {
        return !r.motorista ||
            r.motorista === 'Sem Identificação' ||
            r.motorista.toUpperCase().includes('NÃO IDENTIFICADO') ||
            r.motorista.toUpperCase().includes('SEM IDENTIFICAÇÃO');
    });
}

function updateAuditTab() {
    const unIdRecords = getUnidentifiedRecords();

    // 1. KPIs
    const totalEl = document.getElementById('audit-kpi-total');
    const frotaEl = document.getElementById('audit-kpi-frota');
    const picoEl = document.getElementById('audit-kpi-pico');
    const durationEl = document.getElementById('audit-kpi-duracao');

    const uniquePlacas = new Set(unIdRecords.map(r => r.placa).filter(Boolean));
    const maxSpeed = unIdRecords.reduce((max, r) => Math.max(max, r.velocidade || 0), 0);
    const totalDurationMin = unIdRecords.reduce((sum, r) => sum + (r.duracao_sec || r.duracao_segundos || 0), 0) / 60;

    if (totalEl) totalEl.textContent = unIdRecords.length.toLocaleString('pt-BR');
    if (frotaEl) frotaEl.textContent = `${uniquePlacas.size} VEÍCULOS`;
    if (picoEl) picoEl.textContent = `${maxSpeed.toFixed(0)} km/h`;
    if (durationEl) durationEl.textContent = `${totalDurationMin.toFixed(0)} min`;

    // 2. Ranking de Placas mais Reincidentes
    const placaMap = {};
    unIdRecords.forEach(r => {
        const placa = r.placa || 'PLACA N/D';
        if (!placaMap[placa]) {
            placaMap[placa] = {
                placa,
                categoria: r.categoria || r.categoria_veiculo || 'NÃO DEFINIDA',
                count: 0,
                maxSpeed: 0,
                totalSec: 0,
                rodovias: new Set()
            };
        }
        placaMap[placa].count++;
        placaMap[placa].maxSpeed = Math.max(placaMap[placa].maxSpeed, r.velocidade || 0);
        placaMap[placa].totalSec += (r.duracao_sec || r.duracao_segundos || 0);
        const road = r.logradouro || r.rodovia;
        if (road && road !== 'Não Informado' && road !== 'N/D') {
            placaMap[placa].rodovias.add(road);
        }
    });

    const topPlacas = Object.values(placaMap).sort((a, b) => b.count - a.count).slice(0, 15);
    const tbody = document.getElementById('audit-placas-tbody');
    if (tbody) {
        if (topPlacas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-6 text-tech-muted">
                        Nenhuma ocorrência sem identificação encontrada com os filtros atuais.
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = topPlacas.map((item, idx) => {
                const rodoviasStr = Array.from(item.rodovias).slice(0, 2).join(', ') || 'N/D';
                return `
                    <tr>
                        <td class="font-mono font-bold text-main">#${idx + 1}</td>
                        <td class="font-mono font-bold text-main">${item.placa}</td>
                        <td class="text-sub">${item.categoria}</td>
                        <td class="font-mono font-bold metric-warning">${item.count.toLocaleString('pt-BR')}</td>
                        <td class="font-mono font-bold metric-danger">${item.maxSpeed.toFixed(0)} km/h</td>
                        <td class="text-tech-muted text-xs truncate max-w-[160px]" title="${rodoviasStr}">${rodoviasStr}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 3. Gráfico de Horários / Turnos Críticos
    renderAuditHourChart(unIdRecords);
}

function renderAuditHourChart(unIdRecords) {
    const canvas = document.getElementById('chart-audit-hours');
    if (!canvas) return;

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const hourCounts = new Array(24).fill(0);

    unIdRecords.forEach(r => {
        let h = null;
        if (typeof r.hour === 'number' && r.hour >= 0 && r.hour < 24) {
            h = r.hour;
        } else if (r.hora && typeof r.hora === 'string' && r.hora.includes(':')) {
            h = parseInt(r.hora.split(':')[0], 10);
        } else if (r.data_hora) {
            const d = new Date(r.data_hora);
            if (!isNaN(d.getTime())) h = d.getHours();
        }
        if (h !== null && !isNaN(h) && h >= 0 && h < 24) {
            hourCounts[h]++;
        }
    });

    if (auditChartInstance) {
        auditChartInstance.destroy();
    }

    const isLight = document.documentElement.classList.contains('light');
    const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    auditChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: hours.map(h => `${String(h).padStart(2, '0')}h`),
            datasets: [{
                label: 'Ocorrências Sem Identificação',
                data: hourCounts,
                backgroundColor: 'rgba(245, 158, 11, 0.7)',
                borderColor: '#f59e0b',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.raw} infrações sem iButton às ${ctx.label}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'JetBrains Mono', size: 10 } },
                    beginAtZero: true
                }
            }
        }
    });
}

function exportAuditReport() {
    const unIdRecords = getUnidentifiedRecords();
    if (!unIdRecords.length) {
        showToast('Nenhum registro para exportar com os filtros atuais.', 'error');
        return;
    }

    const headers = ['ID', 'Data', 'Hora', 'Placa', 'Categoria', 'Velocidade (km/h)', 'Limite (km/h)', 'Excesso (km/h)', 'Rodovia', 'Localização', 'Duração (s)'];
    const rows = unIdRecords.map(r => [
        r.id || '',
        `"${r.data || ''}"`,
        `"${r.hora || ''}"`,
        `"${r.placa || ''}"`,
        `"${r.categoria || r.categoria_veiculo || ''}"`,
        r.velocidade || 0,
        r.limiar || 0,
        r.delta || 0,
        `"${(r.logradouro || r.rodovia || '').replace(/"/g, '""')}"`,
        `"${(r.cidade ? `${r.cidade} - ${r.estado || 'MS'}` : '').replace(/"/g, '""')}"`,
        r.duracao_sec || r.duracao_segundos || 0
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Auditoria_Conducao_Sem_Identificacao_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Relatório exportado com sucesso: ${unIdRecords.length} ocorrências.`, 'success');
}

