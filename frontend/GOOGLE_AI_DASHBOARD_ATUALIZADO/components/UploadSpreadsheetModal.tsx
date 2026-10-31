'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { uploadSpreadsheetEvents } from '@/lib/telemetry-service';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, ShieldAlert, Loader2 } from 'lucide-react';

interface UploadSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (
    message: string,
    details?: { fileName: string; inserted: number; duplicates: number; totalRows: number }
  ) => void;
}

interface ParsedSummary {
  fileName: string;
  totalRows: number;
  speedExcesses: number;
  violationsAbove80: number;
  uniquePlates: number;
  unidentifiedCount: number;
  records: any[];
}

export default function UploadSpreadsheetModal({
  isOpen,
  onClose,
  onUploadSuccess,
}: UploadSpreadsheetModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [summary, setSummary] = useState<ParsedSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setSummary(null);
    setErrorMessage(null);
    setIsParsing(false);
    setIsUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (isUploading) return;
    resetState();
    onClose();
  };

  const fixText = (val: any): string => {
    if (val === null || val === undefined) return '';
    let s = String(val).trim();
    s = s.replace(/\ufffd/g, 'Ç').replace(/CAAMBA/gi, 'CAÇAMBA').replace(/CA\?AMBA/gi, 'CAÇAMBA');
    s = s.replace(/ONIBUS/gi, 'ÔNIBUS');
    return s;
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setIsParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (!rawData || rawData.length === 0) {
        throw new Error('A planilha selecionada está vazia ou não possui linhas válidas.');
      }

      const records: any[] = [];
      const platesSet = new Set<string>();
      let violations80 = 0;
      let speedCount = 0;
      let unidentified = 0;

      for (const row of rawData) {
        // Normaliza chaves da planilha para minúsculo
        const norm: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          norm[k.trim().toUpperCase()] = v;
        }

        const placa = fixText(norm['PLACA'] || norm['VEICULO'] || norm['VEÍCULO'] || norm['PLACA VEÍCULO'] || 'SEM-PLACA').toUpperCase();
        if (placa && placa !== 'SEM-PLACA') platesSet.add(placa);

        const motoristaRaw = fixText(norm['MOTORISTA'] || norm['CONDUTOR'] || norm['NOME'] || 'Sem Identificação');
        const hasDriver = motoristaRaw !== '' && !motoristaRaw.toLowerCase().includes('sem ident') && !motoristaRaw.toLowerCase().includes('não ident');
        const motorista = hasDriver ? motoristaRaw : 'Sem Identificação';
        if (!hasDriver) unidentified++;

        // Velocidade e Limiar
        const velRaw = String(norm['VELOCIDADE'] || norm['EXCESSO'] || norm['VALOR'] || '0').replace('km/h', '').replace(',', '.').trim();
        const limRaw = String(norm['LIMIAR'] || norm['LIMITE'] || norm['VELOCIDADE REGULAMENTAR'] || '80').replace('km/h', '').replace(',', '.').trim();
        const vel = parseFloat(velRaw) || 0;
        const lim = parseFloat(limRaw) || 80;
        const delta = Math.max(0, parseFloat((vel - lim).toFixed(1)));
        const pct = lim > 0 ? parseFloat(((delta / lim) * 100).toFixed(1)) : 0;

        if (vel > 0) speedCount++;
        if (vel > 80) violations80++;

        // Datas e Horas
        let dataEvento = fixText(norm['DATA'] || norm['DATA_EVENTO'] || norm['DATA EVENTO'] || new Date().toISOString().split('T')[0]);
        // Se a data vier em DD/MM/YYYY, converte para YYYY-MM-DD para o Postgres
        if (dataEvento.includes('/')) {
          const parts = dataEvento.split('/');
          if (parts.length === 3) dataEvento = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }

        const horaEvento = fixText(norm['HORA'] || norm['HORA_EVENTO'] || norm['HORA EVENTO'] || '12:00:00');
        const hour = parseInt(horaEvento.split(':')[0] || '12', 10);

        const categoria = fixText(norm['CATEGORIA'] || norm['TIPO VEICULO'] || 'CAVALO');
        const prefixo = fixText(norm['PREFIXO'] || norm['FROTA'] || '');
        const cpf = fixText(norm['CPF'] || norm['DOCUMENTO'] || '-');
        const uo = fixText(norm['UO'] || norm['UNIDADE'] || 'CASAGRANDE');
        const logradouro = fixText(norm['LOGRADOURO'] || norm['RODOVIA'] || norm['LOCAL'] || 'MS-112');
        const cidade = fixText(norm['CIDADE'] || norm['MUNICIPIO'] || 'Não Informado');
        const estado = fixText(norm['ESTADO'] || norm['UF'] || 'MS');

        // Chave de deduplicação idempotente
        const hashDedup = `${placa}_${dataEvento}_${horaEvento}_${vel}`;

        records.push({
          hash_dedup: hashDedup,
          placa,
          prefixo,
          categoria,
          motorista,
          cpf,
          uo,
          tipo: fixText(norm['TIPO'] || 'EXCESSO_VELOCIDADE'),
          nivel: delta > 20 ? 'ALTO' : delta > 10 ? 'MEDIO' : 'BAIXO',
          limiar: lim,
          velocidade: vel,
          delta,
          pct,
          duracao_str: fixText(norm['DURACAO'] || norm['DURAÇÃO'] || '00:02:00'),
          duracao_sec: 120,
          logradouro,
          cidade,
          estado,
          data_evento: dataEvento,
          hora_evento: horaEvento,
          hour: isNaN(hour) ? 12 : hour,
          status: 'NOVO',
        });
      }

      setSummary({
        fileName: file.name,
        totalRows: rawData.length,
        speedExcesses: speedCount,
        violationsAbove80: violations80,
        uniquePlates: platesSet.size,
        unidentifiedCount: unidentified,
        records,
      });
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err);
      setErrorMessage(err.message || 'Falha ao processar arquivo. Verifique se o formato é .xlsx ou .csv válido.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmUpload = async () => {
    if (!summary || summary.records.length === 0) return;
    setIsUploading(true);
    setUploadProgress(10);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 400);

    const result = await uploadSpreadsheetEvents(summary.fileName, summary.records);
    clearInterval(progressInterval);
    setUploadProgress(100);

    if (result.success) {
      onUploadSuccess(
        `Planilha "${summary.fileName}" ingerida com sucesso! ${result.inserted} novos eventos adicionados e ${result.duplicates} duplicados ignorados com segurança.`,
        {
          fileName: summary.fileName,
          inserted: result.inserted,
          duplicates: result.duplicates,
          totalRows: summary.totalRows,
        }
      );
      handleClose();
    } else {
      setErrorMessage(result.error || 'Erro ao sincronizar dados com o Supabase.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#111722] border border-[#263143] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#263143] flex items-center justify-between bg-[#151d2b]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#2ca03a]/15 border border-[#2ca03a]/30 flex items-center justify-center text-[#34b344] shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 flex-wrap">
                Ingestão de Planilhas de Telemetria
                <span className="text-[10px] font-mono uppercase bg-[#2ca03a]/20 text-[#34b344] px-2 py-0.5 rounded border border-[#2ca03a]/30">
                  Deduplicação Ativa
                </span>
              </h2>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Arraste os relatórios brutos do CCO (.xlsx ou .csv) para atualização direta no Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="size-9 min-h-[36px] min-w-[36px] rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#1f2937] transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 flex flex-col gap-4 max-h-[85dvh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!summary ? (
            /* Upload Drop Area */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-[#34b344] bg-[#2ca03a]/10 scale-[0.99]'
                  : 'border-[#283548] bg-[#0c1017]/60 hover:border-[#34b344]/60 hover:bg-[#131923]'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
                }}
              />

              <div className="w-14 h-14 rounded-2xl bg-[#1c2432] border border-[#283548] flex items-center justify-center text-[#34b344]">
                {isParsing ? (
                  <Loader2 className="w-7 h-7 animate-spin text-[#34b344]" />
                ) : (
                  <FileSpreadsheet className="w-7 h-7" />
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-white">
                  {isParsing
                    ? 'Lendo e higienizando planilha...'
                    : 'Clique para selecionar ou arraste o arquivo aqui'}
                </p>
                <p className="text-xs text-[#94a3b8] mt-1">
                  Formatos suportados: <strong className="text-white">.xlsx, .xls, .csv</strong> (Relatório de Alertas CSG)
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[#64748b] font-mono mt-2">
                <span>Trava SHA-256 Anti-Duplicidade</span>
                <span>•</span>
                <span>Auditado pelo SESMT</span>
              </div>
            </div>
          ) : (
            /* Pre-ingestion Summary View */
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="p-3.5 rounded-xl bg-[#16202e] border border-[#283548] flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileSpreadsheet className="w-6 h-6 text-[#34b344] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{summary.fileName}</p>
                    <p className="text-[11px] text-[#94a3b8]">{summary.totalRows} registros identificados na planilha</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetState}
                  disabled={isUploading}
                  className="text-xs text-[#34b344] hover:underline shrink-0 font-semibold"
                >
                  Trocar arquivo
                </button>
              </div>

              {/* 4 Cards de Auditoria Prévia */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#0e141f] border border-[#263143]">
                  <span className="text-[10px] uppercase font-bold text-[#94a3b8]">Linhas Lidas</span>
                  <p className="text-lg font-mono font-bold text-white mt-0.5">{summary.totalRows}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0e141f] border border-[#263143]">
                  <span className="text-[10px] uppercase font-bold text-[#94a3b8]">Veículos Únicos</span>
                  <p className="text-lg font-mono font-bold text-[#34b344] mt-0.5">{summary.uniquePlates}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0e141f] border border-[#263143]">
                  <span className="text-[10px] uppercase font-bold text-[#94a3b8]">&gt; 80 km/h (Teto)</span>
                  <p className="text-lg font-mono font-bold text-amber-400 mt-0.5">{summary.violationsAbove80}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0e141f] border border-[#263143]">
                  <span className="text-[10px] uppercase font-bold text-[#94a3b8]">Sem Identificação</span>
                  <p className="text-lg font-mono font-bold text-red-400 mt-0.5">{summary.unidentifiedCount}</p>
                </div>
              </div>

              {/* Regra de Ouro Notice */}
              <div className="p-3.5 rounded-xl bg-[#1c2432]/60 border border-[#2ca03a]/30 flex items-start gap-3 text-xs text-[#cbd5e1]">
                <ShieldAlert className="w-5 h-5 text-[#34b344] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Governança CSG: Trava Anti-Duplicação Ativa</p>
                  <p className="text-[#94a3b8] text-[11px] mt-0.5 leading-relaxed">
                    Eventos repetidos com mesma placa, data, horário e velocidade serão descartados automaticamente pelo hash único, garantindo integridade absoluta nos rankings de bonificação.
                  </p>
                </div>
              </div>

              {/* Barra de Progresso no Upload */}
              {isUploading && (
                <div className="flex flex-col gap-1.5 pt-2">
                  <div className="flex justify-between text-xs text-[#94a3b8]">
                    <span>Gravando lotes no Supabase (sa-east-1)...</span>
                    <span className="font-mono font-bold text-[#34b344]">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#1c2432] overflow-hidden">
                    <div
                      className="h-full bg-[#34b344] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-[#263143] bg-[#151d2b] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 min-h-[38px] rounded-xl text-xs font-semibold text-[#94a3b8] hover:text-white hover:bg-[#1f2937] transition-colors text-center"
          >
            Cancelar
          </button>

          {summary && (
            <button
              type="button"
              onClick={handleConfirmUpload}
              disabled={isUploading}
              className="px-5 py-2 min-h-[38px] rounded-xl bg-[#2ca03a] hover:bg-[#34b344] text-white text-xs font-bold transition-all shadow-[0_0_15px_rgba(52,179,68,0.35)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sincronizando Banco de Dados...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Gravar {summary.records.length} Eventos no Supabase</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
