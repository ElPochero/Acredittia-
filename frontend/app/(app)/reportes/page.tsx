"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import type { Contrato, ReportesResumen, TipoReporte } from "@/lib/tipos";

type GenerandoEstado = {
  status: "queued" | "processing" | "downloading";
  error?: string;
};

type ToastInfo = {
  msg: string;
  type: "success" | "error";
  onRetry?: () => void;
};

const CATALOGO_REPORTES: {
  tipo: TipoReporte;
  titulo: string;
  badge: string;
  color: string;
  descripcion: string;
}[] = [
  {
    tipo: "estado_acreditacion",
    titulo: "Estado de Acreditación",
    badge: "General",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    descripcion:
      "Resumen ejecutivo del estado de acreditación de contratos, cumplimiento documental promedio y alertas de faena.",
  },
  {
    tipo: "cumplimiento_requisitos",
    titulo: "Cumplimiento de Requisitos",
    badge: "Normativa",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    descripcion:
      "Desglose de requerimientos documentales exigidos por contrato y nivel de aprobación por empresa y trabajadores.",
  },
  {
    tipo: "personal_acreditado",
    titulo: "Personal Acreditado",
    badge: "Dotación",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    descripcion:
      "Padrón consolidado de trabajadores activos, cargos asignados, vigencia de pases y licencias internas de faena.",
  },
  {
    tipo: "equipos_vehiculos",
    titulo: "Equipos y Flota",
    badge: "Equipos",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    descripcion:
      "Catálogo de vehículos y maquinaria pesada autorizada, revisiones técnicas, pólizas de seguro y permisos de circulación.",
  },
  {
    tipo: "vencimientos",
    titulo: "Control de Vencimientos",
    badge: "Alertas",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    descripcion:
      "Listado cronológico de documentos vencidos y por vencer en los próximos 30, 60 y 90 días para evitar bloqueos de acceso.",
  },
  {
    tipo: "matriz_cumplimiento",
    titulo: "Matriz de Cumplimiento",
    badge: "Auditoría",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    descripcion:
      "Matriz multidimensional cruzada de sujetos contra requisitos documentales, idónea para auditorías de clientes mandantes.",
  },
];

