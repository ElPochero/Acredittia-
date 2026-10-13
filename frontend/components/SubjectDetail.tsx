"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Api from "@/lib/cliente";
import type {
  Archivo,
  Documento,
  Ejemplo,
  EstadoJob,
  Revision,
  SujetoDetalle,
} from "@/lib/tipos";
import { Barra, Chip, Modal, Spinner } from "./ui";

/**
 * Expediente de un trabajador o de un equipo.
 *
 * Concentra el flujo nuevo de archivos (§6 de RUPTURAS): la subida son tres
 * pasos con SAS y la revisión IA es asíncrona, así que tras subir el documento
 * sigue en `falta` y hay que sondear el job antes de saber el veredicto. La
 * pantalla lo refleja con dos estados distintos: «Subiendo» y «Analizando».
 */
const ICONO_HALLAZGO: Record<string, string> = {
  error: "⛔",
  warning: "⚠️",
  info: "✅",
};

type Subiendo = { docId: string; pct: number; texto: string };
type Analizando = { docId: string; titulo: string; status: EstadoJob };

function FilaDoc({
  doc,
  subiendo,
  analizando,
  onSubir,
  onToggle,
  onEjemplo,
  onDescargar,
}: {
  doc: Documento;
  subiendo: Subiendo | null;
  analizando: boolean;
  onSubir: (d: Documento, f: File) => void;
  onToggle: (d: Documento) => void;
  onEjemplo: (clave: string) => void;
  onDescargar: (d: Documento, a: Archivo) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ocupado = !!subiendo || analizando;
  
  const isOk = doc.estado_calc === 'ok';
  const borderColor = isOk ? 'border-emerald-400' : 'border-red-400';
  const iconBg = isOk ? 'bg-emerald-500' : 'bg-red-500';
  const iconColor = isOk ? 'text-emerald-500' : 'text-slate-400';
  
  return (
    <div className={`flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden border-l-4 ${borderColor}`}>
      <div className="p-4 pl-3 pb-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-4 h-4 rounded-full ${iconBg} text-white flex items-center justify-center shrink-0`}>
            {isOk ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[0.75rem] font-bold text-slate-800">
                {doc.titulo}
              </span>
              {doc.obligatorio ? (
                <span className="px-1.5 py-0.5 rounded text-[0.55rem] font-bold bg-red-50 text-red-600 border border-red-100 uppercase tracking-wider">Obligatorio</span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-[0.55rem] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">Opcional</span>
              )}
              {doc.plataforma && (
                <span className="text-[0.55rem] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded italic uppercase tracking-wider">
                  {doc.plataforma === 'siga' ? (
                    <span className="flex items-center gap-0.5"><span className="text-blue-400">((•))</span> SIGA</span>
                  ) : doc.plataforma}
                </span>
              )}
            </div>
            
            {doc.vence ? (
              <div className="text-[0.65rem] flex items-center gap-1 mt-1 mb-3">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconColor}><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span className={iconColor}>Vigente hasta {doc.vence}</span>
              </div>
            ) : (
              <div className="text-[0.65rem] flex items-center gap-1 mt-1 mb-3 text-slate-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <span>Sin fecha de vencimiento registrada</span>
              </div>
            )}
            
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <button 
                onClick={() => inputRef.current?.click()}
                disabled={ocupado}
                className="h-[26px] px-3 bg-[#EEF2FF] text-blue-700 rounded-md text-[0.65rem] font-bold hover:bg-[#E0E7FF] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                📎 Subir documento
              </button>
              
              {doc.archivos && doc.archivos.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-[26px] px-2.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-md text-[0.65rem] font-medium flex items-center justify-center gap-1.5">
                    📄 {doc.archivos[0].filename.length > 20 ? doc.archivos[0].filename.substring(0, 17) + '...' : doc.archivos[0].filename}
                  </div>
                  <button 
                    onClick={() => onDescargar(doc, doc.archivos![0])}
                    className="h-[26px] px-2.5 border border-blue-200 text-blue-600 rounded-md text-[0.65rem] font-bold hover:bg-blue-50 transition-colors flex items-center justify-center"
                  >
                    Ver documento
                  </button>
                  <button className="text-[0.65rem] font-bold text-red-500 hover:text-red-600 px-1">
                    Quitar
                  </button>
                </div>
              )}
              
              <div className="h-[26px] border border-slate-200 rounded-md text-[0.6rem] font-medium flex items-center overflow-hidden ml-auto">
                <span className="bg-slate-100 px-2 h-full flex items-center text-slate-500 border-r border-slate-200 uppercase tracking-wide text-[0.55rem] font-bold">SIGA:</span>
                <select className="bg-white h-full px-2 outline-none text-slate-600 cursor-pointer hover:bg-slate-50 appearance-none pr-6 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NDkzYjgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTUgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-[length:12px] bg-no-repeat bg-[right_6px_center]">
                  <option>Sin subir</option>
                  <option>Subido</option>
                </select>
              </div>
            </div>
            
            {subiendo && (
              <div className="mt-3 max-w-xs">
                <Barra pct={subiendo.pct} texto={subiendo.texto} />
              </div>
            )}
            {analizando && (
              <div className="mt-2 text-xs font-medium text-sky-700 bg-sky-50 p-2 rounded-md border border-sky-100 flex items-center gap-2">
                🤖 Analizando el documento con IA…
              </div>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSubir(doc, f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function SubjectDetail({
  tipo,
  id,
}: {
  tipo: "personal" | "equipos";
  id: string;
}) {
  const [data, setData] = useState<SujetoDetalle | null>(null);
  const [subiendo, setSubiendo] = useState<Subiendo | null>(null);
  const [analizando, setAnalizando] = useState<Analizando | null>(null);
  const [review, setReview] = useState<{ doc: string; r: Revision } | null>(
    null,
  );
  const [ejemplo, setEjemplo] = useState<Ejemplo | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(() => {
    const pedir =
      tipo === "personal" ? Api.personal.detalle : Api.equipos.detalle;
    pedir(id)
      .then(setData)
      .catch((e) => setError(Api.mensajeError(e)));
  }, [tipo, id]);
  useEffect(cargar, [cargar]);

  /**
   * Sube el archivo y espera el veredicto de la IA.
   *
   * El documento sigue en `falta` en la respuesta de la subida: se recarga el
   * expediente dos veces, una al confirmar el archivo y otra cuando el job
   * termina y ya se aplicó la acción (marcar ok, autocompletar el vencimiento).
   */
  const subir = async (doc: Documento, file: File) => {
    setError("");
    setAviso("");
    setSubiendo({ docId: doc.id, pct: 0, texto: "Preparando la subida…" });
    let jobId = "";
    try {
      const res = await Api.subirDocumento(doc.id, file, (pct, etapa) => {
        const texto =
          etapa === "firmando"
            ? "Preparando la subida…"
            : etapa === "subiendo"
              ? "Subiendo el archivo…"
              : etapa === "confirmando"
                ? "Registrando el archivo…"
                : "Listo";
        setSubiendo({ docId: doc.id, pct, texto });
      });
      jobId = res.job_id;
      cargar();
    } catch (e) {
      setError(Api.mensajeError(e));
      return;
    } finally {
      setSubiendo(null);
    }

    setAnalizando({ docId: doc.id, titulo: doc.titulo, status: "queued" });
    try {
      const r = await Api.esperarRevision(jobId, {
        onEstado: (parcial) =>
          setAnalizando({
            docId: doc.id,
            titulo: doc.titulo,
            status: parcial.status,
          }),
      });
      setReview({ doc: doc.titulo, r });
      cargar();
    } catch (e) {
      // El job sigue vivo en el servidor: no es un fallo de la subida.
      if (Api.esApiError(e) && e.code === "REVISION_TIMEOUT")
        setAviso(e.message);
      else setError(Api.mensajeError(e));
    } finally {
      setAnalizando(null);
    }
  };

  const toggle = async (doc: Documento) => {
    setError("");
    try {
      const actualizado = await Api.documentos.editar(doc.id, {
        estado: doc.estado === "ok" ? "falta" : "ok",
      });
      if (actualizado.vence_derivado) {
        setAviso(
          actualizado.nota ??
            `El vencimiento se derivó de la plantilla: ${actualizado.vence}`,
        );
      }
      cargar();
    } catch (e) {
      setError(Api.mensajeError(e));
    }
  };

  const verEjemplo = async (clave: string) => {
    try {
      setEjemplo(await Api.catalogo.ejemplo(clave));
    } catch (e) {
      setError(Api.mensajeError(e));
    }
  };

  const descargar = async (doc: Documento, a: Archivo) => {
    setError("");
    try {
      await Api.descargarArchivo(doc.id, a.id);
    } catch (e) {
      setError(Api.mensajeError(e));
    }
  };

  if (error && !data) return <p className="p-6 text-red-600">{error}</p>;
  if (!data) return <Spinner />;

  const esTrabajador = tipo === "personal";
  const fila = (d: Documento) => (
    <FilaDoc
      key={d.id}
      doc={d}
      subiendo={subiendo?.docId === d.id ? subiendo : null}
      analizando={analizando?.docId === d.id}
      onSubir={subir}
      onToggle={toggle}
      onEjemplo={verEjemplo}
      onDescargar={descargar}
    />
  );

  return (
    <div className="w-full mx-auto pb-10">
      <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#3B82F6] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm shrink-0">
            {data.nombre.split(' ').slice(0,2).map(n => n[0]).join('')}
          </div>
          <div>
            <h1 className="text-[1.1rem] font-bold text-slate-800 flex items-center gap-2">
              {data.nombre}
            </h1>
            <div className="text-[0.75rem] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
              <span>{data.rut}</span>
              {data.email && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>{data.email}</span>
                </>
              )}
              {data.telefono && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>{data.telefono}</span>
                </>
              )}
              <span className="text-slate-300">•</span>
              <span>{data.cargo || 'Sin cargo'}</span>
              {esTrabajador && (data.licencia_interna || data.cargo?.toLowerCase().includes('conductor')) && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                    Conductor
                  </span>
                </>
              )}
            </div>
            <div className="text-[0.7rem] mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                {data.contrato.faena}
              </span>
              <span className="text-slate-400">· {data.contrato.nombre}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end justify-center mr-2">
          <div className="text-[1.8rem] font-black text-emerald-500 leading-none">{data.stats.cumplimiento_pct}%</div>
          <div className="text-[0.65rem] text-slate-400 font-bold mt-1 tracking-wide">{data.documentos.filter(d=>d.estado_calc==='ok').length + data.documentos_emsipor.filter(d=>d.estado_calc==='ok').length} de {data.documentos.length + data.documentos_emsipor.length} al día</div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 mb-5 border border-red-200">
          {error}
        </p>
      )}
      {aviso && (
        <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800 mb-5 border border-sky-200">
          <span>ℹ️</span>
          <span className="flex-1">{aviso}</span>
          <button
            className="text-sky-600 underline font-medium"
            onClick={() => setAviso("")}
          >
            cerrar
          </button>
        </p>
      )}

      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl overflow-hidden shadow-sm mb-5 border border-slate-700">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-0.5">
            <div className="w-7 h-7 rounded bg-indigo-500/20 text-indigo-400 font-bold text-[0.65rem] flex items-center justify-center shrink-0 border border-indigo-500/30">
              IA
            </div>
            <h2 className="text-[0.8rem] font-bold text-white">
              Diagnóstico de acreditación · {data.contrato.faena}
            </h2>
          </div>
          <p className="text-[0.65rem] text-slate-400 ml-10 mb-3">Documentos exigidos por el estándar de esta faena</p>
          
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-3 py-2.5 flex items-center gap-2 ml-10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span className="text-[0.7rem] font-medium text-emerald-100">Este trabajador está completamente al día. No requiere acción.</span>
          </div>
        </div>
      </div>

      {esTrabajador && data.licencia_interna && data.documentos_emsipor.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-[#EEF5FF] shadow-sm mb-5 overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1e3a8a] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-inner">
                  EM
                </div>
                <div>
                  <h2 className="text-[0.8rem] font-bold text-blue-950 flex items-center gap-2">
                    EMSIPOR · Licencia Interna Mina
                  </h2>
                  <p className="text-[0.65rem] text-blue-600 mt-0.5">Requerido para conductores en {data.contrato.faena}</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                Vigente
              </span>
            </div>
            
            <div className="ml-11 flex items-center gap-10 mb-4">
              <div>
                <div className="text-[0.6rem] font-bold text-blue-800 uppercase tracking-wider mb-0.5">N° LIM</div>
                <div className="text-[0.75rem] font-bold text-slate-700">{data.licencia_interna.numero || 'LTM-2025-0412'}</div>
                <div className="text-[0.65rem] text-slate-500 mt-0.5">Vence: {data.licencia_interna.vence ?? "2027-03-15"}</div>
              </div>
              <div className="flex-1 max-w-[220px]">
                <div className="flex justify-between items-end mb-1">
                  <div className="text-[0.6rem] font-bold text-blue-800 uppercase tracking-wider">Proceso EMSIPOR</div>
                  <div className="text-[0.65rem] font-bold text-slate-700 text-right">{data.documentos_emsipor.filter(d=>d.estado_calc==='ok').length}/{data.documentos_emsipor.length} docs</div>
                </div>
                <div className="h-1.5 w-full bg-blue-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-700 rounded-full transition-all" style={{width: `${(data.documentos_emsipor.filter(d=>d.estado_calc==='ok').length / data.documentos_emsipor.length) * 100}%`}}></div>
                </div>
              </div>
            </div>
            
            <details className="ml-11 group cursor-pointer outline-none">
              <summary className="text-[0.7rem] font-bold text-blue-800 flex items-center gap-1 hover:text-blue-600 list-none">
                <span className="transition-transform group-open:rotate-90 text-[0.6rem]">▶</span> Ver documentos EMSIPOR ({data.documentos_emsipor.length} requeridos)
              </summary>
              <div className="mt-4 flex flex-col gap-3 pb-2 cursor-default">
                {data.documentos_emsipor.map(fila)}
              </div>
            </details>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-[0.8rem] font-bold text-slate-800 mb-3 px-1">
          Documentos requeridos en {data.contrato.faena}
        </h2>
        <div className="flex flex-col gap-3">
          {data.documentos.map(fila)}
        </div>
      </div>

      <Modal
        abierto={!!review}
        titulo={`Revisión IA — ${review?.doc}`}
        onCerrar={() => setReview(null)}
      >
        {review && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {review.r.status === "failed" ? (
                <Chip estado="failed" texto="La revisión falló" />
              ) : (
                <Chip
                  estado={
                    review.r.resultado === "validado"
                      ? "ok"
                      : review.r.resultado === "con_errores"
                        ? "venc"
                        : "porvenc"
                  }
                  texto={
                    review.r.resultado === "validado"
                      ? "Validado"
                      : review.r.resultado === "con_errores"
                        ? "Con errores"
                        : "Con observaciones"
                  }
                />
              )}
              {review.r.confianza != null && (
                <span className="text-sm text-slate-500">
                  Confianza: {(review.r.confianza * 100).toFixed(0)}%
                </span>
              )}
            </div>
            {review.r.accion_aplicada && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Acción aplicada: {review.r.accion_aplicada}
              </p>
            )}
            {review.r.error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {review.r.error}
              </p>
            )}
            <ul className="space-y-2">
              {review.r.hallazgos.map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>{ICONO_HALLAZGO[h.tipo]}</span>
                  <div>
                    <div className="font-mono text-xs text-slate-400">
                      {h.codigo}
                    </div>
                    {h.mensaje}
                  </div>
                </li>
              ))}
            </ul>
            <button
              className="btn-primary w-full"
              onClick={() => setReview(null)}
            >
              Entendido
            </button>
          </div>
        )}
      </Modal>

      <Modal
        abierto={!!ejemplo}
        titulo={ejemplo?.nombre ?? ""}
        onCerrar={() => setEjemplo(null)}
      >
        {ejemplo && (
          <div className="space-y-3 text-sm">
            {ejemplo.referencia && (
              <p className="text-slate-500">Referencia: {ejemplo.referencia}</p>
            )}
            {ejemplo.campos_clave && ejemplo.campos_clave.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="mb-2 font-semibold text-slate-700">
                  Campos clave que valida la IA:
                </div>
                {ejemplo.campos_clave.map(([k, v], i) => (
                  <div
                    key={i}
                    className="flex justify-between border-b border-slate-200 py-1 last:border-0"
                  >
                    <span className="font-medium">{k}</span>
                    <span className="text-slate-500">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {ejemplo.notas && ejemplo.notas.length > 0 && (
              <ul className="list-inside list-disc text-slate-600">
                {ejemplo.notas.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            {ejemplo.pdf_url && (
              <a
                className="btn-ghost inline-block"
                href={ejemplo.pdf_url}
                target="_blank"
                rel="noopener"
              >
                Ver documento de ejemplo ↗
              </a>
            )}
            {ejemplo.tip && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                💡 {ejemplo.tip}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
