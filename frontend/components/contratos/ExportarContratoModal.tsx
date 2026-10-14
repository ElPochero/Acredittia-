"use client";
import React, { useEffect, useState } from "react";
import { Modal, Spinner } from "@/components/ui";
import { toast } from "sonner";
import * as Api from "@/lib/cliente";
import type { Contrato, PlataformaContrato, RecursoExport } from "@/lib/tipos";
import { numeroContrato } from "./ContratoLayout";

interface ExportarContratoModalProps {
  abierto: boolean;
  onCerrar: () => void;
  contrato: Contrato | null;
  plataformas: PlataformaContrato[];
}

type Sec = "documentos" | "personal" | "equipos" | "alertas" | "matriz";
type Paso = "cfg" | "run" | "done";

type ArchivoListo = { sec: string; url: string; nombre: string };

// ponytail: ZIP sin compresión (método stored), ~50 líneas para no traer
// una dependencia. Si algún día se quiere comprimir, traer jszip.
const CRC_TABLA: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function descargarZip(nombre: string, archivos: { nombre: string; url: string }[]) {
  const enc = new TextEncoder();
  const ahora = new Date();
  const dosHora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
  const dosFecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
  const datos: BlobPart[] = [];
  const central: BlobPart[] = [];
  let offset = 0;
  for (const a of archivos) {
    const res = await fetch(a.url);
    if (!res.ok) throw new Error(`No se pudo leer ${a.nombre} (${res.status}).`);
    const buf = new Uint8Array(await res.arrayBuffer());
    const nom = enc.encode(a.nombre);
    const crc = crc32(buf);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true);
    lh.setUint16(10, dosHora, true);
    lh.setUint16(12, dosFecha, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, buf.length, true);
    lh.setUint32(22, buf.length, true);
    lh.setUint16(26, nom.length, true);
    lh.setUint16(28, 0, true);
    datos.push(lh.buffer, nom, buf);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, dosHora, true);
    ch.setUint16(14, dosFecha, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, buf.length, true);
    ch.setUint32(24, buf.length, true);
    ch.setUint16(28, nom.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, nom);
    offset += 30 + nom.length + buf.length;
  }
  const tamCentral = central.reduce((n, p) => n + (p instanceof ArrayBuffer ? p.byteLength : (p as Uint8Array).length), 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, offset, true);
  const blob = new Blob([...datos, ...central, fin.buffer], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const SECCIONES: { k: Sec; icono: string; t: string; d: string; recurso: RecursoExport }[] = [
  { k: "documentos", icono: "📄", t: "Documentos", d: "Listado documental del contrato con estados y vencimientos", recurso: "documentos" },
  { k: "personal", icono: "👤", t: "Personal", d: "Nómina y estado de acreditación por trabajador", recurso: "personal" },
  { k: "equipos", icono: "🚛", t: "Equipos", d: "Flota y estado de acreditación por equipo", recurso: "equipos" },
  { k: "alertas", icono: "⚠️", t: "Alertas", d: "Alertas activas del contrato", recurso: "alertas" },
  { k: "matriz", icono: "📊", t: "Matriz", d: "Cuadrícula de cumplimiento por trabajador", recurso: "matriz" },
];

export function ExportarContratoModal({ abierto, onCerrar, contrato, plataformas }: ExportarContratoModalProps) {
  const [plat, setPlat] = useState("");
  const [on, setOn] = useState<Record<Sec, boolean>>({ documentos: true, personal: true, equipos: true, alertas: true, matriz: false });
  const [fmt, setFmt] = useState<Record<Sec, "excel" | "csv">>({ documentos: "excel", personal: "excel", equipos: "excel", alertas: "excel", matriz: "excel" });
  const [paso, setPaso] = useState<Paso>("cfg");
  const [prog, setProg] = useState(0);
  const [msg, setMsg] = useState("");
  const [archivos, setArchivos] = useState<ArchivoListo[]>([]);
  const [conResumen, setConResumen] = useState(true);
  const [bajandoZip, setBajandoZip] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [subidas, setSubidas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (abierto && contrato) {
      setPlat(plataformas[0]?.nombre || "");
      setPaso("cfg");
      setArchivos([]);
      setError(null);
      // Última marca de subida por plataforma (la marca es la fila de actividad).
      Api.contratos.historial(contrato.id, { modulo: "plataformas", page_size: 50 })
        .then((h) => {
          const mapa: Record<string, string> = {};
          for (const f of h.items || []) {
            if (f.plataforma && f.descripcion.startsWith("Documentos subidos a") && !mapa[f.plataforma]) {
              mapa[f.plataforma] = f.created_at;
            }
          }
          setSubidas(mapa);
        })
        .catch(() => setSubidas({}));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  if (!contrato) return null;

  const stats = contrato.stats;
  const conteo: Record<Sec, number> = {
    documentos: stats?.docs_empresa?.total ?? 0,
    personal: stats?.personal?.total ?? 0,
    equipos: stats?.equipos?.total ?? 0,
    alertas: stats?.alertas_activas ?? 0,
    matriz: (stats?.personal?.total ?? 0) + (stats?.equipos?.total ?? 0),
  };
  const elegidas = SECCIONES.filter((s) => on[s.k]);
  const raiz = `${numeroContrato(contrato)}_${(plat || "plataforma").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ")}`;

  const cerrar = () => {
    setPaso("cfg");
    setArchivos([]);
    setError(null);
    onCerrar();
  };

  const ejecutar = async () => {
    if (!elegidas.length && !conResumen) return;
    setPaso("run");
    setProg(5);
    setError(null);
    const listos: ArchivoListo[] = [];
    try {
      for (let i = 0; i < elegidas.length; i++) {
        const s = elegidas[i];
        setMsg(`Generando ${s.t}...`);
        setProg(Math.round(5 + (i / (elegidas.length + (conResumen ? 1 : 0))) * 90));
        const res = await Api.exportaciones.crear({
          recurso: s.recurso,
          filtros: { contrato_id: contrato.id },
          formato: fmt[s.k],
        });
        const url = res.download_url ?? (res.id ? await Api.reportes.esperarDescarga(res.id) : null);
        if (!url) throw new Error(`El servidor no devolvió archivo para ${s.t}.`);
        listos.push({ sec: s.k, url, nombre: `${numeroContrato(contrato)}_${s.k}.${fmt[s.k] === "excel" ? "xlsx" : "csv"}` });
      }
      if (conResumen) {
        setMsg("Generando resumen PDF...");
        setProg(92);
        const job = await Api.reportes.crear({
          tipo: "cumplimiento_requisitos",
          formato: "pdf",
          params: { contrato_id: contrato.id },
          nombre: `Resumen ${contrato.nombre}`,
        });
        const url = await Api.reportes.esperarDescarga(job.id);
        listos.push({ sec: "resumen", url, nombre: `${numeroContrato(contrato)}_resumen.pdf` });
      }
      setArchivos(listos);
      setProg(100);
      setPaso("done");
    } catch (e) {
      setError(Api.mensajeError(e));
      setPaso("cfg");
    }
  };

  const pidDePlataforma = () => {
    const p = plataformas.find((x) => x.nombre === plat);
    return p ? p.id || p.faena_plataforma_id || null : null;
  };

  const bajarZip = async () => {
    if (!archivos.length || bajandoZip) return;
    setBajandoZip(true);
    setError(null);
    try {
      await descargarZip(`${raiz}.zip`, archivos);
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setBajandoZip(false);
    }
  };

  const marcarSubido = async () => {
    const pid = pidDePlataforma();
    if (!pid || marcando) return;
    setMarcando(true);
    try {
      const res = await Api.plataformas.marcarSubida(contrato.id, pid);
      setSubidas((m) => ({ ...m, [res.plataforma]: res.subida_at }));
      toast.success("Marcado como subido", {
        description: `Documentos subidos a ${res.plataforma}.`,
      });
    } catch (e) {
      toast.error("No se pudo marcar", { description: Api.mensajeError(e) });
    } finally {
      setMarcando(false);
    }
  };

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo="" ancho={paso === "cfg" ? "max-w-[920px]" : "max-w-[520px]"}>
      {paso === "cfg" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span aria-hidden="true" className="w-[42px] h-[42px] rounded-xl bg-indigo-50 grid place-items-center text-[1.3rem] flex-shrink-0">📦</span>
            <div>
              <h3 className="m-0 text-[1.1rem] font-bold text-slate-900">Exportar documentos del contrato</h3>
              <p className="m-0 text-[0.8rem] text-slate-500">{numeroContrato(contrato)} · {contrato.faena?.nombre} — preparados para subirlos a la plataforma del mandante</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-5">
            <div className="flex-1 min-w-0">
              <div className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-500 mb-2">1 · Plataforma de destino</div>
              <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-label="Plataforma de destino">
                {plataformas.length === 0 && <span className="text-[0.8rem] text-slate-400">Sin plataformas en este contrato.</span>}
                {plataformas.map((p) => (
                  <button
                    key={p.id}
                    role="radio"
                    aria-checked={plat === p.nombre}
                    onClick={() => setPlat(p.nombre)}
                    className={`px-3.5 py-1.5 rounded-full border text-[0.8rem] font-semibold transition-colors ${
                      plat === p.nombre ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>
              {plat && subidas[plat] && (
                <div className="mt-2 text-[0.75rem] font-semibold text-emerald-700">
                  ✓ Subido a {plat} el {new Date(subidas[plat]).toLocaleString("es-CL")}
                </div>
              )}

              <div className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">2 · Qué exportar</div>
              <div className="flex flex-col gap-2">
                {SECCIONES.map((s) => (
                  <div key={s.k} className={on[s.k] ? "" : "opacity-55"}>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 m-0 font-bold text-slate-800 text-[0.85rem] min-w-[140px] cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-auto"
                          checked={on[s.k]}
                          onChange={(e) => setOn((p) => ({ ...p, [s.k]: e.target.checked }))}
                        />
                        {s.icono} {s.t}
                      </label>
                      <select
                        aria-label={`Formato de ${s.t}`}
                        value={fmt[s.k]}
                        disabled={!on[s.k]}
                        onChange={(e) => setFmt((p) => ({ ...p, [s.k]: e.target.value as "excel" | "csv" }))}
                        className="flex-1 h-9 px-2 border border-slate-300 rounded-lg text-[0.8rem] bg-white outline-none"
                      >
                        <option value="excel">📊 Excel (.xlsx)</option>
                        <option value="csv">📝 CSV</option>
                      </select>
                    </div>
                    <div className="text-[0.72rem] text-slate-500 mt-0.5 ml-6">{on[s.k] ? `${s.d} · ${conteo[s.k]} registros` : "No se incluye"}</div>
                  </div>
                ))}
                <label className={`flex items-center gap-2 m-0 font-bold text-slate-800 text-[0.85rem] cursor-pointer ${conResumen ? "" : "opacity-55"}`}>
                  <input
                    type="checkbox"
                    className="w-auto"
                    checked={conResumen}
                    onChange={(e) => setConResumen(e.target.checked)}
                  />
                  📕 Resumen PDF
                </label>
                <div className="text-[0.72rem] text-slate-500 mt-0.5 ml-6">{conResumen ? "Estado del contrato en PDF ejecutivo (vía reportes)" : "No se incluye"}</div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-500 mb-2">Vista previa del archivo</div>
              <div className="rounded-xl bg-slate-900 text-slate-200 font-mono text-[0.72rem] leading-relaxed p-3.5 max-h-[300px] overflow-auto">
                {elegidas.length === 0 && <div className="text-slate-400">Nada seleccionado.</div>}
                {elegidas.length > 0 && <div className="font-bold text-white mb-1">🗜️ {raiz}.zip</div>}
                {elegidas.map((s, i) => (
                  <div key={s.k} className="pl-4 truncate">
                    📄 {String(i + 1).padStart(2, "0")}_{s.t}/{numeroContrato(contrato)}_{s.k}.{fmt[s.k] === "excel" ? "xlsx" : "csv"}
                  </div>
                ))}
                {conResumen && (
                  <div className="pl-4 truncate">
                    📕 {String(elegidas.length + 1).padStart(2, "0")}_Resumen/{numeroContrato(contrato)}_resumen.pdf
                  </div>
                )}
              </div>
              <div className="flex gap-2.5 mt-2.5 flex-wrap">
                <div className="flex-1 min-w-[90px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-center">
                  <b className="block text-[1.15rem] text-slate-800 leading-tight">{conteo.documentos + conteo.personal + conteo.equipos}</b>
                  <span className="text-[0.68rem] text-slate-500">registros</span>
                </div>
                <div className="flex-1 min-w-[90px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-center">
                  <b className="block text-[1.15rem] text-slate-800 leading-tight">{elegidas.length + (conResumen ? 1 : 0)}</b>
                  <span className="text-[0.68rem] text-slate-500">archivos</span>
                </div>
                <div className="flex-1 min-w-[90px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-center">
                  <b className="block text-[1.15rem] text-slate-800 leading-tight">{SECCIONES.length - elegidas.length}</b>
                  <span className="text-[0.68rem] text-slate-500">excluidos</span>
                </div>
              </div>
              {error && (
                <div role="alert" className="mt-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.82rem] text-red-700">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3.5 border-t border-slate-200">
            <button
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={cerrar}
            >
              Cancelar
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              onClick={ejecutar}
              disabled={!elegidas.length && !conResumen}
            >
              ↓ Exportar {elegidas.length + (conResumen ? 1 : 0)} archivo{elegidas.length + (conResumen ? 1 : 0) === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {paso === "run" && (
        <div className="text-center px-2.5 py-6">
          <div className="text-[2rem]" aria-hidden="true">📦</div>
          <h3 className="my-2 text-[1.05rem] font-bold text-slate-900">Preparando la exportación…</h3>
          <div className="text-[0.85rem] text-slate-500">{msg || `Ordenando documentos para ${plat || "la plataforma"}`}</div>
          <div className="h-2 bg-slate-200 rounded-full my-4 mx-auto max-w-[380px] overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${prog}%` }} />
          </div>
        </div>
      )}

      {paso === "done" && (
        <div className="text-center px-2.5 py-5">
          <div aria-hidden="true" className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center text-[1.6rem] mx-auto">✓</div>
          <h3 className="my-2.5 text-[1.05rem] font-bold text-slate-900">Exportación lista</h3>
          <p className="m-0 text-[0.85rem] text-slate-500">
            Se generaron <b>{archivos.length} archivos</b>. Súbelos a <b>{plat || "la plataforma del mandante"}</b> en orden.
          </p>
          <div className="flex flex-col gap-1.5 mt-4 text-left">
            {archivos.map((a) => (
              <a
                key={a.sec}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[0.82rem] font-semibold text-blue-700 hover:bg-blue-50"
              >
                <span aria-hidden="true">📄</span> {a.nombre}
                <span className="ml-auto text-[0.75rem]">↓ Descargar</span>
              </a>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            <button
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={() => setPaso("cfg")}
            >
              ← Volver
            </button>
            <button
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              onClick={bajarZip}
              disabled={bajandoZip || !archivos.length}
            >
              {bajandoZip ? "Comprimiendo..." : `🗜️ Descargar todo (.zip)`}
            </button>
            {pidDePlataforma() && (
              <button
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                onClick={marcarSubido}
                disabled={marcando}
              >
                {marcando ? "Marcando..." : `✓ Marcar como subido a ${plat}`}
              </button>
            )}
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
              onClick={cerrar}
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