export default function ReportesPage() {
  const [loading, setLoading] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ReportesResumen | null>(null);
  const [contratosList, setContratosList] = useState<Contrato[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [generandoMap, setGenerandoMap] = useState<Record<string, GenerandoEstado>>({});
  const [toast, setToast] = useState<ToastInfo | null>(null);

  // Modal para programar reporte
  const [modalProg, setModalProg] = useState<{
    abierto: boolean;
    tipo: TipoReporte;
    nombre: string;
    formato: "pdf" | "excel";
    frecuencia: "diario" | "semanal" | "mensual";
    guardando: boolean;
  }>({
    abierto: false,
    tipo: "estado_acreditacion",
    nombre: "",
    formato: "excel",
    frecuencia: "semanal",
    guardando: false,
  });

  const cargarDatos = async () => {
    setLoading(true);
    setErrorGlobal(null);
    try {
      const [resKpis, resContratos] = await Promise.all([
        Api.reportes.resumen().catch(() => ({
          reportes_generados_30d: 0,
          programados_activos: 0,
          cumplimiento_promedio: 0,
          alertas_activas: 0,
        })),
        Api.contratos.listar({ page_size: 50 }).catch(() => ({ items: [] })),
      ]);
      setResumen(resKpis);
      setContratosList(resContratos.items || []);
    } catch (err: any) {
      console.error("Error al cargar módulo de reportes:", err);
      setErrorGlobal("No fue posible cargar la información de reportes. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const showToast = (msg: string, type: "success" | "error", onRetry?: () => void) => {
    setToast({ msg, type, onRetry });
    if (type === "success") {
      setTimeout(() => setToast(null), 4000);
    }
  };

  // Descarga de reporte por contrato (PDF o Excel)
  const descargarReporteContrato = async (c: Contrato, formato: "pdf" | "excel") => {
    const key = `${c.id}-${formato}`;
    setGenerandoMap((prev) => ({ ...prev, [key]: { status: "queued" } }));
    setToast(null);

    try {
      const rep = await Api.reportes.crear({
        tipo: "estado_acreditacion",
        formato,
        nombre: `Reporte Contrato ${c.codigo || c.nombre}`,
        params: {
          contrato_id: c.id,
          recurso: "reporte_contrato",
        },
      });

      setGenerandoMap((prev) => ({ ...prev, [key]: { status: "processing" } }));

      // Sondeo con backoff progresivo
      let downloadUrl = "";
      let intentos = 0;
      const maxIntentos = 30;

      while (intentos < maxIntentos) {
        const delay = Math.min(800 + intentos * 400, 2500);
        await new Promise((r) => setTimeout(r, delay));
        intentos++;

        const detalle = await Api.reportes.detalle(rep.id);
        if (detalle.status === "done") {
          const dl = await Api.reportes.urlDescarga(rep.id);
          downloadUrl = dl.download_url;
          break;
        }
        if (detalle.status === "failed") {
          throw new Error(detalle.error || "La generación del reporte falló en el servidor.");
        }
      }

      if (!downloadUrl) {
        throw new Error("El reporte demoró más de lo previsto. Intenta nuevamente.");
      }

      setGenerandoMap((prev) => ({ ...prev, [key]: { status: "downloading" } }));

      // Disparar la descarga en el navegador
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `reporte-${c.codigo || "contrato"}.${formato === "pdf" ? "pdf" : "xlsx"}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(
        `Reporte en ${formato.toUpperCase()} de "${c.nombre}" generado y descargado correctamente.`,
        "success"
      );

      // Actualizar contador de reportes si corresponde
      setResumen((prev) =>
        prev ? { ...prev, reportes_generados_30d: prev.reportes_generados_30d + 1 } : prev
      );
    } catch (err: any) {
      console.error("Error al generar reporte de contrato:", err);
      const errMsg = err.message || "Error al procesar la descarga del reporte.";
      setGenerandoMap((prev) => ({ ...prev, [key]: { status: "queued", error: errMsg } }));
      showToast(errMsg, "error", () => descargarReporteContrato(c, formato));
    } finally {
      setTimeout(() => {
        setGenerandoMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 1500);
    }
  };

  // Generación bajo demanda desde el catálogo
  const generarDesdeCatalogo = async (tipo: TipoReporte, formato: "pdf" | "excel", titulo: string) => {
    const key = `catalogo-${tipo}-${formato}`;
    setGenerandoMap((prev) => ({ ...prev, [key]: { status: "queued" } }));
    setToast(null);

    try {
      const rep = await Api.reportes.crear({
        tipo,
        formato,
        nombre: `Reporte ${titulo}`,
      });

      setGenerandoMap((prev) => ({ ...prev, [key]: { status: "processing" } }));

      let downloadUrl = "";
      let intentos = 0;
      while (intentos < 30) {
        const delay = Math.min(800 + intentos * 400, 2500);
        await new Promise((r) => setTimeout(r, delay));
        intentos++;

        const detalle = await Api.reportes.detalle(rep.id);
        if (detalle.status === "done") {
          const dl = await Api.reportes.urlDescarga(rep.id);
          downloadUrl = dl.download_url;
          break;
        }
        if (detalle.status === "failed") {
          throw new Error(detalle.error || "La generación del catálogo falló en el servidor.");
        }
      }

      if (!downloadUrl) throw new Error("Tiempo de espera agotado.");

      setGenerandoMap((prev) => ({ ...prev, [key]: { status: "downloading" } }));
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", `catalogo-${tipo}.${formato === "pdf" ? "pdf" : "xlsx"}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast(`Reporte "${titulo}" descargado en formato ${formato.toUpperCase()}.`, "success");
    } catch (err: any) {
      const msg = err.message || "No se pudo generar el reporte del catálogo.";
      showToast(msg, "error", () => generarDesdeCatalogo(tipo, formato, titulo));
    } finally {
      setTimeout(() => {
        setGenerandoMap((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 1500);
    }
  };

  // Guardar programación de reporte
  const guardarProgramacion = async () => {
    if (!modalProg.nombre.trim()) {
      showToast("Por favor asigna un nombre a la programación.", "error");
      return;
    }
    setModalProg((prev) => ({ ...prev, guardando: true }));
    try {
      let cron = "0 8 * * *"; // Diario 08:00
      if (modalProg.frecuencia === "semanal") cron = "0 8 * * 1"; // Lunes 08:00
      if (modalProg.frecuencia === "mensual") cron = "0 8 1 * *"; // Día 1 de cada mes 08:00

      await Api.reportes.crearProgramado({
        nombre: modalProg.nombre.trim(),
        tipo: modalProg.tipo,
        formato: modalProg.formato,
        cron_expr: cron,
        activo: true,
      });

      showToast(`Programación "${modalProg.nombre}" guardada con éxito.`, "success");
      setModalProg({
        abierto: false,
        tipo: "estado_acreditacion",
        nombre: "",
        formato: "excel",
        frecuencia: "semanal",
        guardando: false,
      });
      // Actualizar contador
      setResumen((prev) =>
        prev ? { ...prev, programados_activos: prev.programados_activos + 1 } : prev
      );
    } catch (err: any) {
      console.error("Error al guardar programación:", err);
      showToast(err.message || "No fue posible guardar la programación.", "error");
      setModalProg((prev) => ({ ...prev, guardando: false }));
    }
  };

  // Filtrado de contratos en búsqueda
  const contratosFiltrados = contratosList.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nombre = (c.nombre || "").toLowerCase();
    const codigo = (c.codigo || "").toLowerCase();
    const faena = (c.faena?.nombre || "").toLowerCase();
    const mandante = (c.faena?.mandante || "").toLowerCase();
    return nombre.includes(q) || codigo.includes(q) || faena.includes(q) || mandante.includes(q);
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Toast de estado con soporte para reintento */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium border transition-all ${
            toast.type === "success"
              ? "bg-slate-900 text-white border-slate-800"
              : "bg-red-900 text-white border-red-800"
          }`}
        >
          <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
          <span>{toast.msg}</span>
          {toast.onRetry && (
            <button
              onClick={() => {
                const retryFn = toast.onRetry;
                setToast(null);
                if (retryFn) retryFn();
              }}
              className="ml-2 px-2.5 py-1 text-xs bg-white text-red-900 font-bold rounded-md hover:bg-red-50 transition"
            >
              Reintentar
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            className="ml-1 text-slate-400 hover:text-white text-base leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Cabecera descriptiva */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Centro de Reportes</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generación y descarga de informes de cumplimiento en PDF y Excel, métricas por contrato y programación automática.
          </p>
        </div>
      </div>

      {/* 1. KPIs Superiores con datos reales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Reportes Generados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reportes Generados</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? "..." : resumen?.reportes_generados_30d ?? 0}
            </h3>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Últimos 30 días</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-xl font-bold">
            📄
          </div>
        </div>

        {/* KPI 2: Programados Activos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Programados Activos</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? "..." : resumen?.programados_activos ?? 0}
            </h3>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Ejecución en cron</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold">
            ⏰
          </div>
        </div>

        {/* KPI 3: Cumplimiento Promedio */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cumplimiento Promedio</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold text-slate-900">
                {loading ? "..." : `${resumen?.cumplimiento_promedio ?? 100}%`}
              </h3>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  (resumen?.cumplimiento_promedio ?? 100) >= 80
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {(resumen?.cumplimiento_promedio ?? 100) >= 80 ? "Óptimo" : "En atención"}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Sujetos y contratos activos</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 text-xl font-bold">
            🛡️
          </div>
        </div>

        {/* KPI 4: Alertas Activas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alertas Activas</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {loading ? "..." : resumen?.alertas_activas ?? 0}
            </h3>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Vencimientos pendientes</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 text-xl font-bold">
            ⚠️
          </div>
        </div>
      </div>

      {/* 2. Sección Reporte por Contrato */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Reporte por Contrato</h3>
            <p className="text-xs text-slate-500">
              Genera la ficha integral del contrato en PDF con diseño formal o en Excel con planillas tabulares detalladas.
            </p>
          </div>
          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="Buscar por código, nombre, faena..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="inline-block animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full mb-3" />
            <p>Cargando contratos y estadísticas de cumplimiento...</p>
          </div>
        ) : errorGlobal ? (
          <div className="p-8 bg-red-50 border border-red-200 text-red-800 rounded-xl text-center space-y-2">
            <p className="text-xs font-semibold">{errorGlobal}</p>
            <button
              onClick={cargarDatos}
              className="px-4 py-1.5 text-xs bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
            >
              Reintentar
            </button>
          </div>
        ) : contratosFiltrados.length === 0 ? (
          <div className="p-10 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs space-y-1">
            <p className="font-semibold text-slate-600">No se encontraron contratos coincidentes</p>
            <p className="text-slate-400">Verifica el término de búsqueda o asegúrate de tener contratos activos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contratosFiltrados.map((c) => {
              const cumpPct = c.stats?.cumplimiento_pct ?? 100;
              const keyPdf = `${c.id}-pdf`;
              const keyExcel = `${c.id}-excel`;
              const estadoPdf = generandoMap[keyPdf];
              const estadoExcel = generandoMap[keyExcel];
              const isPdfBusy = Boolean(estadoPdf);
              const isExcelBusy = Boolean(estadoExcel);

              return (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >
                  {/* Info Contrato */}
                  <div className="space-y-1.5 min-w-[280px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{c.nombre}</span>
                      {c.codigo && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 font-bold">
                          {c.codigo}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        📍 {c.faena?.nombre || "Sin faena"}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        🏢 Mandante: <strong className="font-semibold text-slate-800">{c.faena?.mandante || "General"}</strong>
                      </span>
                      {c.unidad_negocio && (
                        <>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-semibold">
                            {c.unidad_negocio}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Métricas de Dotación y Cumplimiento */}
                  <div className="flex items-center gap-6">
                    {/* Barra de progreso de cumplimiento */}
                    <div className="w-36 space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-500 text-[11px]">Cumplimiento</span>
                        <span className={cumpPct >= 80 ? "text-emerald-600" : "text-amber-600"}>
                          {cumpPct}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cumpPct >= 80 ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(cumpPct, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Resumen rápido de dotación */}
                    <div className="hidden sm:flex items-center gap-3 text-xs text-slate-600 border-l border-slate-200 pl-4">
                      <div>
                        <span className="block font-bold text-slate-800">
                          {c.stats?.personal?.acreditados ?? 0}/{c.stats?.personal?.total ?? 0}
                        </span>
                        <span className="text-[10px] text-slate-400">Personal OK</span>
                      </div>
                      <div>
                        <span className="block font-bold text-slate-800">
                          {c.stats?.equipos?.acreditados ?? 0}/{c.stats?.equipos?.total ?? 0}
                        </span>
                        <span className="text-[10px] text-slate-400">Equipos OK</span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones de Descarga */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    {/* Botón Ver y Descargar (PDF) */}
                    <button
                      onClick={() => descargarReporteContrato(c, "pdf")}
                      disabled={isPdfBusy || isExcelBusy}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 border transition ${
                        isPdfBusy
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                          : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80 hover:border-red-300"
                      }`}
                      title="Descargar reporte ejecutivo en formato PDF"
                    >
                      {isPdfBusy ? (
                        <>
                          <span className="inline-block animate-spin w-3.5 h-3.5 border-2 border-red-400 border-t-red-700 rounded-full" />
                          <span>
                            {estadoPdf?.status === "downloading"
                              ? "Descargando..."
                              : estadoPdf?.status === "processing"
                              ? "Generando PDF..."
                              : "Encolando..."}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm">📄</span>
                          <span>Ver y descargar (PDF)</span>
                        </>
                      )}
                    </button>

                    {/* Botón Excel */}
                    <button
                      onClick={() => descargarReporteContrato(c, "excel")}
                      disabled={isPdfBusy || isExcelBusy}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 border transition ${
                        isExcelBusy
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80 hover:border-emerald-300"
                      }`}
                      title="Descargar planilla completa en formato Excel (.xlsx)"
                    >
                      {isExcelBusy ? (
                        <>
                          <span className="inline-block animate-spin w-3.5 h-3.5 border-2 border-emerald-400 border-t-emerald-700 rounded-full" />
                          <span>
                            {estadoExcel?.status === "downloading"
                              ? "Descargando..."
                              : estadoExcel?.status === "processing"
                              ? "Generando XLSX..."
                              : "Encolando..."}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-sm">📊</span>
                          <span>Excel</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Catálogo Inferior de Reportes Disponibles */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Catálogo de Reportes Especializados</h3>
          <p className="text-xs text-slate-500">
            Exporta vistas consolidadas a nivel de empresa o programa despachos periódicos a tu correo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CATALOGO_REPORTES.map((item) => {
            const keyPdf = `catalogo-${item.tipo}-pdf`;
            const keyXlsx = `catalogo-${item.tipo}-excel`;
            const isBusy = Boolean(generandoMap[keyPdf] || generandoMap[keyXlsx]);

            return (
              <div
                key={item.tipo}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.color}`}>
                      {item.badge}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">PDF / XLSX</span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">{item.titulo}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.descripcion}</p>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => generarDesdeCatalogo(item.tipo, "pdf", item.titulo)}
                      disabled={isBusy}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition"
                      title="Descargar versión PDF"
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => generarDesdeCatalogo(item.tipo, "excel", item.titulo)}
                      disabled={isBusy}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition"
                      title="Descargar versión Excel"
                    >
                      Excel
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setModalProg({
                        abierto: true,
                        tipo: item.tipo,
                        nombre: `Reporte Periódico: ${item.titulo}`,
                        formato: "excel",
                        frecuencia: "semanal",
                        guardando: false,
                      });
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50/80 border border-blue-200/80 rounded-lg hover:bg-blue-100 transition"
                  >
                    Programar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Programación */}
      {modalProg.abierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-sm text-slate-900">Programar Despacho Automático</h4>
              <button
                onClick={() => setModalProg((p) => ({ ...p, abierto: false }))}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nombre de la Programación</label>
                <input
                  type="text"
                  value={modalProg.nombre}
                  onChange={(e) => setModalProg((p) => ({ ...p, nombre: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
                  placeholder="Ej: Reporte Semanal de Dotación"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Formato</label>
                  <select
                    value={modalProg.formato}
                    onChange={(e) =>
                      setModalProg((p) => ({ ...p, formato: e.target.value as "pdf" | "excel" }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden bg-white"
                  >
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="pdf">PDF Documento</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Frecuencia</label>
                  <select
                    value={modalProg.frecuencia}
                    onChange={(e) =>
                      setModalProg((p) => ({
                        ...p,
                        frecuencia: e.target.value as "diario" | "semanal" | "mensual",
                      }))
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden bg-white"
                  >
                    <option value="diario">Diaria (08:00 hrs)</option>
                    <option value="semanal">Semanal (Lunes 08:00)</option>
                    <option value="mensual">Mensual (Día 1 08:00)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl leading-relaxed text-[11px]">
                ℹ️ Los reportes se generarán automáticamente por el worker de Celery en segundo plano y quedarán disponibles para descarga directa en la plataforma.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setModalProg((p) => ({ ...p, abierto: false }))}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={guardarProgramacion}
                disabled={modalProg.guardando}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition disabled:opacity-50"
              >
                {modalProg.guardando ? "Guardando..." : "Confirmar Programación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
