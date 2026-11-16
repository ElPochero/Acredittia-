"use client";

import React, { useState, useEffect, useCallback } from "react";
import * as Api from "@/lib/platform/cliente";
import { HojaCalculoRespuesta, HojaCalculoTab } from "@/lib/platform/tipos";
import { Modal, Spinner } from "@/components/shared/ui";
import { toast } from "sonner";

interface GoogleSheetsModalProps {
  contratoId: string;
  contratoNombre?: string;
  contratoCodigo?: string | null;
  abierto: boolean;
  onCerrar: () => void;
  tabInicial?: HojaCalculoTab;
}

const TABS: { id: HojaCalculoTab; label: string }[] = [
  { id: "empresa", label: "Empresa" },
  { id: "personal", label: "Trabajadores" },
  { id: "equipos", label: "Equipos" },
  { id: "licencia", label: "Licencia interna" },
];

function getColName(i: number): string {
  let s = "";
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function getCellColorClass(val: string): { color: string; bg?: string } {
  if (!val) return { color: "#1e293b" };
  const v = val.trim();
  if (/^✓|^Vigente$|^Acreditado$|^Aprobado$/.test(v)) {
    return { color: "#137333", bg: "#e6f4ea" };
  }
  if (/^Vencido|^Falta$|^Bloqueado$/.test(v)) {
    return { color: "#c5221f", bg: "#fce8e6" };
  }
  if (/^Por vencer|^En proceso$|^Pendiente$/.test(v)) {
    return { color: "#b06000", bg: "#fef7e0" };
  }
  return { color: "#1e293b" };
}

export function GoogleSheetsModal({
  contratoId,
  contratoNombre,
  contratoCodigo,
  abierto,
  onCerrar,
  tabInicial = "personal",
}: GoogleSheetsModalProps) {
  const [tab, setTab] = useState<HojaCalculoTab>(tabInicial);
  const [data, setData] = useState<HojaCalculoRespuesta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number; val: string } | null>(null);

  // Sincronizar tab con tabInicial si cambia al abrir
  useEffect(() => {
    if (abierto && tabInicial) {
      setTab(tabInicial);
    }
  }, [abierto, tabInicial]);

  const cargarDatos = useCallback(async (tabActiva: HojaCalculoTab) => {
    if (!contratoId) return;
    setCargando(true);
    try {
      const res = await Api.contratos.hojaCalculo(contratoId, tabActiva);
      setData(res);
      // Seleccionar celda A1 por defecto
      const primerValor = res.columnas?.[0] || "";
      setSelectedCell({ r: 0, c: 0, val: primerValor });
    } catch (e: any) {
      toast.error(e.message || "Error al cargar la hoja de cálculo");
    } finally {
      setCargando(false);
    }
  }, [contratoId]);

  useEffect(() => {
    if (abierto) {
      cargarDatos(tab);
    } else {
      setData(null);
      setSelectedCell(null);
    }
  }, [abierto, tab, cargarDatos]);

  const copiarTSV = async () => {
    if (!data?.tsv) {
      toast.error("No hay datos para copiar");
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(data.tsv);
      } else {
        const ta = document.createElement("textarea");
        ta.value = data.tsv;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      toast.success("✓ Tabla copiada — pégala en Excel o Google Sheets (Ctrl+V / Cmd+V)");
    } catch {
      toast.error("No se pudo copiar automáticamente");
    }
  };

  const descargarTSV = () => {
    if (!data?.tsv) {
      toast.error("No hay datos para descargar");
      return;
    }
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), data.tsv], {
      type: "text/tab-separated-values;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const cod = contratoCodigo || contratoId.slice(0, 8);
    link.href = url;
    link.setAttribute("download", `ACREDITTIA_${cod}_${tab}.tsv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("↓ Archivo TSV descargado");
  };

  const abrirEnSheets = async () => {
    await copiarTSV();
    window.open("https://sheets.new", "_blank");
    toast.info("En la nueva hoja de cálculo haz clic en A1 y pega con Ctrl+V");
  };

  const columnas = data?.columnas || [];
  const filas = data?.filas || [];
  const emptyRowsCount = Math.max(3, 16 - filas.length);

  const selectedCoord = selectedCell
    ? `${getColName(selectedCell.c)}${selectedCell.r + 1}`
    : "A1";

  return (
    <Modal
      abierto={abierto}
      titulo={
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg viewBox="0 0 24 32" width="22" height="28">
              <path d="M15 0H3a3 3 0 0 0-3 3v26a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3V9z" fill="#0F9D58" />
              <path d="M15 0v6a3 3 0 0 0 3 3h6z" fill="#87CEAC" />
              <rect x="5" y="14" width="14" height="11" rx="1" fill="#fff" />
              <path d="M5 17.5h14M5 21h14M10 14v11" stroke="#0F9D58" strokeWidth="1.3" />
            </svg>
          </div>
          <div>
            <h3 className="text-[0.95rem] font-bold text-slate-800 leading-tight">
              ACREDITTIA · {contratoCodigo || "Contrato"} {contratoNombre ? `· ${contratoNombre}` : ""}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>Hoja de cálculo interactiva</span>
            </div>
          </div>
        </div>
      }
      onCerrar={onCerrar}
      ancho="max-w-7xl"
    >
      <div className="flex flex-col gap-3 -mt-2">
        {/* Barra superior de herramientas y acciones */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200 pb-2">
          {/* Menú visual estilo suite ofimática */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500 font-medium select-none">
            <span className="hover:text-slate-800 cursor-default">Archivo</span>
            <span className="hover:text-slate-800 cursor-default">Editar</span>
            <span className="hover:text-slate-800 cursor-default">Ver</span>
            <span className="hover:text-slate-800 cursor-default">Formato</span>
            <span className="hover:text-slate-800 cursor-default">Datos</span>
            <span className="hover:text-slate-800 cursor-default">Herramientas</span>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              onClick={copiarTSV}
              className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
              title="Copiar datos tabulados al portapapeles"
            >
              📋 Copiar TSV (pegar en Excel/Sheets)
            </button>
            <button
              onClick={descargarTSV}
              className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
              title="Descargar archivo TSV"
            >
              ⬇ Descargar .tsv
            </button>
            <button
              onClick={abrirEnSheets}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
              title="Abre una hoja nueva en Google Sheets y copia los datos"
            >
              Abrir en Google Sheets ↗
            </button>
          </div>
        </div>

        {/* Barra de fórmulas */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-xs">
          <span className="font-bold text-slate-700 min-w-[34px] text-center bg-white border border-slate-300 rounded px-1.5 py-0.5">
            {selectedCoord}
          </span>
          <span className="text-slate-400 italic font-serif text-sm">fx</span>
          <span className="flex-1 overflow-hidden whitespace-nowrap text-ellipsis text-slate-800 bg-white border border-slate-200 rounded px-2 py-0.5 min-h-[22px]">
            {selectedCell?.val ?? ""}
          </span>
          <span className="text-[11px] text-emerald-800 bg-emerald-100 font-sans font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            Sincronizado con la plataforma
          </span>
        </div>

        {/* Grid principal con cabeceras alfabéticas y numeradas */}
        <div className="relative border border-slate-300 rounded overflow-auto max-h-[58vh] bg-white shadow-inner">
          {cargando ? (
            <div className="p-12 flex justify-center">
              <Spinner texto="Cargando hoja de cálculo..." />
            </div>
          ) : columnas.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              No hay datos disponibles para esta pestaña.
            </div>
          ) : (
            <table className="border-collapse text-xs select-none w-max min-w-full">
              <thead>
                {/* Fila de letras de columnas A, B, C... */}
                <tr className="bg-[#f8f9fa] border-b border-slate-300 sticky top-0 z-20">
                  <th className="w-10 min-w-[40px] border-r border-slate-300 bg-[#e9ecef] text-slate-500 font-mono text-center py-1"></th>
                  {columnas.map((_, colIdx) => (
                    <th
                      key={colIdx}
                      className="border-r border-slate-300 px-3 py-1 font-mono font-medium text-slate-500 text-center min-w-[120px]"
                    >
                      {getColName(colIdx)}
                    </th>
                  ))}
                </tr>
                {/* Fila 1: Cabeceras reales de los datos */}
                <tr className="bg-[#f1f3f4] border-b border-slate-300 font-semibold text-slate-800 sticky top-[25px] z-10 shadow-sm">
                  <td className="bg-[#e9ecef] border-r border-slate-300 text-slate-500 font-mono text-center py-1 font-normal">
                    1
                  </td>
                  {columnas.map((colName, colIdx) => {
                    const isSelected = selectedCell?.r === 0 && selectedCell?.c === colIdx;
                    return (
                      <td
                        key={colIdx}
                        onClick={() => setSelectedCell({ r: 0, c: colIdx, val: colName })}
                        className={`border-r border-slate-300 px-3 py-1.5 truncate max-w-[280px] cursor-pointer transition-colors ${
                          isSelected
                            ? "outline outline-2 outline-blue-600 bg-blue-50/60 z-10"
                            : "hover:bg-slate-200/50"
                        }`}
                        title={colName}
                      >
                        {colName}
                      </td>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Filas de datos (2 a N) */}
                {filas.map((row, rowIdx) => {
                  const rowNumber = rowIdx + 2;
                  return (
                    <tr
                      key={rowIdx}
                      className="border-b border-slate-200 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="bg-[#f8f9fa] border-r border-slate-300 text-slate-500 font-mono text-center py-1 select-none font-normal">
                        {rowNumber}
                      </td>
                      {columnas.map((_, colIdx) => {
                        const cellVal = row[colIdx] ?? "";
                        const { color, bg } = getCellColorClass(cellVal);
                        const isSelected = selectedCell?.r === rowIdx + 1 && selectedCell?.c === colIdx;
                        return (
                          <td
                            key={colIdx}
                            onClick={() =>
                              setSelectedCell({ r: rowIdx + 1, c: colIdx, val: String(cellVal) })
                            }
                            style={{ color, backgroundColor: isSelected ? undefined : bg }}
                            className={`border-r border-slate-200 px-3 py-1.5 truncate max-w-[320px] cursor-pointer ${
                              isSelected
                                ? "outline outline-2 outline-blue-600 bg-blue-50/70 z-10 font-medium"
                                : ""
                            }`}
                            title={String(cellVal)}
                          >
                            {cellVal}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Filas vacías adicionales estilo spreadsheet */}
                {Array.from({ length: emptyRowsCount }).map((_, emptyIdx) => {
                  const rowNumber = filas.length + 2 + emptyIdx;
                  return (
                    <tr key={`empty-${emptyIdx}`} className="border-b border-slate-200">
                      <td className="bg-[#f8f9fa] border-r border-slate-300 text-slate-400 font-mono text-center py-1 select-none font-normal">
                        {rowNumber}
                      </td>
                      {columnas.map((_, colIdx) => (
                        <td key={colIdx} className="border-r border-slate-200 px-3 py-1.5 h-6"></td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pestañas inferiores (estilo Google Sheets) y contador */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-2 flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <span className="px-2 text-slate-400 font-bold select-none cursor-default">+</span>
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    active
                      ? "bg-white text-emerald-700 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-500 font-mono">
            {filas.length} filas · {columnas.length} columnas
          </div>
        </div>
      </div>
    </Modal>
  );
}
