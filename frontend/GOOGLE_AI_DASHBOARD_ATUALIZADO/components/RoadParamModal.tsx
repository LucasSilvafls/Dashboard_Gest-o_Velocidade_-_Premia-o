'use client';

import React, { useState } from 'react';
import { RoadParameter } from '@/lib/telemetry-data';

interface RoadParamModalProps {
  param: RoadParameter | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (param: RoadParameter) => void;
}

export default function RoadParamModal({
  param,
  isOpen,
  onClose,
  onSave,
}: RoadParamModalProps) {
  const [road, setRoad] = useState(param ? param.road : '');
  const [section, setSection] = useState(param ? param.section : '');
  const [profile, setProfile] = useState(param ? param.profile : '');
  const [cavaloLimit, setCavaloLimit] = useState(param ? param.cavaloLimit : 80);
  const [bitremLimit, setBitremLimit] = useState(param ? param.bitremLimit : 80);
  const [leveLimit, setLeveLimit] = useState(param ? param.leveLimit : 90);
  const [trigger1, setTrigger1] = useState(param ? param.trigger1 : '>81 km/h');
  const [trigger2, setTrigger2] = useState(param ? param.trigger2 : '>95 km/h');

  const [prevParam, setPrevParam] = useState(param);
  if (param !== prevParam) {
    setPrevParam(param);
    setRoad(param ? param.road : '');
    setSection(param ? param.section : '');
    setProfile(param ? param.profile : '');
    setCavaloLimit(param ? param.cavaloLimit : 80);
    setBitremLimit(param ? param.bitremLimit : 80);
    setLeveLimit(param ? param.leveLimit : 90);
    setTrigger1(param ? param.trigger1 : '>81 km/h');
    setTrigger2(param ? param.trigger2 : '>95 km/h');
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!road.trim()) return;

    onSave({
      id: param ? param.id : `road-${Date.now()}`,
      road,
      section,
      profile,
      cavaloLimit: Number(cavaloLimit),
      bitremLimit: Number(bitremLimit),
      leveLimit: Number(leveLimit),
      trigger1,
      trigger2,
      status: 'ATIVO',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg bg-[#131923] border border-[#283548] rounded-xl shadow-2xl overflow-hidden flex flex-col text-[#f1f5f9]"
      >
        <div className="p-4 bg-[#0c1017] border-b border-[#283548] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#34b344] text-[20px]">
              signpost
            </span>
            <h3 className="font-bold text-white text-base">
              {param ? 'Editar Trecho Parametrizado' : 'Adicionar Novo Trecho'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="size-9 min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-[#1c2432] transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs max-h-[85dvh] overflow-y-auto">
          <div>
            <label className="text-[#94a3b8] font-tabular-data text-[10px] uppercase font-bold block mb-1">
              Rodovia / Identificação
            </label>
            <input
              type="text"
              required
              value={road}
              onChange={(e) => setRoad(e.target.value)}
              placeholder="Ex: MS-112, MS-377, BR-262"
              className="w-full bg-[#0c1017] border border-[#283548] rounded px-3 py-1.5 text-white font-tabular-data text-xs focus:outline-none focus:border-[#34b344]"
            />
          </div>

          <div>
            <label className="text-[#94a3b8] font-tabular-data text-[10px] uppercase font-bold block mb-1">
              Trecho / Cidades
            </label>
            <input
              type="text"
              required
              value={section}
              onChange={(e) => setSection(e.target.value)}
              placeholder="Ex: Três Lagoas / Cassilândia"
              className="w-full bg-[#0c1017] border border-[#283548] rounded px-3 py-1.5 text-white font-tabular-data text-xs focus:outline-none focus:border-[#34b344]"
            />
          </div>

          <div>
            <label className="text-[#94a3b8] font-tabular-data text-[10px] uppercase font-bold block mb-1">
              Perfil da Via
            </label>
            <input
              type="text"
              required
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="Ex: Pista Simples c/ Desnível"
              className="w-full bg-[#0c1017] border border-[#283548] rounded px-3 py-1.5 text-white font-tabular-data text-xs focus:outline-none focus:border-[#34b344]"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <label className="text-[#94a3b8] font-tabular-data text-[10px] uppercase font-bold block mb-1">
                Cavalo 6x4 (km/h)
              </label>
              <input
                type="number"
                required
                value={cavaloLimit}
                onChange={(e) => setCavaloLimit(Number(e.target.value))}
                className="w-full bg-[#0c1017] border border-[#283548] rounded px-2.5 py-1.5 text-white font-tabular-data text-xs font-bold text-center focus:outline-none focus:border-[#34b344]"
              />
            </div>
            <div>
              <label className="text-[#94a3b8] font-tabular-data text-[10px] uppercase font-bold block mb-1">
                Bi-trem (km/h)
              </label>
              <input
                type="number"
                required
                value={bitremLimit}
                onChange={(e) => setBitremLimit(Number(e.target.value))}
                className="w-full bg-[#0c1017] border border-[#283548] rounded px-2.5 py-1.5 text-white font-tabular-data text-xs font-bold text-center focus:outline-none focus:border-[#34b344]"
              />
            </div>
            <div>
              <label className="text-[#94a3b8] font-tabular-data text-[10px] uppercase font-bold block mb-1">
                Apoio Leve (km/h)
              </label>
              <input
                type="number"
                required
                value={leveLimit}
                onChange={(e) => setLeveLimit(Number(e.target.value))}
                className="w-full bg-[#0c1017] border border-[#283548] rounded px-2.5 py-1.5 text-white font-tabular-data text-xs font-bold text-center focus:outline-none focus:border-[#34b344]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[#94a3b8] font-tabular-data text-[10px] uppercase font-bold block mb-1">
                Gatilho Alerta 1
              </label>
              <input
                type="text"
                value={trigger1}
                onChange={(e) => setTrigger1(e.target.value)}
                className="w-full bg-[#0c1017] border border-[#283548] rounded px-2.5 py-1.5 text-amber-400 font-tabular-data text-xs text-center focus:outline-none focus:border-[#34b344]"
              />
            </div>
            <div>
              <label className="text-[#94a3b8] font-tabular-data text-[10px] uppercase font-bold block mb-1">
                Gatilho Alerta 2 (Grave)
              </label>
              <input
                type="text"
                value={trigger2}
                onChange={(e) => setTrigger2(e.target.value)}
                className="w-full bg-[#0c1017] border border-[#283548] rounded px-2.5 py-1.5 text-red-400 font-tabular-data text-xs text-center focus:outline-none focus:border-[#34b344]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#283548] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded bg-[#1c2432] text-[#94a3b8] hover:text-white border border-[#283548] font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-[#2ca03a] hover:bg-[#34b344] text-white font-bold transition-all shadow-md"
            >
              Salvar Parâmetros
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
