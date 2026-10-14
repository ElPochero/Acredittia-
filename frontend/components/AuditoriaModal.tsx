"use client";
import React, { useState } from "react";
import type { PeriodoDocumento, AuditoriaDocumento } from "@/lib/tipos";
import { Modal, Chip } from "@/components/ui";

interface AuditoriaModalProps {
  abierto: boolean;
  onCerrar: () => void;
  doc?: PeriodoDocumento | null;
  sujetoNombre?: string;
  sujetoRut?: string;
  requisitoNombre?: string;
  onSubirDocumento?: (file: File) => Promise<void>;
  onAuditar?: (accion: "aprobar" | "observar" | "rechazar", observacion?: string) => Promise<void>;
  historial?: AuditoriaDocumento[];
}

export default function AuditoriaModal({
  abierto,
  onCerrar,
  doc,
  sujetoNombre,
  sujetoRut,
  requisitoNombre,
  onSubirDocumento,
  onAuditar,
  historial = [],
}: AuditoriaModalProps) {
  const [observacion, setObservacion] = useState("");
  const [cargando, setCargando] = useState(false);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!abierto) return null;

  const nombreTrabajador = doc?.sujeto_nombre || sujetoNombre || "Trabajador";
  const rutTrabajador = doc?.sujeto_rut || sujetoRut || "";
  const nombreDoc = doc?.requisito_nombre || requisitoNombre || "Documento Requerido";
  const estadoActual = doc?.estado || "pendiente";

  const handleSubir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoSeleccionado || !onSubirDocumento) return;
    setCargando(true);
    setErrorMsg(null);
    try {
      await onSubirDocumento(archivoSeleccionado);
      setArchivoSeleccionado(null);
      alert("Documento subido correctamente.");
    } catch (err: any) {
      setErrorMsg(err?.message || "Error al subir documento");
    } finally {
      setCargando(false);
    }
  };

  const handleAccionAuditoria = async (accion: "aprobar" | "observar" | "rechazar") => {
    if ((accion === "observar" || accion === "rechazar") && !observacion.trim()) {
      setErrorMsg(`Para ${accion === "observar" ? "observar" : "rechazar"}, debes ingresar el motivo en la observación.`);
      return;
    }
    setErrorMsg(null);
    setCargando(true);
    try {
      if (onAuditar) {
        await onAuditar(accion, observacion.trim());
      }
      setObservacion("");
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
      titulo="Revisión & Auditoría de Documento"
      onCerrar={onCerrar}
      ancho="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Document & Worker Context Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">
                {nombreDoc}
              </span>
              <h4 className="text-base font-bold text-slate-900">{nombreTrabajador}</h4>
              {rutTrabajador && <p className="text-xs font-mono text-slate-500">RUT: {rutTrabajador}</p>}
            </div>
            <Chip estado={estadoActual} />
          </div>

          {doc?.archivo_url && (
            <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs">
              <span className="font-medium text-slate-600">
                📎 Archivo cargado (v{doc.version || 1})
              </span>
              <a
                href={doc.archivo_url}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-cyan-600 hover:underline"
              >
                Ver / Descargar PDF ↗
              </a>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Section 1: Upload / Replace Document */}
        <div className="rounded-xl border border-slate-200 p-4">
          <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            📤 Subir o Reemplazar Documento
          </h5>
          <form onSubmit={handleSubir} className="space-y-3">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setArchivoSeleccionado(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
            {archivoSeleccionado && (
              <button
                type="submit"
                disabled={cargando}
                className="w-full rounded-xl bg-cyan-600 p-2.5 text-xs font-bold text-white transition hover:bg-cyan-700 disabled:opacity-50"
              >
                {cargando ? "Subiendo..." : "Confirmar Carga de Documento"}
              </button>
            )}
          </form>
        </div>

        {/* Section 2: Audit Controls (Auditor Actions) */}
        <div className="rounded-xl border border-slate-200 p-4">
          <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700">
            🔍 Evaluación del Auditor
          </h5>

          <textarea
            rows={3}
            placeholder="Escribe observaciones, correcciones requeridas o notas de aprobación..."
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className="mb-3 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:border-cyan-500 focus:outline-none"
          />

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleAccionAuditoria("aprobar")}
              disabled={cargando}
              className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
            >
              ✅ Aprobar
            </button>
            <button
              onClick={() => handleAccionAuditoria("observar")}
              disabled={cargando}
              className="rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-amber-600 disabled:opacity-50 shadow-sm"
            >
              ⚠️ Observar
            </button>
            <button
              onClick={() => handleAccionAuditoria("rechazar")}
              disabled={cargando}
              className="rounded-xl bg-rose-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-50 shadow-sm"
            >
              ❌ Rechazar
            </button>
          </div>
        </div>

        {/* Section 3: Revision History Timeline */}
        <div>
          <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">
            📜 Historial de Revisiones y Trazabilidad
          </h5>

          {historial.length === 0 ? (
            <p className="text-center text-xs text-slate-400 italic py-2">
              No hay revisiones anteriores para este documento.
            </p>
          ) : (
            <div className="relative border-l-2 border-slate-200 pl-4 space-y-4 text-xs">
              {historial.map((item) => (
                <div key={item.id} className="relative">
                  {/* Circle Marker */}
                  <span className="absolute -left-[21px] top-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-600 ring-4 ring-white" />

                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-semibold text-slate-800">{item.auditor_nombre}</span>
                    <span className="text-[10px]">{item.fecha}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold uppercase text-[10px] text-slate-700">
                      {item.accion} (v{item.version})
                    </span>
                  </div>
                  {item.observacion && (
                    <p className="mt-1.5 rounded-lg bg-slate-50 p-2.5 text-slate-700 italic border border-slate-100">
                      "{item.observacion}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
