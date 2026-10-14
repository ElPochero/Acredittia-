"use client";
import React from "react";
import type { CumplimientoDashboardData } from "@/lib/tipos";
import { Kpi, Donut } from "@/components/ui";

interface CumplimientoDashboardProps {
  data: CumplimientoDashboardData;
}

export default function CumplimientoDashboard({ data }: CumplimientoDashboardProps) {
  const {
    total_requeridos,
    aprobados,
    observados,
    pendientes,
    rechazados,
    porcentaje_cumplimiento,
    por_tipo,
    alertas,
  } = data;

  return (
    <div className="space-y-6">
      {/* Top Header Card with Donut & KPIs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-6">
            <Donut pct={porcentaje_cumplimiento} size={120} />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-700">
                Dashboard de Cumplimiento
              </span>
              <h2 className="text-2xl font-bold text-slate-900">
                {porcentaje_cumplimiento}% Acreditado
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Progreso acumulado de la matriz de certificación laboral del período.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-center min-w-[100px]">
              <div className="text-xs font-semibold text-emerald-700">Aprobados</div>
              <div className="text-xl font-bold text-emerald-800">{aprobados}</div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-center min-w-[100px]">
              <div className="text-xs font-semibold text-amber-700">Observados</div>
              <div className="text-xl font-bold text-amber-800">{observados}</div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-center min-w-[100px]">
              <div className="text-xs font-semibold text-slate-600">Pendientes</div>
              <div className="text-xl font-bold text-slate-700">{pendientes}</div>
            </div>
          </div>
        </div>

        {/* Quick KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          <Kpi titulo="Total Exigidos" valor={total_requeridos} sub="documentos de período" />
          <Kpi titulo="Tasa Aprobación" valor={`${Math.round((aprobados / (total_requeridos || 1)) * 100)}%`} color="text-emerald-600" />
          <Kpi titulo="Revisión Pendiente" valor={data.cargados + data.en_revision} color="text-sky-600" />
          <Kpi titulo="Rechazados" valor={rechazados} color="text-rose-600" />
        </div>
      </div>

      {/* Breakdown by Document Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Document Type Progress */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
            <span>📊</span> Cumplimiento por Tipo de Documento
          </h3>

          <div className="space-y-4">
            {por_tipo.map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between text-xs font-medium mb-1">
                  <span className="text-slate-800 font-semibold">{item.tipo}</span>
                  <span className="text-slate-500">
                    {item.aprobados} / {item.total} ({item.porcentaje}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.porcentaje >= 90
                        ? "bg-emerald-500"
                        : item.porcentaje >= 70
                        ? "bg-cyan-500"
                        : "bg-amber-500"
                    }`}
                    style={{ width: `${item.porcentaje}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts Feed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
            <span>🔔</span> Alertas y Observaciones Críticas
          </h3>

          {alertas.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">
              No existen alertas pendientes para este período.
            </p>
          ) : (
            <div className="space-y-3">
              {alertas.map((alerta, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 text-xs text-amber-900"
                >
                  <span className="text-amber-600 text-sm">⚠️</span>
                  <div className="flex-1 font-medium">{alerta}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
