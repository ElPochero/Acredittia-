"use client";
import React, { useState } from "react";
import type { MatrizCumplimientoData, PeriodoDocumento } from "@/lib/tipos";

interface MatrizDocumentalProps {
  data: MatrizCumplimientoData;
  onSelectCelda: (sujetoId: string, requisitoId: string, doc?: PeriodoDocumento) => void;
  onCargaMasiva?: () => void;
}

export default function MatrizDocumental({
  data,
  onSelectCelda,
  onCargaMasiva,
}: MatrizDocumentalProps) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  const { sujetos, requisitos, celdas, periodo } = data;

  // Filter subjects by search text
  const sujetosFiltrados = sujetos.filter((s) => {
    const txt = `${s.nombre} ${s.rut} ${s.cargo || ""}`.toLowerCase();
    const coincideBusqueda = txt.includes(busqueda.toLowerCase());

    if (!coincideBusqueda) return false;
    if (filtroEstado === "todos") return true;

    // Check if worker has any document matching the filter state
    return requisitos.some((r) => {
      const key = `${s.id}_${r.id}`;
      const doc = celdas[key];
      const st = doc?.estado || "pendiente";
      return st === filtroEstado;
    });
  });

  const getBadgeStyle = (estado?: string) => {
    switch (estado) {
      case "aprobado":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
      case "observado":
        return "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 animate-pulse";
      case "rechazado":
        return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100";
      case "cargado":
      case "en_revision":
        return "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100";
      default:
        return "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600";
    }
  };

  const getIcon = (estado?: string) => {
    switch (estado) {
      case "aprobado":
        return "✅";
      case "observado":
        return "⚠️";
      case "rechazado":
        return "❌";
      case "cargado":
      case "en_revision":
        return "📤";
      default:
        return "⬜";
    }
  };

  const getLabel = (estado?: string) => {
    switch (estado) {
      case "aprobado":
        return "Aprobado";
      case "observado":
        return "Observado";
      case "rechazado":
        return "Rechazado";
      case "cargado":
        return "Cargado";
      case "en_revision":
        return "En Revisión";
      default:
        return "Pendiente";
    }
  };

  const exportarCSV = () => {
    alert("Exportando Matriz Documental a formato CSV/Excel...");
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header & Controls Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>🟩</span> Matriz Documental — {periodo.nombre}
          </h3>
          <p className="text-xs text-slate-500">
            Haz clic sobre cualquier celda para cargar, auditar o revisar las observaciones de un documento.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <input
            type="text"
            placeholder="Buscar trabajador o RUT..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />

          {/* Filter Dropdown */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-cyan-500 focus:outline-none"
          >
            <option value="todos">Todos los Estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="cargado">Cargados</option>
            <option value="observado">Observados</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
          </select>

          {/* Export button */}
          <button
            onClick={exportarCSV}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 shadow-sm"
          >
            📊 Exportar Matriz
          </button>

          {/* Bulk upload button */}
          {onCargaMasiva && (
            <button
              onClick={onCargaMasiva}
              className="rounded-xl bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700 shadow-sm"
            >
              📤 Carga Masiva ZIP
            </button>
          )}
        </div>
      </div>

      {/* Legend Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
        <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Simbología:</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Aprobado</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> Observado</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span> Rechazado</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-500"></span> Cargado / En revisión</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-300"></span> Pendiente</span>
      </div>

      {/* Interactive Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <th className="p-3 sticky left-0 bg-slate-100 z-10 min-w-[200px] border-r border-slate-200">
                Trabajador / Sujeto
              </th>
              <th className="p-3 min-w-[120px] border-r border-slate-200">RUT</th>
              {requisitos.map((req) => (
                <th
                  key={req.id}
                  className="p-3 text-center min-w-[150px] border-r border-slate-200 last:border-r-0"
                >
                  <div className="truncate font-semibold text-slate-800" title={req.nombre}>
                    {req.nombre}
                  </div>
                  <div className="text-[9px] font-normal lowercase text-slate-500">
                    {req.ambito} {req.obligatorio ? "• obligatorio" : ""}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {sujetosFiltrados.length === 0 ? (
              <tr>
                <td colSpan={requisitos.length + 2} className="p-8 text-center text-slate-400">
                  No se encontraron trabajadores que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              sujetosFiltrados.map((sujeto) => (
                <tr key={sujeto.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Worker Name & Position */}
                  <td className="p-3 sticky left-0 bg-white font-semibold text-slate-900 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div>{sujeto.nombre}</div>
                    <div className="text-[10px] font-normal text-slate-400">{sujeto.cargo || "Sin cargo"}</div>
                  </td>
                  {/* RUT */}
                  <td className="p-3 font-mono text-slate-600 border-r border-slate-100">
                    {sujeto.rut}
                  </td>
                  {/* Document Cells */}
                  {requisitos.map((req) => {
                    const cellKey = `${sujeto.id}_${req.id}`;
                    const doc = celdas[cellKey];
                    const estado = doc?.estado || "pendiente";

                    return (
                      <td
                        key={req.id}
                        onClick={() => onSelectCelda(sujeto.id, req.id, doc)}
                        className="p-2 text-center border-r border-slate-100 last:border-r-0 cursor-pointer"
                      >
                        <div
                          className={`group/btn flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150 ${getBadgeStyle(
                            estado
                          )}`}
                          title={`Hacer clic para gestionar ${req.nombre} de ${sujeto.nombre}`}
                        >
                          <span className="text-xs">{getIcon(estado)}</span>
                          <span>{getLabel(estado)}</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
