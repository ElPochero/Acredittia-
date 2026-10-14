"use client";
import React from "react";
import type { PeriodoLaboral } from "@/lib/tipos";
import { Chip } from "@/components/ui";

interface PeriodoCardProps {
  periodo: PeriodoLaboral;
  onVerMatriz?: (id: string) => void;
  onAuditar?: (id: string) => void;
  onVerDashboard?: (id: string) => void;
}

export default function PeriodoCard({
  periodo,
  onVerMatriz,
  onAuditar,
  onVerDashboard,
}: PeriodoCardProps) {
  const pct = periodo.porcentaje_cumplimiento || 0;

  // Estado chip style mapping
  const estadoMap: Record<string, { label: string; chipState: string }> = {
    abierto: { label: "Abierto", chipState: "proc" },
    en_revision: { label: "En Revisión", chipState: "pending" },
    cerrado: { label: "Cerrado", chipState: "vigente" },
  };

  const infoEstado = estadoMap[periodo.estado] ?? {
    label: periodo.estado,
    chipState: "pendiente",
  };

  const getBarColor = (val: number) => {
    if (val >= 90) return "bg-emerald-500";
    if (val >= 70) return "bg-sky-500";
    if (val >= 50) return "bg-amber-500";
    return "bg-rose-500";
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-500/30 hover:shadow-md">
      <div>
        {/* Header: Title & Status Chip */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-slate-400">
              {periodo.contrato_nombre || "Contrato Minero"}
            </span>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">
              {periodo.nombre}
            </h3>
          </div>
          <Chip estado={infoEstado.chipState} texto={infoEstado.label} />
        </div>

        {/* Date & Type */}
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1 font-medium">
            📅 {periodo.fecha_inicio} al {periodo.fecha_fin}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium capitalize text-slate-600">
            {periodo.tipo}
          </span>
        </div>

        {/* Compliance Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-600">Cumplimiento Documental</span>
            <span className="font-bold text-slate-900">{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getBarColor(pct)}`}
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        </div>

        {/* Breakdown Stats Badges */}
        <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-slate-50 p-2.5 text-center text-xs">
          <div>
            <div className="font-bold text-slate-800">{periodo.total_requeridos ?? 0}</div>
            <div className="text-[10px] text-slate-500">Exigidos</div>
          </div>
          <div>
            <div className="font-bold text-emerald-600">{periodo.total_aprobados ?? 0}</div>
            <div className="text-[10px] text-slate-500">Aprobados</div>
          </div>
          <div>
            <div className="font-bold text-amber-600">{periodo.total_observados ?? 0}</div>
            <div className="text-[10px] text-slate-500">Observados</div>
          </div>
          <div>
            <div className="font-bold text-rose-600">{periodo.total_pendientes ?? 0}</div>
            <div className="text-[10px] text-slate-500">Pendientes</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => onVerMatriz?.(periodo.id)}
          className="flex-1 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700 shadow-sm"
        >
          🟩 Ver Matriz Documental
        </button>
        {onAuditar && (
          <button
            onClick={() => onAuditar(periodo.id)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            📋 Auditar
          </button>
        )}
        {onVerDashboard && (
          <button
            onClick={() => onVerDashboard(periodo.id)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            📊 Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
