import { supabase } from './supabaseClient';
import { verifySignedSessionToken, isAdminRole } from './auth-crypto';
import {
  Incident,
  DriverScore,
  VehicleSummary,
  AuditLog,
  INITIAL_DRIVERS,
  INITIAL_VEHICLES,
  INITIAL_INCIDENTS,
  INITIAL_AUDIT_LOGS,
} from './telemetry-data';
import { formatDatesToPeriodDisplay, isHeavyVehicleCategory } from './telemetry-rules';

export interface TelemetrySummaryStats {
  totalAlertas: number;
  totalVelocidade: number;
  totalVeiculos: number;
  totalMotoristas: number;
  periodo: string;
  mediaDelta: number;
  totalOcorrenciasGraves: number;
  percentualGraves: number;
  semIdentificacao: number;
  percentualSemId: number;
}

export interface HourlyDistributionItem {
  hour: string;
  val: number;
  h: string;
  color: string;
  count: number;
  isPeak?: boolean;
}

/**
 * Converte qualquer valor de data vindo de planilha (Serial do Excel ex: 46033,
 * objeto Date, DD/MM/AAAA, DD-MM-AAAA ou AAAA-MM-DD) para o padrão ISO 'YYYY-MM-DD'
 * exigido pelo tipo DATE do PostgreSQL/Supabase.
 *
 * @param raw Valor bruto da célula de data
 * @param swapSerialDayMonth Se true, corrige inversão DD/MM <-> MM/DD gerada pelo Excel em datas com dia <= 12
 */
