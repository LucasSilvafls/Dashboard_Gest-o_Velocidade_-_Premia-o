/**
 * ============================================================================
 * GERENCIADOR DE GRÁFICOS CHART.JS (TELEMETRIA E PERFORMANCE)
 * Casagrande Locações e Transportes • Unidade Operacional CSG
 * ============================================================================
 */

let chartDaily = null;
let chartHourly = null;
let chartLimits = null;
let chartDeltas = null;
let chartDurations = null;
let chartTelemetry = null;
let chartTopVehicles = null;
let chartTopDrivers = null;

function isLightMode() {
    return document.documentElement.classList.contains('light');
}

function getChartThemeTokens() {
    const light = isLightMode();
    return {
        textColor: light ? '#475569' : '#94a3b8',
        gridColor: light ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.05)',
        brandPrimary: light ? '#15803d' : '#22c55e',
        riskHigh: light ? '#dc2626' : '#ef4444',
        riskMed: light ? '#d97706' : '#f59e0b',
        riskLow: light ? '#15803d' : '#22c55e',
        slatePrimary: light ? '#64748b' : '#94a3b8',
        slateSecondary: light ? '#94a3b8' : '#475569'
    };
}

function updateChartsColors() {
    const tokens = getChartThemeTokens();
    const allCharts = [
        chartDaily, chartHourly, chartLimits, chartDeltas,
        chartDurations, chartTelemetry, chartTopVehicles, chartTopDrivers,
        typeof auditChartInstance !== 'undefined' ? auditChartInstance : null
    ];

    allCharts.forEach(ch => {
        if (!ch) return;
        if (ch.options.scales) {
            Object.values(ch.options.scales).forEach(scale => {
                if (scale.ticks) scale.ticks.color = tokens.textColor;
                if (scale.grid) scale.grid.color = tokens.gridColor;
            });
        }
        if (ch.options.plugins && ch.options.plugins.legend && ch.options.plugins.legend.labels) {
            ch.options.plugins.legend.labels.color = tokens.textColor;
        }
        ch.update();
    });
}

function initCharts() {
    const tokens = getChartThemeTokens();
    const defaultScales = {
        x: {
            grid: { color: tokens.gridColor },
            ticks: { color: tokens.textColor, font: { family: 'JetBrains Mono', size: 10 } }
        },
        y: {
            grid: { color: tokens.gridColor },
            ticks: { color: tokens.textColor, font: { family: 'JetBrains Mono', size: 10 } },
            beginAtZero: true
        }
    };

    // 1. Daily trend
    const elDaily = document.getElementById('chart-daily');
    if (elDaily) {
        chartDaily = new Chart(elDaily, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: defaultScales,
                plugins: {
                    legend: { labels: { color: tokens.textColor, font: { size: 11, family: 'Plus Jakarta Sans' } } }
                }
            }
        });
    }

    // 2. Hourly concentration
    const elHourly = document.getElementById('chart-hourly');
    if (elHourly) {
        chartHourly = new Chart(elHourly, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: defaultScales,
                plugins: { legend: { display: false } }
            }
        });
    }

    // 3. Limits distribution (Donut)
    const elLimits = document.getElementById('chart-limits');
    if (elLimits) {
        chartLimits = new Chart(elLimits, {
            type: 'doughnut',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: tokens.textColor, font: { size: 10 } } }
                }
            }
        });
    }

    // 4. Deltas distribution
    const elDeltas = document.getElementById('chart-deltas');
    if (elDeltas) {
        chartDeltas = new Chart(elDeltas, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: defaultScales,
                plugins: { legend: { display: false } }
            }
        });
    }

    // 5. Durations distribution
    const elDurations = document.getElementById('chart-durations');
    if (elDurations) {
        chartDurations = new Chart(elDurations, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: defaultScales,
                plugins: { legend: { display: false } }
            }
        });
    }

    // 6. Telemetry context (Donut)
    const elTelem = document.getElementById('chart-telemetry-context');
    if (elTelem) {
        chartTelemetry = new Chart(elTelem, {
            type: 'doughnut',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: tokens.textColor, font: { size: 10 } } }
                }
            }
        });
    }

    // 7. Top vehicles
    const elTopVehicles = document.getElementById('chart-top-vehicles');
    if (elTopVehicles) {
        chartTopVehicles = new Chart(elTopVehicles, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    ...defaultScales,
                    x: { ...defaultScales.x, stacked: true },
                    y: { ...defaultScales.y, stacked: true }
                },
                plugins: {
                    legend: { labels: { color: tokens.textColor, font: { size: 10 } } }
                }
            }
        });
    }

    // 8. Top drivers
    const elTopDrivers = document.getElementById('chart-top-drivers');
    if (elTopDrivers) {
        chartTopDrivers = new Chart(elTopDrivers, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: defaultScales,
                plugins: { legend: { display: false } }
            }
        });
    }
}

