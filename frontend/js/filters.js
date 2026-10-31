/**
 * ============================================================================
 * FILTROS EM CASCATA INTELIGENTE (PERÍODO, DIA ESPECÍFICO, CATEGORIA, TIPO, PLACA, IDENTIFICAÇÃO CONDUTOR)
 * Casagrande Locações e Transportes • Unidade Operacional CSG
 * ============================================================================
 */

function parseBRDateToUTC(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    return Date.UTC(y, m, d);
}

function getAllDatesBounds() {
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (let i = 0; i < allRecords.length; i++) {
        const ts = parseBRDateToUTC(allRecords[i].data);
        if (ts !== null) {
            if (ts < minTs) minTs = ts;
            if (ts > maxTs) maxTs = ts;
        }
    }
    if (minTs === Infinity || maxTs === -Infinity) {
        minTs = Date.UTC(2026, 8, 26);
        maxTs = Date.UTC(2026, 9, 25);
    }
    return { minTs, maxTs };
}

function isRecordInPeriod(dateStr, periodVal, minTs, maxTs) {
    if (!periodVal || periodVal === 'ALL') return true;
    const ts = parseBRDateToUTC(dateStr);
    if (ts === null) return true;
    const DAY_MS = 24 * 60 * 60 * 1000;
    if (periodVal === 'LAST_7') {
        return ts >= maxTs - 6 * DAY_MS && ts <= maxTs;
    }
    if (periodVal === 'LAST_15') {
        return ts >= maxTs - 14 * DAY_MS && ts <= maxTs;
    }
    if (periodVal === 'FIRST_15') {
        return ts >= minTs && ts <= minTs + 14 * DAY_MS;
    }
    return true;
}

function toggleFilterCollapse() {
    const grid = document.getElementById('filter-controls-grid');
    const icon = document.getElementById('icon-toggle-filters');
    const label = document.getElementById('label-toggle-filters');
    if (!grid) return;
    const isHidden = grid.classList.contains('hidden');
    if (isHidden) {
        grid.classList.remove('hidden');
        if (label) label.textContent = 'Recolher';
        if (icon) icon.setAttribute('data-lucide', 'chevron-up');
    } else {
        grid.classList.add('hidden');
        if (label) label.textContent = 'Expandir';
        if (icon) icon.setAttribute('data-lucide', 'chevron-down');
    }
    if (window.lucide) lucide.createIcons();
}

function updateSpecificDayDropdown() {
    const periodVal = document.getElementById('filter-period')?.value || 'ALL';
    const dateSelect = document.getElementById('filter-date');
    if (!dateSelect) return;

    const { minTs, maxTs } = getAllDatesBounds();
    const dayCounts = {};
    allRecords.forEach(r => {
        if (r.data && isRecordInPeriod(r.data, periodVal, minTs, maxTs)) {
            dayCounts[r.data] = (dayCounts[r.data] || 0) + 1;
        }
    });

    const sortedDates = Object.keys(dayCounts).sort((a, b) => {
        return (parseBRDateToUTC(b) || 0) - (parseBRDateToUTC(a) || 0);
    });

    const currentSelection = dateSelect.value;
    dateSelect.innerHTML = `<option value="ALL">Todos os dias (${sortedDates.length} dias)</option>`;
    sortedDates.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = `${d} (${dayCounts[d]} ocorr.)`;
        dateSelect.appendChild(opt);
    });

    if (sortedDates.includes(currentSelection)) {
        dateSelect.value = currentSelection;
    } else {
        dateSelect.value = 'ALL';
    }
}

function onPeriodFilterChange() {
    updateSpecificDayDropdown();
    applyFilters();
}

function updateVehicleDropdown() {
    const categoryVal = document.getElementById('filter-category')?.value || 'ALL';
    const vehicleSelect = document.getElementById('filter-vehicle');
    if (!vehicleSelect) return;

    let candidateRecords = allRecords;
    if (categoryVal !== 'ALL') {
        candidateRecords = allRecords.filter(r => r.categoria === categoryVal);
    }

    const uniquePlacas = Array.from(new Set(candidateRecords.map(r => r.placa).filter(p => p && p !== 'N/I'))).sort();
    const currentSelection = vehicleSelect.value;

    vehicleSelect.innerHTML = `<option value="ALL">Todas as placas (${uniquePlacas.length})</option>`;
    uniquePlacas.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        vehicleSelect.appendChild(opt);
    });

    if (uniquePlacas.includes(currentSelection)) {
        vehicleSelect.value = currentSelection;
    } else {
        vehicleSelect.value = 'ALL';
    }
}

function onCategoryFilterChange() {
    updateVehicleDropdown();
    applyFilters();
}

