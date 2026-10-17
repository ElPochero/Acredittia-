"use client";

import Link from "next/link";
import type { ActividadFila } from "@/lib/tipos";

type Props = { actividades: ActividadFila[]; loading: boolean };

function tiempoRelativo(fechaIso: string): string {
  const d = new Date(fechaIso);
  if (isNaN(d.getTime())) return "Reciente";
  const diffHs = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (diffHs < 24) return `Hoy, ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffHs < 48) return "Ayer";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function ActividadRecienteCard({ actividades, loading }: Props) {
  return (
    <section aria-label="Actividad reciente" className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-800">Actividad reciente</h3>
          <Link href="/alertas" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
            Ver todas →
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs" role="status">Cargando actividad...</div>
        ) : actividades.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs" role="status">No hay actividad reciente registrada.</div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {actividades.map((act) => (
              <div key={act.id} className="py-3 flex items-start gap-2.5">
                <span className="text-xs text-blue-500 mt-0.5" aria-hidden="true">🔹</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 leading-snug">{act.descripcion}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{tiempoRelativo(act.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
