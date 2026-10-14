"use client";
import React, { useState } from "react";
import { Modal, Spinner } from "@/components/ui";
import { Contrato } from "@/lib/tipos";
import * as Api from "@/lib/cliente";
import { numeroContrato } from "./ContratoLayout";

interface ReporteContratoModalProps {
  abierto: boolean;
  onCerrar: () => void;
  contrato: Contrato | null;
}

type Fase = "idle" | "generando" | "listo" | "error";

export function ReporteContratoModal({ abierto, onCerrar, contrato }: ReporteContratoModalProps) {
  const [formato, setFormato] = useState<"pdf" | "excel">("pdf");
  const [fase, setFase] = useState<Fase>("idle");
  const [detalle, setDetalle] = useState("");
  const [url, setUrl] = useState<string | null>(null);

  if (!contrato) return null;

  const cerrar = () => {
    setFase("idle");
    setDetalle("");
    setUrl(null);
    onCerrar();
  };

  const generar = async () => {
    setFase("generando");
    setDetalle("Encolando el reporte...");
    setUrl(null);
    try {
      const job = await Api.reportes.crear({
        tipo: "cumplimiento_requisitos",
        formato,
        params: { contrato_id: contrato.id },
        nombre: `Reporte ${contrato.nombre}`,
      });
      setDetalle("Generando... (en cola)");
      const downloadUrl = await Api.reportes.esperarDescarga(job.id);
      setUrl(downloadUrl);
      setFase("listo");
      setDetalle("Reporte listo para descargar.");
    } catch (e) {
      setFase("error");
      setDetalle(Api.mensajeError(e));
    }
  };

  return (
    <Modal abierto={abierto} onCerrar={cerrar} titulo={`Reporte de estado — ${contrato.nombre}`} ancho="max-w-md">
      <p className="-mt-2 mb-4 text-[0.85rem] text-slate-500">
        {numeroContrato(contrato)} · Empresa, personal, equipos, licencia interna y vencimientos.
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-[0.8rem] font-bold text-slate-700">Formato de exportación:</span>
        <div className="flex gap-2" role="radiogroup" aria-label="Formato">
          {(
            [
              { v: "pdf", t: "PDF (Ejecutivo)", icono: "📄", on: "border-red-500 bg-red-50 text-red-700" },
              { v: "excel", t: "Excel (Detallado)", icono: "📊", on: "border-emerald-500 bg-emerald-50 text-emerald-700" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              role="radio"
              aria-checked={formato === o.v}
              onClick={() => setFormato(o.v)}
              disabled={fase === "generando"}
              className={`flex-1 flex flex-col items-center justify-center p-4 border rounded-xl gap-2 transition-all disabled:opacity-60 ${
                formato === o.v ? o.on + " shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">{o.icono}</span>
              <span className="text-[0.8rem] font-bold">{o.t}</span>
            </button>
          ))}
        </div>
      </div>

      {(fase === "generando" || fase === "error" || fase === "listo") && (
        <div
          role="status"
          className={`mt-3 rounded-xl border px-4 py-3 text-[0.85rem] flex items-center gap-3 ${
            fase === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {fase === "generando" && <Spinner texto={detalle} />}
          {fase !== "generando" && detalle}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          onClick={cerrar}
        >
          {fase === "listo" ? "Cerrar" : "Cancelar"}
        </button>
        {fase === "listo" && url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors inline-flex items-center gap-2"
          >
            ↓ Descargar {formato === "pdf" ? "PDF" : "Excel"}
          </a>
        ) : (
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            onClick={generar}
            disabled={fase === "generando"}
          >
            {fase === "generando" ? "Generando..." : "Generar reporte"}
          </button>
        )}
      </div>
    </Modal>
  );
}
