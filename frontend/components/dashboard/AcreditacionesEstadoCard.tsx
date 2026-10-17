"use client";

import type { AcreditacionesEstado } from "@/lib/tipos";

type Props = { data: AcreditacionesEstado | null; loading: boolean };

function fila(color: string, label: string, n: number, pct: number) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} aria-hidden="true" />
        <span className="font-semibold text-slate-700">{label}</span>
      </div>
      <div className="font-bold text-slate-800">
        {n} <span className="text-slate-400 text-[11px] font-normal">({pct}%)</span>
      </div>
    </div>
  );
}

export default function AcreditacionesEstadoCard({ data, loading }: Props) {
  const total = data?.total || 1;
  const acred = data?.acreditados || 0;
  const pend = data?.pendientes || 0;
  const venc = data?.vencidos || 0;
  const pA = Math.round((acred / total) * 100);
  const pP = Math.round((pend / total) * 100);
  const pV = Math.round((venc / total) * 100);

  return (
    <section aria-label="Acreditaciones por estado" className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-sm text-slate-800 mb-4">Acreditaciones por estado</h3>
        <div className="flex items-center justify-center my-4">
          <div className="relative w-36 h-36 flex items-center justify-center" role="img"
            aria-label={`Acreditados ${pA}%, pendientes ${pP}%, vencidos ${pV}%`}>
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <path className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-red-500 transition-all duration-700" strokeDasharray={`${pV}, 100`} strokeDashoffset="0"
                strokeWidth="4.5" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-amber-400 transition-all duration-700" strokeDasharray={`${pP}, 100`} strokeDashoffset={`-${pV}`}
                strokeWidth="4.5" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-emerald-500 transition-all duration-700" strokeDasharray={`${pA}, 100`} strokeDashoffset={`-${pV + pP}`}
                strokeWidth="4.5" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute text-center">
              <div className="text-xl font-bold text-slate-900 leading-none">{loading ? "..." : total}</div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">Total</div>
            </div>
          </div>
        </div>
        <div className="space-y-2 mt-4 text-xs">
          {fila("bg-emerald-500", "Acreditados", acred, pA)}
          {fila("bg-amber-400", "Pendiente", pend, pP)}
          {fila("bg-red-500", "Vencido", venc, pV)}
        </div>
      </div>
    </section>
  );
}