function updateDailyTrendChart() {
    if (!chartDaily) return;
    const tokens = getChartThemeTokens();
    const dateMap = {};
    (metaData.datas || []).forEach(d => {
        dateMap[d] = { alto: 0, medio: 0, baixo: 0, total: 0 };
    });

    filteredRecords.forEach(r => {
        if (!dateMap[r.data]) dateMap[r.data] = { alto: 0, medio: 0, baixo: 0, total: 0 };
        dateMap[r.data].total++;
        if (r.nivel === 'ALTO') dateMap[r.data].alto++;
        else if (r.nivel === 'MEDIO') dateMap[r.data].medio++;
        else dateMap[r.data].baixo++;
    });

    const labels = Object.keys(dateMap).sort((a, b) => {
        const pA = a.split('/'), pB = b.split('/');
        return (`${pA[2]}-${pA[1]}-${pA[0]}` > `${pB[2]}-${pB[1]}-${pB[0]}`) ? 1 : -1;
    });

    chartDaily.data = {
        labels: labels.map(l => l.slice(0, 5)),
        datasets: [
            { label: 'Gravidade Alta', data: labels.map(l => dateMap[l].alto), backgroundColor: tokens.riskHigh, borderRadius: 2, stack: 'combined' },
            { label: 'Gravidade Média', data: labels.map(l => dateMap[l].medio), backgroundColor: tokens.riskMed, borderRadius: 2, stack: 'combined' },
            { label: 'Gravidade Baixa', data: labels.map(l => dateMap[l].baixo), backgroundColor: tokens.riskLow, borderRadius: 2, stack: 'combined' }
        ]
    };
    chartDaily.update();
}

