"use client";

import type { Kpis, Tendencia } from "@/lib/tipos";

type Props = {
  kpis: Kpis | null;
  tendencia?: Tendencia | null;
  loading: boolean;
};

function KpiCard({ icon, iconCls, label, value, sub, subCls }: {
  icon: string; iconCls: string; label: string; value: string; sub: string; subCls?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3.5 shadow-sm hover:border-slate-300 transition-colors">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0 ${iconCls}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
        <div className={`text-[11px] mt-0.5 ${subCls ?? "text-slate-400"}`}>{sub}</div>
      </div>
    </div>
  );
}

export default function DashboardKpis({ kpis, tendencia, loading }: Props) {
  const ph = loading ? "..." : null;
  const cumplimiento = kpis?.cumplimiento_general_pct ?? 0;
  const delta = tendencia?.delta_pct;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <KpiCard icon="📋" iconCls="bg-blue-50 text-blue-600" label="Contratos activos"
        value={ph ?? String(kpis?.contratos_activos ?? 0)}
        sub={ph ?? `de ${kpis?.contratos_activos ?? 0} contratos totales`} />
      <KpiCard icon="🏔️" iconCls="bg-emerald-50 text-emerald-600" label="Faenas activas"
        value={ph ?? String(kpis?.faenas_activas ?? 0)}
        sub={ph ?? `de ${kpis?.faenas_activas ?? 0} faenas totales`} />
      <KpiCard icon="👥" iconCls="bg-indigo-50 text-indigo-600" label="Personal acreditado"
        value={ph ?? String(kpis?.personal?.acreditados ?? 0)}
        sub={ph ?? `de ${kpis?.personal?.total ?? 0} trabajadores`} subCls="text-emerald-600 font-medium" />
      <KpiCard icon="🚛" iconCls="bg-amber-50 text-amber-600" label="Equipos acreditados"
        value={ph ?? String(kpis?.equipos?.acreditados ?? 0)}
        sub={ph ?? `de ${kpis?.equipos?.total ?? 0} equipos`} subCls="text-emerald-600 font-medium" />

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3.5 shadow-sm hover:border-slate-300 transition-colors">
        <div className="relative w-12 h-12 flex items-center justify-center shrink-0" role="img" aria-label={`Cumplimiento general ${cumplimiento}%`}>
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
            <path className="text-slate-100" strokeWidth="3.5" stroke="currentColor" fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path className="text-emerald-500 transition-all duration-700" strokeDasharray={`${cumplimiento}, 100`}
              strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <span className="absolute text-[11px] font-bold text-slate-800">{loading ? "..." : `${cumplimiento}%`}</span>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-slate-500 font-medium">Cumplimiento general</div>
          <div className="text-2xl font-bold text-slate-900 leading-tight">{loading ? "..." : `${cumplimiento}%`}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
            {loading ? "..." : delta !== undefined ? `${delta >= 0 ? "+" : ""}${delta}% vs semana anterior` : "Datos en vivo en BD"}
          </div>
        </div>
      </div>
    </div>
  );
}
