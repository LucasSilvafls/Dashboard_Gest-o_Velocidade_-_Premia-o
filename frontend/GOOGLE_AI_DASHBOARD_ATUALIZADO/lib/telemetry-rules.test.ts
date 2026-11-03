import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCompliance,
  classifySeverity,
  filterIncidents,
  filterDrivers,
  calculateConciliationConfidence,
  convertToCSV,
  getCompetenceForDate,
  getCompetenceInfoFromKey,
  isDateInCompetence,
  getAvailableCompetences,
  formatDatesToPeriodDisplay,
  formatTimestampsToPeriodDisplay,
  isHeavyVehicleCategory,
  parseCurrencyBR,
  DEFAULT_BONUS_RULES,
} from './telemetry-rules';
import {
  resolveVehicleCategory,
  cleanPlate,
  normalizeVehicleCategory,
  normalizeSpreadsheetDate,
  detectExcelSerialDateSwap,
  normalizeSpreadsheetTime,
  normalizeSpreadsheetDuration,
  parseSpreadsheetNumber,
  parseSpreadsheetCoord,
  normalizeAlertType,
} from './telemetry-service';
import { INITIAL_DRIVERS, INITIAL_INCIDENTS } from './telemetry-data';

test('calculateCompliance correctly marks <= 80 km/h as APTO', () => {
  const result70 = calculateCompliance(70, 80);
  assert.equal(result70.isCompliant, true);
  assert.equal(result70.status, 'APTO');
  assert.equal(result70.delta, -10);

  const result80 = calculateCompliance(80, 80);
  assert.equal(result80.isCompliant, true);
  assert.equal(result80.status, 'APTO');
  assert.equal(result80.delta, 0);

  const result81 = calculateCompliance(81, 80);
  assert.equal(result81.isCompliant, false);
  assert.equal(result81.status, 'INAPTO');
  assert.equal(result81.delta, 1);

  const result164 = calculateCompliance(164, 80);
  assert.equal(result164.isCompliant, false);
  assert.equal(result164.status, 'INAPTO');
  assert.equal(result164.delta, 84);
});

test('classifySeverity categorizes excess correctly', () => {
  const light = classifySeverity(87, 80);
  assert.equal(light.severity, 'BAIXA / LEVE');
  assert.equal(light.severityBand, 1);
  assert.equal(light.delta, 7);

  const medium = classifySeverity(95, 80);
  assert.equal(medium.severity, 'MÉDIA / ALERTA');
  assert.equal(medium.severityBand, 2);

  const severe = classifySeverity(115, 80);
  assert.equal(severe.severity, 'ALTA / GRAVE');
  assert.equal(severe.severityBand, 4);
});

test('filterIncidents correctly filters by vehicle and search query', () => {
  const filteredPlate = filterIncidents(INITIAL_INCIDENTS, { plate: 'SMH0F42' });
  assert.equal(filteredPlate.length > 0, true);
  assert.equal(filteredPlate.every((inc) => inc.plate === 'SMH0F42'), true);

  const filteredSearch = filterIncidents(INITIAL_INCIDENTS, { searchQuery: '164' });
  assert.equal(filteredSearch.length, 1);
  assert.equal(filteredSearch[0].plate, 'SMH0F42');

  const filteredUnidentified = filterIncidents(INITIAL_INCIDENTS, { driverIdStatus: 'sem' });
  assert.equal(filteredUnidentified.every((inc) => !inc.hasDriver), true);
});

