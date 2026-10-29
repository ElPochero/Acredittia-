"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import * as Api from "@/lib/cliente";
import type { MandanteAgrupado } from "@/lib/tipos";
import { Spinner, Vacio } from "@/components/ui";
import { NuevaModalContrato } from "@/components/contratos/NuevaModalContrato";

export default function MandantesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mandantesList, setMandantesList] = useState<MandanteAgrupado[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [unidadFiltro, setUnidadFiltro] = useState("");
  const [unidades, setUnidades] = useState<string[]>([]);
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);
    try {
      const [agrupados, resUnidades] = await Promise.all([
        Api.contratos.agrupadoPorMandante(unidadFiltro ? { unidad_negocio: unidadFiltro } : undefined),
        Api.contratos.unidadesNegocio().catch(() => ({ items: [], total: 0 })),
      ]);
      setMandantesList(agrupados || []);
      setUnidades((resUnidades.items || []).map((u) => u.nombre));

      // Auto expandir todos los mandantes inicialmente
      const inicial: Record<string, boolean> = {};
      (agrupados || []).forEach((m) => {
        inicial[m.mandante] = true;
      });
      setExpandidos(inicial);
    } catch (err) {
      console.error("Error al cargar mandantes agrupados:", err);
      setError(Api.mensajeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [unidadFiltro]);

  const toggleExpand = (nombre: string) => {
    setExpandidos((prev) => ({ ...prev, [nombre]: !prev[nombre] }));
  };

  const expandirTodos = () => {
    const todos: Record<string, boolean> = {};
    mandantesList.forEach((m) => {
      todos[m.mandante] = true;
    });
    setExpandidos(todos);
  };

  const colapsarTodos = () => {
    setExpandidos({});
  };

  // Filtrado en memoria
  const mandantesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return mandantesList;
    return mandantesList.filter((m) => {
      const matchMandante = m.mandante.toLowerCase().includes(q);
      const matchFaenas = m.faenas.some((f) => f.nombre.toLowerCase().includes(q));
      const matchContratos = m.contratos.some(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.codigo || "").toLowerCase().includes(q) ||
          (c.faena?.nombre || "").toLowerCase().includes(q)
      );
      return matchMandante || matchFaenas || matchContratos;
    });
  }, [mandantesList, busqueda]);

  // Totales para KPIs
  const totales = useMemo(() => {
    let contratos = 0;
    let personalTotal = 0;
    let personalAcreditado = 0;
    let sumaCumplimiento = 0;

    mandantesList.forEach((m) => {
      contratos += m.contratos_total;
      personalTotal += m.personal.total;
      personalAcreditado += m.personal.acreditados;
      sumaCumplimiento += m.cumplimiento_pct;
    });

    const promCumplimiento =
      mandantesList.length > 0 ? Math.round((sumaCumplimiento / mandantesList.length) * 10) / 10 : 0;

    return {
      totalMandantes: mandantesList.length,
      contratos,
      personalTotal,
      personalAcreditado,
      promCumplimiento,
    };
  }, [mandantesList]);

  const getAvatarColor = (name: string) => {
    const char = name.trim().charAt(0).toUpperCase();
    if (["A", "E", "I", "O", "U"].includes(char)) return "bg-blue-600 text-white";
    if (["L", "M", "N", "C"].includes(char)) return "bg-amber-600 text-white";
    if (["R", "S", "T"].includes(char)) return "bg-teal-600 text-white";
    return "bg-slate-700 text-white";
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>🏢</span> Vista Agrupada por Mandantes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervisa tus contratos, dotación acreditada y cumplimiento agrupados por empresa mandante efectiva.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/faenas"
            className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>🏔️</span> Ver por Faenas
          </Link>
          <button
            onClick={() => setModalNuevoAbierto(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>➕</span> Nuevo contrato
          </button>
        </div>
      </div>

      {/* KPIs superiores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mandantes Activos</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {loading ? "-" : totales.totalMandantes}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Empresas mandantes con contratos</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Contratos</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {loading ? "-" : totales.contratos}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Asignados a mandantes</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Personal Acreditado</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {loading ? "-" : `${totales.personalAcreditado} / ${totales.personalTotal}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {totales.personalTotal > 0
              ? `${Math.round((totales.personalAcreditado / totales.personalTotal) * 100)}% de dotación activa`
              : "Sin personal asignado"}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cumplimiento Global</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            {loading ? "-" : `${totales.promCumplimiento}%`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Promedio general mandantes</div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              placeholder="Buscar por mandante, faena o contrato..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:bg-white focus:border-blue-500 outline-none transition-colors"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute inset-y-0 right-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {unidades.length > 0 && (
            <select
              value={unidadFiltro}
              onChange={(e) => setUnidadFiltro(e.target.value)}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-colors"
            >
              <option value="">Todas las unidades</option>
              {unidades.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={expandirTodos}
            className="text-[11px] font-medium text-slate-600 hover:text-blue-600 px-2 py-1 rounded transition-colors"
          >
            Expandir todos
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={colapsarTodos}
            className="text-[11px] font-medium text-slate-600 hover:text-blue-600 px-2 py-1 rounded transition-colors"
          >
            Colapsar todos
          </button>
        </div>
      </div>

      {/* Estados de Carga y Error */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <Spinner />
          <p className="text-xs text-slate-500 mt-3 font-medium">Cargando contratos agrupados por mandante...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-5 shadow-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">
            <h4 className="font-bold text-xs uppercase tracking-wider">Error al cargar datos</h4>
            <p className="text-xs text-red-700 mt-1">{error}</p>
            <button
              onClick={cargarDatos}
              className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Estado Vacío */}
      {!loading && !error && mandantesFiltrados.length === 0 && (
        <Vacio
          mensaje={
            busqueda
              ? `No se encontraron mandantes ni contratos que coincidan con «${busqueda}».`
              : "No hay contratos asociados a mandantes en tu empresa."
          }
          cta="Crear nuevo contrato"
          onCta={() => setModalNuevoAbierto(true)}
        />
      )}

      {/* Lista de Mandantes con Acordeón */}
      {!loading && !error && mandantesFiltrados.length > 0 && (
        <div className="space-y-4">
          {mandantesFiltrados.map((m) => {
            const expandido = !!expandidos[m.mandante];
            const pctColor =
              m.cumplimiento_pct >= 90
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : m.cumplimiento_pct >= 75
                ? "text-blue-700 bg-blue-50 border-blue-200"
                : m.cumplimiento_pct >= 50
                ? "text-amber-700 bg-amber-50 border-amber-200"
                : "text-red-700 bg-red-50 border-red-200";

            return (
              <div
                key={m.mandante}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:border-slate-300 transition-all"
              >
                {/* Cabecera del Mandante (Clickable) */}
                <div
                  onClick={() => toggleExpand(m.mandante)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs uppercase tracking-wider flex-shrink-0 shadow-sm ${getAvatarColor(
                        m.mandante
                      )}`}
                    >
                      {m.mandante.substring(0, 2)}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900">{m.mandante}</h2>
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          {m.faenas.length} {m.faenas.length === 1 ? "faena" : "faenas"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {m.faenas.map((f) => (
                          <span
                            key={f.id}
                            className="inline-flex items-center gap-1 text-[10px] bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: f.color || "#0284c7" }}
                            />
                            {f.nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Métricas resumidas del Mandante */}
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap md:flex-nowrap justify-between md:justify-end">
                    <div className="text-right">
                      <div className="text-[10px] font-medium text-slate-400 uppercase">Contratos</div>
                      <div className="text-xs font-bold text-slate-800">
                        {m.contratos_total === 1 ? "1 contrato" : `${m.contratos_total} contratos`}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-medium text-slate-400 uppercase">Personal</div>
                      <div className="text-xs font-bold text-slate-800">
                        {m.personal.acreditados} / {m.personal.total}
                      </div>
                    </div>

                    <div className="text-right min-w-[90px]">
                      <div className="text-[10px] font-medium text-slate-400 uppercase">Cumplimiento</div>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${pctColor}`}>
                          {m.cumplimiento_pct}%
                        </span>
                      </div>
                    </div>

                    <div className="text-slate-400 hover:text-slate-600 pl-2">
                      <span
                        className="text-sm inline-block transition-transform duration-200"
                        style={{ transform: expandido ? "rotate(180deg)" : "rotate(0deg)" }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contenido Expandido: Contratos del Mandante */}
                {expandido && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3.5">Contrato</th>
                            <th className="py-2.5 px-3.5">Faena de operación</th>
                            <th className="py-2.5 px-3.5">Unidad</th>
                            <th className="py-2.5 px-3.5 text-center">Personal</th>
                            <th className="py-2.5 px-3.5 text-center">Equipos</th>
                            <th className="py-2.5 px-3.5 text-center">Cumplimiento</th>
                            <th className="py-2.5 px-3.5 text-center">Estado</th>
                            <th className="py-2.5 px-3.5 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {m.contratos.map((c) => {
                            const cPctColor =
                              c.cumplimiento_pct >= 90
                                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                : c.cumplimiento_pct >= 75
                                ? "text-blue-700 bg-blue-50 border-blue-200"
                                : c.cumplimiento_pct >= 50
                                ? "text-amber-700 bg-amber-50 border-amber-200"
                                : "text-red-700 bg-red-50 border-red-200";

                            return (
                              <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-3.5">
                                  <Link
                                    href={`/contratos/${c.id}`}
                                    className="font-bold text-slate-800 hover:text-blue-600 block transition-colors"
                                  >
                                    {c.nombre}
                                  </Link>
                                  {c.codigo && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      N° {c.codigo}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3.5 text-slate-700">
                                  {c.faena ? (
                                    <span className="inline-flex items-center gap-1.5 font-medium">
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: c.faena.color || "#0284c7" }}
                                      />
                                      {c.faena.nombre}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">Sin faena</span>
                                  )}
                                </td>
                                <td className="py-3 px-3.5 text-slate-500">
                                  {c.unidad_negocio || "—"}
                                </td>
                                <td className="py-3 px-3.5 text-center font-medium text-slate-700">
                                  {c.personal.acreditados} / {c.personal.total}
                                </td>
                                <td className="py-3 px-3.5 text-center font-medium text-slate-700">
                                  {c.equipos.acreditados} / {c.equipos.total}
                                </td>
                                <td className="py-3 px-3.5 text-center">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cPctColor}`}>
                                    {c.cumplimiento_pct}%
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-center">
                                  <span
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                      c.estado === "activo"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {c.estado}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-right">
                                  <Link
                                    href={`/contratos/${c.id}`}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                                  >
                                    Ver contrato →
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Crear Contrato */}
      {modalNuevoAbierto && (
        <NuevaModalContrato
          abierto={modalNuevoAbierto}
          onCerrar={() => setModalNuevoAbierto(false)}
          onCreado={() => {
            setModalNuevoAbierto(false);
            cargarDatos();
          }}
        />
      )}
    </div>
  );
}
