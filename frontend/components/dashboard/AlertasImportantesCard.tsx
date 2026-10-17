"use client";

import Link from "next/link";
import type { Alerta } from "@/lib/tipos";

type Props = { alertas: Alerta[]; loading: boolean };

function critica(a: Alerta) {
  return a.severidad === "critica" || a.severidad === "alta";
}

/** Destino del documento/registro de la alerta (contrato → sujeto → listado). */
function destino(a: Alerta): string {
  if (a.contrato_id) return `/contratos/${a.contrato_id}`;
  if (a.sujeto_id) return `/personal/${a.sujeto_id}`;
  return "/alertas";
}

export default function AlertasImportantesCard({ alertas, loading }: Props) {
  return (
    <section aria-label="Alertas importantes" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
      <div>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="font-bold text-sm text-slate-800">Alertas importantes</h3>
          <Link href="/alertas" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            Ver todas ({alertas.length})
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs" role="status">Cargando alertas...</div>
        ) : alertas.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs" role="status">Sin alertas importantes reportadas.</div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {alertas.slice(0, 5).map((a) => (
              <div key={a.id} className="p-3.5 flex items-start gap-3 hover:bg-slate-50/60 transition-colors">
                <span className="text-base mt-0.5" aria-hidden="true">{critica(a) ? "⚠️" : "⏰"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-800 line-clamp-1">{a.titulo}</div>
                  <div className="text-slate-500 text-[11px] line-clamp-2 mt-0.5">
                    {a.descripcion || "Documento por vencer o requiere revisión de vigencia."}
                  </div>
                </div>
                <Link href={destino(a)}
                  className={`px-2 py-1 text-[10px] font-bold rounded shrink-0 ${critica(a) ? "text-red-700 bg-red-50 hover:bg-red-100" : "text-slate-600 bg-slate-100 hover:bg-slate-200"}`}>
                  {critica(a) ? "Vencido" : "Ver doc"}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