test('filterIncidents correctly handles the 6 standardized filters (period, specificDay, vehicleCategory, excessType, plate, driverIdStatus)', () => {
  // 1. Período/Dia (ultimos-7, ultimos-15, primeiros-15)
  const last7 = filterIncidents(INITIAL_INCIDENTS, { period: 'ultimos-7' });
  assert.equal(last7.length > 0, true);
  assert.equal(last7.length <= INITIAL_INCIDENTS.length, true);

  const first15 = filterIncidents(INITIAL_INCIDENTS, { period: 'primeiros-15' });
  assert.equal(first15.length > 0, true);

  // 2. Dia específico
  const day24 = filterIncidents(INITIAL_INCIDENTS, { specificDay: '24/10/2026' });
  assert.equal(day24.length > 0, true);
  assert.equal(day24.every((inc) => inc.date === '24/10/2026'), true);

  // 3. Categoria Veículo
  const catLeve = filterIncidents(INITIAL_INCIDENTS, { vehicleCategory: 'LEVE' });
  assert.equal(catLeve.length > 0, true);
  assert.equal(catLeve.every((inc) => inc.vehicleCategory.toUpperCase().includes('LEVE')), true);

  // 4. Tipo de Excesso Veloc.
  const typeVia = filterIncidents(INITIAL_INCIDENTS, { excessType: 'EXCESSO_VELOCIDADE_POR_VIA' });
  assert.equal(typeVia.length > 0, true);
  assert.equal(
    typeVia.every((inc) => inc.excessType === 'EXCESSO_VELOCIDADE_POR_VIA' || inc.speedLimit < 80),
    true
  );

  // 5. Placa do Veículo
  const plateFilter = filterIncidents(INITIAL_INCIDENTS, { plate: 'UGY5G31' });
  assert.equal(plateFilter.length > 0, true);
  assert.equal(plateFilter.every((inc) => inc.plate === 'UGY5G31'), true);

  // 6. Identificação Condutor (identificado / sem_identificacao)
  const identFilter = filterIncidents(INITIAL_INCIDENTS, { driverIdStatus: 'identificado' });
  assert.equal(identFilter.length > 0, true);
  assert.equal(identFilter.every((inc) => inc.hasDriver === true), true);

  const semIdentFilter = filterIncidents(INITIAL_INCIDENTS, { driverIdStatus: 'sem_identificacao' });
  assert.equal(semIdentFilter.length > 0, true);
  assert.equal(semIdentFilter.every((inc) => inc.hasDriver === false), true);
});

test('filterDrivers correctly filters by APTO/INAPTO status', () => {
  const aptos = filterDrivers(INITIAL_DRIVERS, 'APTOS');
  assert.equal(aptos.length, 4);
  assert.equal(aptos.every((d) => d.status === 'APTO'), true);

  const inaptos = filterDrivers(INITIAL_DRIVERS, 'INAPTOS');
  assert.equal(inaptos.length, 8);
  assert.equal(inaptos.every((d) => d.status === 'INAPTO'), true);
});

test('calculateConciliationConfidence scores within bounds', () => {
  const insideShift = calculateConciliationConfidence(10, 8, 16, true);
  assert.equal(insideShift, 99); // 50 + 35 + 15 = 100 capped at 99

  const outsideShift = calculateConciliationConfidence(2, 8, 16, false);
  assert.equal(outsideShift, 50);
});

test('convertToCSV generates valid semicolon delimited CSV', () => {
  const sample = [
    { placa: 'SMH0F42', velocidade: 164, status: 'GRAVE' },
    { placa: 'RWK7I76', velocidade: 70, status: 'CONFORME' },
  ];
  const csv = convertToCSV(sample);
  assert.ok(csv.includes('placa;velocidade;status'));
  assert.ok(csv.includes('SMH0F42;164;GRAVE'));
});

