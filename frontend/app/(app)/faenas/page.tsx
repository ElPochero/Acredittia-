"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import * as Api from "@/lib/cliente";
import type { FaenaAgrupada } from "@/lib/tipos";
import { Spinner, Vacio } from "@/components/ui";
import { NuevaModalContrato } from "@/components/contratos/NuevaModalContrato";

export default function FaenasPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faenasList, setFaenasList] = useState<FaenaAgrupada[]>([]);
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
        Api.faenas.agrupado(unidadFiltro ? { unidad_negocio: unidadFiltro } : undefined),
        Api.contratos.unidadesNegocio().catch(() => ({ items: [], total: 0 })),
      ]);
      setFaenasList(agrupados || []);
      setUnidades((resUnidades.items || []).map((u) => u.nombre));
      
      // Auto expandir las faenas que tienen contratos
      const inicial: Record<string, boolean> = {};
      (agrupados || []).forEach((f) => {
        if (f.contratos_total > 0) {
          inicial[f.faena_id] = true;
        }
      });
      setExpandidos(inicial);
    } catch (err) {
      console.error("Error al cargar faenas agrupadas:", err);
      setError(Api.mensajeError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [unidadFiltro]);

  const toggleExpand = (id: string) => {
    setExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandirTodos = () => {
    const todos: Record<string, boolean> = {};
    faenasList.forEach((f) => {
      todos[f.faena_id] = true;
    });
    setExpandidos(todos);
  };

  const colapsarTodos = () => {
    setExpandidos({});
  };

  // Filtrado en memoria por búsqueda
  const faenasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return faenasList;
    return faenasList.filter((f) => {
      const matchNombre = f.nombre.toLowerCase().includes(q);
      const matchMandante = (f.mandante_defecto || "").toLowerCase().includes(q);
      const matchRegion = (f.region || "").toLowerCase().includes(q);
      const matchContratos = f.contratos.some(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.codigo || "").toLowerCase().includes(q) ||
          c.mandante.toLowerCase().includes(q)
      );
      return matchNombre || matchMandante || matchRegion || matchContratos;
    });
  }, [faenasList, busqueda]);

  // Totales para KPIs
  const totales = useMemo(() => {
    let contratos = 0;
    let personalTotal = 0;
    let personalAcreditado = 0;
    let sumaCumplimiento = 0;
    let conContratos = 0;

    faenasList.forEach((f) => {
      contratos += f.contratos_total;
      personalTotal += f.personal.total;
      personalAcreditado += f.personal.acreditados;
      if (f.contratos_total > 0) {
        sumaCumplimiento += f.cumplimiento_pct;
        conContratos++;
      }
    });

    const promCumplimiento = conContratos > 0 ? Math.round((sumaCumplimiento / conContratos) * 10) / 10 : 0;
    return {
      faenasTotal: faenasList.length,
      faenasConContratos: conContratos,
      contratos,
      personalTotal,
      personalAcreditado,
      promCumplimiento,
    };
  }, [faenasList]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Encabezado y Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>🏔️</span> Vista Agrupada por Faenas
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervisa tus contratos, dotación de personal y porcentaje de cumplimiento organizados por faena operativa.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/mandantes"
            className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>🏢</span> Ver por Mandantes
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
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Faenas Operativas</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {loading ? "-" : `${totales.faenasConContratos} / ${totales.faenasTotal}`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Faenas con contratos activos</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Contratos</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {loading ? "-" : totales.contratos}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">En todas las faenas</div>
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
          <div className="text-[11px] text-slate-400 mt-0.5">Promedio ponderado faenas</div>
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
              placeholder="Buscar por faena, mandante o contrato..."
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
          <p className="text-xs text-slate-500 mt-3 font-medium">Cargando contratos agrupados por faena...</p>
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
      {!loading && !error && faenasFiltradas.length === 0 && (
        <Vacio
          mensaje={
            busqueda
              ? `No se encontraron faenas ni contratos que coincidan con «${busqueda}».`
              : "No hay faenas registradas en la plataforma."
          }
          cta="Crear nuevo contrato"
          onCta={() => setModalNuevoAbierto(true)}
        />
      )}

      {/* Lista de Faenas con Acordeón */}
      {!loading && !error && faenasFiltradas.length > 0 && (
        <div className="space-y-4">
          {faenasFiltradas.map((f) => {
            const expandido = !!expandidos[f.faena_id];
            const tieneContratos = f.contratos_total > 0;
            const pctColor =
              f.cumplimiento_pct >= 90
                ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                : f.cumplimiento_pct >= 75
                ? "text-blue-700 bg-blue-50 border-blue-200"
                : f.cumplimiento_pct >= 50
                ? "text-amber-700 bg-amber-50 border-amber-200"
                : "text-red-700 bg-red-50 border-red-200";

            return (
              <div
                key={f.faena_id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:border-slate-300 transition-all"
              >
                {/* Cabecera de Faena (Clickable) */}
                <div
                  onClick={() => toggleExpand(f.faena_id)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: f.color || "#0284c7" }}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900">{f.nombre}</h2>
                        {f.grupo && (
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            {f.grupo}
                          </span>
                        )}
                        {f.region && (
                          <span className="text-[10px] text-slate-400">📍 {f.region}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Mandante por defecto: <span className="font-semibold text-slate-700">{f.mandante_defecto}</span>
                      </p>
                    </div>
                  </div>

                  {/* Métricas resumidas de la Faena */}
                  <div className="flex items-center gap-4 sm:gap-6 flex-wrap md:flex-nowrap justify-between md:justify-end">
                    <div className="text-right">
                      <div className="text-[10px] font-medium text-slate-400 uppercase">Contratos</div>
                      <div className="text-xs font-bold text-slate-800">
                        {f.contratos_total === 1 ? "1 contrato" : `${f.contratos_total} contratos`}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-medium text-slate-400 uppercase">Personal</div>
                      <div className="text-xs font-bold text-slate-800">
                        {f.personal.acreditados} / {f.personal.total}
                      </div>
                    </div>

                    <div className="text-right min-w-[90px]">
                      <div className="text-[10px] font-medium text-slate-400 uppercase">Cumplimiento</div>
                      <div className="flex items-center justify-end gap-1.5 mt-0.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${pctColor}`}>
                          {tieneContratos ? `${f.cumplimiento_pct}%` : "S/C"}
                        </span>
                      </div>
                    </div>

                    <div className="text-slate-400 hover:text-slate-600 pl-2">
                      <span className="text-sm inline-block transition-transform duration-200" style={{ transform: expandido ? "rotate(180deg)" : "rotate(0deg)" }}>
                        ▼
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contenido Expandido: Contratos de la Faena */}
                {expandido && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                    {!tieneContratos ? (
                      <div className="bg-white border border-dashed border-slate-200 rounded-lg p-6 text-center">
                        <p className="text-xs text-slate-500">
                          Tu empresa no tiene contratos asociados a esta faena actualmente.
                        </p>
                        <button
                          onClick={() => setModalNuevoAbierto(true)}
                          className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                        >
                          ➕ Asociar un contrato a {f.nombre}
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="py-2.5 px-3.5">Contrato</th>
                              <th className="py-2.5 px-3.5">Mandante efectivo</th>
                              <th className="py-2.5 px-3.5">Unidad</th>
                              <th className="py-2.5 px-3.5 text-center">Personal</th>
                              <th className="py-2.5 px-3.5 text-center">Equipos</th>
                              <th className="py-2.5 px-3.5 text-center">Cumplimiento</th>
                              <th className="py-2.5 px-3.5 text-center">Estado</th>
                              <th className="py-2.5 px-3.5 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {f.contratos.map((c) => {
                              const mandanteDiferente =
                                c.mandante.toLowerCase().trim() !== f.mandante_defecto.toLowerCase().trim();
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
                                  <td className="py-3 px-3.5 text-slate-700 font-medium">
                                    <div className="flex items-center gap-1.5">
                                      <span>{c.mandante}</span>
                                      {mandanteDiferente && (
                                        <span
                                          className="text-[9px] bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.5 rounded border border-indigo-100"
                                          title="Mandante personalizado en este contrato"
                                        >
                                          Personalizado
                                        </span>
                                      )}
                                    </div>
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
                    )}
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