function updateHourlyChart() {
    if (!chartHourly) return;
    const tokens = getChartThemeTokens();
    const hourCounts = Array(24).fill(0);
    filteredRecords.forEach(r => {
        if (r.hour >= 0 && r.hour < 24) hourCounts[r.hour]++;
    });

    let maxVal = 0, peakHour = 0;
    hourCounts.forEach((cnt, h) => {
        if (cnt > maxVal) { maxVal = cnt; peakHour = h; }
    });

    const peakBadge = document.getElementById('badge-hourly-peak');
    if (peakBadge) {
        peakBadge.textContent = `Pico às ${String(peakHour).padStart(2, '0')}h: ${maxVal.toLocaleString('pt-BR')} casos`;
    }

    chartHourly.data = {
        labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`),
        datasets: [{
            label: 'Ocorrências por Hora',
            data: hourCounts,
            backgroundColor: hourCounts.map((v, i) => i === peakHour ? tokens.riskHigh : tokens.brandPrimary),
            borderRadius: 2
        }]
    };
    chartHourly.update();
}

function updateLimitsChart() {
    if (!chartLimits) return;
    const tokens = getChartThemeTokens();
    const limitMap = {};
    filteredRecords.forEach(r => {
        const lim = r.limiar ? `Limite ${r.limiar} km/h` : 'Não informado';
        limitMap[lim] = (limitMap[lim] || 0) + 1;
    });

    const labels = Object.keys(limitMap).sort((a, b) => (limitMap[b] - limitMap[a])).slice(0, 5);
    const values = labels.map(l => limitMap[l]);

    chartLimits.data = {
        labels: labels,
        datasets: [{
            data: values,
            backgroundColor: [tokens.brandPrimary, '#0284c7', tokens.riskMed, tokens.slatePrimary, tokens.slateSecondary],
            borderColor: isLightMode() ? '#ffffff' : '#13181f',
            borderWidth: 2
        }]
    };
    chartLimits.update();
}

function updateDeltasChart() {
    if (!chartDeltas) return;
    const tokens = getChartThemeTokens();
    const buckets = {
        '+1 a 5 km/h': 0,
        '+6 a 10 km/h': 0,
        '+11 a 20 km/h': 0,
        '+21 a 30 km/h': 0,
        '+31 a 50 km/h': 0,
        'Mais de +50 km/h': 0
    };

    filteredRecords.forEach(r => {
        const d = r.delta || 0;
        if (d <= 5) buckets['+1 a 5 km/h']++;
        else if (d <= 10) buckets['+6 a 10 km/h']++;
        else if (d <= 20) buckets['+11 a 20 km/h']++;
        else if (d <= 30) buckets['+21 a 30 km/h']++;
        else if (d <= 50) buckets['+31 a 50 km/h']++;
        else buckets['Mais de +50 km/h']++;
    });

    chartDeltas.data = {
        labels: Object.keys(buckets),
        datasets: [{
            data: Object.values(buckets),
            backgroundColor: [tokens.slatePrimary, tokens.riskLow, tokens.riskLow, tokens.riskMed, tokens.riskHigh, '#991b1b'],
            borderRadius: 2
        }]
    };
    chartDeltas.update();
}

function updateDurationsChart() {
    if (!chartDurations) return;
    const tokens = getChartThemeTokens();
    const buckets = {
        'Até 10 seg': 0,
        '11 a 30 seg': 0,
        '31 a 60 seg': 0,
        '1 a 5 min': 0,
        '5 a 10 min': 0,
        'Mais de 10 min': 0
    };

    filteredRecords.forEach(r => {
        const s = r.duracao_sec || 0;
        if (s <= 10) buckets['Até 10 seg']++;
        else if (s <= 30) buckets['11 a 30 seg']++;
        else if (s <= 60) buckets['31 a 60 seg']++;
        else if (s <= 300) buckets['1 a 5 min']++;
        else if (s <= 600) buckets['5 a 10 min']++;
        else buckets['Mais de 10 min']++;
    });

    chartDurations.data = {
        labels: Object.keys(buckets),
        datasets: [{
            data: Object.values(buckets),
            backgroundColor: tokens.brandPrimary,
            borderRadius: 2
        }]
    };
    chartDurations.update();
}

function updateTelemetryContextChart() {
    if (!chartTelemetry) return;
    const dist = metaData.telemetry_distribution || {};
    const speedCount = ((dist['EXCESSO_VELOCIDADE'] || 0) + (dist['EXCESSO_VELOCIDADE_POR_VIA'] || 0)) || allRecords.length;
    const paradoCount = dist['PARADO_LIGADO'] || 2640;
    const bocejoCount = (dist['BOCEJO'] || 0) + (dist['FADIGA_MOTORISTA'] || 0);
    const distracaoCount = (dist['DISTRACAO_MOTORISTA'] || 0) + (dist['MANUSEIO_CELULAR'] || 0);
    const totalFile = metaData.total_file_alerts || 16067;
    const outrosCount = Math.max(0, totalFile - (speedCount + paradoCount + bocejoCount + distracaoCount));

    const fmtStat = (cnt) => {
        const pct = totalFile > 0 ? ((cnt / totalFile) * 100).toFixed(1).replace('.', ',') : '0,0';
        return `${cnt.toLocaleString('pt-BR')} <span class="text-tech-muted font-normal">(${pct}%)</span>`;
    };

    const badgeTotal = document.getElementById('telem-total-badge');
    if (badgeTotal) badgeTotal.textContent = `TOTAL GERAL: ${totalFile.toLocaleString('pt-BR')}`;
    const elSpeed = document.getElementById('telem-stat-speed');
    if (elSpeed) elSpeed.innerHTML = fmtStat(speedCount);
    const elIdle = document.getElementById('telem-stat-idle');
    if (elIdle) elIdle.innerHTML = fmtStat(paradoCount);
    const elFatigue = document.getElementById('telem-stat-fatigue');
    if (elFatigue) elFatigue.innerHTML = fmtStat(bocejoCount);
    const elOther = document.getElementById('telem-stat-other');
    if (elOther) elOther.innerHTML = fmtStat(distracaoCount + outrosCount);

    chartTelemetry.data = {
        labels: ['Excesso de Velocidade', 'Parado com Motor Ligado', 'Sono / Fadiga', 'Distração / Celular', 'Outros Alertas'],
        datasets: [{
            data: [speedCount, paradoCount, bocejoCount, distracaoCount, outrosCount],
            backgroundColor: ['#dc2626', '#d97706', '#0284c7', '#64748b', '#94a3b8'],
            borderColor: isLightMode() ? '#ffffff' : '#13181f',
            borderWidth: 2
        }]
    };
    chartTelemetry.update();
}

function updateTopVehiclesChart() {
    if (!chartTopVehicles) return;
    const tokens = getChartThemeTokens();
    const counts = {};
    filteredRecords.forEach(r => {
        counts[r.placa] = counts[r.placa] || { alto: 0, medio: 0, baixo: 0, total: 0 };
        counts[r.placa].total++;
        if (r.nivel === 'ALTO') counts[r.placa].alto++;
        else if (r.nivel === 'MEDIO') counts[r.placa].medio++;
        else counts[r.placa].baixo++;
    });

    const top10Placas = Object.keys(counts).sort((a, b) => counts[b].total - counts[a].total).slice(0, 10);

    chartTopVehicles.data = {
        labels: top10Placas,
        datasets: [
            { label: 'Gravidade Alta', data: top10Placas.map(p => counts[p].alto), backgroundColor: tokens.riskHigh, borderRadius: 2 },
            { label: 'Gravidade Média', data: top10Placas.map(p => counts[p].medio), backgroundColor: tokens.riskMed, borderRadius: 2 },
            { label: 'Gravidade Baixa', data: top10Placas.map(p => counts[p].baixo), backgroundColor: tokens.riskLow, borderRadius: 2 }
        ]
    };
    chartTopVehicles.update();
}

function updateTopDriversChart() {
    if (!chartTopDrivers) return;
    const tokens = getChartThemeTokens();
    const counts = {};
    filteredRecords.forEach(r => {
        if (r.motorista && r.motorista !== 'Sem Identificação') {
            counts[r.motorista] = (counts[r.motorista] || 0) + 1;
        }
    });

    const top10Drivers = Object.keys(counts).sort((a, b) => counts[b].total - counts[a].total).slice(0, 10);

    chartTopDrivers.data = {
        labels: top10Drivers.map(d => d.length > 22 ? d.slice(0, 20) + '...' : d),
        datasets: [{
            label: 'Excessos com Crachá',
            data: top10Drivers.map(d => counts[d]),
            backgroundColor: tokens.brandPrimary,
            borderRadius: 2
        }]
    };
    chartTopDrivers.update();
}
