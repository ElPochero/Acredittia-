"use client";
import React, { useEffect, useState } from "react";
import { Contrato, Sujeto, LicenciaInterna, Documento, Ejemplo } from "@/lib/tipos";
import * as Api from "@/lib/cliente";
import { Modal, Spinner } from "@/components/ui";

interface TabLicenciaInternaProps {
  contrato: Contrato;
  cambiarTab: (t: any) => void;
  onSubir: (docId: string, file: File) => void;
  subiendo: { docId: string; pct: number; texto: string } | null;
  analizandoId: string | null;
}

type Conductor = { sujeto: Sujeto; licencia: LicenciaInterna | null };

const CHIP_LIM: Record<string, string> = {
  vigente: "bg-emerald-100 text-emerald-700",
  por_vencer: "bg-amber-100 text-amber-700",
  pendiente: "bg-red-100 text-red-600",
};

function iniciales(nombre: string): string {
  return nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function TabLicenciaInternaContrato({ contrato, cambiarTab, onSubir, subiendo, analizandoId }: TabLicenciaInternaProps) {
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [ejemplo, setEjemplo] = useState<Ejemplo | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await Api.contratos.personal(contrato.id, { es_conductor: true, page_size: 100 });
      const lista = res.items || [];
      const filas = await Promise.all(
        lista.map(async (s): Promise<Conductor> => {
          try {
            const li = await Api.licencia.detalle(s.id);
            return { sujeto: s, licencia: li };
          } catch {
            return { sujeto: s, licencia: null };
          }
        })
      );
      setConductores(filas);
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

  const nVig = conductores.filter((c) => c.licencia?.estado === "vigente").length;
  const nPv = conductores.filter((c) => c.licencia?.estado === "por_vencer").length;
  const nPend = conductores.length - nVig - nPv;

  if (sel) return <DetalleConductor c={sel} onVolver={() => setSelId(null)} onSubir={onSubir} subiendo={subiendo} analizandoId={analizandoId} onEjemplo={verEjemplo} onQuitar={quitarArchivo} quitando={quitando} />;

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { t: "Conductores", v: conductores.length, c: "text-slate-800" },
          { t: "Vigentes", v: nVig, c: "text-emerald-600" },
          { t: "Por vencer", v: nPv, c: "text-amber-600" },
          { t: "Pendientes", v: nPend, c: "text-red-600" },
        ].map((k) => (
          <div key={k.t} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[0.7rem] font-bold text-slate-500 uppercase mb-1">{k.t}</div>
            <div className={`text-2xl font-black ${k.c}`}>{cargando ? "…" : k.v}</div>
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
                <th className="py-3 px-4">Requisitos</th>
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
                conductores.map(({ sujeto: s, licencia: li }) => {
                  const ok = li?.resumen.ok ?? 0;
                  const tot = li?.resumen.total ?? 0;
                  const pct = tot ? Math.round((ok / tot) * 100) : 0;
                  const est = li?.estado || "pendiente";
                  return (
                    <tr key={s.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span aria-hidden="true" className="w-8 h-8 rounded-full bg-slate-700 text-white grid place-items-center text-[0.7rem] font-bold flex-shrink-0">
                            {iniciales(s.nombre)}
                          </span>
                          <div>
                            <div className="font-bold text-slate-800 text-[0.85rem]">{s.nombre}</div>
                            <div className="text-[0.72rem] text-slate-500">{s.cargo || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[0.8rem] text-slate-500">{s.rut || "—"}</td>
                      <td className="py-3 px-4 text-[0.8rem] text-slate-600 font-mono">{li?.numero || "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center h-5 px-2 rounded-full text-[0.62rem] font-bold uppercase tracking-wider ${CHIP_LIM[est]}`}>
                          {est === "vigente" ? "Vigente" : est === "por_vencer" ? "Por vencer" : "Pendiente"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[0.8rem] text-slate-500">{li?.vence || "—"}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="h-[6px] w-[70px] bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[0.74rem] font-semibold text-slate-600">{ok}/{tot}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button onClick={() => setSelId(s.id)} className="text-[0.8rem] font-semibold text-blue-700 hover:underline">
                          Ver requisitos
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 text-[0.75rem] font-medium text-slate-500 bg-slate-50">
          {conductores.length} conductores
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

function DetalleConductor({ c, onVolver, onSubir, subiendo, analizandoId, onEjemplo, onQuitar, quitando }: {
  c: Conductor;
  onVolver: () => void;
  onSubir: (docId: string, file: File) => void;
  subiendo: { docId: string; pct: number; texto: string } | null;
  analizandoId: string | null;
  onEjemplo: (clave: string) => void;
  onQuitar: (doc: Documento) => void;
  quitando: string | null;
}) {
  const { sujeto: s, licencia: li } = c;
  const docs = li?.checklist || [];
  const ok = li?.resumen.ok ?? 0;
  const tot = li?.resumen.total ?? docs.length;
  const pct = tot ? Math.round((ok / tot) * 100) : 0;
  const faltan = docs.filter((d) => d.estado_calc === "falta" && d.obligatorio);
  const vencidos = docs.filter((d) => d.estado_calc === "venc");

  return (
    <div className="max-w-[1000px]">
      <button onClick={onVolver} className="mb-4 h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[0.82rem] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
        ← Volver a conductores
      </button>

      <div className="flex items-center gap-4 mb-5 flex-wrap">
        <span aria-hidden="true" className="w-14 h-14 rounded-full bg-slate-700 text-white grid place-items-center text-[1.1rem] font-bold flex-shrink-0">
          {iniciales(s.nombre)}
        </span>
        <div className="flex-1 min-w-[200px]">
          <h2 className="m-0 text-[1.2rem] font-bold text-slate-900">{s.nombre}</h2>
          <div className="text-[0.8rem] text-slate-500">{s.rut} · {s.cargo} · Licencia Interna de Mina</div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[0.84rem]">
            <span className={`inline-flex items-center h-5 px-2 rounded-full text-[0.62rem] font-bold uppercase tracking-wider ${CHIP_LIM[li?.estado || "pendiente"]}`}>
              {(li?.estado || "pendiente") === "vigente" ? "Vigente" : li?.estado === "por_vencer" ? "Por vencer" : "Pendiente"}
            </span>
            <span className="text-slate-500">N° LIM: <b className="text-slate-800">{li?.numero || "Sin asignar"}</b>{li?.vence ? ` · vence ${li.vence}` : ""}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[1.6rem] font-black text-slate-900 leading-none">{pct}%</div>
          <div className="text-[0.75rem] text-slate-500 mt-1">{ok} de {tot} requisitos</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-2.5 mb-2">
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
        {faltan.length === 0 && vencidos.length === 0 && (
          <div className="flex gap-2.5 text-[0.82rem] text-emerald-700 py-1.5">
            <span aria-hidden="true">✅</span>
            <div>Todos los requisitos de la licencia interna están al día.</div>
          </div>
        )}
      </div>

      <h3 className="text-[1.0rem] font-bold text-slate-900 mb-3">Requisitos de la licencia interna ({tot})</h3>
      <div className="flex flex-col gap-2.5">
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
            <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="font-bold text-slate-800 text-[0.88rem]">
                {d.titulo}
                <span className={`ml-2 text-[0.65rem] font-bold px-1.5 py-0.5 rounded ${d.obligatorio ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {d.obligatorio ? "Obligatorio" : "Opcional"}
                </span>
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