test('Competência / Mês: regra de negócio dia 26 do mês anterior ao dia 25 do mês corrente', () => {
  // Teste 1: 26/09/2026 deve pertencer à competência Outubro/2026 (2026-10)
  const c26Set = getCompetenceForDate('26/09/2026');
  assert.ok(c26Set !== null);
  assert.equal(c26Set.key, '2026-10');
  assert.equal(c26Set.label, 'Outubro/2026');
  assert.equal(c26Set.shortRangeLabel, '26/09 a 25/10');
  assert.equal(c26Set.startDateStr, '26/09/2026');
  assert.equal(c26Set.endDateStr, '25/10/2026');

  // Teste 2: 25/10/2026 deve pertencer à competência Outubro/2026
  const c25Out = getCompetenceForDate('25/10/2026');
  assert.ok(c25Out !== null);
  assert.equal(c25Out.key, '2026-10');
  assert.equal(c25Out.label, 'Outubro/2026');

  // Teste 3: 26/10/2026 vira para a competência Novembro/2026 (2026-11)
  const c26Out = getCompetenceForDate('26/10/2026');
  assert.ok(c26Out !== null);
  assert.equal(c26Out.key, '2026-11');
  assert.equal(c26Out.label, 'Novembro/2026');
  assert.equal(c26Out.shortRangeLabel, '26/10 a 25/11');

  // Teste 4: 25/09/2026 pertence à competência Setembro/2026 (2026-09)
  const c25Set = getCompetenceForDate('25/09/2026');
  assert.ok(c25Set !== null);
  assert.equal(c25Set.key, '2026-09');
  assert.equal(c25Set.label, 'Setembro/2026');
  assert.equal(c25Set.shortRangeLabel, '26/08 a 25/09');

  // Teste 5: Virada de ano - 26/12/2026 pertence à competência Janeiro/2027 (2027-01)
  const c26Dez = getCompetenceForDate('26/12/2026');
  assert.ok(c26Dez !== null);
  assert.equal(c26Dez.key, '2027-01');
  assert.equal(c26Dez.label, 'Janeiro/2027');
  assert.equal(c26Dez.startDateStr, '26/12/2026');
  assert.equal(c26Dez.endDateStr, '25/01/2027');

  // Teste 6: 15/01/2027 pertence à competência Janeiro/2027
  const c15Jan = getCompetenceForDate('15/01/2027');
  assert.ok(c15Jan !== null);
  assert.equal(c15Jan.key, '2027-01');
  assert.equal(c15Jan.label, 'Janeiro/2027');

  // Teste 7: getCompetenceInfoFromKey
  const keyInfo = getCompetenceInfoFromKey('2026-10');
  assert.ok(keyInfo !== null);
  assert.equal(keyInfo.label, 'Outubro/2026');
  assert.equal(keyInfo.startDateStr, '26/09/2026');
  assert.equal(keyInfo.endDateStr, '25/10/2026');

  // Teste 8: isDateInCompetence
  assert.equal(isDateInCompetence('26/09/2026', '2026-10'), true);
  assert.equal(isDateInCompetence('15/10/2026', '2026-10'), true);
  assert.equal(isDateInCompetence('25/10/2026', '2026-10'), true);
  assert.equal(isDateInCompetence('26/10/2026', '2026-10'), false);
  assert.equal(isDateInCompetence('25/09/2026', '2026-10'), false);
});

test('Competência / Mês: getAvailableCompetences e filtro em filterIncidents', () => {
  // getAvailableCompetences agrupa os incidentes
  const comps = getAvailableCompetences(INITIAL_INCIDENTS);
  assert.ok(comps.length > 0);
  assert.equal(comps[0].key, '2026-10');
  assert.equal(comps[0].label, 'Outubro/2026');
  assert.equal(comps[0].count, INITIAL_INCIDENTS.length);

  // filterIncidents com competence: '2026-10'
  const filteredComp = filterIncidents(INITIAL_INCIDENTS, { competence: '2026-10' });
  assert.equal(filteredComp.length, INITIAL_INCIDENTS.length);

  // filterIncidents com outra competência (ex: '2026-11') deve retornar 0 para esse dataset
  const filteredNov = filterIncidents(INITIAL_INCIDENTS, { competence: '2026-11' });
  assert.equal(filteredNov.length, 0);

  // filterIncidents com competence 'all' retorna todos
  const filteredAll = filterIncidents(INITIAL_INCIDENTS, { competence: 'all' });
  assert.equal(filteredAll.length, INITIAL_INCIDENTS.length);
});

