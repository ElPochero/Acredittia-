"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as Api from "@/lib/cliente";
import type { ContratoCertificacionLaboral } from "@/lib/tipos";
import { Spinner, Kpi, Chip } from "@/components/ui";
import MisPendientesRrhhView from "@/components/certificacion/MisPendientesRrhhView";

export default function CertificacionLaboralPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Conmutador de vista principal (Sección 3.4, CA 9)
  const tabQuery = searchParams.get("tab");
  const [vistaPrincipal, setVistaPrincipal] = useState<"contratos" | "pendientes">(
    tabQuery === "pendientes" ? "pendientes" : "contratos"
  );
  const [totalPendientesRrhh, setTotalPendientesRrhh] = useState<number>(0);

  const [contratos, setContratos] = useState<ContratoCertificacionLaboral[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de contratos
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [vista, setVista] = useState<"tarjetas" | "tabla">("tarjetas");

  const cargarContratos = async () => {
    setCargando(true);
    setError(null);
    try {
      const [res, pendientesRes] = await Promise.all([
        Api.certificacion.listarContratos({
          busqueda: busqueda.trim() || undefined,
          estado: filtroEstado !== "todos" ? filtroEstado : undefined,
        }),
        Api.certificacion.obtenerMisPendientes().catch(() => null),
      ]);
      setContratos(res.items || []);
      if (pendientesRes) {
        setTotalPendientesRrhh(pendientesRes.total_pendientes || 0);
      }
    } catch (err: any) {
      console.error("Error al cargar contratos de certificación laboral:", err);
      setError("No se pudieron cargar los contratos para Control Laboral.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarContratos();
  }, [filtroEstado]);

  // Búsqueda en cliente para filtrado interactivo instantáneo
  const contratosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return contratos;
    const term = busqueda.toLowerCase().trim();
    return contratos.filter(
      (c) =>
        c.nombre.toLowerCase().includes(term) ||
        (c.codigo && c.codigo.toLowerCase().includes(term)) ||
        (c.empresa_proveedora && c.empresa_proveedora.toLowerCase().includes(term)) ||
        (c.mandante && c.mandante.toLowerCase().includes(term)) ||
        (c.faena_nombre && c.faena_nombre.toLowerCase().includes(term))
    );
  }, [contratos, busqueda]);

  // Cálculos de KPIs globales de la pantalla 1
  const kpis = useMemo(() => {
    const totalContratos = contratos.length;
    const totalPorRevisar = contratos.reduce((acc, c) => acc + (c.por_revisar_count || 0), 0);
    const totalPendientes = contratos.reduce((acc, c) => acc + (c.pendientes_carga_count || 0), 0);
    const totalCumplimiento = contratos.reduce((acc, c) => acc + (c.porcentaje_cumplimiento || 0), 0);
    const cumplimientoPromedio = totalContratos > 0 ? Math.round(totalCumplimiento / totalContratos) : 0;

    return {
      totalContratos,
      totalPorRevisar,
      totalPendientes,
      cumplimientoPromedio,
    };
  }, [contratos]);

  const irAContrato = (contratoId: string) => {
    router.push(`/certificacion-laboral/${contratoId}`);
  };

  const colorCumplimiento = (pct: number) => {
    if (pct >= 85) return "#16A34A"; // Verde
    if (pct >= 50) return "#EAB308"; // Amarillo
    return "#3D62F5"; // Azul
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Cabecera Principal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Certificación Laboral (Control Laboral)
          </h1>
          <p className="text-sm text-slate-500">
            Control de cumplimiento mensual por contrato, auditoría documental F30-1 / Previred y trazabilidad laboral.
          </p>
        </div>

        {/* Botón de recarga rápida */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => cargarContratos()}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            <span>🔄</span> Actualizar
          </button>
        </div>
      </div>

      {/* Conmutador Superior de Vista (Sección 3.4, CA 9) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setVistaPrincipal("contratos")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            vistaPrincipal === "contratos"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>🏢 Mis contratos</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              vistaPrincipal === "contratos" ? "bg-white/20 text-white font-extrabold" : "bg-slate-200 text-slate-700"
            }`}
          >
            {contratos.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setVistaPrincipal("pendientes")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            vistaPrincipal === "pendientes"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <span>📋 Mis pendientes</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] ${
              vistaPrincipal === "pendientes"
                ? "bg-white/20 text-white font-extrabold"
                : "bg-amber-100 text-amber-800 font-extrabold"
            }`}
          >
            {totalPendientesRrhh}
          </span>
        </button>
      </div>

      {/* CONTENIDO SEGÚN VISTA CONMUTADA */}
      {vistaPrincipal === "pendientes" ? (
        <MisPendientesRrhhView onTotalActualizado={setTotalPendientesRrhh} />
      ) : (
        <>
          {/* Tarjetas de KPIs Generales */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              titulo="Contratos en Control"
              valor={kpis.totalContratos}
              sub="Empresas y proyectos"
              color="#3D62F5"
            />
            <Kpi
              titulo="Cumplimiento Promedio"
              valor={`${kpis.cumplimientoPromedio}%`}
              sub="Período vigente"
              color={colorCumplimiento(kpis.cumplimientoPromedio)}
            />
            <Kpi
              titulo="Documentos Pendientes"
              valor={kpis.totalPendientes}
              sub="Por cargar en nóminas"
              color="#F97316"
            />
            <Kpi
              titulo="Entregas por Revisar"
              valor={kpis.totalPorRevisar}
              sub="Bandeja auditoría ADC"
              color="#DC2626"
            />
          </div>

          {/* Barra de Filtros y Búsqueda */}
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            {/* Input Buscador */}
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre de contrato, código, faena o mandante..."
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtros de Estado y Vista */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition focus:border-indigo-500 focus:outline-none"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Solo Activos</option>
                <option value="en_revision">En Revisión</option>
                <option value="cerrado">Cerrados</option>
              </select>

              {/* Botones Selector de Vista (Tarjetas / Tabla) */}
              <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  onClick={() => setVista("tarjetas")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    vista === "tarjetas"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Vista Cuadrícula"
                >
                  🗂️ Cuadrícula
                </button>
                <button
                  onClick={() => setVista("tabla")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    vista === "tabla"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Vista Tabla"
                >
                  📄 Tabla
                </button>
              </div>
            </div>
          </div>

          {/* Indicador de Carga */}
          {cargando && (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Spinner texto="Actualizando contratos laborales..." />
            </div>
          )}

          {/* Mensaje de Error */}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm font-semibold text-rose-700 shadow-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Estado Vacío */}
          {!cargando && !error && contratosFiltrados.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
              <span className="text-4xl">📂</span>
              <h3 className="mt-2 text-base font-bold text-slate-800">
                No se encontraron contratos para Control Laboral
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {busqueda
                  ? "Prueba modificando los términos de búsqueda o los filtros."
                  : "No hay contratos configurados actualmente en faena para este período."}
              </p>
            </div>
          )}

          {/* Renderizado de Contratos: VISTA CUADRÍCULA */}
          {!cargando && !error && vista === "tarjetas" && contratosFiltrados.length > 0 && (
            <div className="cl-cts">
              {contratosFiltrados.map((c) => {
                const tieneAlertas = c.por_revisar_count > 0;
                const tienePendientes = c.pendientes_carga_count > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => irAContrato(c.id)}
                    className="cl-ct hover:border-indigo-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Cabecera de la tarjeta */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {c.codigo || "S/C"}
                        </span>
                        <Chip estado={c.estado_contractual || c.estado} texto={c.estado_contractual || c.estado} />
                      </div>

                      {/* Nombre y datos del contrato */}
                      <h3 className="text-sm font-bold text-slate-900 line-clamp-1 mb-1" title={c.nombre}>
                        {c.nombre}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-1 mb-3">
                        🏢 {c.empresa_proveedora}
                      </p>

                      <div className="text-[11px] text-slate-600 space-y-0.5 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div>
                          <strong className="text-slate-700">Mandante:</strong> {c.mandante_nombre || c.mandante || "Mandante"}
                        </div>
                        <div>
                          <strong className="text-slate-700">Faena:</strong> {c.faena_nombre}
                        </div>
                        {c.periodo_vigente_nombre && (
                          <div className="text-indigo-600 font-semibold pt-0.5">
                            📅 Período: {c.periodo_vigente_nombre}
                          </div>
                        )}
                      </div>

                      {/* Barra de progreso de cumplimiento */}
                      <div className="space-y-1 mb-4">
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="text-slate-500">Cumplimiento Período</span>
                          <span style={{ color: colorCumplimiento(c.porcentaje_cumplimiento) }}>
                            {Math.round(c.porcentaje_cumplimiento)}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.round(c.porcentaje_cumplimiento))}%`,
                              backgroundColor: colorCumplimiento(c.porcentaje_cumplimiento),
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pie de la tarjeta: Badges de alertas y acción */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                      <div className="flex flex-wrap gap-1">
                        {tieneAlertas && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                            🔍 {c.por_revisar_count} por revisar
                          </span>
                        )}
                        {tienePendientes && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            ⏳ {c.pendientes_carga_count} pend.
                          </span>
                        )}
                        {!tieneAlertas && !tienePendientes && c.aprobados_count > 0 && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                            ✓ {c.aprobados_count} aprobados
                          </span>
                        )}
                      </div>

                      <span className="font-bold text-indigo-600 hover:underline">
                        Ingresar →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Renderizado de Contratos: VISTA TABLA */}
          {!cargando && !error && vista === "tabla" && contratosFiltrados.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Nombre del Contrato</th>
                    <th className="px-4 py-3">Empresa Proveedora</th>
                    <th className="px-4 py-3">Faena</th>
                    <th className="px-4 py-3">Período Vigente</th>
                    <th className="px-4 py-3">Cumplimiento</th>
                    <th className="px-4 py-3">Alertas</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contratosFiltrados.map((c) => {
                    return (
                      <tr
                        key={c.id}
                        onClick={() => irAContrato(c.id)}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-slate-500">
                          {c.codigo || "S/C"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{c.nombre}</div>
                          <div className="text-[10px] text-slate-400">
                            Mandante: {c.mandante_nombre || c.mandante || "Mandante"}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {c.empresa_proveedora}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {c.faena_nombre}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                            {c.periodo_vigente_nombre || "Sin período"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="font-bold"
                              style={{ color: colorCumplimiento(c.porcentaje_cumplimiento) }}
                            >
                              {Math.round(c.porcentaje_cumplimiento)}%
                            </span>
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.round(c.porcentaje_cumplimiento))}%`,
                                  backgroundColor: colorCumplimiento(c.porcentaje_cumplimiento),
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.por_revisar_count > 0 && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                                🔍 {c.por_revisar_count} por revisar
                              </span>
                            )}
                            {c.pendientes_carga_count > 0 && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                ⏳ {c.pendientes_carga_count} pend.
                              </span>
                            )}
                            {c.aprobados_count > 0 && (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                                ✓ {c.aprobados_count}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              irAContrato(c.id);
                            }}
                            className="rounded-lg bg-blue-50 px-3 py-1.5 font-bold text-blue-600 hover:bg-blue-100 active:scale-95 transition"
                          >
                            Ingresar →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
