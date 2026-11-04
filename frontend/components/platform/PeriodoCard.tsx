"use client";
import React from "react";
import type { PeriodoLaboral } from "@/lib/platform/tipos";
import { Chip } from "@/components/shared/ui";

interface PeriodoCardProps {
  periodo: PeriodoLaboral;
  activa?: boolean;
  onSelect?: (periodo: PeriodoLaboral) => void;
  variante?: "strip" | "completa";
  onVerMatriz?: (id: string) => void;
  onAuditar?: (id: string) => void;
  onVerDashboard?: (id: string) => void;
}

export default function PeriodoCard({
  periodo,
  activa = false,
  onSelect,
  variante = "strip",
  onVerMatriz,
  onAuditar,
  onVerDashboard,
}: PeriodoCardProps) {
  const pct = Math.round(periodo.porcentaje_cumplimiento || 0);

  // Mapeo semántico de estados de períodos
  const estadoMap: Record<string, { label: string; chipState: string; badgeCls: string }> = {
    cerrado: { label: "Cerrado", chipState: "vigente", badgeCls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    en_auditoria: { label: "En auditoría", chipState: "proc", badgeCls: "bg-amber-50 text-amber-700 border-amber-200" },
    en_revision: { label: "En revisión", chipState: "proc", badgeCls: "bg-amber-50 text-amber-700 border-amber-200" },
    abierto: { label: "Abierto", chipState: "pending", badgeCls: "bg-blue-50 text-blue-700 border-blue-200" },
  };

  const info = estadoMap[periodo.estado] || {
    label: periodo.estado,
    chipState: "pendiente",
    badgeCls: "bg-slate-50 text-slate-700 border-slate-200",
  };

  const getBarColor = (val: number) => {
    if (val >= 90) return "bg-emerald-500";
    if (val >= 60) return "bg-blue-600";
    if (val >= 30) return "bg-amber-500";
    return "bg-rose-500";
  };

  // 1. Variante "strip": Tarjeta mensual optimizada para la barra horizontal de Pantalla 2 (.cl-per)
  if (variante === "strip") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect?.(periodo)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(periodo);
          }
        }}
        className={`cl-per relative flex flex-col justify-between text-left select-none transition-all duration-150 ${
          activa ? "on !border-blue-600 shadow-md ring-2 ring-blue-500/20 bg-blue-50/20" : "hover:border-slate-300"
        }`}
        style={{ minWidth: "195px" }}
      >
        <div>
          {/* Header del Período: Mes/Año y Chip */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              {periodo.nombre}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${info.badgeCls}`}>
              {info.label}
            </span>
          </div>

          {/* Barra de Progreso y Porcentaje */}
          <div className="mt-1 mb-2.5">
            <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
              <span className="text-slate-500">Cumplimiento</span>
              <span className={`${pct >= 90 ? "text-emerald-600" : pct >= 50 ? "text-blue-600" : "text-amber-600"}`}>
                {pct}%
              </span>
            </div>
            <div className="cl-mbar">
              <div
                className={`cl-mbar-fill ${getBarColor(pct)}`}
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Resumen rápido de entregas */}
        <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 text-[10px] font-semibold text-center">
          <div className="rounded bg-emerald-50 px-1 py-0.5 text-emerald-700" title="Aprobados">
            ✓ {periodo.total_aprobados ?? 0}
          </div>
          <div className="rounded bg-amber-50 px-1 py-0.5 text-amber-700" title="Observados">
            📝 {periodo.total_observados ?? 0}
          </div>
          <div className="rounded bg-rose-50 px-1 py-0.5 text-rose-700" title="Pendientes">
            ⏳ {periodo.total_pendientes ?? 0}
          </div>
        </div>

        {(periodo.por_revisar_count ?? 0) > 0 && (
          <div className="mt-1.5 flex items-center justify-center gap-1 rounded bg-amber-100/70 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
            <span>🔍 {periodo.por_revisar_count} por auditar</span>
          </div>
        )}
      </div>
    );
  }

  // 2. Variante "completa" (Grid / Detalle)
  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-500/30 hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-slate-400">
              {periodo.contrato_nombre || "Contrato"}
            </span>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">
              {periodo.nombre}
            </h3>
          </div>
          <Chip estado={info.chipState} texto={info.label} />
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1 font-medium">
            📅 {periodo.fecha_inicio} al {periodo.fecha_fin}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium capitalize text-slate-600">
            {periodo.tipo}
          </span>
        </div>

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

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {onSelect && (
          <button
            onClick={() => onSelect(periodo)}
            className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 shadow-sm"
          >
            Seleccionar Período
          </button>
        )}
        {onVerMatriz && (
          <button
            onClick={() => onVerMatriz(periodo.id)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            🟩 Matriz
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
