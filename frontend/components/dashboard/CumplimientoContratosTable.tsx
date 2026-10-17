"use client";

import Link from "next/link";
import type { CumplimientoContrato } from "@/lib/tipos";

type Props = { contratos: CumplimientoContrato[]; loading: boolean };

function chip(pct: number): { cls: string; label: string; bar: string } {
  if (pct >= 70) return { cls: "bg-emerald-100 text-emerald-800", label: "Activo", bar: "bg-emerald-500" };
  if (pct >= 40) return { cls: "bg-amber-100 text-amber-800", label: "Por vencer", bar: "bg-amber-400" };
  return { cls: "bg-red-100 text-red-700", label: "Vencido", bar: "bg-red-500" };
}

function pctOf(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

export default function CumplimientoContratosTable({ contratos, loading }: Props) {
  return (
    <section aria-label="Cumplimiento por contrato" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
      <div>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="font-bold text-sm text-slate-800">Cumplimiento por contrato</h3>
          <Link href="/contratos" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            Ver todos los contratos →
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs" role="status">Cargando datos de contratos...</div>
        ) : contratos.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2" role="status">
            <div>No se encontraron contratos registrados.</div>
            <Link href="/contratos" className="inline-block px-3 py-1.5 bg-blue-600 text-white font-semibold rounded text-xs">
              + Crear Contrato
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left divide-y divide-slate-100">
              <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th scope="col" className="py-2.5 px-4">Contrato / Faena</th>
                  <th scope="col" className="py-2.5 px-3">Estado</th>
                  <th scope="col" className="py-2.5 px-3">Cumplimiento</th>
                  <th scope="col" className="py-2.5 px-3 text-center">Personal</th>
                  <th scope="col" className="py-2.5 px-3 text-center">Equipos</th>
                  <th scope="col" className="py-2.5 px-3 text-center">Alertas</th>
                  <th scope="col" className="py-2.5 px-3 text-right"><span className="sr-only">Detalle</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contratos.map((c) => {
                  const pct = c.cumplimiento_pct ?? 0;
                  const ch = chip(pct);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{c.nombre}</div>
                        <div className="text-[11px] text-slate-400">{c.faena || "Sin Faena"}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${ch.cls}`}>{ch.label}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className={`${ch.bar} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-bold text-slate-700">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-semibold text-slate-700">{c.personal?.acreditados || 0}/{c.personal?.total || 0}</div>
                        <div className="text-[10px] text-slate-400">{pctOf(c.personal?.acreditados || 0, c.personal?.total || 0)}%</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-semibold text-slate-700">{c.equipos?.acreditados || 0}/{c.equipos?.total || 0}</div>
                        <div className="text-[10px] text-slate-400">{pctOf(c.equipos?.acreditados || 0, c.equipos?.total || 0)}%</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {(c.alertas_activas || 0) > 0 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full" title={`${c.alertas_activas} alertas`}>
                            ⚠️ {c.alertas_activas}
                          </span>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link href={`/contratos/${c.id}`} aria-label={`Ver ${c.nombre}`} className="p-1 text-slate-400 hover:text-blue-600 transition-colors font-bold text-sm">
                          →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
