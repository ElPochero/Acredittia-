"use client";

import React from "react";
import Link from "next/link";
import type { Contrato } from "@/lib/tipos";

interface ContratosTableProps {
  contratos: Contrato[];
  loading: boolean;
  total: number;
  onDelete: (id: string, nombre: string) => void;
  viewMode?: "table" | "grid";
}

/** Estado de vigencia del contrato, derivado de sus fechas (checklist C1 → `ctVig`). */
export type EstadoVig = "Vigente" | "Por iniciar" | "Por vencer" | "Vencido";

export function estadoVigencia(c: Contrato, hoy: Date = new Date()): EstadoVig {
  const ini = c.fecha_inicio ? new Date(c.fecha_inicio + "T00:00:00") : null;
  const fin = c.fecha_termino ? new Date(c.fecha_termino + "T00:00:00") : null;
  if (ini && ini > hoy) return "Por iniciar";
  if (fin) {
    const dias = Math.ceil((fin.getTime() - hoy.getTime()) / 86_400_000);
    if (dias < 0) return "Vencido";
    if (dias <= 90) return "Por vencer";
  }
  return "Vigente";
}

const CHIP_VIG: Record<EstadoVig, string> = {
  Vigente: "bg-emerald-100 text-emerald-700",
  "Por iniciar": "bg-blue-100 text-blue-700",
  "Por vencer": "bg-amber-100 text-amber-700",
  Vencido: "bg-red-100 text-red-700",
};

function ChipVig({ estado }: { estado: EstadoVig }) {
  return (
    <span className={`inline-flex items-center h-5 px-2 rounded-full text-[0.62rem] font-bold uppercase tracking-wider ${CHIP_VIG[estado]}`}>
      {estado}
    </span>
  );
}

function BarraCumplimiento({ pct }: { pct: number }) {
  const color = pct >= 70 ? "#10B981" : pct >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-[6px] w-[60px] bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[0.78rem] font-semibold" style={{ color }}>{pct}%</span>
    </div>
  );
}

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-CL").replace(/\//g, "-");
}

