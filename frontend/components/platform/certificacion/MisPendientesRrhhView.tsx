"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as Api from "@/lib/platform/cliente";
import type {
  MisPendientesRrhhRespuesta,
  MisPendientesDocumentoItem,
} from "@/lib/platform/tipos";
import { Spinner, Modal, Chip } from "@/components/shared/ui";

interface MisPendientesRrhhViewProps {
  onTotalActualizado?: (total: number) => void;
}

export default function MisPendientesRrhhView({ onTotalActualizado }: MisPendientesRrhhViewProps) {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState<MisPendientesRrhhRespuesta | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtros internos
  const [filtroTab, setFiltroTab] = useState<"todos" | "observados" | "pendientes" | "periodos">("todos");
  const [busqueda, setBusqueda] = useState("");

  // Modal de Subida de Corrección o Requisito
  const [modalSubidaAbierto, setModalSubidaAbierto] = useState(false);
  const [itemParaSubir, setItemParaSubir] = useState<MisPendientesDocumentoItem | null>(null);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);

  const cargarPendientes = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await Api.certificacion.obtenerMisPendientes();
      setDatos(res);
      if (onTotalActualizado) {
        onTotalActualizado(res.total_pendientes);
      }
    } catch (err: any) {
      console.error("Error al cargar pendientes de RR.HH.:", err);
      setError("No se pudieron cargar los pendientes de RR.HH.");
    } finally {
      setCargando(false);
    }
  }, [onTotalActualizado]);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  const abrirModalSubida = (item: MisPendientesDocumentoItem) => {
    setItemParaSubir(item);
    setArchivoSeleccionado(null);
    setErrorSubida(null);
    setModalSubidaAbierto(true);
  };

  const handleConfirmarSubida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemParaSubir || !archivoSeleccionado) return;

    setSubiendo(true);
    setErrorSubida(null);
    try {
      const urlFake = `https://storage.acredittia.cl/${archivoSeleccionado.name}`;
      await Api.certificacion.subirDocumentoDirecto(
        itemParaSubir.periodo_id,
        itemParaSubir.documento_id,
        {
          archivo_url: urlFake,
          archivo_nombre: archivoSeleccionado.name,
        }
      );
      alert(
        itemParaSubir.estado === "observado" || itemParaSubir.estado === "rechazado"
          ? `✅ Corrección subida exitosamente como versión ${(itemParaSubir.version || 1) + 1}. El documento pasó a 'En revisión' para el ADC.`
          : `✅ Documento subido exitosamente. Ha quedado en estado 'En revisión' para el ADC.`
      );
      setModalSubidaAbierto(false);
      setItemParaSubir(null);
      setArchivoSeleccionado(null);
      await cargarPendientes();
    } catch (err: any) {
      setErrorSubida(err?.message || "Error al subir documento");
    } finally {
      setSubiendo(false);
    }
  };

  const irAPeriodo = (contratoId: string, periodoId: string) => {
    router.push(`/certificacion-laboral/${contratoId}?periodo=${periodoId}`);
  };

  // Filtrado de observados/rechazados
  const observadosFiltrados = useMemo(() => {
    if (!datos?.observados_rechazados) return [];
    if (!busqueda.trim()) return datos.observados_rechazados;
    const term = busqueda.toLowerCase().trim();
    return datos.observados_rechazados.filter(
      (d) =>
        d.contrato_nombre.toLowerCase().includes(term) ||
        d.periodo_nombre.toLowerCase().includes(term) ||
        d.requisito_nombre.toLowerCase().includes(term) ||
        d.sujeto_nombre.toLowerCase().includes(term)
    );
  }, [datos?.observados_rechazados, busqueda]);

  // Filtrado de pendientes de carga
  const pendientesFiltrados = useMemo(() => {
    if (!datos?.pendientes_carga) return [];
    if (!busqueda.trim()) return datos.pendientes_carga;
    const term = busqueda.toLowerCase().trim();
    return datos.pendientes_carga.filter(
      (d) =>
        d.contrato_nombre.toLowerCase().includes(term) ||
        d.periodo_nombre.toLowerCase().includes(term) ||
        d.requisito_nombre.toLowerCase().includes(term) ||
        d.sujeto_nombre.toLowerCase().includes(term)
    );
  }, [datos?.pendientes_carga, busqueda]);

  // Filtrado de periodos proximos
  const periodosFiltrados = useMemo(() => {
    if (!datos?.periodos_proximos) return [];
    if (!busqueda.trim()) return datos.periodos_proximos;
    const term = busqueda.toLowerCase().trim();
    return datos.periodos_proximos.filter(
      (p) =>
        p.contrato_nombre.toLowerCase().includes(term) ||
        p.periodo_nombre.toLowerCase().includes(term)
    );
  }, [datos?.periodos_proximos, busqueda]);

  const totalObservados = datos?.observados_rechazados.length || 0;
  const totalPendientesCarga = datos?.pendientes_carga.length || 0;
  const totalPeriodosProximos = datos?.periodos_proximos.length || 0;
  const granTotal = datos?.total_pendientes || 0;

  if (cargando) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center p-12 text-slate-500">
        <Spinner texto="Cargando bandeja 'Mis pendientes' de RR.HH...." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-xs text-rose-700">
        <p className="font-bold">{error}</p>
        <button
          type="button"
          onClick={cargarPendientes}
          className="mt-3 rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Modo RR.HH. (.rh-bar, plataforma.html L14243) */}
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50/50 p-5 text-blue-900 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">👤</span>
            <div>
              <h2 className="text-base font-bold">
                Bandeja Consolidada "Mis pendientes" (Encargado de RR.HH.)
              </h2>
              <p className="text-xs text-blue-800/80 mt-0.5">
                Vista unificada de entregas observadas por el ADC para corregir, requisitos pendientes de carga y cierres próximos de todos tus contratos asignados (Sección 3.4).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={cargarPendientes}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50 transition active:scale-95 whitespace-nowrap self-start sm:self-auto"
          >
            <span>🔄</span> Actualizar bandeja
          </button>
        </div>
      </div>

      {/* Tarjetas de Resumen KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
            📝 Observados a Corregir
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{totalObservados}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Requieren nueva versión corregida</div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">
            ⏳ Requisitos Pendientes
          </div>
          <div className="text-2xl font-black text-blue-900 mt-1">{totalPendientesCarga}</div>
          <div className="text-[10px] text-blue-700 mt-0.5">Por cargar en nóminas activas</div>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">
            📅 Períodos en Cierre
          </div>
          <div className="text-2xl font-black text-indigo-900 mt-1">{totalPeriodosProximos}</div>
          <div className="text-[10px] text-indigo-700 mt-0.5">Con fecha límite próxima</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            📊 Total Acciones
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{granTotal}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Tareas pendientes en total</div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltroTab("todos")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              filtroTab === "todos"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Todos ({granTotal})
          </button>
          <button
            type="button"
            onClick={() => setFiltroTab("observados")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
              filtroTab === "observados"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>📝 Observados ({totalObservados})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroTab("pendientes")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
              filtroTab === "pendientes"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>⏳ Pendientes de carga ({totalPendientesCarga})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroTab("periodos")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
              filtroTab === "periodos"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>📅 Cierres próximos ({totalPeriodosProximos})</span>
          </button>
        </div>

        {/* Input Buscador */}
        <div className="relative min-w-[240px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Buscar por contrato, período, trabajador..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-xl border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* SECCIÓN 1: Documentos Observados o Rechazados (Prioridad 1) */}
      {(filtroTab === "todos" || filtroTab === "observados") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold">
                !
              </span>
              <span>Documentos Observados o Rechazados que Requieren Corrección</span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {observadosFiltrados.length} pendientes
              </span>
            </h3>
          </div>

          {observadosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
              🎉 No tienes documentos observados ni rechazados pendientes de corrección.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {observadosFiltrados.map((item) => (
                <div
                  key={item.documento_id}
                  className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm hover:border-amber-300 transition"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          🏢 {item.contrato_nombre}
                        </span>
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          📅 {item.periodo_nombre}
                        </span>
                        <Chip estado={item.estado} texto={item.estado} />
                        <span className="text-[11px] font-mono text-slate-500">
                          v{item.version || 1}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 pt-1">
                        {item.requisito_nombre}
                      </h4>
                      <p className="text-xs text-slate-600">
                        Trabajador / Ámbito: <strong className="text-slate-800">{item.sujeto_nombre}</strong>
                      </p>

                      {/* Caja Destacada con la Observación Exacta del ADC */}
                      <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                        <div className="flex items-start gap-2">
                          <span className="text-base leading-none">📝</span>
                          <div className="flex-1">
                            <span className="font-bold">Observación del ADC: </span>
                            <span className="italic">
                              "{item.observaciones || "Subsanar observaciones técnicas del documento."}"
                            </span>
                            {item.fecha_revision && (
                              <div className="text-[10px] text-amber-700 mt-1">
                                Revisado el: {item.fecha_revision.replace("T", " ").slice(0, 16)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Botón Directo para Subir Corrección */}
                    <div className="flex flex-col sm:flex-row md:flex-col items-end gap-2 shrink-0 pt-2 md:pt-0">
                      <button
                        type="button"
                        onClick={() => abrirModalSubida(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
                      >
                        <span>↑ Subir corrección (v{(item.version || 1) + 1})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => irAPeriodo(item.contrato_id, item.periodo_id)}
                        className="text-[11px] font-semibold text-blue-600 hover:underline"
                      >
                        Ver período completo ↗
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 2: Requisitos Pendientes de Carga Inicial */}
      {(filtroTab === "todos" || filtroTab === "pendientes") && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                ⏳
              </span>
              <span>Requisitos Pendientes de Carga Inicial</span>
              <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                {pendientesFiltrados.length} documentos
              </span>
            </h3>
          </div>

          {pendientesFiltrados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
              🎉 No tienes documentos pendientes de carga inicial.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Contrato & Período</th>
                      <th className="px-4 py-3">Requisito</th>
                      <th className="px-4 py-3">Trabajador / Ámbito</th>
                      <th className="px-4 py-3">Fecha Límite</th>
                      <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendientesFiltrados.map((item) => (
                      <tr key={item.documento_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{item.contrato_nombre}</div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {item.periodo_nombre}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {item.requisito_nombre}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-800 font-medium">{item.sujeto_nombre}</span>
                        </td>
                        <td className="px-4 py-3">
                          {item.fecha_limite ? (
                            <span className="font-mono text-[11px] font-semibold text-slate-700">
                              📅 {item.fecha_limite}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => abrirModalSubida(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 transition"
                          >
                            <span>↑ Subir archivo</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 3: Períodos Abiertos con Cierre Próximo */}
      {(filtroTab === "todos" || filtroTab === "periodos") && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
                📅
              </span>
              <span>Períodos Abiertos con Cierre Próximo</span>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                {periodosFiltrados.length} períodos
              </span>
            </h3>
          </div>

          {periodosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
              No hay períodos abiertos próximos a su fecha límite de cierre.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {periodosFiltrados.map((p) => {
                const urgente = p.dias_restantes <= 3;
                return (
                  <div
                    key={p.periodo_id}
                    className={`rounded-2xl border p-4 bg-white shadow-sm transition hover:shadow-md ${
                      urgente ? "border-amber-300 ring-1 ring-amber-300" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                        {p.contrato_nombre}
                      </span>
                      <Chip estado={p.estado} texto={p.estado} />
                    </div>

                    <h4 className="text-base font-bold text-slate-900">{p.periodo_nombre}</h4>

                    <div className="mt-2 text-xs text-slate-600 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Límite de entrega:</span>
                        <span className="font-semibold text-slate-800">
                          {p.fecha_limite || "Sin fecha límite"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tiempo restante:</span>
                        <span
                          className={`font-bold ${
                            p.dias_restantes <= 0
                              ? "text-rose-600"
                              : p.dias_restantes <= 3
                              ? "text-amber-700"
                              : "text-blue-700"
                          }`}
                        >
                          {p.dias_restantes < 0
                            ? `⚠️ Venció hace ${Math.abs(p.dias_restantes)} días`
                            : p.dias_restantes === 0
                            ? "⚠️ Vence hoy"
                            : `⏳ Quedan ${p.dias_restantes} días`}
                        </span>
                      </div>
                    </div>

                    {/* Barra de progreso de cumplimiento */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                        <span>Cumplimiento</span>
                        <span>{Math.round(p.porcentaje_cumplimiento || 0)}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.round(p.porcentaje_cumplimiento || 0))}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => irAPeriodo(p.contrato_id, p.periodo_id)}
                      className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-center text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition"
                    >
                      Ir al período mensual ↗
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Carga / Corrección Directa */}
      {modalSubidaAbierto && itemParaSubir && (
        <Modal
          abierto={modalSubidaAbierto}
          titulo={
            itemParaSubir.estado === "observado" || itemParaSubir.estado === "rechazado"
              ? `↑ Subir Corrección: Versión ${(itemParaSubir.version || 1) + 1}`
              : `↑ Cargar Documento: ${itemParaSubir.requisito_nombre}`
          }
          onCerrar={() => setModalSubidaAbierto(false)}
          ancho="max-w-md"
        >
          <form onSubmit={handleConfirmarSubida} className="space-y-4 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
              <span className="text-[11px] font-bold text-blue-700 uppercase">
                {itemParaSubir.contrato_nombre} • {itemParaSubir.periodo_nombre}
              </span>
              <h4 className="text-sm font-bold text-slate-900">{itemParaSubir.requisito_nombre}</h4>
              <p className="text-slate-600">Trabajador: {itemParaSubir.sujeto_nombre}</p>
            </div>

            {itemParaSubir.observaciones && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <span className="font-bold">Observación ADC a subsanar: </span>
                <p className="mt-0.5 italic">"{itemParaSubir.observaciones}"</p>
              </div>
            )}

            {errorSubida && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-700 font-medium">
                ⚠️ {errorSubida}
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-800 mb-1">
                Seleccione el archivo PDF o imagen:
              </label>
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setArchivoSeleccionado(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Al subir, el requisito pasará a estado <strong>En revisión</strong> para la evaluación del ADC.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalSubidaAbierto(false)}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={subiendo || !archivoSeleccionado}
                className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
              >
                {subiendo ? "Subiendo..." : "Confirmar Carga"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
