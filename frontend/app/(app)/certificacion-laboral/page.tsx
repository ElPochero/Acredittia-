"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Api from "@/lib/cliente";
import type { PeriodoLaboral, Contrato } from "@/lib/tipos";
import PeriodoCard from "@/components/PeriodoCard";
import { Modal, Spinner, Kpi } from "@/components/ui";

export default function CertificacionLaboralPage() {
  const router = useRouter();
  const [periodos, setPeriodos] = useState<PeriodoLaboral[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filters state
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroContrato, setFiltroContrato] = useState<string>("todos");

  // Create Modal state
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoContratoId, setNuevoContratoId] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState("mensual");
  const [nuevaFechaInicio, setNuevaFechaInicio] = useState("");
  const [nuevaFechaFin, setNuevaFechaFin] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [resPeriodos, resContratos] = await Promise.all([
        Api.certificacion.listarPeriodos(),
        Api.contratos.listar().catch((err) => { console.error("CONTRATOS ERROR", err); return { items: [] as Contrato[] } }),
      ]);
      setPeriodos(resPeriodos.items);
      setContratos(resContratos.items);
      if (resContratos.items.length > 0) {
        setNuevoContratoId(resContratos.items[0].id);
      }
    } catch (err) {
      console.error("Error al cargar períodos:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleCrearPeriodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim() || !nuevaFechaInicio || !nuevaFechaFin) {
      alert("Por favor completa los campos obligatorios.");
      return;
    }
    setGuardando(true);
    try {
      const nuevo = await Api.certificacion.crearPeriodo({
        contrato_id: nuevoContratoId || (contratos.length > 0 ? contratos[0].id : ""),
        nombre: nuevoNombre.trim(),
        tipo: nuevoTipo,
        fecha_inicio: nuevaFechaInicio,
        fecha_fin: nuevaFechaFin,
      });
      setPeriodos([nuevo, ...periodos]);
      setModalCrearAbierto(false);
      setNuevoNombre("");
      alert("Período laboral creado correctamente.");
    } catch (err: any) {
      alert(err?.message || "Error al crear período");
    } finally {
      setGuardando(false);
    }
  };

  // Filter periods
  const periodosFiltrados = periodos.filter((p) => {
    const txt = `${p.nombre} ${p.contrato_nombre || ""}`.toLowerCase();
    const coincideBusqueda = txt.includes(busqueda.toLowerCase());
    if (!coincideBusqueda) return false;

    if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
    if (filtroContrato !== "todos" && p.contrato_id !== filtroContrato) return false;

    return true;
  });

  // KPI Calculations
  const totalPeriodos = periodos.length;
  const enRevision = periodos.filter((p) => p.estado === "en_revision").length;
  const abiertos = periodos.filter((p) => p.estado === "abierto").length;
  const pctPromedio = Math.round(
    periodos.reduce((acc, p) => acc + (p.porcentaje_cumplimiento || 0), 0) / (totalPeriodos || 1)
  );

  const irADetalle = (id: string) => {
    router.push(`/certificacion-laboral/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="view-head">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">📊 Certificación Laboral</h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestión de períodos laborales, matriz documental por trabajador y auditoría de cumplimiento.
          </p>
        </div>
        <div className="view-head-actions">
          <button
            onClick={() => setModalCrearAbierto(true)}
            className="btn-primary flex items-center gap-2 text-xs"
          >
            <span>+</span> Nuevo Período Laboral
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi titulo="Total Períodos" valor={totalPeriodos} sub="registrados" />
        <Kpi titulo="En Revisión" valor={enRevision} color="text-amber-600" />
        <Kpi titulo="Períodos Abiertos" valor={abiertos} color="text-sky-600" />
        <Kpi titulo="Cumplimiento Promed." valor={`${pctPromedio}%`} color="text-emerald-600" />
      </div>

      {/* Filter bar */}
      <div className="view-filters flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <input
          className="view-search flex-1 min-w-[200px] rounded-xl border border-slate-200 px-4 py-2 text-xs focus:border-cyan-500 focus:outline-none"
          placeholder="Buscar período laboral o contrato..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          className="view-select rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:border-cyan-500 focus:outline-none"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Estado: Todos</option>
          <option value="abierto">Abiertos</option>
          <option value="en_revision">En Revisión</option>
          <option value="cerrado">Cerrados</option>
        </select>
        <select
          className="view-select rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 focus:border-cyan-500 focus:outline-none"
          value={filtroContrato}
          onChange={(e) => setFiltroContrato(e.target.value)}
        >
          <option value="todos">Contrato: Todos</option>
          {contratos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* List / Grid of Periods */}
      {cargando ? (
        <Spinner texto="Cargando períodos laborales..." />
      ) : periodosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500 text-xs">
          No existen períodos laborales que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {periodosFiltrados.map((periodo) => (
            <PeriodoCard
              key={periodo.id}
              periodo={periodo}
              onVerMatriz={() => irADetalle(periodo.id)}
              onAuditar={() => irADetalle(periodo.id)}
              onVerDashboard={() => irADetalle(periodo.id)}
            />
          ))}
        </div>
      )}

      {/* Modal: Crear Período */}
      <Modal
        abierto={modalCrearAbierto}
        titulo="Crear Nuevo Período Laboral"
        onCerrar={() => setModalCrearAbierto(false)}
      >
        <form onSubmit={handleCrearPeriodo} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nombre del Período *</label>
            <input
              type="text"
              required
              placeholder="Ej: Período Octubre 2026"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Contrato Asociado</label>
            <select
              value={nuevoContratoId}
              onChange={(e) => setNuevoContratoId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-cyan-500 focus:outline-none"
            >
{contratos.length === 0 && <option value="">Sin contratos disponibles</option>}
{contratos.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fecha Inicio *</label>
              <input
                type="date"
                required
                value={nuevaFechaInicio}
                onChange={(e) => setNuevaFechaInicio(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fecha Término *</label>
              <input
                type="date"
                required
                value={nuevaFechaFin}
                onChange={(e) => setNuevaFechaFin(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tipo de Período</label>
            <select
              value={nuevoTipo}
              onChange={(e) => setNuevoTipo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="mensual">Mensual</option>
              <option value="quincenal">Quincenal</option>
              <option value="otro">Especial / Eventual</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalCrearAbierto(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white hover:bg-cyan-700 disabled:opacity-50"
            >
              {guardando ? "Creando..." : "Crear Período"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

