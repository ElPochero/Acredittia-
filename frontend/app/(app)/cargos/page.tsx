"use client";

import React, { useEffect, useState, useMemo } from "react";
import * as Api from "@/lib/cliente";
import type { Cargo, PlantillaRequisito } from "@/lib/tipos";

// --- Íconos SVG limpios ---
const BadgeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h2"/><path d="M15 12h2"/><path d="M7 16h5"/></svg>
);
const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const TruckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11"/><path d="M14 9h4l4 4v5c0 .6-.4 1-1 1h-2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
);
const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
);
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
);
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

const CATEGORIAS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  conduccion: { label: "Conducción", badgeClass: "bg-purple-100 text-purple-700 border-purple-200" },
  operacion: { label: "Operación", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  supervision: { label: "Supervisión", badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
  mantencion: { label: "Mantención", badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
  administracion: { label: "Administración", badgeClass: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  otro: { label: "Otro", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" },
};

function getComplianceStyle(pct: number) {
  if (pct >= 75) return { bar: "bg-emerald-500", text: "text-emerald-700", state: "Al día", stateBg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (pct >= 50) return { bar: "bg-amber-500", text: "text-amber-700", state: "Atención", stateBg: "bg-amber-50 text-amber-700 border-amber-200" };
  return { bar: "bg-red-500", text: "text-red-700", state: "Crítico", stateBg: "bg-red-50 text-red-700 border-red-200" };
}

export default function CargosPage() {
  const [loading, setLoading] = useState(true);
  const [cargosList, setCargosList] = useState<Cargo[]>([]);
  const [templatesList, setTemplatesList] = useState<PlantillaRequisito[]>([]);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [busqueda, setBusqueda] = useState("");
  const [toast, setToast] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);

  // Modales
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState<Cargo | null>(null);
  const [modalRequisitos, setModalRequisitos] = useState<Cargo | null>(null);
  const [reqsEfectivos, setReqsEfectivos] = useState<any | null>(null);
  const [loadingReqs, setLoadingReqs] = useState(false);

  // Form State
  const [formNombre, setFormNombre] = useState("");
  const [formCategoria, setFormCategoria] = useState("operacion");
  const [formEmsipor, setFormEmsipor] = useState(false);
  const [formActivo, setFormActivo] = useState(true);
  const [formReqsSeleccionados, setFormReqsSeleccionados] = useState<string[]>([]);
  const [formRetroactivo, setFormRetroactivo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  function mostrarToast(tipo: "exito" | "error", mensaje: string) {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 4000);
  }

  async function cargarDatos() {
    setLoading(true);
    try {
      const [resCargos, resTemplates] = await Promise.all([
        Api.cargos.listar({ page_size: 100 }),
        Api.requisitos.plantillas({ ambito: "personal", page_size: 100 }).catch(() => ({ items: [] }))
      ]);
      setCargosList(resCargos.items || []);
      setTemplatesList(resTemplates.items || []);
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al cargar catálogo de cargos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  // Abrir Modal Crear
  const abrirModalCrear = () => {
    setFormNombre("");
    setFormCategoria("operacion");
    setFormEmsipor(false);
    setFormActivo(true);
    setFormReqsSeleccionados([]);
    setFormRetroactivo(false);
    setModalNuevo(true);
  };

  // Abrir Modal Editar
  const abrirModalEditar = (cargo: Cargo) => {
    setModalEditar(cargo);
    setFormNombre(cargo.nombre);
    setFormCategoria(cargo.categoria || "otro");
    setFormEmsipor(cargo.requiere_emsipor);
    setFormActivo(cargo.activo);
    const reqIds = (cargo.requisitos || []).map((r: any) => r.template_id);
    setFormReqsSeleccionados(reqIds);
    setFormRetroactivo(false);
  };

  // Abrir Modal Requisitos
  const abrirModalRequisitos = async (cargo: Cargo) => {
    setModalRequisitos(cargo);
    setLoadingReqs(true);
    try {
      const res = await Api.cargos.requisitos(cargo.id);
      setReqsEfectivos(res);
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al cargar requisitos del cargo");
    } finally {
      setLoadingReqs(false);
    }
  };

  // Guardar Nuevo Cargo
  const handleCrearCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) return;
    setGuardando(true);
    try {
      const reqPayload = formReqsSeleccionados.map((id) => ({
        template_id: id,
        obligatorio: true,
      }));
      await Api.cargos.crear({
        nombre: formNombre.trim(),
        categoria: formCategoria as any,
        requiere_emsipor: formEmsipor,
        requisitos: reqPayload,
      });
      mostrarToast("exito", `Cargo "${formNombre.trim()}" creado correctamente.`);
      setModalNuevo(false);
      cargarDatos();
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al crear el cargo.");
    } finally {
      setGuardando(false);
    }
  };

  // Guardar Edición
  const handleEditarCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar) return;
    if (modalEditar.es_global) {
      mostrarToast("error", "Los cargos base de Acredittia son de solo lectura.");
      return;
    }
    setGuardando(true);
    try {
      const reqPayload = formReqsSeleccionados.map((id) => ({
        template_id: id,
        obligatorio: true,
      }));
      const res = await Api.cargos.editar(
        modalEditar.id,
        {
          nombre: formNombre.trim(),
          categoria: formCategoria as any,
          requiere_emsipor: formEmsipor,
          activo: formActivo,
          requisitos: reqPayload,
        },
        formRetroactivo
      );
      const retroInfo = res.documentos_creados ? ` (${res.documentos_creados} documentos propagados)` : "";
      mostrarToast("exito", `Cargo "${formNombre.trim()}" actualizado correctamente${retroInfo}.`);
      setModalEditar(null);
      cargarDatos();
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al actualizar el cargo.");
    } finally {
      setGuardando(false);
    }
  };

  // Alternar Estado Activo/Inactivo rápido
  const handleToggleActivo = async (cargo: Cargo) => {
    if (cargo.es_global) {
      mostrarToast("error", "Los cargos del catálogo base no se pueden desactivar.");
      return;
    }
    try {
      await Api.cargos.editar(cargo.id, { activo: !cargo.activo });
      mostrarToast("exito", `Cargo "${cargo.nombre}" ${!cargo.activo ? "activado" : "desactivado"}.`);
      cargarDatos();
    } catch (err: any) {
      mostrarToast("error", err.message || "No se pudo cambiar el estado del cargo.");
    }
  };

  // Filtrado y KPIs reales
  const cargosFiltrados = useMemo(() => {
    return cargosList.filter((c) => {
      const cumpleCat = filtroCategoria === "todas" || c.categoria === filtroCategoria;
      const cumpleBusq = !busqueda.trim() || c.nombre.toLowerCase().includes(busqueda.toLowerCase().trim());
      return cumpleCat && cumpleBusq;
    });
  }, [cargosList, filtroCategoria, busqueda]);

  const kpis = useMemo(() => {
    const totalCargos = cargosList.length;
    const totalTrabajadores = cargosList.reduce((acc, c) => acc + (c.trabajadores || 0), 0);
    const conEmsipor = cargosList.filter((c) => c.requiere_emsipor).length;
    const conTrabajadores = cargosList.filter((c) => (c.trabajadores || 0) > 0);
    const cumplimientoPromedio = conTrabajadores.length > 0
      ? Math.round(conTrabajadores.reduce((acc, c) => acc + (c.cumplimiento_pct || 0), 0) / conTrabajadores.length)
      : 100;
    return { totalCargos, totalTrabajadores, conEmsipor, cumplimientoPromedio };
  }, [cargosList]);

  // Agrupación por categoría
  const cargosAgrupados = useMemo(() => {
    const grupos: Record<string, Cargo[]> = {};
    for (const c of cargosFiltrados) {
      const cat = c.categoria || "otro";
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(c);
    }
    return grupos;
  }, [cargosFiltrados]);

  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
            toast.tipo === "exito"
              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
              : "bg-red-50 border-red-300 text-red-800"
          }`}
        >
          {toast.mensaje}
        </div>
      )}

      {/* Cabecera y acciones */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Catálogo de Cargos y Requisitos</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Administra los cargos de tu dotación, sus requisitos documentales y requerimientos EMSIPOR de Licencia Interna.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={abrirModalCrear}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            <PlusIcon /> Nuevo cargo propio
          </button>
        </div>
      </div>

      {/* KPI Cards Reales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-slate-100 text-slate-600 p-2.5 rounded-lg shrink-0">
            <BadgeIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Cargos catalogados</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{kpis.totalCargos}</span>
            <span className="text-xs text-slate-400 font-medium mt-0.5">base + propios</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-slate-100 text-slate-600 p-2.5 rounded-lg shrink-0">
            <UsersIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Trabajadores asignados</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{kpis.totalTrabajadores}</span>
            <span className="text-xs text-slate-400 font-medium mt-0.5">activos en faenas</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-purple-50 text-purple-600 p-2.5 rounded-lg shrink-0">
            <TruckIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Cargos con EMSIPOR</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{kpis.conEmsipor}</span>
            <span className="text-xs text-purple-600 font-medium mt-0.5">exigen licencia interna</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-lg shrink-0">
            <CheckCircleIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Cumplimiento promedio</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{kpis.cumplimientoPromedio}%</span>
            <span className="text-xs text-emerald-600 font-medium mt-0.5">por cargo asignado</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre de cargo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2 outline-none w-full sm:w-auto"
        >
          <option value="todas">Todas las categorías</option>
          <option value="conduccion">Conducción</option>
          <option value="operacion">Operación</option>
          <option value="supervision">Supervisión</option>
          <option value="mantencion">Mantención</option>
          <option value="administracion">Administración</option>
          <option value="otro">Otro</option>
        </select>
      </div>

      {/* Contenido Agrupado por Categoría */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 shadow-sm">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-sm font-medium">Cargando catálogo de cargos...</p>
        </div>
      ) : Object.keys(cargosAgrupados).length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm">
          <p className="text-base font-semibold">No se encontraron cargos con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(cargosAgrupados).map(([catKey, cargosEnGrupo]) => {
            const catConf = CATEGORIAS_CONFIG[catKey] || { label: catKey, badgeClass: "bg-slate-100 text-slate-700" };
            return (
              <div key={catKey} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {/* Cabecera de Categoría */}
                <div className="bg-slate-50/80 px-6 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${catConf.badgeClass}`}>
                      {catConf.label}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {cargosEnGrupo.length} cargo{cargosEnGrupo.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                {/* Tabla de Cargos en la Categoría */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
                    <thead className="bg-white border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Cargo</th>
                        <th className="px-6 py-3">Origen Catálogo</th>
                        <th className="px-6 py-3 text-center">Trabajadores</th>
                        <th className="px-6 py-3">Requisitos Documentales</th>
                        <th className="px-6 py-3 w-44">Cumplimiento</th>
                        <th className="px-6 py-3 text-center">Estado</th>
                        <th className="px-6 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cargosEnGrupo.map((c) => {
                        const comp = c.cumplimiento_pct || 0;
                        const styles = getComplianceStyle(comp);
                        const numReqs = (c.requisitos && c.requisitos.length) || 0;

                        return (
                          <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                                  <BadgeIcon />
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-800 block">{c.nombre}</span>
                                  {c.requiere_emsipor && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded mt-0.5 border border-purple-200">
                                      Requiere Licencia EMSIPOR
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {c.es_global ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200" title="Catálogo base de Acredittia (solo lectura)">
                                  <LockIcon /> Base Acredittia
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  Propio Empresa
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-slate-700">
                              {c.trabajadores || 0}
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-600">
                              <button
                                onClick={() => abrirModalRequisitos(c)}
                                className="text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 flex items-center gap-1"
                              >
                                {numReqs > 0 ? `${numReqs} requisitos` : "Requisitos estándar"}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${comp}%` }}></div>
                                </div>
                                <span className={`text-xs font-bold w-10 text-right ${styles.text}`}>{comp}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${c.activo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                                {c.activo ? "Activo" : "Inactivo"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => abrirModalRequisitos(c)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Ver requisitos aplicables"
                                >
                                  <EyeIcon />
                                </button>
                                {!c.es_global ? (
                                  <>
                                    <button
                                      onClick={() => abrirModalEditar(c)}
                                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                      title="Editar cargo"
                                    >
                                      <EditIcon />
                                    </button>
                                    <button
                                      onClick={() => handleToggleActivo(c)}
                                      className="text-xs font-semibold px-2 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                                    >
                                      {c.activo ? "Desactivar" : "Activar"}
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-400 italic pr-2">Solo lectura</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR CARGO */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Crear Nuevo Cargo Propio</h3>
              <button onClick={() => setModalNuevo(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleCrearCargo} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del cargo *</label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej. Conductor de Transporte Personal"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Categoría</label>
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="conduccion">Conducción</option>
                  <option value="operacion">Operación</option>
                  <option value="supervision">Supervisión</option>
                  <option value="mantencion">Mantención</option>
                  <option value="administracion">Administración</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-xl bg-purple-50/50">
                <input
                  type="checkbox"
                  id="crear_emsipor"
                  checked={formEmsipor}
                  onChange={(e) => setFormEmsipor(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="crear_emsipor" className="text-sm font-medium text-slate-800 cursor-pointer select-none">
                  Exige Licencia Interna de Mina (EMSIPOR)
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Requisitos de Ámbito Personal Aplicables</label>
                <p className="text-xs text-slate-500 mb-2">Selecciona qué plantillas de requisitos debe cumplir este cargo:</p>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                  {templatesList.length === 0 ? (
                    <p className="text-xs text-slate-400">Sin plantillas personales disponibles.</p>
                  ) : (
                    templatesList.map((t) => {
                      const checked = formReqsSeleccionados.includes(t.id);
                      return (
                        <label key={t.id} className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-900 cursor-pointer p-1">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormReqsSeleccionados([...formReqsSeleccionados, t.id]);
                              } else {
                                setFormReqsSeleccionados(formReqsSeleccionados.filter((id) => id !== t.id));
                              }
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>{t.titulo}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando || !formNombre.trim()}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50 text-sm"
                >
                  {guardando ? "Guardando..." : "Crear Cargo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR CARGO */}
      {modalEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">
                {modalEditar.es_global ? "Detalle de Cargo Base Acredittia" : "Editar Cargo Propio"}
              </h3>
              <button onClick={() => setModalEditar(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleEditarCargo} className="p-6 space-y-4 overflow-y-auto flex-1">
              {modalEditar.es_global && (
                <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
                  <LockIcon />
                  <span>Este cargo pertenece al catálogo base global de Acredittia y es de solo lectura. Para personalizar requisitos, crea un nuevo cargo propio para tu empresa.</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del cargo</label>
                <input
                  type="text"
                  required
                  disabled={modalEditar.es_global}
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Categoría</label>
                <select
                  disabled={modalEditar.es_global}
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="conduccion">Conducción</option>
                  <option value="operacion">Operación</option>
                  <option value="supervision">Supervisión</option>
                  <option value="mantencion">Mantención</option>
                  <option value="administracion">Administración</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-xl bg-purple-50/50">
                <input
                  type="checkbox"
                  id="edit_emsipor"
                  disabled={modalEditar.es_global}
                  checked={formEmsipor}
                  onChange={(e) => setFormEmsipor(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer disabled:opacity-50"
                />
                <label htmlFor="edit_emsipor" className="text-sm font-medium text-slate-800 cursor-pointer select-none">
                  Exige Licencia Interna de Mina (EMSIPOR)
                </label>
              </div>

              <div className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-xl bg-slate-50">
                <input
                  type="checkbox"
                  id="edit_activo"
                  disabled={modalEditar.es_global}
                  checked={formActivo}
                  onChange={(e) => setFormActivo(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                />
                <label htmlFor="edit_activo" className="text-sm font-medium text-slate-800 cursor-pointer select-none">
                  Cargo Activo
                </label>
              </div>

              {!modalEditar.es_global && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Requisitos de Ámbito Personal</label>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                      {templatesList.map((t) => {
                        const checked = formReqsSeleccionados.includes(t.id);
                        return (
                          <label key={t.id} className="flex items-center gap-2.5 text-xs text-slate-700 hover:text-slate-900 cursor-pointer p-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormReqsSeleccionados([...formReqsSeleccionados, t.id]);
                                } else {
                                  setFormReqsSeleccionados(formReqsSeleccionados.filter((id) => id !== t.id));
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span>{t.titulo}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3.5 border border-blue-200 rounded-xl bg-blue-50/50">
                    <input
                      type="checkbox"
                      id="retroactivo"
                      checked={formRetroactivo}
                      onChange={(e) => setFormRetroactivo(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer mt-0.5"
                    />
                    <label htmlFor="retroactivo" className="text-xs text-blue-900 cursor-pointer select-none">
                      <strong className="block font-semibold">Aplicar de forma retroactiva</strong>
                      Crear documentos faltantes para los trabajadores activos actualmente asignados a este cargo.
                    </label>
                  </div>
                </>
              )}

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEditar(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm"
                >
                  {modalEditar.es_global ? "Cerrar" : "Cancelar"}
                </button>
                {!modalEditar.es_global && (
                  <button
                    type="submit"
                    disabled={guardando || !formNombre.trim()}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50 text-sm"
                  >
                    {guardando ? "Guardando..." : "Guardar Cambios"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VER REQUISITOS EFECTIVOS */}
      {modalRequisitos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Requisitos: {modalRequisitos.nombre}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Checklist efectivo que se instanciará a un trabajador contratado bajo este cargo.
                </p>
              </div>
              <button onClick={() => setModalRequisitos(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <XIcon />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {loadingReqs ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mb-2"></div>
                  <p className="text-sm">Consultando requisitos efectivos...</p>
                </div>
              ) : reqsEfectivos ? (
                <>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Documentación Personal ({reqsEfectivos.personal?.length || 0})
                    </h4>
                    {reqsEfectivos.personal?.length === 0 ? (
                      <p className="text-xs text-slate-400">Sin requisitos personales configurados.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {reqsEfectivos.personal.map((p: any, idx: number) => (
                          <li key={idx} className="p-3.5 flex items-center justify-between text-xs bg-white">
                            <span className="font-semibold text-slate-800">{p.titulo}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.obligatorio ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                              {p.obligatorio ? "Obligatorio" : "Opcional"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {modalRequisitos.requiere_emsipor && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-3 flex items-center gap-1.5">
                        <TruckIcon /> Expediente Licencia Interna EMSIPOR ({reqsEfectivos.emsipor?.length || 0})
                      </h4>
                      <ul className="divide-y divide-purple-100 border border-purple-200 rounded-xl overflow-hidden bg-purple-50/20">
                        {reqsEfectivos.emsipor?.map((e: any, idx: number) => (
                          <li key={idx} className="p-3.5 flex items-center justify-between text-xs">
                            <span className="font-semibold text-purple-900">{e.titulo}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                              Exigido LIM
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400">No fue posible obtener los requisitos.</p>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setModalRequisitos(null)}
                className="px-5 py-2 bg-slate-800 text-white font-semibold rounded-xl text-xs hover:bg-slate-900"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
