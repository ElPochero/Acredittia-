"use client";

import React, { useState } from "react";
import type {
  ContratoValidacionIa,
  EstadoValidacionIa,
  ReglaValidacionIa,
  ResultadoReglaIa,
  ResumenValidacionIa,
  Revision,
} from "@/lib/platform/tipos";

interface ValidationResultPanelProps {
  review: Revision;
  rutEnviado?: string | null;
}

function esObjetoPlano(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function formatearValor(val: unknown): string {
  if (val === true) return "Sí";
  if (val === false) return "No";
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  return JSON.stringify(val);
}

function IconoRegla({ resultado }: { resultado: ResultadoReglaIa }) {
  if (resultado === "OK") {
    return (
      <span
        aria-label="OK"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-500 text-[10px] font-bold text-emerald-600"
      >
        ✓
      </span>
    );
  }
  if (resultado === "OBS") {
    return (
      <span
        aria-label="Observación"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-xs font-bold text-amber-500"
      >
        ⚠
      </span>
    );
  }
  if (resultado === "RECH") {
    return (
      <span
        aria-label="Rechazado"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-rose-500 text-[10px] font-bold text-rose-600"
      >
        ✕
      </span>
    );
  }
  if (resultado === "REV") {
    return (
      <span
        aria-label="Requiere revisión"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-violet-500 text-[10px] font-bold text-violet-600"
      >
        ?
      </span>
    );
  }
  return <span aria-label="No aplica" className="inline-block h-4 w-4 shrink-0" />;
}

function GrupoDatosExtraidos({
  nombre,
  datos,
}: {
  nombre: string;
  datos: Record<string, unknown>;
}) {
  const [abierto, setAbierto] = useState(false);
  const entradas = Object.entries(datos);

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 py-1.5 text-left text-sm text-slate-800 hover:text-slate-950"
      >
        <span className="text-[11px] text-slate-400">{abierto ? "▲" : "▾"}</span>
        <span className="font-medium">{nombre}</span>
        <span className="text-xs text-slate-400">
          ({entradas.length} {entradas.length === 1 ? "campo" : "campos"})
        </span>
      </button>
      {abierto && (
        <div className="mb-2 ml-5 space-y-1 border-l border-slate-200 pl-3 text-xs">
          {entradas.map(([k, v]) => (
            <div key={k} className="flex flex-wrap gap-2 py-0.5">
              <span className="font-medium text-slate-500">{k}:</span>
              <span className="text-slate-800 break-all">{formatearValor(v) || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ValidationResultPanel({
  review,
  rutEnviado,
}: ValidationResultPanelProps) {
  const [datosAbierto, setDatosAbierto] = useState(true);
  const [jsonAbierto, setJsonAbierto] = useState(false);

  const docData: Record<string, unknown> =
    review.documentData || review.campos_extraidos || {};
  const rules: ReglaValidacionIa[] = review.rules || [];
  const summary: ResumenValidacionIa = review.summary || {
    OK: rules.filter((r) => r.resultado === "OK").length,
    OBS: rules.filter((r) => r.resultado === "OBS").length,
    RECH: rules.filter((r) => r.resultado === "RECH").length,
    "N/A": rules.filter((r) => r.resultado === "N/A").length,
    REV: rules.filter((r) => r.resultado === "REV").length,
    total: rules.length,
  };

  const statusVal: EstadoValidacionIa =
    review.validation_status ||
    (review.resultado === "con_errores" ? "RECHAZADO" : "APROBADO");

  const motivo =
    review.motivo ||
    (statusVal === "APROBADO"
      ? "Todas las validaciones pasaron exitosamente"
      : "Revisa los hallazgos detectados por el motor de validación.");

  const contratoJson: ContratoValidacionIa = review.validation || {
    documentData: docData,
    rules,
    summary,
    status: statusVal,
    motivo,
  };

  const emisor =
    typeof docData.NombreEmisor === "string"
      ? docData.NombreEmisor.includes("Asociación Chilena")
        ? "ACHS"
        : docData.NombreEmisor
      : typeof docData.mutualidad === "string"
        ? docData.mutualidad
        : typeof docData.emisor === "string"
          ? docData.emisor
          : null;

  const rutDetectado =
    rutEnviado ||
    (typeof docData.RUN === "string" ? docData.RUN : null) ||
    (typeof docData.RUTPaciente === "string" ? docData.RUTPaciente : null) ||
    (typeof docData.Patente === "string" ? docData.Patente : null) ||
    (typeof docData.patente === "string" ? docData.patente : null) ||
    (esObjetoPlano(docData.trabajador) && typeof docData.trabajador.rut === "string"
      ? docData.trabajador.rut
      : null) ||
    (typeof docData.RUTEmpresa === "string" ? docData.RUTEmpresa : null);

  const esPatente = Boolean(
    !rutEnviado &&
      ((typeof docData.Patente === "string" && docData.Patente) ||
        (typeof docData.patente === "string" && docData.patente))
  );

  const PRIORIDAD_REGLA: Record<string, number> = {
    "N/A": 0,
    OK: 1,
    OBS: 2,
    REV: 3,
    RECH: 4,
  };
  const reglaId01 = rules.find((r) => r.codigo === "ID01" || r.codigo === "TRAB02");
  const reglaId02 = rules.find((r) => r.codigo === "ID02" || r.codigo === "TRAB01");
  const reglaIdentidadPeor =
    reglaId01 && reglaId02
      ? (PRIORIDAD_REGLA[reglaId02.resultado] ?? 0) >=
        (PRIORIDAD_REGLA[reglaId01.resultado] ?? 0)
        ? reglaId02
        : reglaId01
      : reglaId02 || reglaId01;

  const reglaExa09 = rules.find((r) => r.codigo === "EXA09");
  const tienePortal = Boolean(reglaExa09 || docData.valida_portal);
  const reglaPortal = tienePortal
    ? reglaExa09 || rules.find((r) => r.codigo === "AUT01")
    : undefined;
  const esExamen = Boolean(
    rules.some((r) => r.codigo.startsWith("EXA")) ||
      docData.mutualidad ||
      docData.RUTPaciente
  );
  const reglasRech = rules.filter((r) => r.resultado === "RECH");

  const entradasDatos = Object.entries(docData).filter(([k]) => !k.startsWith("_"));
  const tieneGrupos = entradasDatos.some(([, v]) => esObjetoPlano(v));

  const colorResultado =
    statusVal === "RECHAZADO"
      ? "text-rose-700"
      : statusVal === "REQUIERE_REVISION"
        ? "text-amber-700"
        : "text-emerald-700";

  const etiquetaEstado =
    statusVal === "REQUIERE_REVISION" ? "REQUIERE REVISIÓN" : statusVal;

  return (
    <div className="space-y-4 text-slate-800">
      {/* Cabecera Emisor / Identificador */}
      {(emisor || rutDetectado) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 border-b border-slate-100 pb-3">
          {emisor && (
            <div>
              <div className="text-xs text-slate-500">
                {esExamen ? "Mutualidad / Emisor" : "Emisor"}
              </div>
              <div className="text-base font-medium text-slate-900">{emisor}</div>
            </div>
          )}
          {rutDetectado && (
            <div>
              <div className="text-xs text-slate-500">
                {esPatente ? "Patente" : "RUT Enviado"}
              </div>
              <div className="font-mono text-base font-medium text-slate-900">
                {rutDetectado}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resultado global y contadores */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="text-base">
            🛡️
          </span>
          <span className={`text-base font-semibold ${colorResultado}`}>
            Resultado: {etiquetaEstado}
          </span>
          {review.confianza != null && (
            <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              Confianza {(review.confianza * 100).toFixed(0)}%
            </span>
          )}
        </div>
        {motivo && <p className="text-xs text-slate-600 m-0">{motivo}</p>}

        {rules.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs font-medium">
            <span className="text-emerald-600">OK: {summary.OK}</span>
            <span className="text-amber-600">OBS: {summary.OBS}</span>
            <span className="text-rose-600">RECH: {summary.RECH}</span>
            <span className="text-slate-500">N/A: {summary["N/A"]}</span>
            <span className="text-violet-600">REV: {summary.REV}</span>
            <span className="font-bold text-slate-900">Total: {summary.total}</span>
          </div>
        )}
      </div>

      {/* Tarjetas destacadas para rechazos o validación cruzada/portal */}
      {reglasRech.length > 0 && (
        <div className="space-y-2">
          {reglasRech.slice(0, 4).map((r) => (
            <div
              key={`rech-card-${r.codigo}`}
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-white px-3.5 py-2.5 text-xs shadow-sm"
            >
              <IconoRegla resultado="RECH" />
              <div>
                <span className="font-semibold text-slate-900">
                  {r.codigo} · {r.campo}:{" "}
                </span>
                <span className="text-slate-700">{r.observacion || "Incumplimiento"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {(reglaIdentidadPeor || reglaPortal) && reglasRech.length === 0 && (
        <div className="space-y-2">
          {reglaIdentidadPeor && (
            <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <IconoRegla resultado={reglaIdentidadPeor.resultado} />
                <span>Validación Identidad</span>
              </div>
              <div className="mt-1 pl-6 text-xs text-slate-500">
                {reglaIdentidadPeor.observacion ||
                  "El identificador y nombre coinciden con el titular registrado."}
              </div>
            </div>
          )}

          {reglaPortal && (
            <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <IconoRegla resultado={reglaPortal.resultado} />
                <span>Validación Portal</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    reglaPortal.resultado === "RECH"
                      ? "bg-rose-100 text-rose-700"
                      : reglaPortal.resultado === "OBS" || reglaPortal.resultado === "REV"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {reglaPortal.resultado === "RECH"
                    ? "No verificado"
                    : reglaPortal.resultado === "OBS"
                      ? "Con observación"
                      : reglaPortal.resultado === "REV"
                        ? "Por revisar"
                        : "Auténtico"}
                </span>
              </div>
              <div className="mt-1 pl-6 text-xs text-slate-500">
                {reglaPortal.observacion ||
                  "Documento verificado exitosamente contra la fuente oficial."}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista codificada de reglas */}
      {rules.length > 0 && (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
          <ul className="m-0 list-none space-y-1.5 p-0 text-xs">
            {rules.map((r) => (
              <li key={r.codigo} className="flex items-start gap-2.5 py-0.5">
                <IconoRegla resultado={r.resultado} />
                <div className="flex-1 leading-snug">
                  <span className="font-mono text-[11px] font-semibold text-slate-500 mr-2">
                    {r.codigo}
                  </span>
                  <span className="font-medium text-slate-800">{r.campo}</span>
                  {r.observacion && (
                    <span className="italic text-slate-500"> — {r.observacion}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Acordeón: Datos extraídos */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setDatosAbierto(!datosAbierto)}
          aria-expanded={datosAbierto}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <span className="text-[11px] text-slate-500">{datosAbierto ? "▲" : "▾"}</span>
          <span>Datos extraídos</span>
        </button>

        {datosAbierto && (
          <div className="border-t border-slate-100 px-3.5 py-2.5">
            {entradasDatos.length === 0 ? (
              <p className="m-0 text-xs italic text-slate-400">
                Sin datos extraídos disponibles.
              </p>
            ) : tieneGrupos ? (
              <div className="rounded-lg border border-slate-100 px-3 py-1">
                {entradasDatos.map(([k, v]) =>
                  esObjetoPlano(v) ? (
                    <GrupoDatosExtraidos key={k} nombre={k} datos={v} />
                  ) : (
                    <div key={k} className="flex gap-2 py-1 text-xs">
                      <span className="font-medium text-slate-500">{k}:</span>
                      <span className="text-slate-800">{formatearValor(v) || "—"}</span>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-1 rounded-lg border border-slate-100 p-3 text-xs">
                {entradasDatos.map(([k, v]) => (
                  <div key={k} className="flex flex-wrap gap-2 py-0.5">
                    <span className="font-medium text-slate-500">{k}:</span>
                    <span className="text-slate-800 break-all">
                      {formatearValor(v) || "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Acordeón: Ver respuesta completa (JSON) */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setJsonAbierto(!jsonAbierto)}
          aria-expanded={jsonAbierto}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <span className="text-[11px] text-slate-500">{jsonAbierto ? "▲" : "▾"}</span>
          <span>Ver respuesta completa (JSON)</span>
        </button>
        {jsonAbierto && (
          <pre className="m-0 max-h-60 overflow-auto border-t border-slate-100 bg-slate-50 p-3 font-mono text-[11px] text-slate-700">
            {JSON.stringify(contratoJson, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
