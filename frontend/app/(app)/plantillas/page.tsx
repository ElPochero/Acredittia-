"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import * as Api from "@/lib/cliente";
import type { PlantillaRequisito, Faena } from "@/lib/tipos";

// --- Íconos SVG limpios ---
const FileTextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13"/><line x1="16" x2="8" y1="17"/><line x1="10" x2="8" y1="9"/></svg>
);
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
);
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
);
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const LayersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
);
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default function PlantillasPage() {
  const router = useRouter();
  const [tabActiva, setTabActiva] = useState<"planillas" | "catalogo">("planillas");
  const [loading, setLoading] = useState(true);
  const [planillasList, setPlanillasList] = useState<any[]>([]);
  const [catalogoList, setCatalogoList] = useState<PlantillaRequisito[]>([]);
  const [faenasList, setFaenasList] = useState<Faena[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroAmbito, setFiltroAmbito] = useState("todos");
  const [toast, setToast] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);

  // Modal Crear Contrato desde Planilla
  const [modalCrear, setModalCrear] = useState<any | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formCodigo, setFormCodigo] = useState("");
  const [formFaenaId, setFormFaenaId] = useState("");
  const [formMandante, setFormMandante] = useState("");
  const [formUnidad, setFormUnidad] = useState("");
  const [formFechaInicio, setFormFechaInicio] = useState("");
  const [formFechaTermino, setFormFechaTermino] = useState("");
  const [guardandoContrato, setGuardandoContrato] = useState(false);

  // Modal Ver Resumen de Requisitos
  const [modalDetalle, setModalDetalle] = useState<any | null>(null);
  const [resumenDetalle, setResumenDetalle] = useState<any | null>(null);
  const [loadingResumen, setLoadingResumen] = useState(false);

  function mostrarToast(tipo: "exito" | "error", mensaje: string) {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 4000);
  }

  async function cargarDatos() {
    setLoading(true);
    try {
      const [resPlanillas, resCatalogo, resFaenas] = await Promise.all([
        Api.contratos.plantillasDisponibles().catch(() => ({ items: [] })),
        Api.requisitos.plantillas({ page_size: 100 }).catch(() => ({ items: [] })),
        Api.faenas.listar().catch(() => ({ items: [] }))
      ]);
      setPlanillasList(resPlanillas.items || []);
      setCatalogoList(resCatalogo.items || []);
      setFaenasList(resFaenas.items || []);
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  // Abrir Modal de Creación desde Planilla
  const abrirModalCrearDesdePlanilla = (p: any) => {
    setModalCrear(p);
    setFormNombre(`${p.nombre} (Copia)`);
    setFormCodigo("");
    setFormFaenaId(p.faena_id || (faenasList[0]?.id ? String(faenasList[0].id) : ""));
    setFormMandante(p.mandante || "");
    setFormUnidad(p.unidad_negocio || "");
    setFormFechaInicio("");
    setFormFechaTermino("");
  };

  // Abrir Modal de Vista de Requisitos
  const abrirModalDetalle = async (p: any) => {
    setModalDetalle(p);
    setLoadingResumen(true);
    try {
      const res = await Api.contratos.plantillaResumen(p.id);
      setResumenDetalle(res);
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al obtener requisitos de la planilla");
    } finally {
      setLoadingResumen(false);
    }
  };

  // Ejecutar Creación
  const handleCrearContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalCrear || !formNombre.trim() || !formFaenaId) return;

    setGuardandoContrato(true);
    try {
      const nuevo = await Api.contratos.crear({
        nombre: formNombre.trim(),
        codigo: formCodigo.trim() || null,
        faena_id: formFaenaId,
        mandante: formMandante.trim() || null,
        unidad_negocio: formUnidad.trim() || null,
        fecha_inicio: formFechaInicio || null,
        fecha_termino: formFechaTermino || null,
        plantilla_contrato_id: modalCrear.id,
      });

      mostrarToast("exito", `Contrato "${nuevo.nombre}" creado con todos los requisitos instanciados.`);
      setModalCrear(null);
      setTimeout(() => {
        router.push(`/contratos/${nuevo.id}`);
      }, 1000);
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al crear contrato desde planilla");
    } finally {
      setGuardandoContrato(false);
    }
  };

  // Filtrado de planillas
  const planillasFiltradas = useMemo(() => {
    return planillasList.filter((p) => {
      if (!busqueda.trim()) return true;
      const b = busqueda.toLowerCase().trim();
      return (
        p.nombre?.toLowerCase().includes(b) ||
        p.codigo?.toLowerCase().includes(b) ||
        p.faena_nombre?.toLowerCase().includes(b) ||
        p.mandante?.toLowerCase().includes(b)
      );
    });
  }, [planillasList, busqueda]);

  // Filtrado de catálogo
  const catalogoFiltrado = useMemo(() => {
    return catalogoList.filter((c) => {
      const cumpleAmbito = filtroAmbito === "todos" || c.ambito === filtroAmbito;
      const cumpleBusq = !busqueda.trim() || c.titulo.toLowerCase().includes(busqueda.toLowerCase().trim());
      return cumpleAmbito && cumpleBusq;
    });
  }, [catalogoList, filtroAmbito, busqueda]);

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

      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Planillas y Plantillas Reutilizables</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Reutiliza configuraciones documentales existentes para pre-cargar e instanciar contratos de forma instantánea.
          </p>
        </div>
      </div>

      {/* Pestañas de Alternancia */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setTabActiva("planillas"); setBusqueda(""); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            tabActiva === "planillas"
              ? "border-blue-600 text-blue-600 bg-white"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <LayersIcon /> Planillas de Contratos Reutilizables ({planillasList.length})
        </button>
        <button
          onClick={() => { setTabActiva("catalogo"); setBusqueda(""); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            tabActiva === "catalogo"
              ? "border-blue-600 text-blue-600 bg-white"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileTextIcon /> Catálogo Base de Requisitos ({catalogoList.length})
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder={tabActiva === "planillas" ? "Buscar planilla por nombre o faena..." : "Buscar requisito..."}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {tabActiva === "catalogo" && (
          <select
            value={filtroAmbito}
            onChange={(e) => setFiltroAmbito(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-4 py-2 outline-none w-full sm:w-auto"
          >
            <option value="todos">Todos los ámbitos</option>
            <option value="empresa">Empresa</option>
            <option value="personal">Personal</option>
            <option value="equipo">Equipos</option>
            <option value="emsipor">EMSIPOR</option>
          </select>
        )}
      </div>

      {/* CONTENIDO PESTAÑA 1: PLANILLAS DE CONTRATO */}
      {tabActiva === "planillas" && (
        <>
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 shadow-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-sm font-medium">Cargando configuraciones de planillas...</p>
            </div>
          ) : planillasFiltradas.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm">
              <LayersIcon />
              <p className="text-base font-semibold mt-3">No hay planillas de contratos disponibles.</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Cualquier contrato existente de tu empresa puede utilizarse como planilla reutilizable para instanciar nuevos contratos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {planillasFiltradas.map((p) => {
                const totalReqs = p.total_requisitos || 0;
                const hasOverrides = p.overrides && Object.keys(p.overrides).length > 0;
                const customCount = p.requisitos_custom_total || 0;

                return (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                            <CopyIcon />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm leading-tight">{p.nombre}</h3>
                            <span className="text-[11px] font-mono text-slate-400">{p.codigo || "Sin código"}</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {p.estado}
                        </span>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Faena:</span>
                          <span className="font-semibold text-slate-700">{p.faena_nombre}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-medium">Mandante:</span>
                          <span className="font-semibold text-slate-700">{p.mandante}</span>
                        </div>
                        {p.unidad_negocio && (
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-medium">Unidad:</span>
                            <span className="font-semibold text-blue-700">{p.unidad_negocio}</span>
                          </div>
                        )}
                      </div>

                      {/* Badges de requisitos */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                          {totalReqs} requisitos configurados
                        </span>
                        {hasOverrides && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Overrides activos
                          </span>
                        )}
                        {customCount > 0 && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {customCount} custom
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
                      <button
                        onClick={() => abrirModalDetalle(p)}
                        className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        title="Ver detalle de requisitos"
                      >
                        <EyeIcon /> Ver requisitos
                      </button>
                      <button
                        onClick={() => abrirModalCrearDesdePlanilla(p)}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                      >
                        <PlusIcon /> Crear contrato desde esta planilla
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* CONTENIDO PESTAÑA 2: CATÁLOGO BASE DE REQUISITOS */}
      {tabActiva === "catalogo" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Título del Requisito</th>
                <th className="p-3.5">Ámbito</th>
                <th className="p-3.5">Tipo</th>
                <th className="p-3.5 text-center">Carácter</th>
                <th className="p-3.5 text-center">Vigencia Estándar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Cargando catálogo base...
                  </td>
                </tr>
              ) : catalogoFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No se encontraron requisitos en el catálogo base.
                  </td>
                </tr>
              ) : (
                catalogoFiltrado.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-800">{p.titulo}</td>
                    <td className="p-3.5">
                      <span className="capitalize px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {p.ambito || "General"}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600">{p.tipo || "Documento"}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.obligatorio ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.obligatorio ? "Obligatorio" : "Opcional"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center text-slate-500">
                      {p.vigencia_meses ? `${p.vigencia_meses} meses` : "Permanente / Faena"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL CREAR CONTRATO DESDE PLANILLA */}
      {modalCrear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Crear Contrato desde Planilla</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Plantilla origen: <strong className="text-slate-700">{modalCrear.nombre}</strong>
                </p>
              </div>
              <button onClick={() => setModalCrear(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleCrearContrato} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
                Este nuevo contrato heredará automáticamente todos los overrides y requisitos configurados en la planilla seleccionada, instanciando los documentos de empresa correspondientes.
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del nuevo contrato *</label>
                <input
                  type="text"
                  required
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej. Servicio Transporte Faena Pelambres 2026"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Código del contrato</label>
                  <input
                    type="text"
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    placeholder="Ej. CT-2026-004"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Faena de destino *</label>
                  <select
                    required
                    value={formFaenaId}
                    onChange={(e) => setFormFaenaId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    {faenasList.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Mandante</label>
                  <input
                    type="text"
                    value={formMandante}
                    onChange={(e) => setFormMandante(e.target.value)}
                    placeholder="Ej. AMSA, Lundin Mining"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Unidad de Negocio</label>
                  <input
                    type="text"
                    value={formUnidad}
                    onChange={(e) => setFormUnidad(e.target.value)}
                    placeholder="Ej. Transporte de Personal"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    value={formFechaInicio}
                    onChange={(e) => setFormFechaInicio(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Término</label>
                  <input
                    type="date"
                    value={formFechaTermino}
                    onChange={(e) => setFormFechaTermino(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalCrear(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoContrato || !formNombre.trim() || !formFaenaId}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50 text-sm"
                >
                  {guardandoContrato ? "Instanciando contrato..." : "Crear e Instanciar Contrato"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VER DETALLE DE REQUISITOS DE PLANILLA */}
      {modalDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Requisitos de la Planilla: {modalDetalle.nombre}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Desglose de documentación aplicable por cada ámbito.
                </p>
              </div>
              <button onClick={() => setModalDetalle(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <XIcon />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {loadingResumen ? (
                <div className="py-12 text-center text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mb-2"></div>
                  <p className="text-sm">Consultando requisitos de la planilla...</p>
                </div>
              ) : resumenDetalle ? (
                <div className="space-y-5">
                  {Object.entries(resumenDetalle.requisitos_por_ambito || {}).map(([ambito, reqs]: [string, any]) => {
                    return (
                      <div key={ambito}>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center justify-between">
                          <span>Ámbito: {ambito}</span>
                          <span className="text-[11px] font-normal text-slate-400">{reqs.length} requisitos</span>
                        </h4>
                        {reqs.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Sin requisitos registrados en este ámbito.</p>
                        ) : (
                          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                            {reqs.map((r: any, idx: number) => (
                              <li key={idx} className="p-3 flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800">{r.titulo}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                    r.origen === "custom"
                                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                                      : r.origen === "override"
                                      ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                      : "bg-slate-100 text-slate-600"
                                  }`}>
                                    {r.origen}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.obligatorio ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                                    {r.obligatorio ? "Obligatorio" : "Opcional"}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No se encontraron detalles de la planilla.</p>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500">
                Total de requisitos: <strong>{resumenDetalle?.total || 0}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalDetalle(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-100"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = modalDetalle;
                    setModalDetalle(null);
                    abrirModalCrearDesdePlanilla(p);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs"
                >
                  Crear contrato desde esta planilla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
