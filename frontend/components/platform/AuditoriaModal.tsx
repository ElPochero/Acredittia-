"use client";

import React, { useState, useEffect } from "react";
import type { PeriodoDocumento, AuditoriaDocumento, PeriodoDocumentoVersionItem } from "@/lib/platform/tipos";
import { Modal, Chip } from "@/components/shared/ui";
import * as Api from "@/lib/platform/cliente";

interface AuditoriaModalProps {
  abierto: boolean;
  onCerrar: () => void;
  periodoId?: string;
  doc?: PeriodoDocumento | null;
  sujetoNombre?: string;
  sujetoRut?: string;
  requisitoNombre?: string;
  onSubirDocumento?: (file: File) => Promise<void>;
  onAuditar?: (accion: "aprobar" | "observar" | "rechazar" | "no_aplica", observacion?: string) => Promise<void>;
  historial?: AuditoriaDocumento[];
  periodoCerrado?: boolean;
}

export default function AuditoriaModal({
  abierto,
  onCerrar,
  periodoId,
  doc,
  sujetoNombre,
  sujetoRut,
  requisitoNombre,
  onSubirDocumento,
  onAuditar,
  historial = [],
  periodoCerrado = false,
}: AuditoriaModalProps) {
  const [observacion, setObservacion] = useState("");
  const [accionSeleccionada, setAccionSeleccionada] = useState<"observar" | "rechazar" | null>(null);
  const [cargando, setCargando] = useState(false);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [versiones, setVersiones] = useState<PeriodoDocumentoVersionItem[]>([]);
  const [cargandoVersiones, setCargandoVersiones] = useState(false);
  const [acordeonVersionesAbierto, setAcordeonVersionesAbierto] = useState(true);

  const nombreTrabajador = doc?.sujeto_nombre || sujetoNombre || "Documento General";
  const rutTrabajador = doc?.sujeto_rut || sujetoRut || "";
  const nombreDoc = doc?.requisito_nombre || requisitoNombre || "Requisito Laboral";
  const estadoActual = doc?.estado || "pendiente";

  // Cargar historial de versiones reales
  useEffect(() => {
    if (!abierto || !doc?.id || !periodoId) {
      setVersiones([]);
      setAccionSeleccionada(null);
      setObservacion("");
      setErrorMsg(null);
      return;
    }

    let cancelado = false;
    setCargandoVersiones(true);

    Api.certificacion
      .listarVersiones(periodoId, doc.id)
      .then((res) => {
        if (!cancelado) {
          setVersiones(res || []);
        }
      })
      .catch((err) => {
        console.error("Error al cargar versiones del documento:", err);
      })
      .finally(() => {
        if (!cancelado) setCargandoVersiones(false);
      });

    return () => {
      cancelado = true;
    };
  }, [abierto, doc?.id, periodoId]);

  if (!abierto) return null;

  const handleVerArchivo = async () => {
    if (!doc?.archivo_url) return;
    if (periodoId && doc.id) {
      try {
        await Api.certificacion.marcarDocumentoVisto(periodoId, doc.id);
      } catch (err) {
        console.warn("No se pudo marcar como visto por ADC:", err);
      }
    }
    window.open(doc.archivo_url, "_blank");
  };

  const handleSubir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoSeleccionado || !onSubirDocumento) return;
    setCargando(true);
    setErrorMsg(null);
    try {
      await onSubirDocumento(archivoSeleccionado);
      setArchivoSeleccionado(null);
      alert("Documento subido correctamente. Ha quedado en estado 'En revisión'.");
      onCerrar();
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al subir documento");
    } finally {
      setCargando(false);
    }
  };

  const handleEjecutarAccion = async (accion: "aprobar" | "observar" | "rechazar" | "no_aplica") => {
    if ((accion === "observar" || accion === "rechazar") && !observacion.trim()) {
      setAccionSeleccionada(accion);
      setErrorMsg(`El comentario es obligatorio para ${accion} el documento. Se notificará a RR.HH.`);
      return;
    }

    setErrorMsg(null);
    setCargando(true);
    try {
      if (onAuditar) {
        await onAuditar(accion, observacion.trim());
      }
      setObservacion("");
      setAccionSeleccionada(null);
      onCerrar();
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al auditar documento");
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Revisión & Auditoría de Documento (ADC)"
      onCerrar={onCerrar}
      ancho="max-w-3xl"
    >
      <div className="space-y-6 text-slate-800">
        {/* Banner de Período Cerrado */}
        {periodoCerrado && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 flex items-center gap-2">
            <span>🔒</span>
            <span>
              Este período se encuentra <strong>cerrado</strong> formalmente. La auditoría y los archivos son inmutables.
            </span>
          </div>
        )}

        {/* Ficha del Documento */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                {nombreDoc}
              </span>
              <h4 className="text-base font-bold text-slate-900">{nombreTrabajador}</h4>
              {rutTrabajador && <p className="text-xs font-mono text-slate-500">RUT: {rutTrabajador}</p>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Chip estado={estadoActual} texto={estadoActual} />
              <span className="text-[11px] font-mono text-slate-500">
                Versión: v{doc?.version || 1}
              </span>
            </div>
          </div>

          {doc?.observaciones && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-900">
              <span className="font-bold">📝 Última observación ADC: </span>
              <span>{doc.observaciones}</span>
            </div>
          )}

          {doc?.archivo_url ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-slate-600">
                <span>📎 Archivo entregado:</span>
                <span className="font-semibold text-slate-800">
                  v{doc.version || 1} {doc.abierto_por_adc ? "• 👁 Visto por ADC" : "• ⏳ No abierto"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleVerArchivo}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                <span>👁 Ver / Descargar archivo</span>
              </button>
            </div>
          ) : (
            <div className="mt-3 border-t border-slate-200/60 pt-3 text-xs italic text-slate-400">
              No hay archivo subido para este requisito en la versión actual.
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Sección: Evaluación del Auditor ADC */}
        {!periodoCerrado && (
          <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span>🔍</span> Dictamen de Revisión ADC (CA 11)
              </h5>
              <span className="text-[11px] text-slate-500">
                RR.HH. y ADC ven el estado actualizado en tiempo real
              </span>
            </div>

            {/* Modal/Caja de comentario obligatorio (#cl-obs) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Comentario u Observación para RR.HH. {accionSeleccionada ? `(Obligatorio para ${accionSeleccionada})` : "(Opcional para aprobar)"}:
              </label>
              <textarea
                id="cl-obs"
                rows={3}
                placeholder="Escriba las observaciones detalladas que el Encargado de RR.HH. debe corregir en su entrega..."
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                className={`w-full rounded-xl border p-3 text-xs text-slate-800 placeholder-slate-400 transition focus:outline-none focus:ring-1 ${
                  accionSeleccionada && !observacion.trim()
                    ? "border-amber-400 bg-amber-50/30 focus:ring-amber-500"
                    : "border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                }`}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                ℹ️ Al observar o rechazar, el Encargado de RR.HH. recibirá una notificación y verá el comentario en su bandeja <strong>Mis pendientes</strong>.
              </p>
            </div>

            {/* Botones de Dictamen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleEjecutarAccion("aprobar")}
                disabled={cargando}
                className="cl-b ok w-full py-2.5 text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
              >
                ✓ Aprobar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccionSeleccionada("observar");
                  if (!observacion.trim()) {
                    setErrorMsg("Por favor, ingrese el motivo obligatorio de la observación en el cuadro de texto.");
                  } else {
                    handleEjecutarAccion("observar");
                  }
                }}
                disabled={cargando}
                className="cl-b ob w-full py-2.5 text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
              >
                📝 Observar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccionSeleccionada("rechazar");
                  if (!observacion.trim()) {
                    setErrorMsg("Por favor, ingrese el motivo obligatorio del rechazo en el cuadro de texto.");
                  } else {
                    handleEjecutarAccion("rechazar");
                  }
                }}
                disabled={cargando}
                className="cl-b re w-full py-2.5 text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
              >
                ⛔ Rechazar
              </button>
              <button
                type="button"
                onClick={() => handleEjecutarAccion("no_aplica")}
                disabled={cargando}
                className="rounded-xl border border-slate-300 bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition shadow-sm disabled:opacity-50"
              >
                ⚪ No aplica
              </button>
            </div>
          </div>
        )}

        {/* Sección: Historial de Versiones de Entrega (Sección 4.4, CA 9) */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setAcordeonVersionesAbierto(!acordeonVersionesAbierto)}
            className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 transition text-left"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>📚</span> Historial de Versiones de Entrega ({versiones.length > 0 ? versiones.length : doc?.version || 1})
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {acordeonVersionesAbierto ? "▲ Ocultar" : "▼ Desplegar"}
            </span>
          </button>

          {acordeonVersionesAbierto && (
            <div className="p-4 space-y-3">
              {cargandoVersiones ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  Cargando versiones del documento...
                </div>
              ) : versiones.length === 0 ? (
                <div className="py-2 text-center text-xs text-slate-400 italic">
                  Solo existe la versión actual (v{doc?.version || 1}).
                </div>
              ) : (
                <div className="space-y-3">
                  {versiones.map((v) => (
                    <div
                      key={v.id}
                      className={`rounded-xl border p-3 text-xs transition ${
                        v.version === (doc?.version || 1)
                          ? "border-blue-200 bg-blue-50/30"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-slate-200 px-2 py-0.5 font-bold font-mono text-[11px] text-slate-800">
                            v{v.version}
                          </span>
                          <Chip estado={v.estado} texto={v.estado} />
                          {v.version === (doc?.version || 1) && (
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                              Entrega actual
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {v.fecha_carga ? `Subido el ${v.fecha_carga.replace("T", " ").slice(0, 16)}` : ""}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 my-1">
                        <div>
                          <span className="font-medium text-slate-500">Subido por: </span>
                          <span className="font-semibold text-slate-800">
                            {v.subido_por_nombre || v.cargado_por || "Encargado RR.HH."}
                          </span>
                        </div>
                        {v.revisado_por_nombre && (
                          <div>
                            <span className="font-medium text-slate-500">Revisado por: </span>
                            <span className="font-semibold text-slate-800">
                              {v.revisado_por_nombre}
                            </span>
                          </div>
                        )}
                      </div>

                      {v.observaciones && (
                        <div className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-900 border border-amber-100 italic">
                          " {v.observaciones} "
                        </div>
                      )}

                      {v.archivo_url && (
                        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                          <span className="text-[11px] text-slate-500">
                            {v.abierto_por_adc ? "👁 Revisado por ADC" : "⏳ No abierto por ADC"}
                          </span>
                          <a
                            href={v.archivo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-blue-600 hover:underline"
                          >
                            Descargar archivo v{v.version} ↗
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sección: Carga Directa (Para RR.HH.) */}
        {!periodoCerrado && onSubirDocumento && (
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
            <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>📤</span> Subir Archivo o Corrección
            </h5>
            <p className="text-[11px] text-slate-500 mb-3">
              Si el documento ya fue revisado por ADC, subir un nuevo archivo creará automáticamente la <strong>versión {((doc?.version || 1) + 1)}</strong> conservando intactas las anteriores (CA 9).
            </p>
            <form onSubmit={handleSubir} className="space-y-3">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setArchivoSeleccionado(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              {archivoSeleccionado && (
                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full rounded-xl bg-blue-600 p-2.5 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  {cargando ? "Subiendo..." : "Confirmar Carga de Documento"}
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
}
