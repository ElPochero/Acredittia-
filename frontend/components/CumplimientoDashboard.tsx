"use client";
import React from "react";
import type { CumplimientoDashboardData } from "@/lib/tipos";
import { Donut } from "@/components/ui";

interface CumplimientoDashboardProps {
  data: CumplimientoDashboardData;
}

const ETAPAS = [
  { num: 1, nombre: "1. Período" },
  { num: 2, nombre: "2. Carga documental" },
  { num: 3, nombre: "3. Auditoría" },
  { num: 4, nombre: "4. Observaciones" },
  { num: 5, nombre: "5. Corrección" },
  { num: 6, nombre: "6. Cierre" },
];

export default function CumplimientoDashboard({ data }: CumplimientoDashboardProps) {
  const {
    total_requeridos = 0,
    aprobados = 0,
    observados = 0,
    pendientes = 0,
    cargados = 0,
    en_revision = 0,
    rechazados = 0,
    porcentaje_cumplimiento = 0,
    etapa_actual = 1,
    etapa_nombre = "Período",
    por_documento = [],
    alertas = [],
  } = data;

  const totalPendientesRevision = pendientes + cargados + en_revision;

  return (
    <div className="space-y-6">
      {/* =====================================================================
          BLOQUE B: Stepper de 6 Etapas (.cl-steps)
          plataforma.html L6876–L6885
          ===================================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <span>🔄</span> Flujo Operativo del Período Mensual
          </h3>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            Etapa {etapa_actual} de 6: {etapa_nombre}
          </span>
        </div>

        <div className="cl-steps flex items-center gap-1 overflow-x-auto py-2">
          {ETAPAS.map((et, index) => {
            const isDone = et.num < etapa_actual;
            const isCurrent = et.num === etapa_actual;
            return (
              <React.Fragment key={et.num}>
                <div
                  className={`cl-step flex items-center gap-2.5 px-2 py-1 select-none ${
                    isDone ? "done" : isCurrent ? "on" : ""
                  }`}
                >
                  <div
                    className={`cl-dot shrink-0 font-bold ${
                      isDone
                        ? "!bg-emerald-600 !text-white"
                        : isCurrent
                        ? "!bg-blue-600 !text-white !ring-4 !ring-blue-500/20 shadow-sm"
                        : "!bg-slate-100 !text-slate-400"
                    }`}
                  >
                    {isDone ? "✓" : et.num}
                  </div>
                  <span
                    className={`text-xs whitespace-nowrap ${
                      isCurrent
                        ? "font-bold text-blue-700"
                        : isDone
                        ? "font-semibold text-slate-700"
                        : "text-slate-400"
                    }`}
                  >
                    {et.nombre}
                  </span>
                </div>
                {index < ETAPAS.length - 1 && (
                  <div
                    className={`cl-bar mx-1 h-[3px] flex-1 min-w-[20px] rounded ${
                      et.num < etapa_actual ? "done !bg-emerald-600" : "!bg-slate-200"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          BLOQUE C: Dona SVG de % Cumplimiento + 4 Tarjetas Numéricas (.dkpis5)
          plataforma.html L6886–L6892
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Dona de Cumplimiento General */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center gap-6">
          <div className="shrink-0">
            <Donut pct={Math.round(porcentaje_cumplimiento)} size={125} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Cumplimiento del Contrato
            </span>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {Math.round(porcentaje_cumplimiento)}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {aprobados} de {total_requeridos} obligaciones requeridas certificadas en este período.
            </p>
          </div>
        </div>

        {/* 4 Tarjetas Numéricas (KPIs) */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Documentos aprobados */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm flex flex-col justify-between">
            <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <span>✅</span> Aprobados
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-700">{aprobados}</div>
            <div className="text-[11px] text-emerald-600/80 mt-1">Certificados OK</div>
          </div>

          {/* 2. Con observaciones */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm flex flex-col justify-between">
            <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
              <span>📝</span> Observados
            </div>
            <div className="mt-2 text-2xl font-black text-amber-700">{observados}</div>
            <div className="text-[11px] text-amber-600/80 mt-1">Requieren ajuste</div>
          </div>

          {/* 3. Pendientes / En revisión */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm flex flex-col justify-between">
            <div className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
              <span>⏳</span> Pendientes
            </div>
            <div className="mt-2 text-2xl font-black text-sky-700">{totalPendientesRevision}</div>
            <div className="text-[11px] text-sky-600/80 mt-1">
              {en_revision > 0 ? `${en_revision} en revisión` : "Por cargar / auditar"}
            </div>
          </div>

          {/* 4. Rechazados */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm flex flex-col justify-between">
            <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
              <span>⛔</span> Rechazados
            </div>
            <div className="mt-2 text-2xl font-black text-rose-700">{rechazados}</div>
            <div className="text-[11px] text-rose-600/80 mt-1">No conformes</div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          BLOQUES E y F: Estado por Documento + Alertas del Contrato
          plataforma.html L6893–L6899
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Bloque E: Estado por Documento */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>📊</span> Estado por Requisito Documental
            </h3>
            <span className="text-xs text-slate-400">
              {por_documento.length} requisitos exigidos
            </span>
          </div>

          {por_documento.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center italic">
              No se han registrado requisitos para este período.
            </p>
          ) : (
            <div className="space-y-4">
              {por_documento.map((item, idx) => {
                const pct = Math.round(item.porcentaje);
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{item.nombre}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 capitalize">
                          {item.ambito === "contrato" ? "Consolidado Contrato" : "Por Trabajador"}
                        </span>
                      </div>
                      <div className="font-mono text-xs font-semibold text-slate-600">
                        {item.aprobados} / {item.total}{" "}
                        <span
                          className={`font-bold ml-1 ${
                            pct >= 90
                              ? "text-emerald-600"
                              : pct >= 50
                              ? "text-blue-600"
                              : "text-amber-600"
                          }`}
                        >
                          ({pct}%)
                        </span>
                      </div>
                    </div>

                    <div className="cl-mbar h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`cl-mbar-fill h-full rounded-full transition-all duration-300 ${
                          pct >= 90
                            ? "bg-emerald-500"
                            : pct >= 50
                            ? "bg-blue-600"
                            : pct > 0
                            ? "bg-amber-500"
                            : "bg-slate-300"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bloque F: Alertas del Contrato */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>🔔</span> Alertas del Contrato
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {alertas.length} activas
              </span>
            </div>

            {alertas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 italic">
                No hay alertas activas. El período se encuentra al día.
              </div>
            ) : (
              <div className="space-y-3">
                {alertas.map((alerta, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-800"
                  >
                    <span className="text-sm shrink-0">
                      {alerta.includes("⚠️")
                        ? "⚠️"
                        : alerta.includes("🔒")
                        ? "🔒"
                        : alerta.includes("⏳")
                        ? "⏳"
                        : alerta.includes("🔍")
                        ? "🔍"
                        : "📄"}
                    </span>
                    <div className="flex-1 font-medium leading-relaxed">
                      {alerta.replace(/^[\u26a0\ufe0f\ud83d\udd12\u23f3\ud83d\udd0d\ud83d\udcc4\ud83d\udcdd\s]+/, "")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Sincronización en tiempo real</span>
            <span className="font-mono">Motor Acredittia</span>
          </div>
        </div>
      </div>
    </div>
  );
}
