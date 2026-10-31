import { Incident, DriverScore, RoadParameter } from './telemetry-data';

export interface FilterOptions {
  competence?: string; // Chave 'YYYY-MM' ou 'all' (ex: '2026-10')
  period?: string;
  specificDay?: string;
  vehicleCategory?: string;
  excessType?: string;
  plate?: string;
  severity?: string;
  driverIdStatus?: string;
  highway?: string;
  shift?: string;
  searchQuery?: string;
}

export interface CompetenceInfo {
  key: string;            // '2026-10'
  month: number;          // 1..12
  year: number;           // 2026
  label: string;          // 'Outubro/2026'
  rangeLabel: string;     // '26/09/2026 a 25/10/2026'
  shortRangeLabel: string;// '26/09 a 25/10'
  startTs: number;        // UTC ms da 00:00:00 do dia 26 do mês anterior
  endTs: number;          // UTC ms da 23:59:59.999 do dia 25 do mês da competência
  startDateStr: string;   // '26/09/2026'
  endDateStr: string;     // '25/10/2026'
}

export interface AvailableCompetenceItem {
  key: string;
  label: string;
  rangeLabel: string;
  shortRangeLabel: string;
  count: number;
  month: number;
  year: number;
  startTs: number;
  endTs: number;
}

export const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

/**
 * Calcula a competência mensal para o dia/mês/ano informados.
 * Regra de Negócio Casagrande:
 * - Ciclo mensal: Do dia 26 do mês anterior (M-1) ao dia 25 do mês atual (M).
 * - Dias 26 a 31 pertencem à competência do mês seguinte.
 * - Dias 01 a 25 pertencem à competência do mês corrente.
 * Exemplo: 26/09/2026 a 25/10/2026 é referente à competência de Outubro/2026.
 */
export function getCompetenceFromParts(day: number, month1To12: number, year: number): CompetenceInfo {
  let compMonth: number;
  let compYear: number;
  let prevMonth: number;
  let prevYear: number;

  if (day >= 26) {
    if (month1To12 === 12) {
      compMonth = 1;
      compYear = year + 1;
    } else {
      compMonth = month1To12 + 1;
      compYear = year;
    }
    prevMonth = month1To12;
    prevYear = year;
  } else {
    compMonth = month1To12;
    compYear = year;
    if (month1To12 === 1) {
      prevMonth = 12;
      prevYear = year - 1;
    } else {
      prevMonth = month1To12 - 1;
      prevYear = year;
    }
  }

  const compMonthStr = String(compMonth).padStart(2, '0');
  const prevMonthStr = String(prevMonth).padStart(2, '0');
  const key = `${compYear}-${compMonthStr}`;
  const label = `${MONTH_NAMES_PT[compMonth - 1]}/${compYear}`;
  const startDateStr = `26/${prevMonthStr}/${prevYear}`;
  const endDateStr = `25/${compMonthStr}/${compYear}`;
  const shortRangeLabel = `26/${prevMonthStr} a 25/${compMonthStr}`;
  const rangeLabel = `${startDateStr} a ${endDateStr}`;

  // Timestamps UTC
  const startTs = Date.UTC(prevYear, prevMonth - 1, 26, 0, 0, 0, 0);
  const endTs = Date.UTC(compYear, compMonth - 1, 25, 23, 59, 59, 999);

  return {
    key,
    month: compMonth,
    year: compYear,
    label,
    rangeLabel,
    shortRangeLabel,
    startTs,
    endTs,
    startDateStr,
    endDateStr,
  };
}

/**
 * Retorna a competência para uma string de data (DD/MM/AAAA ou AAAA-MM-DD).
 */
export function getCompetenceForDate(dateStr: string | undefined | null): CompetenceInfo | null {
  if (!dateStr) return null;
  const clean = dateStr.trim().split(' ')[0];
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return getCompetenceFromParts(day, month, year);
      }
    }
  } else if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return getCompetenceFromParts(day, month, year);
      }
    }
  }
  return null;
}

