"use client";
import React, { useState, useRef } from "react";
import type { MatrizCumplimientoData, PeriodoDocumento } from "@/lib/tipos";
import { Chip } from "@/components/ui";

interface MatrizDocumentalProps {
  data: MatrizCumplimientoData;
  onSelectCelda: (sujetoId: string, requisitoId: string, doc?: PeriodoDocumento) => void;
  onSubirDirecto?: (docId: string, file: File) => Promise<void>;
  onCargaMasiva?: () => void;
  esAdminOAdc?: boolean;
}

export default function MatrizDocumental({
  data,
  onSelectCelda,
  onSubirDirecto,
  onCargaMasiva,
  esAdminOAdc = true,
}: MatrizDocumentalProps) {
  const [vista, setVista] = useState<"tabla" | "matriz">("tabla");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroAmbito, setFiltroAmbito] = useState<string>("todos");
  const [subiendoDocId, setSubiendoDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sujetos, requisitos, celdas, periodo } = data;

  const handleTriggerSubir = (docId: string) => {
    setSubiendoDocId(docId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && subiendoDocId && onSubirDirecto) {
      await onSubirDirecto(subiendoDocId, file);
    }
    // Limpiar input
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSubiendoDocId(null);
  };

  // 1. Armar lista aplanada de todos los requisitos requeridos (.vtable)
  const itemsTabla = React.useMemo(() => {
    const lista: {
      key: string;
      docId: string;
      sujetoId: string;
      requisitoId: string;
      requisitoNombre: string;
      ambito: string;
      obligatorio: boolean;
      asociadoA: string;
      rutAsociado: string;
      estado: string;
      archivoUrl?: string | null;
      fechaLimite: string;
      fuente: string;
      doc?: PeriodoDocumento;
    }[] = [];

    // Por cada sujeto y por cada requisito
    sujetos.forEach((s) => {
      requisitos.forEach((r) => {
        const cellKey = `${s.id}_${r.id}`;
        const doc = celdas[cellKey];
        const docId = doc?.id || `doc-${s.id}-${r.id}`;
        const estado = doc?.estado || "pendiente";

        lista.push({
          key: cellKey,
          docId,
          sujetoId: s.id,
          requisitoId: r.id,
          requisitoNombre: r.nombre,
          ambito: r.ambito,
          obligatorio: r.obligatorio,
          asociadoA: s.nombre,
          rutAsociado: s.rut,
          estado,
          archivoUrl: doc?.archivo_url,
          fechaLimite: periodo.fecha_fin || "10 de mes",
          fuente: r.nombre.includes("Buk") || r.nombre.includes("Previred") ? "Buk / Previred" : "Manual",
          doc,
        });
      });
    });

    return lista;
  }, [sujetos, requisitos, celdas, periodo]);

  // Filtros aplicados
  const itemsFiltrados = React.useMemo(() => {
    return itemsTabla.filter((it) => {
      if (filtroEstado !== "todos" && it.estado !== filtroEstado) return false;
      if (filtroAmbito !== "todos" && it.ambito !== filtroAmbito) return false;
      if (busqueda.trim()) {
        const term = busqueda.toLowerCase().trim();
        const coincide =
          it.requisitoNombre.toLowerCase().includes(term) ||
          it.asociadoA.toLowerCase().includes(term) ||
          it.rutAsociado.toLowerCase().includes(term);
        if (!coincide) return false;
      }
      return true;
    });
  }, [itemsTabla, filtroEstado, filtroAmbito, busqueda]);

  const exportarCSV = () => {
    const encabezados = "Documento,Ambito,Asociado_A,RUT,Estado,Obligatorio\n";
    const filas = itemsFiltrados
      .map(
        (i) =>
          `"${i.requisitoNombre}","${i.ambito}","${i.asociadoA}","${i.rutAsociado}","${i.estado}","${i.obligatorio ? "SI" : "NO"}"`
      )
      .join("\n");
    const blob = new Blob([encabezados + filas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `documentos_requeridos_${periodo.nombre.replace(/\s+/g, "_")}.csv`;
    a.click();
  };

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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
      {/* Input de archivo oculto para carga directa */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.zip"
      />

      {/* Barra Superior con Selector de Vistas y Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📑</span> Documentos Requeridos del Período
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              ({itemsFiltrados.length} obligaciones)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Carga y revisión directa de obligaciones documentales de faena (Sección 7, CA 7).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Vista: Tabla Requisitos vs Matriz Trabajadores */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setVista("tabla")}
              className={`rounded-lg px-3 py-1.5 transition ${
                vista === "tabla"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📋 Vista Lista
            </button>
            <button
              type="button"
              onClick={() => setVista("matriz")}
              className={`rounded-lg px-3 py-1.5 transition ${
                vista === "matriz"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🟩 Vista Matriz
            </button>
          </div>

          {/* Buscador */}
          <input
            type="text"
            placeholder="Buscar documento o RUT..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {/* Filtro de Estado */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="todos">Todos los Estados</option>
            <option value="pendiente">Pendientes</option>
            <option value="en_revision">En revisión</option>
            <option value="observado">Observados</option>
            <option value="aprobado">Aprobados</option>
            <option value="rechazado">Rechazados</option>
          </select>

          {/* Exportar */}
          <button
            type="button"
            onClick={exportarCSV}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            📥 Exportar CSV
          </button>
        </div>
      </div>

      {/* =====================================================================
          1. VISTA TABLA DE REQUISITOS (.vtable)
          plataforma.html L6900–L6903 y L14258–L14262
          ===================================================================== */}
      {vista === "tabla" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-[11px] text-slate-700">
              <tr>
                <th className="px-4 py-3">Documento Requerido</th>
                <th className="px-4 py-3 text-center">Obligatorio</th>
                <th className="px-4 py-3">Fuente</th>
                <th className="px-4 py-3">Asociado a</th>
                <th className="px-4 py-3">Fecha Límite</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Archivo / Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No se encontraron documentos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                itemsFiltrados.map((it) => (
                  <tr
                    key={it.key}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => onSelectCelda(it.sujetoId, it.requisitoId, it.doc)}
                  >
                    {/* Documento */}
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">📄</span>
                        <div>
                          <div>{it.requisitoNombre}</div>
                          <div className="text-[10px] font-normal text-slate-400 capitalize">
                            Ámbito: {it.ambito}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Switch / Requerido */}
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {esAdminOAdc ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            it.obligatorio
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {it.obligatorio ? "Obligatorio" : "Opcional"}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-600">
                          {it.obligatorio ? "Obligatorio" : "Opcional"}
                        </span>
                      )}
                    </td>

                    {/* Fuente */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600">
                        {it.fuente.includes("Buk") ? "🔗 Buk" : "📁 Manual"}
                      </span>
                    </td>

                    {/* Asociado a */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{it.asociadoA}</div>
                      <div className="font-mono text-[10px] text-slate-400">{it.rutAsociado}</div>
                    </td>

                    {/* Fecha Límite */}
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                      {it.fechaLimite}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      <Chip estado={it.estado} texto={it.estado} />
                    </td>

                    {/* Archivo / Acción */}
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {it.archivoUrl ? (
                          <>
                            <a
                              href={it.archivoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              <span>👁️</span> Ver
                            </a>
                            <button
                              type="button"
                              onClick={() => handleTriggerSubir(it.docId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-sm hover:bg-blue-50 transition"
                            >
                              <span>↻</span> Reemplazar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTriggerSubir(it.docId)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 transition"
                          >
                            <span>↑</span> Subir archivo
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectCelda(it.sujetoId, it.requisitoId, it.doc)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                          title="Abrir detalles de auditoría"
                        >
                          🔍
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* =====================================================================
           2. VISTA MATRIZ DE CELDAS (TRABAJADOR VS REQUISITOS)
           ===================================================================== */
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="p-3 sticky left-0 bg-slate-100 z-10 min-w-[200px] border-r border-slate-200">
                  Trabajador
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
              {sujetos.length === 0 ? (
                <tr>
                  <td colSpan={requisitos.length + 2} className="p-8 text-center text-slate-400">
                    No hay trabajadores en la nómina de este período.
                  </td>
                </tr>
              ) : (
                sujetos.map((sujeto) => (
                  <tr key={sujeto.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 sticky left-0 bg-white font-semibold text-slate-900 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      <div>{sujeto.nombre}</div>
                      <div className="text-[10px] font-normal text-slate-400">
                        {sujeto.cargo || "Sin cargo"}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-slate-600 border-r border-slate-100">
                      {sujeto.rut}
                    </td>
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
                            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${getBadgeStyle(
                              estado
                            )}`}
                          >
                            <span>
                              {estado === "aprobado"
                                ? "✅"
                                : estado === "observado"
                                ? "📝"
                                : estado === "rechazado"
                                ? "⛔"
                                : estado === "en_revision" || estado === "cargado"
                                ? "📤"
                                : "⏳"}
                            </span>
                            <span className="capitalize">{estado}</span>
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
      )}
    </div>
  );
}