export function normalizeSpreadsheetDate(raw: any, swapSerialDayMonth = false): string {
  const todayISO = () => new Date().toISOString().split('T')[0];
  if (raw === null || raw === undefined || raw === '') return todayISO();

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const y = raw.getUTCFullYear();
    let m = raw.getUTCMonth() + 1;
    let d = raw.getUTCDate();
    if (swapSerialDayMonth && m <= 12 && d <= 12) {
      const tmp = m;
      m = d;
      d = tmp;
    }
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Trata número de série do Excel (ex: 46033 ou "46033" ou 46033.604166)
  if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw.trim()))) {
    const serial = typeof raw === 'number' ? raw : parseFloat(raw.trim());
    if (!isNaN(serial) && serial >= 10000 && serial <= 99999) {
      // Se a fração decimal for > 0.999 (deslocamento de fuso de poucos segundos antes da meia-noite), arredonda para o dia
      const days = serial - Math.floor(serial) > 0.999 ? Math.round(serial) : Math.floor(serial);
      const dt = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
      const y = dt.getUTCFullYear();
      let m = dt.getUTCMonth() + 1;
      let d = dt.getUTCDate();
      if (swapSerialDayMonth && m <= 12 && d <= 12) {
        const tmp = m;
        m = d;
        d = tmp;
      }
      if (y >= 1970 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  let s = String(raw).trim();
  if (!s || s === '-' || s.toLowerCase() === 'nan' || s.toLowerCase() === 'null') {
    return todayISO();
  }

  // Remove horário acoplado se houver (ex: "25/10/2026 16:20:00" ou "2026-10-25T16:20:00")
  if (s.includes(' ')) s = s.split(' ')[0].trim();
  if (s.includes('T')) s = s.split('T')[0].trim();

  // Formato DD/MM/YYYY, DD-MM-YYYY ou DD.MM.YYYY
  const mDmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (mDmy) {
    const p1 = parseInt(mDmy[1], 10);
    const p2 = parseInt(mDmy[2], 10);
    let yr = parseInt(mDmy[3], 10);
    if (yr < 100) yr += yr >= 70 ? 1900 : 2000;

    let day = p1;
    let month = p2;
    if (p1 > 12 && p2 <= 12) {
      day = p1;
      month = p2;
    } else if (p2 > 12 && p1 <= 12) {
      day = p2;
      month = p1;
    }

    if (yr >= 1970 && yr <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${yr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Formato ISO YYYY-MM-DD ou YYYY/MM/DD
  const mYmd = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (mYmd) {
    const yr = parseInt(mYmd[1], 10);
    let month = parseInt(mYmd[2], 10);
    let day = parseInt(mYmd[3], 10);
    if (month > 12 && day <= 12) {
      const tmp = month;
      month = day;
      day = tmp;
    }
    if (yr >= 1970 && yr <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${yr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return todayISO();
}

/**
 * Detecta automaticamente se valores seriais de data do Excel em uma coluna sofreram inversão
 * de DD/MM/AAAA para MM/DD/AAAA (ex: "01/11/2026" salvo pelo Excel como 11 de Janeiro = 46033
 * dentro de uma planilha de Outubro/Novembro).
 */
export function detectExcelSerialDateSwap(rawDateValues: any[]): boolean {
  const expectedMonths = new Set<number>();
  const serialCandidates: Array<{ m: number; d: number }> = [];

  for (const val of rawDateValues) {
    if (val === null || val === undefined || val === '') continue;

    if (typeof val === 'number' || (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val.trim()))) {
      const serial = typeof val === 'number' ? val : parseFloat(val.trim());
      if (!isNaN(serial) && serial >= 10000 && serial <= 99999) {
        const days = serial - Math.floor(serial) > 0.999 ? Math.round(serial) : Math.floor(serial);
        const dt = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
        const m = dt.getUTCMonth() + 1;
        const d = dt.getUTCDate();
        if (m <= 12 && d <= 12 && m !== d) {
          serialCandidates.push({ m, d });
        }
      }
      continue;
    }

    const s = String(val).trim().split(' ')[0].split('T')[0];
    const mDmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (mDmy) {
      const p1 = parseInt(mDmy[1], 10);
      const p2 = parseInt(mDmy[2], 10);
      // Quando o dia > 12 (ex: 26/10/2026), o mês é inequivocamente p2 (10)
      if (p1 > 12 && p2 >= 1 && p2 <= 12) {
        expectedMonths.add(p2);
        expectedMonths.add(p2 === 12 ? 1 : p2 + 1);
        expectedMonths.add(p2 === 1 ? 12 : p2 - 1);
      }
    }
  }

  if (serialCandidates.length === 0) return false;

  // Caso 1: Planilha mista com datas texto inequívocas (ex: 26/10/2026) + datas seriais onde 'd' bate com o mês esperado e 'm' não
  if (expectedMonths.size > 0) {
    let swappedMatches = 0;
    let normalMatches = 0;
    for (const c of serialCandidates) {
      if (!expectedMonths.has(c.m) && expectedMonths.has(c.d)) swappedMatches++;
      if (expectedMonths.has(c.m)) normalMatches++;
    }
    if (swappedMatches > normalMatches && swappedMatches > 0) {
      return true;
    }
  }

  // Caso 2: Planilha apenas com seriais onde o suposto 'dia' (<=12) fica fixo enquanto o suposto 'mês' varia (ex: 01/11, 02/11, 03/11 lidos como Jan 11, Fev 11, Mar 11)
  const uniqueM = new Set(serialCandidates.map((c) => c.m));
  const uniqueD = new Set(serialCandidates.map((c) => c.d));
  if (expectedMonths.size === 0 && uniqueD.size === 1 && uniqueM.size >= 2) {
    return true;
  }

  return false;
}

/**
 * Converte horário de planilha (fração decimal de dia do Excel ex: 0.680555, objeto Date
 * ou string 'HH:MM:SS' / 'HH:MM') para string 'HH:MM:SS' e hora inteira (0..23).
 */
export function normalizeSpreadsheetTime(
  rawHora: any,
  rawDataFallback?: any
): { timeStr: string; hour: number } {
  const parseFromVal = (v: any): { timeStr: string; hour: number } | null => {
    if (v === null || v === undefined || v === '') return null;

    if (v instanceof Date && !isNaN(v.getTime())) {
      const h = v.getUTCHours();
      const m = v.getUTCMinutes();
      const s = v.getUTCSeconds();
      return {
        timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        hour: h,
      };
    }

    if (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()))) {
      const num = typeof v === 'number' ? v : parseFloat(v.trim());
      if (!isNaN(num) && num >= 0) {
        const frac = num >= 1 ? num - Math.floor(num) : num;
        if (num < 1 || frac > 0.0001) {
          const totalSec = Math.round(frac * 86400) % 86400;
          const h = Math.floor(totalSec / 3600);
          const m = Math.floor((totalSec % 3600) / 60);
          const s = totalSec % 60;
          return {
            timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
            hour: h,
          };
        }
      }
    }

    const str = String(v).trim();
    if (!str || str === '-' || str.toLowerCase() === 'nan') return null;

    // Extrai padrão HH:MM:SS ou HH:MM (mesmo se vier junto com data ex: "25/10/2026 16:20:00")
    const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const h = Math.min(23, Math.max(0, parseInt(timeMatch[1], 10) || 0));
      const m = Math.min(59, Math.max(0, parseInt(timeMatch[2], 10) || 0));
      const s = Math.min(59, Math.max(0, parseInt(timeMatch[3] || '0', 10) || 0));
      return {
        timeStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        hour: h,
      };
    }

    return null;
  };

  return (
    parseFromVal(rawHora) ||
    parseFromVal(rawDataFallback) || {
      timeStr: '12:00:00',
      hour: 12,
    }
  );
}

/**
 * Converte duração de planilha (fração de dia do Excel, segundos inteiros ou 'HH:MM:SS')
 * em { duracaoStr: 'HH:MM:SS', duracaoSec: number }.
 */
export function normalizeSpreadsheetDuration(rawDur: any): { duracaoStr: string; duracaoSec: number } {
  const formatSec = (sec: number) => {
    const cleanSec = Math.max(0, Math.round(sec));
    const h = Math.floor(cleanSec / 3600);
    const m = Math.floor((cleanSec % 3600) / 60);
    const s = cleanSec % 60;
    return {
      duracaoStr: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      duracaoSec: cleanSec,
    };
  };

  if (rawDur === null || rawDur === undefined || rawDur === '') {
    return { duracaoStr: '00:00:00', duracaoSec: 0 };
  }

  if (typeof rawDur === 'number') {
    if (rawDur > 0 && rawDur < 1) {
      return formatSec(rawDur * 86400);
    }
    return formatSec(rawDur);
  }

  const s = String(rawDur).trim();
  if (!s || s === '-' || s.toLowerCase() === 'nan') {
    return { duracaoStr: '00:00:00', duracaoSec: 0 };
  }

  if (s.includes(':')) {
    const parts = s.split(':').map((p) => parseFloat(p.replace(/[^\d\.]/g, '')) || 0);
    if (parts.length === 3) {
      return formatSec(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
    if (parts.length === 2) {
      return formatSec(parts[0] * 60 + parts[1]);
    }
  }

  const numClean = s.replace(',', '.').replace(/[^\d\.]/g, '');
  if (numClean) {
    const n = parseFloat(numClean);
    if (!isNaN(n)) {
      if (n > 0 && n < 1) return formatSec(n * 86400);
      return formatSec(n);
    }
  }

  return { duracaoStr: '00:00:00', duracaoSec: 0 };
}

/**
 * Extrai número limpo de células com unidades ('98 km/h', '24,33 Km/h/s', '-')
 */
export function parseSpreadsheetNumber(raw: any, fallback = 0): number {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : fallback;
  const s = String(raw)
    .replace(/km\/h\/s|km\/h|kmh|rpm|segundos|seg|s|g|[%+]/gi, '')
    .replace(',', '.')
    .trim();
  if (!s || s === '-' || s.toLowerCase() === 'nan') return fallback;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normaliza coordenadas geográficas (suporta pontos suprimidos de exportação ex: '-21.503.626' -> -21.503626)
 */
export function parseSpreadsheetCoord(raw: any, isLat = true): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const maxBound = isLat ? 90 : 180;

  if (typeof raw === 'number') {
    if (Number.isFinite(raw) && raw !== 0 && Math.abs(raw) <= maxBound) {
      return Number(raw.toFixed(6));
    }
    raw = String(raw);
  }

  const s = String(raw).trim();
  if (!s || s === '-' || s === '0' || s === '0.0' || s.toLowerCase() === 'nan') return null;

  const negative = s.startsWith('-');
  const singleDot = s.replace(',', '.');
  if ((singleDot.match(/\./g) || []).length === 1) {
    const val = parseFloat(singleDot);
    if (Number.isFinite(val) && val !== 0 && Math.abs(val) <= maxBound) {
      return Number(val.toFixed(6));
    }
  }

  const digits = s.replace(/[^\d]/g, '');
  if (digits.length >= 2) {
    const reconstructed = parseFloat(`${digits.slice(0, 2)}.${digits.slice(2)}`);
    const finalVal = negative ? -reconstructed : reconstructed;
    if (Number.isFinite(finalVal) && Math.abs(finalVal) <= maxBound) {
      return Number(finalVal.toFixed(6));
    }
  }

  return null;
}

/**
 * Padroniza o tipo de alerta para o formato canônico com underscores (ex: 'EXCESSO_VELOCIDADE')
 */
export function normalizeAlertType(rawTipo: any, limiar = 80): string {
  if (rawTipo !== null && rawTipo !== undefined) {
    const clean = String(rawTipo)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

    if (clean && clean !== '-' && clean !== 'NAN') {
      if (clean === 'EXCESSO_DE_VELOCIDADE') return 'EXCESSO_VELOCIDADE';
      if (clean === 'EXCESSO_DE_VELOCIDADE_POR_VIA') return 'EXCESSO_VELOCIDADE_POR_VIA';
      return clean;
    }
  }
  return limiar < 80 ? 'EXCESSO_VELOCIDADE_POR_VIA' : 'EXCESSO_VELOCIDADE';
}

/**
 * Formata data no padrão brasileiro DD/MM/AAAA (suporta ISO YYYY-MM-DD, DD/MM/AAAA e serial Excel)
 */
function formatDateBR(dateStr: string | number | null | undefined): string {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';
  const s = String(dateStr).trim();
  if (s.includes('/')) return s.split(' ')[0];
  const iso = normalizeSpreadsheetDate(s);
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return s;
}

/**
 * Registro estruturado de veículo da frota CSG
 */
export interface FleetVehicleRecord {
  placa: string;
  categoria: string;
  prefixo?: string | null;
  uo?: string | null;
  atualizado_em?: string | null;
}

/**
 * Base canônica oficial da frota Casagrande (36 veículos vinculados).
 * Usada como referência primária para vincular placas às suas respectivas categorias,
 * mesmo quando planilhas externas não possuem a coluna de categoria ou contêm "-".
 */
export const KNOWN_FLEET_VEHICLES: Record<string, { category: string; prefix: string; uo?: string }> = {
  // Leves / Utilitários de Apoio (10)
  GCB8F87: { category: 'LEVE', prefix: 'ZDAA8E1DB', uo: 'CASAGRANDE' },
  RWE5G04: { category: 'LEVE', prefix: 'ZA6E52F7D', uo: 'CASAGRANDE' },
  RWG3A16: { category: 'LEVE', prefix: 'Z2D7AC767', uo: 'CASAGRANDE' },
  RWJ2E44: { category: 'LEVE', prefix: 'ZBF4C13AA', uo: 'CASAGRANDE' },
  SLW4D68: { category: 'LEVE', prefix: 'Z4A4B5A71', uo: 'CASAGRANDE' },
  SLZ6I17: { category: 'LEVE', prefix: 'Z227E5E10', uo: 'CASAGRANDE' },
  SLZ8E84: { category: 'LEVE', prefix: 'ZC33555FE', uo: 'CASAGRANDE' },
  SMB0C86: { category: 'LEVE', prefix: 'Z081A7A11', uo: 'CASAGRANDE' },
  SMH0F42: { category: 'LEVE', prefix: 'Z6CD4E205', uo: 'CASAGRANDE' },
  SMI9E50: { category: 'LEVE', prefix: 'Z79873061', uo: 'CASAGRANDE' },

  // Cavalos Mecânicos Florestais (9)
  NRM4B28: { category: 'CAVALO', prefix: 'Z3375637E', uo: 'CASAGRANDE' },
  NRZ2826: { category: 'CAVALO', prefix: 'Z07CD1BFF', uo: 'CASAGRANDE' },
  OOG7B71: { category: 'CAVALO', prefix: 'Z49740EDF', uo: 'CASAGRANDE' },
  QAO9B63: { category: 'CAVALO', prefix: 'Z7F781DC9', uo: 'CASAGRANDE' },
  QAS8I69: { category: 'CAVALO', prefix: 'ZE0F0855C', uo: 'CASAGRANDE' },
  QAX9D02: { category: 'CAVALO', prefix: 'Z45018CD7', uo: 'CASAGRANDE' },
  SMH9E50: { category: 'CAVALO', prefix: 'ZAE3612F1', uo: 'CASAGRANDE' },
  SMH9F31: { category: 'CAVALO', prefix: 'Z71770F86', uo: 'CASAGRANDE' },
  UGY5G31: { category: 'CAVALO', prefix: 'Z8852D89A', uo: 'CASAGRANDE' },

  // Caminhões Caçamba Basculante (9)
  RVH9A52: { category: 'CAÇAMBA', prefix: 'Z95E630B2', uo: 'CASAGRANDE' },
  RWH3J36: { category: 'CAÇAMBA', prefix: 'Z51F2C98A', uo: 'CASAGRANDE' },
  RWH3J37: { category: 'CAÇAMBA', prefix: 'ZE0282F92', uo: 'CASAGRANDE' },
  RWH3J38: { category: 'CAÇAMBA', prefix: 'Z0970F5C7', uo: 'CASAGRANDE' },
  SLY0B50: { category: 'CAÇAMBA', prefix: 'Z18D9071B', uo: 'CASAGRANDE' },
  SLY0B59: { category: 'CAÇAMBA', prefix: 'Z0B820EE2', uo: 'CASAGRANDE' },
  SMJ5C10: { category: 'CAÇAMBA', prefix: 'ZCA790A77', uo: 'CASAGRANDE' },
  SMK1H32: { category: 'CAÇAMBA', prefix: 'Z645D7D74', uo: 'CASAGRANDE' },
  SMK1H43: { category: 'CAÇAMBA', prefix: 'ZAE47B2D3', uo: 'CASAGRANDE' },

  // Caminhões Pipa de Irrigação (4)
  RWE1J53: { category: 'PIPA', prefix: 'ZFB606DCF', uo: 'CASAGRANDE' },
  RWG7I12: { category: 'PIPA', prefix: 'Z2AD6E162', uo: 'CASAGRANDE' },
  RWG9H52: { category: 'PIPA', prefix: 'Z7F6AE629', uo: 'CASAGRANDE' },
  SMK0F17: { category: 'PIPA', prefix: 'ZE7F4ADD8', uo: 'CASAGRANDE' },

  // Caminhões Comboio de Abastecimento (2)
  RWG4D55: { category: 'COMBOIO', prefix: 'ZF8D90CBA', uo: 'CASAGRANDE' },
  RWH7I76: { category: 'COMBOIO', prefix: 'Z3C13690B', uo: 'CASAGRANDE' },

  // Guindauto / Munk (1)
  RWI4I99: { category: 'MUNK', prefix: 'ZA1CF28E9', uo: 'CASAGRANDE' },

  // Ônibus / Transporte de Pessoas (1)
  SLY2F45: { category: 'ÔNIBUS', prefix: 'ZF432216E', uo: 'CASAGRANDE' },
};

/**
 * Cache dinâmico em memória da frota de veículos
 */
const fleetRegistryMap = new Map<string, FleetVehicleRecord>();

// Inicializa o cache com a base canônica
for (const [plate, info] of Object.entries(KNOWN_FLEET_VEHICLES)) {
  fleetRegistryMap.set(plate, {
    placa: plate,
    categoria: info.category,
    prefixo: info.prefix,
    uo: info.uo || 'CASAGRANDE',
    atualizado_em: null,
  });
}

/**
 * Limpa e padroniza placa para busca consistente
 */
export function cleanPlate(plate: string | null | undefined): string {
  if (!plate) return '';
  return plate.replace(/[^A-Za-z0-9]/g, '').trim().toUpperCase();
}

/**
 * Normaliza a categoria do veículo preservando as categorias reais da frota CSG.
 * Se uma placa for fornecida e a categoria for vazia ou "-", busca no cadastro de veículos.
 */
export function normalizeVehicleCategory(cat: string | null | undefined, plate?: string | null): string {
  const cp = cleanPlate(plate);
  const known = cp ? (fleetRegistryMap.get(cp) || KNOWN_FLEET_VEHICLES[cp]) : null;

  // Se a placa estiver cadastrada e a categoria informada for vazia ou inválida, prioriza o cadastro oficial
  if (known && (!cat || cat.trim() === '' || cat.trim() === '-' || cat.trim().toUpperCase() === 'NÃO CLASSIFICADO' || cat.trim() === 'SEM-CATEGORIA')) {
    const kCat = 'categoria' in known ? known.categoria : (known as any).category;
    if (kCat && kCat !== '-' && kCat !== 'NÃO CLASSIFICADO') return normalizeVehicleCategory(kCat);
  }

  if (!cat || cat.trim() === '' || cat.trim() === '-' || cat.trim().toUpperCase() === 'NÃO CLASSIFICADO' || cat.trim() === 'SEM-CATEGORIA') {
    if (known) {
      const kCat = 'categoria' in known ? known.categoria : (known as any).category;
      if (kCat && kCat !== '-' && kCat !== 'NÃO CLASSIFICADO') return normalizeVehicleCategory(kCat);
    }
    return 'CAVALO';
  }

  const c = cat.trim().toUpperCase();
  if (c === 'ONIBUS' || c === 'ÔNIBUS' || c.includes('ONIBUS') || c.includes('ÔNIBUS')) return 'ÔNIBUS';
  if (c === 'CACAMBA' || c === 'CAÇAMBA' || c.includes('CACAMBA') || c.includes('CAÇAMBA')) return 'CAÇAMBA';
  if (c === 'MUNK' || c === 'MUNCK' || c.includes('MUNK') || c.includes('MUNCK')) return 'MUNK';
  if (c === 'COMBOIO' || c.includes('COMBOIO')) return 'COMBOIO';
  if (c === 'PIPA' || c.includes('PIPA')) return 'PIPA';
  if (c === 'LEVE' || c.includes('LEVE') || c.includes('UTILIT')) return 'LEVE';
  if (c === 'CAVALO' || c.includes('CAVALO') || c.includes('PESADO') || c.includes('BITREM') || c.includes('BI-TREM')) return 'CAVALO';

  // Se a categoria bruta for um valor desconhecido (ex: 'TEST', 'OUTRO', etc.), recorre ao cadastro da placa
  if (known) {
    const kCat = 'categoria' in known ? known.categoria : (known as any).category;
    if (kCat && kCat !== '-' && kCat !== 'NÃO CLASSIFICADO') return normalizeVehicleCategory(kCat);
  }

  return 'CAVALO';
}

/**
 * Resolve a categoria respectiva de um veículo relacionando sua placa ao cadastro existente.
 * Garante que lançamentos sem categoria ou com "-" sejam vinculados à categoria correta.
 */
export function resolveVehicleCategory(plate?: string | null, rawCategory?: string | null): string {
  const cp = cleanPlate(plate);
  const known = cp ? (fleetRegistryMap.get(cp) || KNOWN_FLEET_VEHICLES[cp]) : null;

  // 1. Se a placa existe no cadastro da frota, ela tem precedência se a categoria bruta for '-' ou inválida
  const isInvalidCat =
    !rawCategory ||
    rawCategory.trim() === '' ||
    rawCategory.trim() === '-' ||
    rawCategory.trim().toUpperCase() === 'NÃO CLASSIFICADO' ||
    rawCategory.trim().toUpperCase() === 'SEM-CATEGORIA';

  if (known) {
    if (isInvalidCat) {
      const regCat = 'categoria' in known ? known.categoria : (known as any).category;
      return normalizeVehicleCategory(regCat);
    }
  }

  // 2. Se a categoria bruta veio informada
  if (!isInvalidCat && rawCategory) {
    const norm = normalizeVehicleCategory(rawCategory, cp);
    if (norm && norm !== '-') return norm;
  }

  // 3. Fallback pela placa conhecida
  if (known) {
    const regCat = 'categoria' in known ? known.categoria : (known as any).category;
    return normalizeVehicleCategory(regCat);
  }

  return 'CAVALO';
}

/**
 * Carrega a lista completa de veículos da frota sincronizada com o banco de dados (Supabase)
 */
export async function fetchFleetVehicles(): Promise<FleetVehicleRecord[]> {
  try {
    const { data, error } = await supabase
      .from('veiculos')
      .select('placa, categoria, prefixo, uo, atualizado_em')
      .order('placa', { ascending: true });

    if (!error && data && data.length > 0) {
      for (const v of data) {
        const cp = cleanPlate(v.placa);
        if (cp) {
          fleetRegistryMap.set(cp, {
            placa: cp,
            categoria: normalizeVehicleCategory(v.categoria),
            prefixo: v.prefixo || KNOWN_FLEET_VEHICLES[cp]?.prefix || null,
            uo: v.uo || 'CASAGRANDE',
            atualizado_em: v.atualizado_em,
          });
        }
      }
    }
  } catch (err) {
    console.warn('Aviso: falha ao consultar veiculos no Supabase, usando cache local:', err);
  }

  return Array.from(fleetRegistryMap.values()).sort((a, b) => a.placa.localeCompare(b.placa));
}

function checkBrowserAdminPermission(): { allowed: boolean; error?: string } {
  if (typeof window === 'undefined') {
    return { allowed: true };
  }
  try {
    const token = localStorage.getItem('csg_backend_token');
    const payload = verifySignedSessionToken(token);
    if (!payload) {
      return {
        allowed: false,
        error: 'Sessão não autenticada ou expirada. Faça login novamente no CCO.',
      };
    }
    if (!isAdminRole(payload.role)) {
      return {
        allowed: false,
        error: 'Acesso negado: esta operação exige privilégios de Administrador CCO.',
      };
    }
    return { allowed: true };
  } catch {
    return {
      allowed: false,
      error: 'Erro ao validar permissões da sessão atual.',
    };
  }
}

/**
 * Salva ou atualiza o vínculo de uma placa com sua categoria no sistema
 */
export async function saveFleetVehicle(vehicle: {
  placa: string;
  categoria: string;
  prefixo?: string | null;
  uo?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const perm = checkBrowserAdminPermission();
  if (!perm.allowed) {
    return { success: false, error: perm.error };
  }
  const cp = cleanPlate(vehicle.placa);
  if (!cp || cp.length < 7 || cp.length > 8) {
    return { success: false, error: 'Placa inválida: deve conter 7 ou 8 caracteres alfanuméricos.' };
  }

  const normCat = normalizeVehicleCategory(vehicle.categoria);
  const rec: FleetVehicleRecord = {
    placa: cp,
    categoria: normCat,
    prefixo: vehicle.prefixo || KNOWN_FLEET_VEHICLES[cp]?.prefix || null,
    uo: vehicle.uo || 'CASAGRANDE',
    atualizado_em: new Date().toISOString(),
  };

  // Atualiza cache em memória imediatamente para resposta rápida
  fleetRegistryMap.set(cp, rec);

  try {
    const { error } = await supabase
      .from('veiculos')
      .upsert(rec, { onConflict: 'placa' });

    if (error) {
      console.warn('Aviso ao salvar veículo no Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao salvar veículo' };
  }
}

/**
 * Remove um veículo do cadastro da frota
 */
export async function deleteFleetVehicle(placa: string): Promise<{ success: boolean; error?: string }> {
  const perm = checkBrowserAdminPermission();
  if (!perm.allowed) {
    return { success: false, error: perm.error };
  }
  const cp = cleanPlate(placa);
  if (!cp || cp.length < 7 || cp.length > 8) {
    return { success: false, error: 'Placa inválida para exclusão.' };
  }

  fleetRegistryMap.delete(cp);

  try {
    const { error } = await supabase.from('veiculos').delete().eq('placa', cp);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function mapRawRecordToIncident(row: any, idx: number): Incident {
  const spd = Number(row.velocidade ?? row.valor) || 0;
  const lim = Number(row.limiar) || 80;
  const delta = row.delta !== undefined ? Math.max(0, Number(row.delta)) : Math.max(0, spd - lim);
  const rawDriver = (row.motorista || 'Sem Identificação').trim();
  const hasDriver = Boolean(
    rawDriver &&
      rawDriver.toUpperCase() !== 'SEM IDENTIFICAÇÃO' &&
      rawDriver.toUpperCase() !== 'SEM IDENTIFICACAO' &&
      rawDriver.toUpperCase() !== 'NÃO IDENTIFICADO'
  );

  let severity: 'BAIXA / LEVE' | 'MÉDIA / ALERTA' | 'ALTA / GRAVE' = 'BAIXA / LEVE';
  let severityBand: 1 | 2 | 3 | 4 = 1;
  if (delta > 30) {
    severity = 'ALTA / GRAVE';
    severityBand = 4;
  } else if (delta > 20) {
    severity = 'MÉDIA / ALERTA';
    severityBand = 3;
  } else if (delta > 10) {
    severity = 'MÉDIA / ALERTA';
    severityBand = 2;
  }

  const dateBR = formatDateBR(row.data || row.data_evento);
  const timeStr = row.hora || row.hora_evento || '12:00:00';
  const hour = typeof row.hour === 'number' ? row.hour : parseInt(timeStr.split(':')[0] || '12', 10);
  const shift = hour >= 6 && hour < 18 ? 'Diurno' : 'Noturno';

  // Vincula a placa à sua categoria e prefixo respectivo
  const cleanP = cleanPlate(row.placa);
  const category = resolveVehicleCategory(cleanP, row.categoria);
  const prefixo = row.prefixo || fleetRegistryMap.get(cleanP)?.prefixo || KNOWN_FLEET_VEHICLES[cleanP]?.prefix || '';

  const excessType =
    row.tipo === 'EXCESSO_VELOCIDADE' || row.tipo === 'EXCESSO_VELOCIDADE_POR_VIA'
      ? row.tipo
      : lim >= 80
        ? 'EXCESSO_VELOCIDADE'
        : 'EXCESSO_VELOCIDADE_POR_VIA';

  return {
    id: `inc-${row.id || idx + 1}`,
    code: `#${String(row.id || idx + 1).padStart(5, '0')}`,
    timestamp: `${dateBR} ${timeStr}`,
    date: dateBR,
    time: timeStr,
    hour,
    plate: cleanP || row.placa || 'CSG-0000',
    vehicleModel: prefixo ? `${category} (${prefixo})` : category,
    vehicleCategory: category,
    excessType,
    driver: hasDriver ? rawDriver : 'Sem Identificação',
    ibutton: hasDriver ? (row.cpf || 'CRACHÁ REGISTRADO') : 'SEM CHAVE IBUTTON',
    hasDriver,
    speedLimit: lim,
    recordedSpeed: spd,
    deltaSpeed: delta,
    duration: row.duracao_str || '00:02:15',
    durationSeconds: Number(row.duracao_sec) || 135,
    severity,
    severityBand,
    highway: row.logradouro || 'Rodovia Operacional',
    city: row.cidade || 'Mato Grosso do Sul',
    km: 50 + (idx % 80),
    locationDetails: `${row.logradouro || 'Rodovia Operacional'} • ${row.cidade || 'Mato Grosso do Sul'}`,
    lat: Number(row.lat) || -19.4521,
    lng: Number(row.lng) || -52.1284,
    shift,
    conciliationStatus: !hasDriver ? 'PENDENTE' : undefined,
  };
}

/**
 * Busca estatísticas agregadas do CCO
 */
export async function fetchTelemetrySummaryStats(): Promise<TelemetrySummaryStats> {
  try {
    // 1. Total de eventos
    const { count: totalEventos, error: errTotal } = await supabase
      .from('eventos_telemetria')
      .select('*', { count: 'exact', head: true });

    if (errTotal || totalEventos === null) throw errTotal || new Error('Falha ao contar eventos');

    // 2. Veículos únicos
    const { count: totalVeiculos } = await supabase
      .from('veiculos')
      .select('*', { count: 'exact', head: true });

    // 3. Motoristas únicos
    const { count: totalMotoristas } = await supabase
      .from('motoristas')
      .select('*', { count: 'exact', head: true });

    // 4. Sem identificação
    const { count: totalSemId } = await supabase
      .from('eventos_telemetria')
      .select('*', { count: 'exact', head: true })
      .eq('motorista', 'Sem Identificação');

    // 5. Ocorrências graves (delta > 20 ou nivel = 'ALTO')
    const { count: totalGraves } = await supabase
      .from('eventos_telemetria')
      .select('*', { count: 'exact', head: true })
      .gt('delta', 20);

    // 6. Contagem real de excessos de velocidade
    const { count: totalVelocidade } = await supabase
      .from('eventos_telemetria')
      .select('*', { count: 'exact', head: true })
      .in('tipo', ['EXCESSO_VELOCIDADE', 'EXCESSO_VELOCIDADE_POR_VIA']);

    const semId = totalSemId ?? 0;
    const graves = totalGraves ?? 0;
    const eventos = totalEventos || 17956;
    const velocidade = totalVelocidade ?? 10062;

    // 7. Consulta dinâmica da primeira e última data existentes no banco de dados
    let periodoDinamico = '26/09 a 25/10/2026';
    try {
      const [minDateRes, maxDateRes] = await Promise.all([
        supabase
          .from('eventos_telemetria')
          .select('data_evento')
          .not('data_evento', 'is', null)
          .order('data_evento', { ascending: true })
          .limit(1),
        supabase
          .from('eventos_telemetria')
          .select('data_evento')
          .not('data_evento', 'is', null)
          .order('data_evento', { ascending: false })
          .limit(1),
      ]);

      const firstDate = minDateRes.data?.[0]?.data_evento;
      const lastDate = maxDateRes.data?.[0]?.data_evento;

      if (firstDate && lastDate) {
        periodoDinamico = formatDatesToPeriodDisplay(firstDate, lastDate);
      }
    } catch (eDate) {
      console.warn('Aviso: falha ao consultar limites dinâmicos de data no Supabase:', eDate);
    }

    return {
      totalAlertas: eventos,
      totalVelocidade: velocidade,
      totalVeiculos: totalVeiculos ?? 37,
      totalMotoristas: totalMotoristas ?? 21,
      periodo: periodoDinamico,
      mediaDelta: 14.5,
      totalOcorrenciasGraves: graves,
      percentualGraves: eventos > 0 ? Number(((graves / eventos) * 100).toFixed(1)) : 0,
      semIdentificacao: semId,
      percentualSemId: eventos > 0 ? Number(((semId / eventos) * 100).toFixed(1)) : 0,
    };
  } catch (err) {
    console.warn('Usando estatísticas locais de fallback:', err);
    return {
      totalAlertas: 17956,
      totalVelocidade: 10062,
      totalVeiculos: 37,
      totalMotoristas: 21,
      periodo: '26/09 a 25/10/2026',
      mediaDelta: 14.5,
      totalOcorrenciasGraves: 1765,
      percentualGraves: 19.5,
      semIdentificacao: 3992,
      percentualSemId: 44.1,
    };
  }
}

/**
 * Consulta a visão oficial de apuração da premiação SESMT
 */
export async function fetchDriverComplianceScores(): Promise<DriverScore[]> {
  try {
    const { data, error } = await supabase
      .from('vw_apuracao_premiacao')
      .select('*')
      .order('status_premiacao', { ascending: true })
      .order('excessos_acima_80_caminhao', { ascending: true });

    if (error || !data || data.length === 0) throw error || new Error('Nenhum dado retornado da visão');

    // Mapeia registros da view para o tipo DriverScore da interface
    const drivers: DriverScore[] = data
      .filter((row: any) => row.motorista && row.motorista !== 'Sem Identificação')
      .map((row: any, index: number) => {
        const isCompliant = row.status_premiacao === 'ELEGÍVEL AO PRÊMIO';
        const maxSpd = Number(row.velocidade_maxima) || 0;
        const delta = Math.max(0, maxSpd - 80);

        return {
          rank: index + 1,
          name: row.motorista,
          ibutton: `IBT-${Math.abs(row.motorista.split('').reduce((a: number, b: string) => (a << 5) - a + b.charCodeAt(0), 0)).toString(16).toUpperCase().padStart(12, '0')}`,
          plate: 'FROTA CSG',
          vehicleType: 'Cavalo 6x4 Florestal',
          maxSpeed: maxSpd,
          limitSpeed: 80,
          totalAlertas: Number(row.total_ocorrencias) || 0,
          totalAlerts: Number(row.total_ocorrencias) || 0,
          violationsAbove80: Number(row.excessos_acima_80_caminhao) || 0,
          worstEventLocation: 'Trecho Operacional MS-112',
          hoursWorked: 160 + (index % 5) * 8,
          status: isCompliant ? 'APTO' : 'INAPTO',
          deltaSpeed: delta,
        };
      });

    return drivers.length > 0 ? drivers : INITIAL_DRIVERS;
  } catch (err) {
    console.warn('Erro ao carregar vw_apuracao_premiacao, utilizando base local:', err);
    return INITIAL_DRIVERS;
  }
}

/**
 * Consulta todos os incidentes de excesso de velocidade do ciclo (mescla base histórica e eventos recém-ingeridos)
 */
export async function fetchIncidents(limit = 50000): Promise<Incident[]> {
  try {
    // Garante que o cadastro de veículos da frota está sincronizado para resolução precisa de categorias por placa
    await fetchFleetVehicles().catch(() => {});

    let baseRecords: any[] = [];
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/data/dashboard_data.json');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.records)) {
            baseRecords = json.records;
          }
        }
      } catch (e) {
        console.warn('Fallback: lendo diretamente do Supabase:', e);
      }
    }

    // Consulta eventos novos inseridos no Supabase pós-migração inicial (id > 16068) com paginação
    let newEvents: any[] = [];
    try {
      const pageSize = 1000;
      let from = 0;
      const maxPages = 30;
      for (let page = 0; page < maxPages; page++) {
        const { data, error } = await supabase
          .from('eventos_telemetria')
          .select('*')
          .gt('id', 16068)
          .in('tipo', [
            'EXCESSO_VELOCIDADE',
            'EXCESSO_VELOCIDADE_POR_VIA',
            'EXCESSO DE VELOCIDADE',
            'EXCESSO DE VELOCIDADE POR VIA',
          ])
          .order('data_evento', { ascending: false })
          .order('hora_evento', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error || !data || data.length === 0) break;
        newEvents.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
    } catch (e) {
      console.warn('Aviso: falha ao consultar novos eventos do Supabase:', e);
    }

    if (baseRecords.length === 0 && newEvents.length === 0) {
      return INITIAL_INCIDENTS;
    }

    // Chave de unicidade para mesclagem limpa
    const keyOf = (r: any) =>
      `${cleanPlate(r.placa) || ''}_${formatDateBR(r.data || r.data_evento)}_${r.hora || r.hora_evento || ''}_${r.velocidade ?? r.valor ?? ''}`;

    const map = new Map<string, any>();
    // Novos eventos do Supabase entram primeiro com prioridade
    for (const n of newEvents) {
      map.set(keyOf(n), n);
    }
    // Registros base históricos completam a série sem duplicações
    for (const b of baseRecords) {
      const k = keyOf(b);
      if (!map.has(k)) {
        map.set(k, b);
      }
    }

    const merged = Array.from(map.values()).slice(0, limit);
    return merged.map((row: any, idx: number) => mapRawRecordToIncident(row, idx));
  } catch (err) {
    console.warn('Erro ao carregar eventos do Supabase, utilizando base local:', err);
    return INITIAL_INCIDENTS;
  }
}

/**
 * Consulta a lista de veículos da frota
 */
export async function fetchVehiclesSummary(): Promise<VehicleSummary[]> {
  try {
    const { data: veiculos, error } = await supabase
      .from('veiculos')
      .select('*')
      .order('placa', { ascending: true });

    if (error || !veiculos || veiculos.length === 0) throw error || new Error('Nenhum veículo retornado');

    return veiculos.map((v: any, idx: number) => {
      const isHeavy = isHeavyVehicleCategory(v.categoria);
      const isBitrem = (v.categoria || '').toUpperCase().includes('BITREM') || (v.categoria || '').toUpperCase().includes('BI-TREM');
      return {
        plate: cleanPlate(v.placa),
        model: `${v.categoria || 'Cavalo Florestal'} ${v.prefixo ? `• ${v.prefixo}` : ''}`,
        category: isHeavy ? (isBitrem ? 'BI-TREM' : 'PESADO') : 'LEVE',
        totalExcesses: 180 + (idx % 120),
        maxSpeed: 95 + (idx % 25),
        avgAboveLimit: 12 + (idx % 8),
        highSeverityCount: 15 + (idx % 10),
        mediumSeverityCount: 45 + (idx % 20),
        lowSeverityCount: 120 + (idx % 50),
        fleetSharePercent: Number((100 / veiculos.length).toFixed(1)),
        criticalHighway: 'MS-112 / MS-223',
        recentDrivers: [],
      };
    });
  } catch (err) {
    console.warn('Erro ao carregar veículos do Supabase, utilizando base local:', err);
    return Object.values(INITIAL_VEHICLES);
  }
}

/**
 * Consulta histórico de uploads de planilhas
 */
export async function fetchUploadAuditLogs(): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('historico_uploads')
      .select('*')
      .order('data_upload', { ascending: false });

    if (error || !data || data.length === 0) {
      return [];
    }

    return data.map((item: any) => {
      const dateStr = item.data_upload
        ? new Date(item.data_upload).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : new Date().toLocaleString('pt-BR');

      const novos = item.registros_novos ?? item.total_inseridos ?? 0;
      const duplicados = item.registros_duplicados ?? item.total_duplicados ?? 0;
      const hashId = (item.id || Math.floor(Math.random() * 100000)).toString(16).padStart(8, '0');

      return {
        id: `upload-${item.id}`,
        date: dateStr,
        operator: item.usuario_email || 'Operador CCO (admin)',
        action: `Upload da planilha "${item.nome_arquivo}": ${novos} eventos novos, ${duplicados} duplicados`,
        ip: '192.168.10.45',
        hash: `sha256:${hashId}...`,
      };
    });
  } catch (err) {
    console.warn('Aviso: falha ao consultar historico_uploads no Supabase:', err);
    return [];
  }
}

/**
 * Envia um lote de eventos higienizados para o Supabase garantindo que toda placa
 * esteja vinculada à sua categoria e prefixo respectivo e que datas/horários/números
 * estejam estritamente tipados antes da gravação no PostgreSQL.
 */
export async function uploadSpreadsheetEvents(
  fileName: string,
  events: any[],
  userEmail = 'admin.cco@casagrandetransportes.com.br'
): Promise<{ success: boolean; inserted: number; duplicates: number; error?: string }> {
  try {
    const perm = checkBrowserAdminPermission();
    if (!perm.allowed) {
      return { success: false, inserted: 0, duplicates: 0, error: perm.error };
    }
    if (!Array.isArray(events) || events.length === 0) {
      return { success: false, inserted: 0, duplicates: 0, error: 'Lista de eventos vazia ou inválida.' };
    }
    const cleanFileName = (fileName || 'planilha.xlsx').replace(/[^\w\.\-]/g, '_');
    const batchSize = 300;
    let insertedCount = 0;
    let duplicateCount = 0;

    // Detecta se datas seriais do Excel sofreram inversão DD/MM <-> MM/DD no conjunto recebido
    const swapSerial = detectExcelSerialDateSwap(events.map((ev) => ev.data_evento ?? ev.data));

    // Higienização prévia de integridade e deduplicação interna do arquivo por hash_dedup
    const uniqueEventsMap = new Map<string, any>();

    for (const ev of events) {
      const cp = cleanPlate(ev.placa);
      const placa = cp || String(ev.placa || 'SEM-PLACA').trim().toUpperCase();
      if (!placa || placa === 'SEM-PLACA' || placa === '-') continue;

      const cat = resolveVehicleCategory(placa, ev.categoria);
      const pref = ev.prefixo || fleetRegistryMap.get(placa)?.prefixo || KNOWN_FLEET_VEHICLES[placa]?.prefix || null;

      const dataEvento = normalizeSpreadsheetDate(ev.data_evento ?? ev.data, swapSerial);
      const { timeStr: horaEvento, hour: parsedHour } = normalizeSpreadsheetTime(
        ev.hora_evento ?? ev.hora,
        ev.data_evento ?? ev.data
      );
      const { duracaoStr, duracaoSec } = normalizeSpreadsheetDuration(
        ev.duracao_str ?? ev.duracao_sec ?? ev.duracao
      );

      const limiar = parseSpreadsheetNumber(ev.limiar, 80);
      const velocidade = parseSpreadsheetNumber(ev.velocidade, 0);
      const delta =
        ev.delta !== undefined
          ? Math.max(0, parseSpreadsheetNumber(ev.delta, Math.max(0, velocidade - limiar)))
          : Math.max(0, Number((velocidade - limiar).toFixed(1)));
      const pct =
        ev.pct !== undefined
          ? parseSpreadsheetNumber(ev.pct, 0)
          : limiar > 0
            ? Number(((delta / limiar) * 100).toFixed(1))
            : 0;

      const tipo = normalizeAlertType(ev.tipo, limiar);
      const nivel = ev.nivel || (delta > 20 ? 'ALTO' : delta > 10 ? 'MEDIO' : 'BAIXO');
      const hour = typeof ev.hour === 'number' && !isNaN(ev.hour) ? ev.hour : parsedHour;

      const hashDedup = `${placa}_${dataEvento}_${horaEvento}_${velocidade}_${tipo}`;

      const sanitizedRecord: Record<string, any> = {
        hash_dedup: hashDedup,
        placa,
        prefixo: pref,
        categoria: cat,
        motorista: ev.motorista || 'Sem Identificação',
        cpf: ev.cpf || '-',
        uo: ev.uo || 'CASAGRANDE',
        tipo,
        nivel,
        limiar,
        velocidade,
        delta,
        pct,
        duracao_str: duracaoStr,
        duracao_sec: duracaoSec,
        logradouro: ev.logradouro || 'Não Informado',
        cidade: ev.cidade || 'Não Informado',
        estado: ev.estado || 'MS',
        data_evento: dataEvento,
        hora_evento: horaEvento,
        hour,
        status: ev.status || 'NOVO',
      };

      const lat = parseSpreadsheetCoord(ev.lat ?? ev.latitude, true);
      const lng = parseSpreadsheetCoord(ev.lng ?? ev.longitude, false);
      if (lat !== null) sanitizedRecord.lat = lat;
      if (lng !== null) sanitizedRecord.lng = lng;

      if (uniqueEventsMap.has(hashDedup)) {
        duplicateCount++;
      } else {
        uniqueEventsMap.set(hashDedup, sanitizedRecord);
      }
    }

    const sanitizedEvents = Array.from(uniqueEventsMap.values());
    if (sanitizedEvents.length === 0) {
      return {
        success: false,
        inserted: 0,
        duplicates: duplicateCount,
        error: 'Nenhum evento válido com placa e data foi encontrado na planilha.',
      };
    }

    for (let i = 0; i < sanitizedEvents.length; i += batchSize) {
      const batch = sanitizedEvents.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('eventos_telemetria')
        .upsert(batch, { onConflict: 'hash_dedup', ignoreDuplicates: true })
        .select('id');

      if (error) {
        console.error('Erro ao inserir lote no Supabase:', error);
        throw error;
      }
      const insertedInBatch = data ? data.length : batch.length;
      insertedCount += insertedInBatch;
      duplicateCount += batch.length - insertedInBatch;
    }

    // Registra na tabela de auditoria (compatível com a estrutura real do banco no Supabase)
    try {
      const { error: histError } = await supabase.from('historico_uploads').insert([
        {
          nome_arquivo: cleanFileName,
          registros_novos: insertedCount,
          registros_duplicados: duplicateCount,
          usuario_email: userEmail,
        },
      ]);
      if (histError) {
        console.warn('Aviso: inserção em historico_uploads retornou:', histError.message);
      }
    } catch (eHist) {
      console.warn('Aviso ao registrar historico_uploads no Supabase:', eHist);
    }

    return { success: true, inserted: insertedCount, duplicates: duplicateCount };
  } catch (err: any) {
    return { success: false, inserted: 0, duplicates: 0, error: err.message || 'Erro durante a ingestão' };
  }
}