/**
 * Retorna a informação da competência a partir da chave 'YYYY-MM' (ex: '2026-10').
 */
export function getCompetenceInfoFromKey(key: string | undefined | null): CompetenceInfo | null {
  if (!key || key === 'all' || key === 'todas') return null;
  const parts = key.split('-');
  if (parts.length === 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      return getCompetenceFromParts(1, month, year);
    }
  }
  return null;
}

/**
 * Verifica se uma data pertence à competência indicada.
 */
export function isDateInCompetence(dateStr: string | undefined | null, competenceKey: string | undefined): boolean {
  if (!competenceKey || competenceKey === 'all' || competenceKey === 'todas') return true;
  const comp = getCompetenceForDate(dateStr);
  if (!comp) return true;
  return comp.key === competenceKey;
}

/**
 * Agrupa os incidentes por competência mensal e retorna ordenado pela mais recente.
 */
export function getAvailableCompetences(incidents: Incident[]): AvailableCompetenceItem[] {
  const map = new Map<string, AvailableCompetenceItem>();

  for (let i = 0; i < incidents.length; i++) {
    const inc = incidents[i];
    const comp = getCompetenceForDate(inc.date);
    if (!comp) continue;

    const existing = map.get(comp.key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(comp.key, {
        key: comp.key,
        label: comp.label,
        rangeLabel: comp.rangeLabel,
        shortRangeLabel: comp.shortRangeLabel,
        count: 1,
        month: comp.month,
        year: comp.year,
        startTs: comp.startTs,
        endTs: comp.endTs,
      });
    }
  }

  // Ordenar decrescente (ano e mês mais recentes primeiro)
  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

/**
 * Parses a DD/MM/YYYY date string into a UTC timestamp (ms) for reliable day comparison.
 */
export function parseDateBR(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const clean = dateStr.trim().split(' ')[0];
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return Date.UTC(year, month, day);
      }
    }
  } else if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return Date.UTC(year, month, day);
      }
    }
  }
  return null;
}

/**
 * Formata dois timestamps UTC em texto de período legível (ex: '26/09 a 30/10/2026').
 */
export function formatTimestampsToPeriodDisplay(startTs: number, endTs: number): string {
  const dStart = new Date(startTs);
  const dEnd = new Date(endTs);

  const startDay = String(dStart.getUTCDate()).padStart(2, '0');
  const startMonth = String(dStart.getUTCMonth() + 1).padStart(2, '0');
  const startYear = dStart.getUTCFullYear();

  const endDay = String(dEnd.getUTCDate()).padStart(2, '0');
  const endMonth = String(dEnd.getUTCMonth() + 1).padStart(2, '0');
  const endYear = dEnd.getUTCFullYear();

  if (startYear === endYear) {
    if (startDay === endDay && startMonth === endMonth) {
      return `${startDay}/${startMonth}/${startYear}`;
    }
    return `${startDay}/${startMonth} a ${endDay}/${endMonth}/${endYear}`;
  }

  return `${startDay}/${startMonth}/${startYear} a ${endDay}/${endMonth}/${endYear}`;
}

/**
 * Formata um intervalo entre a primeira e a última data para exibição responsiva no topo.
 * Trata formatos YYYY-MM-DD e DD/MM/AAAA.
 */