test('formatDatesToPeriodDisplay: formatação dinâmica e responsiva do período', () => {
  // Teste 1: Datas do banco no formato ISO YYYY-MM-DD
  const isoRange = formatDatesToPeriodDisplay('2026-09-26', '2026-10-30');
  assert.equal(isoRange, '26/09 a 30/10/2026');

  // Teste 2: Datas no formato BR DD/MM/AAAA
  const brRange = formatDatesToPeriodDisplay('26/09/2026', '25/10/2026');
  assert.equal(brRange, '26/09 a 25/10/2026');

  // Teste 3: Anos diferentes
  const diffYears = formatDatesToPeriodDisplay('2026-12-26', '2027-01-25');
  assert.equal(diffYears, '26/12/2026 a 25/01/2027');

  // Teste 4: Ordem invertida deve normalizar em ordem crescente
  const inverted = formatDatesToPeriodDisplay('2026-10-30', '2026-09-26');
  assert.equal(inverted, '26/09 a 30/10/2026');

  // Teste 5: Mesma data
  const singleDate = formatDatesToPeriodDisplay('2026-10-30', '2026-10-30');
  assert.equal(singleDate, '30/10/2026');
});

test('isHeavyVehicleCategory: valida conformidade com o Regulamento Oficial da Premiação (Pesados vs Leves)', () => {
  // Categorias pesadas válidas no escopo da premiação de motoristas
  assert.equal(isHeavyVehicleCategory('CAVALO'), true);
  assert.equal(isHeavyVehicleCategory('CAVALO MECÂNICO'), true);
  assert.equal(isHeavyVehicleCategory('CAÇAMBA'), true);
  assert.equal(isHeavyVehicleCategory('CACAMBA'), true);
  assert.equal(isHeavyVehicleCategory('PIPA'), true);
  assert.equal(isHeavyVehicleCategory('COMBOIO'), true);
  assert.equal(isHeavyVehicleCategory('MUNK'), true);
  assert.equal(isHeavyVehicleCategory('MUNCK'), true);
  assert.equal(isHeavyVehicleCategory('ÔNIBUS'), true);
  assert.equal(isHeavyVehicleCategory('ONIBUS'), true);
  assert.equal(isHeavyVehicleCategory('BITREM'), true);
  assert.equal(isHeavyVehicleCategory('BI-TREM'), true);

  // Categorias leves/supervisão fora do escopo da premiação de caminhões
  assert.equal(isHeavyVehicleCategory('LEVE'), false);
  assert.equal(isHeavyVehicleCategory('UTILITÁRIO'), false);
  assert.equal(isHeavyVehicleCategory('UTILITARIO'), false);
  assert.equal(isHeavyVehicleCategory('PASSEIO'), false);
  assert.equal(isHeavyVehicleCategory(''), false);
  assert.equal(isHeavyVehicleCategory(null), false);
  assert.equal(isHeavyVehicleCategory(undefined), false);
});

test('Competence to Period Display: competência de outubro reflete datas 26/09 a 25/10/2026', () => {
  const octInfo = getCompetenceInfoFromKey('2026-10');
  assert.ok(octInfo);
  assert.equal(octInfo.label, 'Outubro/2026');
  assert.equal(octInfo.startDateStr, '26/09/2026');
  assert.equal(octInfo.endDateStr, '25/10/2026');

  const periodDisplay = formatDatesToPeriodDisplay(octInfo.startDateStr, octInfo.endDateStr);
  assert.equal(periodDisplay, '26/09 a 25/10/2026');

  // Competência de novembro reflete datas 26/10 a 25/11/2026
  const novInfo = getCompetenceInfoFromKey('2026-11');
  assert.ok(novInfo);
  assert.equal(novInfo.label, 'Novembro/2026');
  const novDisplay = formatDatesToPeriodDisplay(novInfo.startDateStr, novInfo.endDateStr);
  assert.equal(novDisplay, '26/10 a 25/11/2026');
});

