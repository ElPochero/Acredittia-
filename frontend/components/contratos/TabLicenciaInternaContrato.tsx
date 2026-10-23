"use client";
import React, { useEffect, useState } from "react";
import { Contrato, LicenciaInterna, Documento, Ejemplo } from "@/lib/tipos";
import * as Api from "@/lib/cliente";
import { Modal } from "@/components/ui";

interface TabLicenciaInternaProps {
  contrato: Contrato;
  cambiarTab: (t: any) => void;
  onSubir: (docId: string, file: File) => void;
  subiendo: { docId: string; pct: number; texto: string } | null;
  analizandoId: string | null;
}

/** Conductor con su expediente EMSIPOR y el estado que lo resume. */
type Conductor = LicenciaInterna & {
  contador: "acreditados" | "vencidos" | "en_proceso" | "bloqueados";
  licencia_vencida: boolean;
};

type Contadores = {
  total: number;
  acreditados: number;
  vencidos: number;
  en_proceso: number;
  bloqueados: number;
};

const CHIP_LIM: Record<string, string> = {
  vigente: "bg-emerald-100 text-emerald-700",
  por_vencer: "bg-amber-100 text-amber-700",
  pendiente: "bg-red-100 text-red-600",
};

const CONTADOR_LBL: Record<Conductor["contador"], string> = {
  acreditados: "Acreditado",
  vencidos: "Vencido",
  en_proceso: "En proceso",
  bloqueados: "Bloqueado",
};