export function formatDatesToPeriodDisplay(
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined
): string {
  if (!startDateStr && !endDateStr) return '26/09 a 25/10/2026';
  const startTs = parseDateBR(startDateStr);
  const endTs = parseDateBR(endDateStr);

  if (startTs === null || endTs === null) {
    if (startDateStr && endDateStr) return `${startDateStr} a ${endDateStr}`;
    return startDateStr || endDateStr || '26/09 a 25/10/2026';
  }

  // Garante ordem cronológica crescente caso venham invertidos
  const minTs = Math.min(startTs, endTs);
  const maxTs = Math.max(startTs, endTs);

  return formatTimestampsToPeriodDisplay(minTs, maxTs);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Checks whether a DD/MM/YYYY date falls within the selected period relative to dataset bounds.
 */
export function isDateInPeriod(
  dateStr: string,
  period: string | undefined,
  minTs: number,
  maxTs: number
): boolean {
  if (!period || period === 'all' || period === 'todos' || period === '30d') return true;
  const ts = parseDateBR(dateStr);
  if (ts === null) return true;

  if (period === 'ultimos-7' || period === '7d' || period === 'ultimos_7') {
    return ts >= maxTs - 6 * DAY_MS && ts <= maxTs;
  }
  if (period === 'ultimos-15' || period === '15d' || period === 'ultimos_15') {
    return ts >= maxTs - 14 * DAY_MS && ts <= maxTs;
  }
  if (period === 'primeiros-15' || period === 'first15' || period === 'primeiros_15') {
    return ts >= minTs && ts <= minTs + 14 * DAY_MS;
  }
  // Allow passing a direct date string in period as fallback
  if (period.includes('/')) {
    return dateStr === period;
  }
  return true;
}

/**
 * Computes the min and max timestamps (UTC ms) across an array of incidents.
 */
export function getDatasetDateBounds(incidents: Incident[]): { minTs: number; maxTs: number } {
  let minTs = Infinity;
  let maxTs = -Infinity;
  for (let i = 0; i < incidents.length; i++) {
    const ts = parseDateBR(incidents[i].date);
    if (ts !== null) {
      if (ts < minTs) minTs = ts;
      if (ts > maxTs) maxTs = ts;
    }
  }
  if (minTs === Infinity || maxTs === -Infinity) {
    // Fallback to official cycle 26/09/2026 - 25/10/2026
    minTs = Date.UTC(2026, 8, 26);
    maxTs = Date.UTC(2026, 9, 25);
  }
  return { minTs, maxTs };
}

/**
 * Compliance check according to Casagrande Golden Rule:
 * Drivers who stay <= 80 km/h (or custom regulatory ceiling) throughout the period are eligible ('APTO').
 * Any excursion > ceiling marks them 'INAPTO'.
 */
export function calculateCompliance(
  maxSpeedRecorded: number,
  speedLimitCeiling: number = 80
): { isCompliant: boolean; delta: number; status: 'APTO' | 'INAPTO' } {
  const delta = maxSpeedRecorded - speedLimitCeiling;
  const isCompliant = maxSpeedRecorded <= speedLimitCeiling;
  return {
    isCompliant,
    delta,
    status: isCompliant ? 'APTO' : 'INAPTO',
  };
}

/**
 * Calculates severity classification given registered speed and limit
 */
export function classifySeverity(
  recordedSpeed: number,
  limit: number
): {
  severity: 'BAIXA / LEVE' | 'MÉDIA / ALERTA' | 'ALTA / GRAVE';
  severityBand: 1 | 2 | 3 | 4;
  delta: number;
} {
  const delta = recordedSpeed - limit;
  if (delta <= 10) {
    return { severity: 'BAIXA / LEVE', severityBand: 1, delta };
  } else if (delta <= 20) {
    return { severity: 'MÉDIA / ALERTA', severityBand: 2, delta };
  } else if (delta <= 30) {
    return { severity: 'MÉDIA / ALERTA', severityBand: 3, delta };
  } else {
    return { severity: 'ALTA / GRAVE', severityBand: 4, delta };
  }
}

/**
 * Filter incidents according to cascading filters and text search
 */
export function filterIncidents(incidents: Incident[], options: FilterOptions): Incident[] {
  // Se houver competência específica, limites temporais consideram a competência selecionada
  let competenceBounds: { minTs: number; maxTs: number } | null = null;
  if (options.competence && options.competence !== 'all' && options.competence !== 'todas') {
    const compInfo = getCompetenceInfoFromKey(options.competence);
    if (compInfo) {
      competenceBounds = { minTs: compInfo.startTs, maxTs: compInfo.endTs };
    }
  }

  const needDateBounds =
    Boolean(options.period && options.period !== 'all' && options.period !== 'todos' && options.period !== '30d');
  const { minTs, maxTs } = needDateBounds
    ? (competenceBounds || getDatasetDateBounds(incidents))
    : { minTs: 0, maxTs: 0 };

  return incidents.filter((item) => {
    // 0. Competência / Mês (Ciclo: dia 26 do mês anterior ao dia 25 do mês corrente)
    if (options.competence && options.competence !== 'all' && options.competence !== 'todas') {
      if (!isDateInCompetence(item.date, options.competence)) {
        return false;
      }
    }

    // 1. Period (Todos os dias; Últimos 7 dias; Últimos 15 dias; Primeiros 15 dias)
    if (needDateBounds && !isDateInPeriod(item.date, options.period, minTs, maxTs)) {
      return false;
    }

    // 2. Specific Day (Dia específico)
    if (options.specificDay && options.specificDay !== 'all') {
      if (item.date !== options.specificDay) return false;
    }

    // Search Query
    if (options.searchQuery && options.searchQuery.trim().length > 0) {
      const q = options.searchQuery.toLowerCase().trim();
      const matches =
        item.plate.toLowerCase().includes(q) ||
        item.driver.toLowerCase().includes(q) ||
        item.highway.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.vehicleModel.toLowerCase().includes(q) ||
        item.vehicleCategory.toLowerCase().includes(q) ||
        item.recordedSpeed.toString().includes(q) ||
        item.deltaSpeed.toString().includes(q) ||
        item.locationDetails.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // 3. Vehicle Category (Categoria Veículo)
    if (options.vehicleCategory && options.vehicleCategory !== 'all') {
      const catUpper = item.vehicleCategory.toUpperCase();
      const filterCat = options.vehicleCategory.toUpperCase();
      if (options.vehicleCategory === 'cavalo') {
        if (!catUpper.includes('CAVALO')) return false;
      } else if (options.vehicleCategory === 'bitrem') {
        if (!catUpper.includes('BI-TREM') && !catUpper.includes('BITREM')) return false;
      } else if (options.vehicleCategory === 'leve') {
        if (!catUpper.includes('LEVE') && !catUpper.includes('UTILITÁRIO')) return false;
      } else if (filterCat === 'ÔNIBUS' || filterCat === 'ONIBUS') {
        if (!catUpper.includes('ÔNIBUS') && !catUpper.includes('ONIBUS')) return false;
      } else if (filterCat === 'CAÇAMBA' || filterCat === 'CACAMBA') {
        if (!catUpper.includes('CAÇAMBA') && !catUpper.includes('CACAMBA')) return false;
      } else {
        if (catUpper !== filterCat && !catUpper.includes(filterCat)) return false;
      }
    }

    // 4. Excess Type (Tipo de Excesso Veloc.)
    if (options.excessType && options.excessType !== 'all') {
      if (options.excessType === 'EXCESSO_VELOCIDADE') {
        if (item.excessType) {
          if (item.excessType !== 'EXCESSO_VELOCIDADE') return false;
        } else if (item.speedLimit < 80) {
          return false;
        }
      } else if (options.excessType === 'EXCESSO_VELOCIDADE_POR_VIA') {
        if (item.excessType) {
          if (item.excessType !== 'EXCESSO_VELOCIDADE_POR_VIA') return false;
        } else if (item.speedLimit >= 80) {
          return false;
        }
      } else if (options.excessType === 'gravissima') {
        if (item.deltaSpeed <= 30) return false;
      } else if (options.excessType === 'grave') {
        if (item.deltaSpeed <= 10 || item.deltaSpeed > 30) return false;
      } else if (options.excessType === 'leve') {
        if (item.deltaSpeed > 10) return false;
      }
    }

    // 5. Plate (Placa do Veículo)
    if (options.plate && options.plate !== 'all') {
      if (item.plate !== options.plate) return false;
    }

    // 6. Driver Identification (Identificação Condutor -> Condutor Identificado; Sem identificação)
    if (options.driverIdStatus && options.driverIdStatus !== 'all') {
      if (
        (options.driverIdStatus === 'com' || options.driverIdStatus === 'identificado') &&
        !item.hasDriver
      ) {
        return false;
      }
      if (
        (options.driverIdStatus === 'sem' || options.driverIdStatus === 'sem_identificacao') &&
        item.hasDriver
      ) {
        return false;
      }
      if (options.driverIdStatus === 'pendente' && item.conciliationStatus !== 'PENDENTE') {
        return false;
      }
    }

    // Highway
    if (options.highway && options.highway !== 'all') {
      if (!item.highway.toLowerCase().includes(options.highway.toLowerCase())) return false;
    }

    // Shift
    if (options.shift && options.shift !== 'all') {
      if (options.shift.toLowerCase() === 'diurno' && item.shift !== 'Diurno') return false;
      if (options.shift.toLowerCase() === 'noturno' && item.shift !== 'Noturno') return false;
    }

    // Severity
    if (options.severity && options.severity !== 'all') {
      if (options.severity === 'gravissima' && item.severityBand !== 4) return false;
      if (options.severity === 'grave' && item.severity !== 'ALTA / GRAVE') return false;
      if (options.severity === 'media' && item.severity !== 'MÉDIA / ALERTA') return false;
      if (options.severity === 'leve' && item.severity !== 'BAIXA / LEVE') return false;
    }

    return true;
  });
}

/**
 * Filter drivers by compliance eligibility status
 */
export function filterDrivers(
  drivers: DriverScore[],
  filterType: 'TODOS' | 'APTOS' | 'INAPTOS',
  searchQuery?: string
): DriverScore[] {
  return drivers.filter((driver) => {
    if (filterType === 'APTOS' && driver.status !== 'APTO') return false;
    if (filterType === 'INAPTOS' && driver.status !== 'INAPTO') return false;
    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const matches =
        driver.name.toLowerCase().includes(q) ||
        driver.plate.toLowerCase().includes(q) ||
        driver.ibutton.toLowerCase().includes(q) ||
        driver.vehicleType.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });
}

/**
 * Conciliation confidence calculator based on schedule match
 */
export function calculateConciliationConfidence(
  registeredHour: number,
  shiftStartHour: number,
  shiftEndHour: number,
  routeMatch: boolean
): number {
  let score = 50;
  // If registered time is inside the shift window
  if (registeredHour >= shiftStartHour && registeredHour <= shiftEndHour) {
    score += 35;
  } else {
    // within 1 hour buffer
    const diff = Math.min(Math.abs(registeredHour - shiftStartHour), Math.abs(registeredHour - shiftEndHour));
    if (diff <= 1) score += 20;
  }
  if (routeMatch) {
    score += 15;
  }
  return Math.min(score, 99);
}

/**
 * Converts array of objects to CSV formatted string
 */
export function convertToCSV<T extends Record<string, any>>(data: T[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((item) =>
    headers
      .map((header) => {
        const val = item[header];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      })
      .join(';')
  );
  return [headers.join(';'), ...rows].join('\r\n');
}

/**
 * Categorias canônicas de veículos pesados cobertos pelo Programa de Premiação
 * de Direção Segura Casagrande (Motorista x Caminhão - teto estrito de 80 km/h)
 * Conforme regulamento oficial: Seção 2 de docs/PREMIACAO_REGULATION.md
 */
export const HEAVY_VEHICLE_CATEGORIES = [
  'CAVALO',
  'CAÇAMBA',
  'CACAMBA',
  'PIPA',
  'COMBOIO',
  'MUNK',
  'MUNCK',
  'ONIBUS',
  'ÔNIBUS',
  'BITREM',
  'BI-TREM',
] as const;

/**
 * Retorna se a categoria informada é de veículo pesado no escopo da premiação.
 * Veículos leves/supervisão retornam false.
 */
export function isHeavyVehicleCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const upper = category.trim().toUpperCase();
  if (upper.includes('LEVE') || upper.includes('UTILITÁRIO') || upper.includes('UTILITARIO') || upper.includes('PASSEIO')) {
    return false;
  }
  return HEAVY_VEHICLE_CATEGORIES.some((c) => upper.includes(c));
}

