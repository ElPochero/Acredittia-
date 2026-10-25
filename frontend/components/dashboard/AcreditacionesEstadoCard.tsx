"use client";

import { useState } from "react";
import * as Api from "@/lib/cliente";
import type { AcreditacionesEstado, EstadoSujeto, Sujeto } from "@/lib/tipos";
import { Chip, Modal } from "@/components/ui";

type Props = { data: AcreditacionesEstado | null; loading: boolean };

type Filtro = "ok" | "pendiente" | "venc";

const META: Record<Filtro, { titulo: string; color: string; estados: EstadoSujeto[] }> = {
  ok: { titulo: "Acreditados", color: "bg-emerald-500", estados: ["ok"] },
  pendiente: { titulo: "Pendientes", color: "bg-amber-400", estados: ["proc", "falta"] },
  venc: { titulo: "Vencidos", color: "bg-red-500", estados: ["venc"] },
};

export default function AcreditacionesEstadoCard({ data, loading }: Props) {
  const total = data?.total || 1;
  const acred = data?.acreditados || 0;
  const pend = data?.pendientes || 0;
  const venc = data?.vencidos || 0;
  const pA = Math.round((acred / total) * 100);
  const pP = Math.round((pend / total) * 100);
  const pV = Math.round((venc / total) * 100);

  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const [sujetos, setSujetos] = useState<Sujeto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function verDetalle(f: Filtro) {
    setFiltro(f);
    setCargando(true);
    setError("");
    setSujetos([]);
    try {
      const estados = META[f].estados;
      const [pers, eqs] = await Promise.all([
        Promise.all(estados.map((e) => Api.personal.listar({ estado: e, page_size: 100 }))),
        Promise.all(estados.map((e) => Api.equipos.listar({ estado: e, page_size: 100 }))),
      ]);
      setSujetos([
        ...pers.flatMap((p) => p.items || []),
        ...eqs.flatMap((p) => p.items || []),
      ]);
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setCargando(false);
    }
  }

  const fila = (f: Filtro, n: number, pct: number) => (
    <button
      onClick={() => verDetalle(f)}
      aria-pressed={filtro === f}
      title={`Ver detalle de ${META[f].titulo.toLowerCase()}`}
      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
        filtro === f ? "bg-blue-50 ring-1 ring-blue-200" : "bg-slate-50 hover:bg-slate-100"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${META[f].color}`} aria-hidden="true" />
        <span className="font-semibold text-slate-700">{META[f].titulo}</span>
      </span>
      <span className="font-bold text-slate-800">
        {n} <span className="text-slate-400 text-[11px] font-normal">({pct}%)</span>
      </span>
    </button>
  );

  return (
    <section aria-label="Acreditaciones por estado" className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-sm text-slate-800 mb-4">Acreditaciones por estado</h3>
        <div className="flex items-center justify-center my-4">
          <div className="relative w-36 h-36 flex items-center justify-center" role="img"
            aria-label={`Acreditados ${pA}%, pendientes ${pP}%, vencidos ${pV}%`}>
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <path className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-red-500 transition-all duration-700" strokeDasharray={`${pV}, 100`} strokeDashoffset="0"
                strokeWidth="4.5" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831">
                <title>{`Vencidos: ${venc} (${pV}%)`}</title>
              </path>
              <path className="text-amber-400 transition-all duration-700" strokeDasharray={`${pP}, 100`} strokeDashoffset={`-${pV}`}
                strokeWidth="4.5" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831">
                <title>{`Pendientes: ${pend} (${pP}%)`}</title>
              </path>
              <path className="text-emerald-500 transition-all duration-700" strokeDasharray={`${pA}, 100`} strokeDashoffset={`-${pV + pP}`}
                strokeWidth="4.5" stroke="currentColor" fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831">
                <title>{`Acreditados: ${acred} (${pA}%)`}</title>
              </path>
            </svg>
            <div className="absolute text-center">
              <div className="text-xl font-bold text-slate-900 leading-none">{loading ? "..." : data?.total || 0}</div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">Total</div>
            </div>
          </div>
        </div>
        <div className="space-y-2 mt-4">
          {fila("ok", acred, pA)}
          {fila("pendiente", pend, pP)}
          {fila("venc", venc, pV)}
        </div>
      </div>

      <Modal
        abierto={!!filtro}
        titulo={filtro ? `${META[filtro].titulo} (${filtro === "ok" ? acred : filtro === "pendiente" ? pend : venc})` : ""}
        onCerrar={() => setFiltro(null)}
        ancho="max-w-xl"
      >
        {cargando ? (
          <p className="py-6 text-center text-sm text-slate-500">Cargando detalle...</p>
        ) : error ? (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{error}</p>
        ) : sujetos.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No hay personal ni equipos en este estado.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm max-h-[60vh] overflow-y-auto">
            {sujetos.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-800 truncate">{s.nombre}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {s.tipo === "equipo" ? s.patente : s.rut} · {s.contrato?.nombre}
                  </div>
                </div>
                <Chip estado={s.estado} />
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </section>
  );
}
