"use client";

import Link from "next/link";
import type { Alerta } from "@/lib/tipos";

type Props = { alertas: Alerta[]; total: number; loading: boolean };

function esAlta(a: Alerta) {
  return a.severidad === "critica" || a.severidad === "alta";
}

export default function AccionesPendientesCard({ alertas, total, loading }: Props) {
  return (
    <section aria-label="Acciones pendientes" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-sm text-slate-800">Acciones pendientes</h2>
          <p className="text-xs text-slate-400 mt-0.5">Documentos que faltan por cargar — resuélvelos desde aquí</p>
        </div>
        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700 shrink-0">
          {total} pendientes
        </span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400 text-xs" role="status">Cargando acciones pendientes...</div>
      ) : alertas.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs" role="status">
          ✨ ¡Excelente! No tienes acciones pendientes por regularizar.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {alertas.map((a) => (
            <div key={a.id} className="p-3.5 flex items-center justify-between gap-4 text-xs hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded shrink-0 ${esAlta(a) ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                  {esAlta(a) ? "Alta" : "Media"}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{a.titulo}</div>
                  {a.descripcion && <div className="text-slate-500 text-[11px] truncate">{a.descripcion}</div>}
                </div>
              </div>
              <Link href={`/alertas?alerta=${a.id}`}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors shrink-0">
                Solucionar
              </Link>
            </div>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="p-3 bg-slate-50/50 border-t border-slate-100 text-center">
          <Link href="/alertas?filtro=pendientes" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            Ver los {total} pendientes →
          </Link>
        </div>
      )}
    </section>
  );
}