function populateFilterDropdowns() {
    // 1. Período / Dia
    const periodSelect = document.getElementById('filter-period');
    if (periodSelect) {
        periodSelect.innerHTML = `
            <option value="ALL">Todos os dias</option>
            <option value="LAST_7">Últimos 7 dias</option>
            <option value="LAST_15">Últimos 15 dias</option>
            <option value="FIRST_15">Primeiros 15 dias</option>
        `;
    }

    // 2. Dia específico (sincronizado com Período)
    updateSpecificDayDropdown();

    // 3. Categoria Veículo
    const categorySelect = document.getElementById('filter-category');
    if (categorySelect) {
        const catCounts = {};
        allRecords.forEach(r => {
            if (r.categoria) {
                catCounts[r.categoria] = (catCounts[r.categoria] || 0) + 1;
            }
        });

        const allCats = Array.from(new Set([
            ...(metaData.categorias || []),
            ...Object.keys(catCounts)
        ])).sort();

        categorySelect.innerHTML = `<option value="ALL">Todas as categorias (${allRecords.length.toLocaleString('pt-BR')})</option>`;
        allCats.forEach(cat => {
            const cnt = catCounts[cat] || 0;
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = `${cat} (${cnt.toLocaleString('pt-BR')})`;
            categorySelect.appendChild(opt);
        });
    }

    // 4. Tipo de Excesso Veloc.
    const typeSelect = document.getElementById('filter-type');
    if (typeSelect) {
        const countFrota = allRecords.filter(r => r.tipo === 'EXCESSO_VELOCIDADE').length;
        const countVia = allRecords.filter(r => r.tipo === 'EXCESSO_VELOCIDADE_POR_VIA').length;
        const countTotalSpeed = allRecords.length;

        typeSelect.innerHTML = `
            <option value="ALL">Todos os excessos de velocidade (${countTotalSpeed.toLocaleString('pt-BR')})</option>
            <option value="EXCESSO_VELOCIDADE">Excesso de Velocidade - Limite Frota (${countFrota.toLocaleString('pt-BR')})</option>
            <option value="EXCESSO_VELOCIDADE_POR_VIA">Excesso de Velocidade por Via / Placa (${countVia.toLocaleString('pt-BR')})</option>
        `;
    }

    // 5. Placa do Veículo sincronizada
    updateVehicleDropdown();

    const profileVehicleSelect = document.getElementById('profile-vehicle-select');
    if (profileVehicleSelect) {
        profileVehicleSelect.innerHTML = '';
        const allPlacas = Array.from(new Set(allRecords.map(r => r.placa).filter(p => p && p !== 'N/I'))).sort();
        allPlacas.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            profileVehicleSelect.appendChild(opt);
        });
    }

    // 6. Identificação Condutor
    const driverStatusSelect = document.getElementById('filter-driver-status');
    if (driverStatusSelect) {
        const countUnid = allRecords.filter(r => r.motorista === 'Sem Identificação').length;
        const countId = allRecords.length - countUnid;
        driverStatusSelect.innerHTML = `
            <option value="ALL">Todos (Com e sem identificação)</option>
            <option value="IDENTIFIED">Condutor Identificado (${countId.toLocaleString('pt-BR')})</option>
            <option value="UNIDENTIFIED">Sem identificação (${countUnid.toLocaleString('pt-BR')})</option>
        `;
    }

    // Atualiza badges do header
    const uniqueVehiclesCount = Array.from(new Set(allRecords.map(r => r.placa))).length;
    const totalFileAlerts = metaData.total_file_alerts || 16067;
    const pctSpeed = ((allRecords.length / totalFileAlerts) * 100).toFixed(1).replace('.', ',');

    const bPeriod = document.getElementById('badge-period');
    const bVehicles = document.getElementById('badge-vehicles-count');
    const bAlerts = document.getElementById('badge-total-file-alerts');

    if (bPeriod) bPeriod.textContent = metaData.period || '26/09 a 25/10/2026';
    if (bVehicles) bVehicles.textContent = `${uniqueVehiclesCount} VEÍCULOS`;
    if (bAlerts) bAlerts.textContent = `${allRecords.length.toLocaleString('pt-BR')} de ${totalFileAlerts.toLocaleString('pt-BR')} (${pctSpeed}%)`;
}

function applyFilters() {
    const periodVal = document.getElementById('filter-period')?.value || 'ALL';
    const dateVal = document.getElementById('filter-date')?.value || 'ALL';
    const categoryVal = document.getElementById('filter-category')?.value || 'ALL';
    const typeVal = document.getElementById('filter-type')?.value || 'ALL';
    const vehicleVal = document.getElementById('filter-vehicle')?.value || 'ALL';
    const driverStatusVal = document.getElementById('filter-driver-status')?.value || 'ALL';

    const { minTs, maxTs } = getAllDatesBounds();

    filteredRecords = allRecords.filter(r => {
        if (periodVal !== 'ALL' && !isRecordInPeriod(r.data, periodVal, minTs, maxTs)) return false;
        if (dateVal !== 'ALL' && r.data !== dateVal) return false;
        if (categoryVal !== 'ALL' && r.categoria !== categoryVal) return false;
        if (typeVal !== 'ALL' && r.tipo !== typeVal) return false;
        if (vehicleVal !== 'ALL' && r.placa !== vehicleVal) return false;
        if (driverStatusVal === 'UNIDENTIFIED' && r.motorista !== 'Sem Identificação') return false;
        if (driverStatusVal === 'IDENTIFIED' && r.motorista === 'Sem Identificação') return false;
        return true;
    });

    currentPage = 1;
    updateAllViews();
}

function resetFilters() {
    const elPeriod = document.getElementById('filter-period');
    const elDate = document.getElementById('filter-date');
    const elCat = document.getElementById('filter-category');
    const elType = document.getElementById('filter-type');
    const elVeh = document.getElementById('filter-vehicle');
    const elDriver = document.getElementById('filter-driver-status');
    const elSearch = document.getElementById('table-search-input');

    if (elPeriod) elPeriod.value = 'ALL';
    updateSpecificDayDropdown();
    if (elDate) elDate.value = 'ALL';
    if (elCat) elCat.value = 'ALL';
    if (elType) elType.value = 'ALL';
    updateVehicleDropdown();
    if (elVeh) elVeh.value = 'ALL';
    if (elDriver) elDriver.value = 'ALL';
    if (elSearch) elSearch.value = '';
    searchQuery = '';

    filteredRecords = [...allRecords];
    currentPage = 1;
    updateAllViews();
}

function filterUnidentifiedOnly() {
    const elDriver = document.getElementById('filter-driver-status');
    if (elDriver) elDriver.value = 'UNIDENTIFIED';
    applyFilters();
    if (typeof switchTab === 'function') switchTab('overview');
}