test('Table column sorting: ordenação rápida maior/menor para números, strings e datas', () => {
  const sample = [
    { code: '#16086', speed: 85, driver: 'CLEBER' },
    { code: '#16087', speed: 71, driver: 'SENIVALDO' },
    { code: '#16094', speed: 88, driver: 'ANA' },
  ];

  // Ordenação por velocidade decrescente (maior para menor)
  const sortedDesc = [...sample].sort((a, b) => b.speed - a.speed);
  assert.equal(sortedDesc[0].speed, 88);
  assert.equal(sortedDesc[1].speed, 85);
  assert.equal(sortedDesc[2].speed, 71);

  // Ordenação por velocidade crescente (menor para maior)
  const sortedAsc = [...sample].sort((a, b) => a.speed - b.speed);
  assert.equal(sortedAsc[0].speed, 71);
  assert.equal(sortedAsc[1].speed, 85);
  assert.equal(sortedAsc[2].speed, 88);

  // Ordenação alfabética por condutor (A-Z)
  const sortedName = [...sample].sort((a, b) => a.driver.localeCompare(b.driver));
  assert.equal(sortedName[0].driver, 'ANA');
  assert.equal(sortedName[1].driver, 'CLEBER');
  assert.equal(sortedName[2].driver, 'SENIVALDO');
});

test('parseCurrencyBR e DEFAULT_BONUS_RULES: converte valores monetários em formato BR para float de cálculo', () => {
  assert.equal(DEFAULT_BONUS_RULES.minHours, 120);
  assert.equal(DEFAULT_BONUS_RULES.baseBonus, '1.200,00');

  // Valores padrão e formatados em reais
  assert.equal(parseCurrencyBR('1.200,00'), 1200);
  assert.equal(parseCurrencyBR('1.500,00'), 1500);
  assert.equal(parseCurrencyBR('2.350,50'), 2350.5);
  assert.equal(parseCurrencyBR('R$ 1.800,00'), 1800);
  assert.equal(parseCurrencyBR('850'), 850);
  assert.equal(parseCurrencyBR(1200), 1200);

  // Casos nulos ou inválidos recorrem ao default de 1200
  assert.equal(parseCurrencyBR(null), 1200);
  assert.equal(parseCurrencyBR(undefined), 1200);
  assert.equal(parseCurrencyBR(''), 1200);
  assert.equal(parseCurrencyBR('abc'), 1200);

  // Cálculo total com multiplicador de condutores aptos
  const aptosCount = 4;
  const customBonus = parseCurrencyBR('1.500,00');
  const totalPrevisto = aptosCount * customBonus;
  assert.equal(totalPrevisto, 6000);
});

test('Vínculo Placa x Categoria: resolveVehicleCategory e cleanPlate vinculam mesmo com categoria "-"', () => {
  // 1. Placa leve conhecida com categoria "-" deve retornar 'LEVE'
  assert.equal(resolveVehicleCategory('SLW4D68', '-'), 'LEVE');
  assert.equal(resolveVehicleCategory('slw-4d68', ''), 'LEVE');
  assert.equal(resolveVehicleCategory('GCB8F87', 'NÃO CLASSIFICADO'), 'LEVE');

  // 2. Placa cavalo conhecida com categoria "-" deve retornar 'CAVALO'
  assert.equal(resolveVehicleCategory('NRZ2826', '-'), 'CAVALO');
  assert.equal(resolveVehicleCategory('OOG7B71', ''), 'CAVALO');

  // 3. Placa ônibus com categoria "-" deve retornar 'ÔNIBUS'
  assert.equal(resolveVehicleCategory('SLY2F45', '-'), 'ÔNIBUS');

  // 4. Placa munk com categoria "-" deve retornar 'MUNK'
  assert.equal(resolveVehicleCategory('RWI4I99', '-'), 'MUNK');

  // 5. Placa caçamba com categoria "-" deve retornar 'CAÇAMBA'
  assert.equal(resolveVehicleCategory('RVH9A52', '-'), 'CAÇAMBA');

  // 6. Placa pipa com categoria "-" deve retornar 'PIPA'
  assert.equal(resolveVehicleCategory('RWE1J53', '-'), 'PIPA');

  // 7. Placa comboio com categoria "-" deve retornar 'COMBOIO'
  assert.equal(resolveVehicleCategory('RWG4D55', '-'), 'COMBOIO');

  // 8. cleanPlate higieniza corretamente
  assert.equal(cleanPlate(' slw-4d68 '), 'SLW4D68');
  assert.equal(cleanPlate('ABC-1234'), 'ABC1234');
  assert.equal(cleanPlate(''), '');

  // 9. normalizeVehicleCategory nunca retorna "-" ou termos espúrios
  assert.equal(normalizeVehicleCategory('-'), 'CAVALO');
  assert.equal(normalizeVehicleCategory(''), 'CAVALO');
  assert.equal(normalizeVehicleCategory(null), 'CAVALO');
  assert.equal(normalizeVehicleCategory('-', 'SLW4D68'), 'LEVE');
  assert.equal(normalizeVehicleCategory('TEST', 'TESTDEL'), 'CAVALO');
  assert.equal(resolveVehicleCategory('TESTDEL', 'TEST'), 'CAVALO');
  assert.equal(resolveVehicleCategory('SLY2F45', '-'), 'ÔNIBUS');
});

