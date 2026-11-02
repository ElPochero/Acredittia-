"use client";
import React, { useEffect, useState, useMemo } from "react";
import * as Api from "@/lib/cliente";
import type { NominaPeriodoRespuesta, TrabajadorNominaItem } from "@/lib/tipos";
import { Chip, Modal, Spinner } from "@/components/ui";
import SubjectDetail from "@/components/SubjectDetail";

interface TabNominaPeriodoProps {
  contratoId: string;
  periodoId: string;
  periodoNombre?: string;
  periodoEstado?: string;
}

export default function TabNominaPeriodo({
  contratoId,
  periodoId,
  periodoNombre,
  periodoEstado,
}: TabNominaPeriodoProps) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NominaPeriodoRespuesta | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "vigentes" | "incorporaciones" | "bajas">("todos");
  const [busqueda, setBusqueda] = useState("");

  // Modal para ver ficha completa del trabajador sin salir del módulo
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState<TrabajadorNominaItem | null>(null);

  const cargarNomina = async () => {
    if (!contratoId || !periodoId) return;
    setCargando(true);
    setError(null);
    try {
      const res = await Api.certificacion.obtenerNominaPeriodo(contratoId, periodoId);
      setData(res);
    } catch (err: any) {
      console.error("Error al cargar nómina del período:", err);
      setError(err?.message || "No se pudo cargar la nómina del período");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarNomina();
  }, [contratoId, periodoId]);

  const listaFiltrada = useMemo(() => {
    if (!data?.datos) return [];
    let base: TrabajadorNominaItem[] = [];

    if (filtroTipo === "todos") {
      // Unir vigentes y bajas evitando duplicados
      const mapa = new Map<string, TrabajadorNominaItem>();
      data.datos.vigentes.forEach((t) => mapa.set(t.id, t));
      data.datos.bajas.forEach((t) => mapa.set(t.id, t));
      base = Array.from(mapa.values());
    } else if (filtroTipo === "vigentes") {
      base = data.datos.vigentes;
    } else if (filtroTipo === "incorporaciones") {
      base = data.datos.incorporaciones;
    } else if (filtroTipo === "bajas") {
      base = data.datos.bajas;
    }

    if (!busqueda.trim()) return base;

    const term = busqueda.toLowerCase().trim();
    return base.filter(
      (t) =>
        t.nombre.toLowerCase().includes(term) ||
        (t.rut && t.rut.toLowerCase().includes(term)) ||
        (t.cargo && t.cargo.toLowerCase().includes(term))
    );
  }, [data, filtroTipo, busqueda]);

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <Spinner texto="Cargando nómina e historial del período..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
        <p className="font-semibold">Ocurrió un error al cargar la nómina</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={cargarNomina}
          className="mt-3 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const resumen = data?.datos?.resumen || {
    total_nomina: 0,
    total_vigentes: 0,
    total_incorporaciones: 0,
    total_bajas: 0,
  };

  const isInmutable = data?.inmutable || periodoEstado === "cerrado";

  return (
    <div className="space-y-6">
      {/* Banner de Estado Inmutable vs En Vivo */}
      {isInmutable ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm">
          <span className="text-xl">🔒</span>
          <div className="text-sm">
            <span className="font-bold">Foto mensual inmutable (Período cerrado):</span>{" "}
            Esta nómina corresponde al snapshot histórico inmutable archivado al momento del cierre de{" "}
            <span className="font-semibold">{data?.periodo_nombre || periodoNombre}</span>. Los datos quedan blindados contra futuras modificaciones.
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900 shadow-sm">
          <span className="text-xl">👥</span>
          <div className="text-sm">
            <span className="font-bold">Nómina del contrato activa:</span>{" "}
            Personal registrado bajo este contrato para el período mensual{" "}
            <span className="font-semibold">{data?.periodo_nombre || periodoNombre}</span>. Visible en tiempo real para ADC y RR.HH.
          </div>
        </div>
      )}

      {/* Tarjetas KPI de Nómina */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Nómina Vigente Total
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {resumen.total_nomina}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Trabajadores activos en contrato</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Vigentes en Mes
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700">
            {resumen.total_vigentes}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Con relación laboral vigente</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-600">
            Incorporaciones Mes
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-700">
            +{resumen.total_incorporaciones}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Altas registradas en el período</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-rose-600">
            Bajas del Mes
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700">
            {resumen.total_bajas}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Desvinculados o en finiquito</div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFiltroTipo("todos")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filtroTipo === "todos"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todos ({resumen.total_vigentes + resumen.total_bajas})
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo("vigentes")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filtroTipo === "vigentes"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Vigentes ({resumen.total_vigentes})
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo("incorporaciones")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filtroTipo === "incorporaciones"
                ? "bg-cyan-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Altas del Mes ({resumen.total_incorporaciones})
          </button>
          <button
            type="button"
            onClick={() => setFiltroTipo("bajas")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filtroTipo === "bajas"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Bajas ({resumen.total_bajas})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por RUT o nombre..."
            className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <span className="absolute left-3 top-2 text-slate-400 text-xs">🔍</span>
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Trabajadores */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
            <tr>
              <th className="px-4 py-3">RUT</th>
              <th className="px-4 py-3">Nombre del Trabajador</th>
              <th className="px-4 py-3">Cargo</th>
              <th className="px-4 py-3">Estado Laboral</th>
              <th className="px-4 py-3">Ingreso / Alta</th>
              <th className="px-4 py-3 text-right">Ficha y Expediente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listaFiltrada.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No se encontraron trabajadores en este período con los filtros aplicados.
                </td>
              </tr>
            ) : (
              listaFiltrada.map((trabajador) => {
                const esBaja = trabajador.estado === "baja";
                return (
                  <tr
                    key={trabajador.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => setTrabajadorSeleccionado(trabajador)}
                  >
                    <td className="px-4 py-3 font-mono font-medium text-slate-800">
                      {trabajador.rut}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {trabajador.nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {trabajador.cargo || "Sin cargo registrado"}
                    </td>
                    <td className="px-4 py-3">
                      {esBaja ? (
                        <Chip estado="rechazado" texto="Baja / Finiquitado" />
                      ) : (
                        <Chip estado="vigente" texto="Vigente" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                      {trabajador.fecha_ingreso || "—"}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setTrabajadorSeleccionado(trabajador)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-cyan-500 hover:text-cyan-700 transition"
                      >
                        <span>👤 Ver ficha</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para inspeccionar la ficha completa del trabajador sin salir del módulo */}
      <Modal
        abierto={!!trabajadorSeleccionado}
        titulo={
          trabajadorSeleccionado ? (
            <div className="flex items-center gap-2">
              <span>👤 Expediente de {trabajadorSeleccionado.nombre}</span>
              <span className="font-mono text-xs text-slate-400">({trabajadorSeleccionado.rut})</span>
            </div>
          ) : (
            "Ficha del Trabajador"
          )
        }
        onCerrar={() => setTrabajadorSeleccionado(null)}
        ancho="max-w-4xl"
      >
        {trabajadorSeleccionado && (
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <SubjectDetail tipo="personal" id={trabajadorSeleccionado.id} />
          </div>
        )}
      </Modal>
    </div>
  );
}