export function ContratosTable({ contratos, loading, total, onDelete, viewMode = "table" }: ContratosTableProps) {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-400 text-[0.85rem]">Cargando contratos...</div>
        ) : contratos.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 text-[0.85rem]">
            No se encontraron contratos con los filtros actuales.
          </div>
        ) : (
          contratos.map((c) => {
            const pct = c.stats?.cumplimiento_pct || 0;
            const bar = pct >= 70 ? "#10B981" : pct >= 40 ? "#F59E0B" : "#EF4444";
            const vig = estadoVigencia(c);
            const perOk = c.stats?.personal?.acreditados || 0;
            const perTot = c.stats?.personal?.total || 0;
            const eqOk = c.stats?.equipos?.acreditados || 0;
            const eqTot = c.stats?.equipos?.total || 0;
            const alCt = c.stats?.alertas_activas || 0;

            return (
              <div key={c.id} className="bg-white border border-slate-200 rounded-[16px] p-5 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col h-full">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <ChipVig estado={vig} />
                    <Link href={`/contratos/${c.id}`} className="block font-bold text-[#1e293b] hover:text-blue-600 hover:underline text-[1.1rem] leading-tight mt-2 mb-1">
                      {c.nombre}
                    </Link>
                    <div className="text-[0.75rem] text-slate-500 flex items-center gap-1.5">
                      <span className="w-4 h-4 bg-slate-100 flex items-center justify-center rounded text-[0.6rem]" aria-hidden="true">🏢</span>
                      {c.faena?.nombre}
                    </div>
                  </div>
                  {alCt > 0 && (
                    <div className="flex flex-col items-center justify-center w-8 h-8 bg-red-50 text-red-600 rounded-lg text-xs font-bold" title={`${alCt} alertas activas`}>
                      <span className="text-[0.6rem] leading-none mb-0.5" aria-hidden="true">⚠️</span>
                      <span className="leading-none">{alCt}</span>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
                  <div>
                    <div className="flex justify-between text-[0.75rem] mb-1 font-semibold text-slate-700">
                      <span>Cumplimiento</span>
                      <span style={{ color: bar }}>{pct}%</span>
                    </div>
                    <div className="h-[6px] w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: bar }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-slate-500 mb-0.5">Personal</div>
                      <div className="font-bold text-slate-700">{perOk} <span className="text-[0.65rem] text-slate-400 font-normal">/ {perTot}</span></div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <div className="text-slate-500 mb-0.5">Equipos</div>
                      <div className="font-bold text-slate-700">{eqOk} <span className="text-[0.65rem] text-slate-400 font-normal">/ {eqTot}</span></div>
                    </div>
                  </div>
                </div>

                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => onDelete(c.id, c.nombre)}
                    aria-label={`Eliminar contrato ${c.nombre}`}
                    className="w-7 h-7 bg-white border border-slate-200 text-slate-400 rounded hover:text-red-600 hover:border-red-200 flex items-center justify-center text-xs shadow-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-[0.68rem] text-slate-500 font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Contrato</th>
              <th className="py-3 px-4">Faena</th>
              <th className="py-3 px-4">Inicio</th>
              <th className="py-3 px-4">Término</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Cumplimiento</th>
              <th className="py-3 px-4">Personal acreditado</th>
              <th className="py-3 px-4">Equipos acreditados</th>
              <th className="py-3 px-4">Alertas</th>
              <th className="py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 text-[0.85rem]">
                  Cargando contratos...
                </td>
              </tr>
            ) : contratos.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 text-[0.85rem]">
                  No se encontraron contratos con los filtros actuales.
                </td>
              </tr>
            ) : (
              contratos.map((c) => {
                const pct = c.stats?.cumplimiento_pct || 0;
                const vig = estadoVigencia(c);
                const perOk = c.stats?.personal?.acreditados || 0;
                const perTot = c.stats?.personal?.total || 0;
                const eqOk = c.stats?.equipos?.acreditados || 0;
                const eqTot = c.stats?.equipos?.total || 0;
                const alCt = c.stats?.alertas_activas || 0;

                return (
                  <tr key={c.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 align-middle">
                      <Link
                        href={`/contratos/${c.id}`}
                        className="inline-block rounded-md bg-indigo-50 px-2.5 py-0.5 font-semibold text-blue-700 hover:bg-indigo-100 text-[0.85rem]"
                      >
                        • {c.nombre}
                      </Link>
                      <div className="text-[0.76rem] text-slate-500 mt-0.5">{c.faena?.nombre}</div>
                    </td>
                    <td className="py-3 px-4 align-middle text-[0.8rem] text-slate-500">{c.faena?.nombre}</td>
                    <td className="py-3 px-4 align-middle text-[0.8rem] text-slate-500 whitespace-nowrap">{fmtFecha(c.fecha_inicio)}</td>
                    <td className="py-3 px-4 align-middle text-[0.8rem] text-slate-500 whitespace-nowrap">{c.fecha_termino ? fmtFecha(c.fecha_termino) : "Sin término"}</td>
                    <td className="py-3 px-4 align-middle">
                      <ChipVig estado={vig} />
                    </td>
                    <td className="py-3 px-4 align-middle">
                      <BarraCumplimiento pct={pct} />
                    </td>
                    <td className="py-3 px-4 align-middle text-[0.8rem] text-slate-700">
                      {perOk} / {perTot}
                      <div className="text-[0.68rem] text-slate-400 font-semibold">{perTot ? Math.round((perOk / perTot) * 100) : 0}%</div>
                    </td>
                    <td className="py-3 px-4 align-middle text-[0.8rem] text-slate-700">
                      {eqOk} / {eqTot}
                      <div className="text-[0.68rem] text-slate-400 font-semibold">{eqTot ? Math.round((eqOk / eqTot) * 100) : 0}%</div>
                    </td>
                    <td className="py-3 px-4 align-middle">
                      {alCt > 0 ? (
                        <span className="inline-flex items-center h-5 px-2 rounded-full text-[0.68rem] font-bold bg-amber-100 text-amber-700">
                          {alCt}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[0.8rem]">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 align-middle">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/contratos/${c.id}`}
                          aria-label={`Ver contrato ${c.nombre}`}
                          className="w-[30px] h-[30px] inline-grid place-items-center rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-blue-700 text-[0.85rem]"
                        >
                          👁
                        </Link>
                        <button
                          onClick={() => onDelete(c.id, c.nombre)}
                          aria-label={`Eliminar contrato ${c.nombre}`}
                          className="w-[30px] h-[30px] inline-grid place-items-center rounded-lg bg-slate-100 border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 text-[0.85rem]"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-slate-200 text-[0.75rem] font-medium text-slate-500 flex justify-between items-center bg-slate-50">
        <span>Mostrando 1 a {contratos.length} de {total} contratos</span>
        <span className="text-blue-600 font-bold">10 por página</span>
      </div>
    </div>
  );
}