test('Leitura e higienização de planilhas: converte datas seriais do Excel ("46033"), horários e durações', () => {
  // 1. Conversão de serial do Excel 46033 (string e number) para ISO YYYY-MM-DD
  assert.equal(normalizeSpreadsheetDate('46033'), '2026-01-11');
  assert.equal(normalizeSpreadsheetDate(46033), '2026-01-11');
  assert.equal(normalizeSpreadsheetDate('46033', true), '2026-11-01');

  // 2. Conversão de datas BR e ISO com ou sem horário acoplado
  assert.equal(normalizeSpreadsheetDate('25/10/2026'), '2026-10-25');
  assert.equal(normalizeSpreadsheetDate('25/10/2026 16:20:00'), '2026-10-25');
  assert.equal(normalizeSpreadsheetDate('2026-10-25T16:20:00'), '2026-10-25');

  // 3. Detecção automática de inversão DD/MM <-> MM/DD em planilhas mistas do Excel
  const mixedNovSheet = ['26/10/2026', '27/10/2026', '31/10/2026', 46033, 46064];
  assert.equal(detectExcelSerialDateSwap(mixedNovSheet), true);
  assert.equal(normalizeSpreadsheetDate(46033, detectExcelSerialDateSwap(mixedNovSheet)), '2026-11-01');

  const genuineJanSheet = ['13/01/2026', '14/01/2026', 46033];
  assert.equal(detectExcelSerialDateSwap(genuineJanSheet), false);
  assert.equal(normalizeSpreadsheetDate(46033, detectExcelSerialDateSwap(genuineJanSheet)), '2026-01-11');

  // 4. Horários (fração de dia do Excel e strings)
  assert.deepEqual(normalizeSpreadsheetTime(0.5), { timeStr: '12:00:00', hour: 12 });
  assert.deepEqual(normalizeSpreadsheetTime('16:20:00'), { timeStr: '16:20:00', hour: 16 });
  assert.deepEqual(normalizeSpreadsheetTime('08:05'), { timeStr: '08:05:00', hour: 8 });

  // 5. Duração, números com unidades, coordenadas e tipo de alerta
  assert.deepEqual(normalizeSpreadsheetDuration('00:02:10'), { duracaoStr: '00:02:10', duracaoSec: 130 });
  assert.deepEqual(normalizeSpreadsheetDuration(120), { duracaoStr: '00:02:00', duracaoSec: 120 });
  assert.equal(parseSpreadsheetNumber('98 km/h'), 98);
  assert.equal(parseSpreadsheetNumber('24,33 Km/h/s'), 24.33);
  assert.equal(parseSpreadsheetCoord('-21.503.626', true), -21.503626);
  assert.equal(normalizeAlertType('EXCESSO DE VELOCIDADE', 80), 'EXCESSO_VELOCIDADE');
  assert.equal(normalizeAlertType('EXCESSO DE VELOCIDADE POR VIA', 60), 'EXCESSO_VELOCIDADE_POR_VIA');
});