function iniciales(nombre: string): string {
  return nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function TabLicenciaInternaContrato({ contrato, cambiarTab, onSubir, subiendo, analizandoId }: TabLicenciaInternaProps) {
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [contadores, setContadores] = useState<Contadores>({
    total: 0, acreditados: 0, vencidos: 0, en_proceso: 0, bloqueados: 0,
  });
  const [cargando, setCargando] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [ejemplo, setEjemplo] = useState<Ejemplo | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await Api.licencia.contrato(contrato.id);
      setConductores(res.conductores || []);
      setContadores(res.contadores || { total: 0, acreditados: 0, vencidos: 0, en_proceso: 0, bloqueados: 0 });
    } catch {
      setConductores([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato.id]);

  const verEjemplo = async (clave: string) => {
    try {
      setEjemplo(await Api.catalogo.ejemplo(clave));
    } catch (e) {
      alert(Api.mensajeError(e));
    }
  };

  const quitarArchivo = async (doc: Documento) => {
    const arch = doc.archivos?.[0];
    if (!arch) return;
    if (!confirm(`¿Quitar "${arch.filename}" de "${doc.titulo}"?`)) return;
    setQuitando(arch.id);
    try {
      await Api.documentos.eliminarArchivo(doc.id, arch.id);
      await cargar();
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setQuitando(null);
    }
  };

  const sel = selId ? conductores.find((c) => c.sujeto.id === selId) : null;

  const kpis = [
    { t: "Conductores totales", v: contadores.total, c: "text-slate-800", i: "🪪", f: "bg-slate-100" },
    { t: "Acreditados", v: contadores.acreditados, c: "text-emerald-600", i: "✅", f: "bg-emerald-500/15" },
    { t: "Vencidos", v: contadores.vencidos, c: "text-red-600", i: "⛔", f: "bg-red-500/15" },
    { t: "En proceso", v: contadores.en_proceso, c: "text-amber-600", i: "⏳", f: "bg-amber-500/15" },
    { t: "Bloqueados", v: contadores.bloqueados, c: "text-slate-600", i: "🚫", f: "bg-slate-200" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-3.5 gap-3 flex-wrap">
        <div>
          <h3 className="text-[#1E293B] text-[0.95rem] font-bold m-0">Licencia Interna de Mina — conductores del contrato</h3>
          <p className="text-[0.78rem] text-slate-500 mt-0.5 mb-0">
            Cada conductor tiene sus propios requisitos de licencia interna. Para agregar uno, márcalo como <b>Conduce</b> en la pestaña Personal.
          </p>
        </div>
        <button
          className="h-[34px] px-3.5 border border-slate-300 rounded-[8px] bg-white text-slate-700 font-semibold text-[0.78rem] hover:bg-slate-50 transition-colors"
          onClick={() => cambiarTab("Personal")}
        >
          Ir a Personal
        </button>
      </div>

      {/* Contadores de la cabecera */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-5">
        {kpis.map((k) => (
          <div key={k.t} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
            <span aria-hidden="true" className={`w-9 h-9 rounded-[10px] grid place-items-center text-[1rem] flex-shrink-0 ${k.f}`}>
              {k.i}
            </span>
            <div className="min-w-0">
              <div className="text-[0.66rem] font-bold uppercase tracking-wider text-slate-500 leading-tight">{k.t}</div>
              <div className={`text-[1.6rem] font-black leading-none mt-0.5 ${k.c}`}>{cargando ? "…" : k.v}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-[12px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-[0.68rem] text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Conductor</th>
                <th className="py-3 px-4">RUT</th>
                <th className="py-3 px-4">N° LIM</th>
                <th className="py-3 px-4">Estado LIM</th>
                <th className="py-3 px-4">Vencimiento LIM</th>
                <th className="py-3 px-4">Expediente EMSIPOR</th>
                <th className="py-3 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400 text-[0.85rem]">Cargando conductores...</td></tr>
              ) : conductores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 text-[0.85rem]">
                    No hay conductores en este contrato. Marca <b>Conduce</b> en la pestaña Personal para agregarlos.
                  </td>
                </tr>
              ) : (
                conductores.map((c) => {
                  const ok = c.resumen?.ok ?? 0;
                  const tot = c.resumen?.total ?? 0;
                  const pct = tot ? Math.round((ok / tot) * 100) : 0;
                  const est = c.estado || "pendiente";
                  const abierto = selId === c.sujeto.id;
                  return (
                    <React.Fragment key={c.sujeto.id}>
                      <tr
                        onClick={() => setSelId(abierto ? null : c.sujeto.id)}
                        className={`border-b border-slate-100 last:border-b-0 transition-colors cursor-pointer ${abierto ? "bg-indigo-50/50" : "hover:bg-slate-50"}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span aria-hidden="true" className="w-8 h-8 rounded-full bg-slate-700 text-white grid place-items-center text-[0.7rem] font-bold flex-shrink-0">
                              {iniciales(c.sujeto.nombre)}
                            </span>
                            <div>
                              <div className="font-bold text-slate-800 text-[0.85rem]">{c.sujeto.nombre}</div>
                              <div className="text-[0.72rem] text-slate-500">{c.sujeto.cargo || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[0.8rem] text-slate-500">{c.sujeto.rut || "—"}</td>
                        <td className="py-3 px-4 text-[0.8rem] text-slate-600 font-mono">{c.numero || "—"}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center h-5 px-2 rounded-full text-[0.62rem] font-bold uppercase tracking-wider ${CHIP_LIM[est] ?? "bg-slate-100 text-slate-600"}`}>
                            {est === "vigente" ? "Vigente" : est === "por_vencer" ? "Por vencer" : "Pendiente"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[0.8rem] text-slate-500">{c.vence || "—"}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <div className="h-[6px] w-[70px] bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[0.74rem] font-semibold text-slate-600">{ok}/{tot}</span>
                            <span className={`inline-flex items-center h-5 px-2 rounded-full text-[0.62rem] font-bold uppercase tracking-wider ${
                              c.contador === "acreditados" ? "bg-emerald-100 text-emerald-700"
                                : c.contador === "vencidos" ? "bg-red-100 text-red-700"
                                : c.contador === "en_proceso" ? "bg-amber-100 text-amber-700"
                                : "bg-slate-200 text-slate-600"
                            }`}>
                              {CONTADOR_LBL[c.contador]}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelId(abierto ? null : c.sujeto.id); }}
                            className="text-[0.8rem] font-semibold text-blue-700 hover:underline"
                          >
                            {abierto ? "Ocultar requisitos" : "Ver requisitos"}
                          </button>
                        </td>
                      </tr>
                      {abierto && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50/70 px-4 py-4 border-b border-slate-100">
                            <Expediente
                              c={c}
                              onSubir={onSubir}
                              subiendo={subiendo}
                              analizandoId={analizandoId}
                              onEjemplo={verEjemplo}
                              onQuitar={quitarArchivo}
                              quitando={quitando}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 text-[0.75rem] font-medium text-slate-500 bg-slate-50">
          {conductores.length} conductores · haz clic en uno para desplegar su expediente EMSIPOR
        </div>
      </div>

      <Modal abierto={!!ejemplo} titulo={ejemplo?.nombre ?? ""} onCerrar={() => setEjemplo(null)}>
        {ejemplo && (
          <div className="flex flex-col gap-3 text-sm">
            {ejemplo.referencia && <p className="text-slate-500 m-0">Referencia: {ejemplo.referencia}</p>}
            {ejemplo.campos_clave && ejemplo.campos_clave.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="mb-2 font-semibold text-slate-700">Campos clave que valida la IA:</div>
                {ejemplo.campos_clave.map(([k, v], i) => (
                  <div key={i} className="flex justify-between border-b border-slate-200 py-1 last:border-0">
                    <span className="font-medium">{k}</span>
                    <span className="text-slate-500">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {ejemplo.notas && ejemplo.notas.length > 0 && (
              <ul className="list-inside list-disc text-slate-600 m-0 pl-1">
                {ejemplo.notas.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
            {ejemplo.tip && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800 m-0">💡 {ejemplo.tip}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

/**
 * Expediente EMSIPOR del conductor: los nueve requisitos con su plataforma y su
 * estado de vigencia (vigente / por vencer / vencido / pendiente).
 */
function Expediente({ c, onSubir, subiendo, analizandoId, onEjemplo, onQuitar, quitando }: {
  c: Conductor;
  onSubir: (docId: string, file: File) => void;
  subiendo: { docId: string; pct: number; texto: string } | null;
  analizandoId: string | null;
  onEjemplo: (clave: string) => void;
  onQuitar: (doc: Documento) => void;
  quitando: string | null;
}) {
  const docs = c.checklist || [];
  const ok = c.resumen?.ok ?? 0;
  const tot = c.resumen?.total ?? docs.length;
  const pct = tot ? Math.round((ok / tot) * 100) : 0;
  const faltan = docs.filter((d) => d.estado_calc === "falta" && d.obligatorio);
  const vencidos = docs.filter((d) => d.estado_calc === "venc");

  return (
    <div className="max-w-[1000px]">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span aria-hidden="true" className="w-12 h-12 rounded-full bg-slate-700 text-white grid place-items-center text-[1rem] font-bold flex-shrink-0">
          {iniciales(c.sujeto.nombre)}
        </span>
        <div className="flex-1 min-w-[200px]">
          <h4 className="m-0 text-[1.05rem] font-bold text-slate-900">{c.sujeto.nombre}</h4>
          <div className="text-[0.8rem] text-slate-500">{c.sujeto.rut} · {c.sujeto.cargo}</div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[0.84rem]">
            <span className={`inline-flex items-center h-5 px-2 rounded-full text-[0.62rem] font-bold uppercase tracking-wider ${CHIP_LIM[c.estado || "pendiente"] ?? "bg-slate-100 text-slate-600"}`}>
              {(c.estado || "pendiente") === "vigente" ? "Vigente" : c.estado === "por_vencer" ? "Por vencer" : "Pendiente"}
            </span>
            <span className="text-slate-500">N° LIM: <b className="text-slate-800">{c.numero || "Sin asignar"}</b>{c.vence ? ` · vence ${c.vence}` : ""}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[1.5rem] font-black text-slate-900 leading-none">{pct}%</div>
          <div className="text-[0.75rem] text-slate-500 mt-1">{ok} de {tot} requisitos</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3.5 mb-3.5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1.5">
          <span aria-hidden="true" className="w-7 h-7 rounded-lg bg-blue-600 text-white grid place-items-center text-[0.75rem] font-black">IA</span>
          <b className="text-[0.88rem] text-slate-800">Revisión automática</b>
        </div>
        {faltan.length > 0 && (
          <div className="flex gap-2.5 text-[0.82rem] text-slate-700 py-1.5">
            <span aria-hidden="true">📋</span>
            <div>Faltan <b>{faltan.length} requisitos</b>: {faltan.map((d) => d.titulo).join(", ")}.</div>
          </div>
        )}
        {vencidos.length > 0 && (
          <div className="flex gap-2.5 text-[0.82rem] text-red-700 py-1.5">
            <span aria-hidden="true">⛔</span>
            <div>Hay <b>{vencidos.length} documentos vencidos</b>. Renuévalos para mantener la licencia.</div>
          </div>
        )}
        {c.licencia_vencida && (
          <div className="flex gap-2.5 text-[0.82rem] text-red-700 py-1.5">
            <span aria-hidden="true">⛔</span>
            <div>La licencia interna está <b>vencida</b>: el conductor no puede operar en faena.</div>
          </div>
        )}
        {faltan.length === 0 && vencidos.length === 0 && !c.licencia_vencida && (
          <div className="flex gap-2.5 text-[0.82rem] text-emerald-700 py-1.5">
            <span aria-hidden="true">✅</span>
            <div>Todos los requisitos de la licencia interna están al día.</div>
          </div>
        )}
      </div>

      <h4 className="text-[0.95rem] font-bold text-slate-900 mb-2.5">Requisitos de la licencia interna ({tot})</h4>
      <div className="flex flex-col gap-2">
        {docs.map((d) => {
          const sub = subiendo?.docId === d.id ? subiendo : null;
          const analizando = analizandoId === d.id;
          const tieneArchivo = (d.archivos || []).length > 0;
          const estTxt =
            d.estado_calc === "venc" ? `⛔ Vencido${d.vence ? ` · ${d.vence}` : ""}` :
            d.estado_calc === "porvenc" ? `⏰ Por vencer · ${d.vence || ""}` :
            d.estado_calc === "ok" ? `✓ ${d.vence ? `Vigente hasta ${d.vence}` : "Cargado"}` :
            "📋 Pendiente de carga";
          const estColor =
            d.estado_calc === "venc" ? "text-red-600" :
            d.estado_calc === "porvenc" ? "text-amber-600" :
            d.estado_calc === "ok" ? "text-emerald-600" : "text-amber-800";
          return (
            <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="font-bold text-slate-800 text-[0.88rem]">
                  {d.titulo}
                  <span className={`ml-2 text-[0.65rem] font-bold px-1.5 py-0.5 rounded ${d.obligatorio ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {d.obligatorio ? "Obligatorio" : "Opcional"}
                  </span>
                </div>
                {d.plataforma && (
                  <span className="text-[0.65rem] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                    {d.plataforma}
                  </span>
                )}
              </div>
              <div className={`text-[0.78rem] font-semibold mt-1 ${estColor}`}>{estTxt}</div>
              {sub && <div className="text-[0.78rem] text-slate-500 mt-1">{sub.texto} ({sub.pct}%)</div>}
              {analizando && <div className="text-[0.78rem] text-blue-600 mt-1">🤖 La IA está revisando el documento...</div>}
              <div className="flex items-center flex-wrap gap-2 mt-2.5">
                <label className="h-8 px-3 bg-blue-50/50 border border-blue-200 hover:bg-blue-50 rounded-md text-[0.75rem] font-semibold text-blue-600 cursor-pointer flex items-center gap-1.5 transition-colors">
                  📎 Subir documento
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        onSubir(d.id, e.target.files[0]);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                {!tieneArchivo && d.ejemplo_clave && (
                  <button onClick={() => onEjemplo(d.ejemplo_clave!)} className="h-8 px-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-md text-[0.75rem] font-medium text-slate-600 transition-colors">
                    📄 Ver ejemplo
                  </button>
                )}
                {tieneArchivo && (
                  <span className="text-[0.75rem] text-slate-500 truncate max-w-[220px]">{d.archivos![0].filename}</span>
                )}
                {tieneArchivo && (
                  <button
                    onClick={() => onQuitar(d)}
                    disabled={quitando === d.archivos![0].id}
                    className="h-8 px-3 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-md text-[0.75rem] font-medium text-slate-500 transition-colors disabled:opacity-50"
                  >
                    {quitando === d.archivos![0].id ? "Quitando..." : "Quitar"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
