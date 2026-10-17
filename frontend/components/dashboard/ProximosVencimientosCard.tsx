"use client";

import Link from "next/link";
import type { ProximoVencimiento } from "@/lib/tipos";

type Props = { vencimientos: ProximoVencimiento[]; loading: boolean };

function badge(fechaIso: string): { dia: string | number; mes: string } {
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) return { dia: "--", mes: "---" };
  return {
    dia: d.getDate(),
    mes: d.toLocaleString("es-CL", { month: "short" }).toUpperCase(),
  };
}

/** El vencimiento pertenece a un sujeto: enlaza su ficha, o el listado si no hay sujeto. */
function destino(v: ProximoVencimiento): string {
  return v.sujeto_id ? `/personal/${v.sujeto_id}` : "/requisitos";
}

export default function ProximosVencimientosCard({ vencimientos, loading }: Props) {
  return (
    <section aria-label="Próximos vencimientos" className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-800">Próximos vencimientos</h3>
          <Link href="/calendario" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            Ver calendario →
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs" role="status">Cargando vencimientos...</div>
        ) : vencimientos.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs" role="status">No hay documentos próximos a vencer.</div>
        ) : (
          <div className="space-y-2.5 text-xs">
            {vencimientos.map((v) => {
              const { dia, mes } = badge(v.vence);
              const vencido = v.dias < 0;
              return (
                <div key={v.documento_id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-200/70 text-slate-800 flex flex-col items-center justify-center shrink-0" aria-hidden="true">
                      <span className="text-xs font-black leading-none">{dia}</span>
                      <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase mt-0.5">{mes}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{v.titulo}</div>
                      {v.sujeto && <div className="text-[11px] text-slate-500 truncate">{v.sujeto}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${vencido ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                      {vencido ? "Vencido" : `Vence en ${v.dias}d`}
                    </span>
                    <Link href={destino(v)}
                      className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded">
                      Ver doc
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
