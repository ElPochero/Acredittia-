"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as Api from "@/lib/cliente";
import type { ContratoCertificacionLaboral } from "@/lib/tipos";
import { Spinner, Kpi, Chip } from "@/components/ui";

export default function CertificacionLaboralPage() {
  const router = useRouter();
  const [contratos, setContratos] = useState<ContratoCertificacionLaboral[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [vista, setVista] = useState<"tarjetas" | "tabla">("tarjetas");

  const cargarContratos = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await Api.certificacion.listarContratos({
        busqueda: busqueda.trim() || undefined,
        estado: filtroEstado !== "todos" ? filtroEstado : undefined,
      });
      setContratos(res.items || []);
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

        {/* Filtros de Estado */}
        <div className="flex items-center gap-2">
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="todos">Todos los Estados</option>
            <option value="vigente">Activo / Vigente</option>
            <option value="en_evaluacion">En Acreditación</option>
            <option value="terminado">Finalizado</option>
          </select>

          {/* Toggle Vista: Cuadrícula vs Tabla */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            <button
              onClick={() => setVista("tarjetas")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                vista === "tarjetas" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Vista en tarjetas"
            >
              ⊞ Tarjetas
            </button>
            <button
              onClick={() => setVista("tabla")}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                vista === "tabla" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Vista en tabla"
            >
              ☰ Tabla
            </button>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      {cargando ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-100 bg-white p-8">
          <Spinner texto="Cargando contratos y KPIs de Control Laboral..." />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
          <p className="font-semibold">{error}</p>
          <button
            onClick={() => cargarContratos()}
            className="mt-3 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
          >
            Reintentar
          </button>
        </div>
      ) : contratosFiltrados.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <span className="text-3xl">📂</span>
          <h3 className="mt-2 text-base font-bold text-slate-800">No se encontraron contratos</h3>
          <p className="mt-1 text-xs text-slate-500">
            {busqueda || filtroEstado !== "todos"
              ? "Prueba ajustando los criterios de búsqueda o restableciendo los filtros."
              : "No hay contratos dados de alta para esta empresa."}
          </p>
          {(busqueda || filtroEstado !== "todos") && (
            <button
              onClick={() => {
                setBusqueda("");
                setFiltroEstado("todos");
              }}
              className="mt-4 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : vista === "tarjetas" ? (
        /* Vista en Cuadrícula de Tarjetas (.cl-cts / .cl-ct) */
        <div className="cl-cts">
          {contratosFiltrados.map((c) => {
            const pct = c.porcentaje_cumplimiento || 0;
            const barColor = colorCumplimiento(pct);

            return (
              <div
                key={c.id}
                onClick={() => irAContrato(c.id)}
                className="cl-ct group"
              >
                {/* Parte Superior: Título y Código */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-blue-600">
                        {c.nombre}
                      </h3>
                      {c.codigo && (
                        <span className="text-[11px] font-medium text-slate-500">
                          Código: {c.codigo}
                        </span>
                      )}
                    </div>
                    <Chip estado={c.estado} />
                  </div>

                  {/* Metadata de Empresa y Faena */}
                  <div className="mt-2.5 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-slate-400">🏢</span>
                      <span className="font-medium text-slate-700 truncate">
                        {c.empresa_proveedora || "Empresa Principal"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-slate-400">📍</span>
                      <span className="truncate">{c.faena_nombre || "Faena no asignada"}</span>
                    </div>
                  </div>

                  {/* Período Vigente */}
                  <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold text-slate-800">
                        🗓️ {c.periodo_vigente_nombre || "Sin período activo"}
                      </span>
                      {c.estado_periodo && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            c.estado_periodo === "cerrado"
                              ? "bg-emerald-100 text-emerald-800"
                              : c.estado_periodo === "en_auditoria" || c.estado_periodo === "en_revision"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {c.estado_periodo}
                        </span>
                      )}
                    </div>

                    {/* Barra de Cumplimiento (.cl-mbar) */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Cumplimiento período</span>
                        <span style={{ color: barColor }}>{pct}%</span>
                      </div>
                      <div className="cl-mbar">
                        <div
                          className="cl-mbar-fill"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Badges de Estado y Acciones Rápidas */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {c.por_revisar_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 animate-pulse">
                        🔍 {c.por_revisar_count} por revisar
                      </span>
                    )}

                    {c.pendientes_carga_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        ⏳ {c.pendientes_carga_count} pendientes
                      </span>
                    )}

                    {c.aprobados_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        ✓ {c.aprobados_count} aprobados
                      </span>
                    )}
                  </div>
                </div>

                {/* Botón Inferior: Ingresar al Contrato */}
                <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400">
                    ADC: <span className="font-medium text-slate-600">{c.adc_asignado || "No asignado"}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                    Ingresar al contrato →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista en Tabla */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Contrato / Código</th>
                <th className="px-4 py-3">Empresa Proveedora</th>
                <th className="px-4 py-3">Faena / Mandante</th>
                <th className="px-4 py-3">Período Vigente</th>
                <th className="px-4 py-3">Cumplimiento</th>
                <th className="px-4 py-3">Estado Entregas</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contratosFiltrados.map((c) => {
                const pct = c.porcentaje_cumplimiento || 0;
                const barColor = colorCumplimiento(pct);

                return (
                  <tr
                    key={c.id}
                    onClick={() => irAContrato(c.id)}
                    className="cursor-pointer hover:bg-slate-50/80 transition"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div>{c.nombre}</div>
                      {c.codigo && <div className="text-[10px] text-slate-400 font-normal">{c.codigo}</div>}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {c.empresa_proveedora || "Empresa Principal"}
                    </td>
                    <td className="px-4 py-3">
                      <div>{c.faena_nombre || "Sin faena"}</div>
                      <div className="text-[10px] text-slate-400">{c.mandante || "Mandante Principal"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{c.periodo_vigente_nombre}</div>
                      <span className="text-[10px] text-slate-500 uppercase">{c.estado_periodo}</span>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <div className="flex items-center justify-between font-bold mb-1" style={{ color: barColor }}>
                        <span>{pct}%</span>
                      </div>
                      <div className="cl-mbar">
                        <div className="cl-mbar-fill" style={{ width: `${pct}%`, backgroundColor: barColor }} />
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
    </div>
  );
}
