"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import * as Api from "@/lib/cliente";
import type { EventoCalendario, Contrato, CategoriaEvento } from "@/lib/tipos";

// --- Íconos SVG limpios ---
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
);
const AlertTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
);
const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
);
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);
const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
);

const CATEGORIAS_COLORES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  vencimiento: { label: "Vencimiento", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  mantencion: { label: "Mantención", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  capacitacion: { label: "Capacitación", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  administrativo: { label: "Administrativo", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  entrega: { label: "Entrega", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  otro: { label: "Otro", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function CalendarioPage() {
  const [loading, setLoading] = useState(true);
  const [eventosList, setEventosList] = useState<EventoCalendario[]>([]);
  const [contratosList, setContratosList] = useState<Contrato[]>([]);
  
  // Controles de fecha (mes activo)
  const [mesActual, setMesActual] = useState(() => new Date().getMonth());
  const [anioActual, setAnioActual] = useState(() => new Date().getFullYear());
  
  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroContrato, setFiltroContrato] = useState<string>("todos");
  const [vistaModo, setVistaModo] = useState<"mes" | "agenda">("mes");
  const [toast, setToast] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);

  // Modales
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalEditar, setModalEditar] = useState<EventoCalendario | null>(null);
  const [modalDetalleVencimiento, setModalDetalleVencimiento] = useState<EventoCalendario | null>(null);

  // Form State Evento Manual
  const [formTitulo, setFormTitulo] = useState("");
  const [formFecha, setFormFecha] = useState("");
  const [formCategoria, setFormCategoria] = useState<any>("capacitacion");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formCompletado, setFormCompletado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  function mostrarToast(tipo: "exito" | "error", mensaje: string) {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 4000);
  }

  // Cargar contratos de la empresa para el filtro
  useEffect(() => {
    async function cargarContratos() {
      try {
        const res = await Api.contratos.listar({ page_size: 100 });
        setContratosList(res.items || []);
      } catch (err) {
        console.error("Error al cargar contratos para filtro:", err);
      }
    }
    cargarContratos();
  }, []);

  // Cargar eventos del mes actual (con margen de 7 días antes y después para llenar semanas)
  async function cargarEventos() {
    setLoading(true);
    try {
      const inicioMes = new Date(anioActual, mesActual, 1);
      const finMes = new Date(anioActual, mesActual + 1, 0);

      // Expandir ventana 10 días antes y 15 días después
      const fechaDesde = new Date(inicioMes.getTime() - 10 * 24 * 60 * 60 * 1000);
      const fechaHasta = new Date(finMes.getTime() + 15 * 24 * 60 * 60 * 1000);

      const dStr = fechaDesde.toISOString().split("T")[0];
      const hStr = fechaHasta.toISOString().split("T")[0];

      const catParam = filtroCategoria !== "todas" ? (filtroCategoria as CategoriaEvento) : undefined;
      const contratoParam = filtroContrato !== "todos" ? filtroContrato : undefined;

      const res = await Api.calendario.eventos(dStr, hStr, catParam, contratoParam);
      setEventosList(res.items || []);
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al cargar eventos del calendario");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarEventos();
  }, [mesActual, anioActual, filtroCategoria, filtroContrato]);

  // Navegación de mes
  const irMesAnterior = () => {
    if (mesActual === 0) {
      setMesActual(11);
      setAnioActual(anioActual - 1);
    } else {
      setMesActual(mesActual - 1);
    }
  };

  const irMesSiguiente = () => {
    if (mesActual === 11) {
      setMesActual(0);
      setAnioActual(anioActual + 1);
    } else {
      setMesActual(mesActual + 1);
    }
  };

  const irAHoy = () => {
    const hoy = new Date();
    setMesActual(hoy.getMonth());
    setAnioActual(hoy.getFullYear());
  };

  // Abrir Modal Crear
  const abrirModalCrear = (fechaSugerida?: string) => {
    const hoyStr = new Date().toISOString().split("T")[0];
    setFormTitulo("");
    setFormFecha(fechaSugerida || hoyStr);
    setFormCategoria("capacitacion");
    setFormDescripcion("");
    setFormCompletado(false);
    setModalNuevo(true);
  };

  // Abrir Modal Editar Manual
  const abrirModalEditar = (ev: EventoCalendario) => {
    setModalEditar(ev);
    setFormTitulo(ev.titulo);
    setFormFecha(ev.fecha);
    setFormCategoria(ev.categoria);
    setFormDescripcion(ev.descripcion || "");
    setFormCompletado(ev.completado);
  };

  // Crear Evento Manual
  const handleCrearEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitulo.trim() || !formFecha) return;
    setGuardando(true);
    try {
      await Api.calendario.crear({
        titulo: formTitulo.trim(),
        fecha: formFecha,
        categoria: formCategoria,
        descripcion: formDescripcion.trim() || null,
      });
      mostrarToast("exito", `Evento "${formTitulo.trim()}" agendado correctamente.`);
      setModalNuevo(false);
      cargarEventos();
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al crear evento.");
    } finally {
      setGuardando(false);
    }
  };

  // Guardar Edición Evento Manual
  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditar || !modalEditar.id) return;
    setGuardando(true);
    try {
      await Api.calendario.editar(modalEditar.id, {
        titulo: formTitulo.trim(),
        fecha: formFecha,
        categoria: formCategoria,
        descripcion: formDescripcion.trim() || null,
        completado: formCompletado,
      });
      mostrarToast("exito", `Evento actualizado.`);
      setModalEditar(null);
      cargarEventos();
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al actualizar evento.");
    } finally {
      setGuardando(false);
    }
  };

  // Eliminar Evento Manual
  const handleEliminarEvento = async (id: string) => {
    try {
      await Api.calendario.eliminar(id);
      mostrarToast("exito", "Evento eliminado del calendario.");
      setModalEditar(null);
      cargarEventos();
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al eliminar evento.");
    }
  };

  // Alternar completado
  const handleToggleCompletado = async (ev: EventoCalendario) => {
    if (!ev.id) return;
    try {
      await Api.calendario.editar(ev.id, { completado: !ev.completado });
      mostrarToast("exito", `Evento marcado como ${!ev.completado ? "completado" : "pendiente"}.`);
      cargarEventos();
    } catch (err: any) {
      mostrarToast("error", err.message || "Error al actualizar estado.");
    }
  };

  // Cálculo de KPIs
  const kpis = useMemo(() => {
    const totalVencimientos = eventosList.filter((e) => e.categoria === "vencimiento").length;
    const criticos = eventosList.filter((e) => e.categoria === "vencimiento" && e.dias <= 7).length;
    const manuales = eventosList.filter((e) => e.id !== null).length;
    const completados = eventosList.filter((e) => e.completado).length;
    return { totalVencimientos, criticos, manuales, completados };
  }, [eventosList]);

  // Generación de días de la grilla mensual
  const diasGrilla = useMemo(() => {
    const primerDiaMes = new Date(anioActual, mesActual, 1);
    const ultimoDiaMes = new Date(anioActual, mesActual + 1, 0);
    
    // Ajuste para comenzar en Lunes (0 = Domingo en JS -> pasar a 1..7 donde 1 = Lunes)
    let diaSemanaInicio = primerDiaMes.getDay();
    diaSemanaInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1; // 0=LUN ... 6=DOM

    const dias = [];

    // Días del mes anterior para rellenar la primera semana
    const mesAnteriorUltimoDia = new Date(anioActual, mesActual, 0).getDate();
    for (let i = diaSemanaInicio - 1; i >= 0; i--) {
      const fechaObj = new Date(anioActual, mesActual - 1, mesAnteriorUltimoDia - i);
      const fechaStr = fechaObj.toISOString().split("T")[0];
      dias.push({
        fechaStr,
        diaNumero: mesAnteriorUltimoDia - i,
        esMesActual: false,
        esHoy: false,
      });
    }

    // Días del mes actual
    const hoyStr = new Date().toISOString().split("T")[0];
    for (let d = 1; d <= ultimoDiaMes.getDate(); d++) {
      const fechaObj = new Date(anioActual, mesActual, d);
      const fechaStr = fechaObj.toISOString().split("T")[0];
      dias.push({
        fechaStr,
        diaNumero: d,
        esMesActual: true,
        esHoy: fechaStr === hoyStr,
      });
    }

    // Días del mes siguiente para completar múltiplos de 7 (máx 35 o 42 celdas)
    const restante = 7 - (dias.length % 7);
    if (restante < 7) {
      for (let s = 1; s <= restante; s++) {
        const fechaObj = new Date(anioActual, mesActual + 1, s);
        const fechaStr = fechaObj.toISOString().split("T")[0];
        dias.push({
          fechaStr,
          diaNumero: s,
          esMesActual: false,
          esHoy: false,
        });
      }
    }

    return dias;
  }, [mesActual, anioActual]);

  // Mapa de eventos por fecha (YYYY-MM-DD)
  const eventosPorFecha = useMemo(() => {
    const mapa: Record<string, EventoCalendario[]> = {};
    for (const ev of eventosList) {
      if (!mapa[ev.fecha]) mapa[ev.fecha] = [];
      mapa[ev.fecha].push(ev);
    }
    return mapa;
  }, [eventosList]);

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

      {/* Cabecera Principal y Contexto */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Calendario de Acreditaciones y Agendamientos (ADC)</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Supervisa los vencimientos documentales proyectados por contrato y agenda eventos de mantención, capacitación e inspecciones en faena.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => abrirModalCrear()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            <PlusIcon /> Agendar nuevo evento
          </button>
        </div>
      </div>

      {/* Tarjetas KPI Dinámicas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-red-50 text-red-600 p-2.5 rounded-lg shrink-0">
            <CalendarIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Vencimientos proyectados</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{kpis.totalVencimientos}</span>
            <span className="text-xs text-red-600 font-medium mt-0.5">en el período</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-amber-50 text-amber-600 p-2.5 rounded-lg shrink-0">
            <AlertTriangleIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Críticos / Inminentes</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{kpis.criticos}</span>
            <span className="text-xs text-amber-600 font-medium mt-0.5">vencidos o en ≤ 7 días</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-lg shrink-0">
            <ClockIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Agendamientos manuales</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{kpis.manuales}</span>
            <span className="text-xs text-blue-600 font-medium mt-0.5">creados por el ADC</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-lg shrink-0">
            <CheckCircleIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Eventos completados</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{kpis.completados}</span>
            <span className="text-xs text-emerald-600 font-medium mt-0.5">registros finalizados</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Control de Calendario */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Controles de Navegación de Mes */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={irMesAnterior}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors"
              title="Mes anterior"
            >
              <ChevronLeftIcon />
            </button>
            <button
              onClick={irAHoy}
              className="px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={irMesSiguiente}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-md transition-colors"
              title="Mes siguiente"
            >
              <ChevronRightIcon />
            </button>
          </div>
          <h2 className="text-lg font-bold text-slate-800 ml-1">
            {MESES[mesActual]} {anioActual}
          </h2>
        </div>

        {/* Filtros por Contrato y Categoría */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <select
            value={filtroContrato}
            onChange={(e) => setFiltroContrato(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 outline-none flex-1 lg:flex-none font-medium"
          >
            <option value="todos">Todos los contratos</option>
            {contratosList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.codigo ? `(${c.codigo})` : ""}
              </option>
            ))}
          </select>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 outline-none flex-1 lg:flex-none font-medium"
          >
            <option value="todas">Todas las categorías</option>
            <option value="vencimiento">Vencimientos</option>
            <option value="capacitacion">Capacitación</option>
            <option value="mantencion">Mantención</option>
            <option value="administrativo">Administrativo</option>
            <option value="entrega">Entrega</option>
            <option value="otro">Otro</option>
          </select>

          {/* Alternador de Vista (Mes / Agenda) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setVistaModo("mes")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                vistaModo === "mes" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => setVistaModo("agenda")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                vistaModo === "agenda" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Agenda
            </button>
          </div>
        </div>
      </div>

      {/* VISTA 1: GRILLA MENSUAL */}
      {vistaModo === "mes" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Cabecera días semana */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center font-bold text-xs text-slate-500 uppercase tracking-wider py-3">
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div>Sáb</div>
            <div>Dom</div>
          </div>

          {/* Celdas de los días */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 min-h-[580px]">
            {diasGrilla.map((dia, idx) => {
              const eventosDelDia = eventosPorFecha[dia.fechaStr] || [];
              return (
                <div
                  key={idx}
                  onClick={() => abrirModalCrear(dia.fechaStr)}
                  className={`p-2 transition-colors flex flex-col justify-between group min-h-[110px] cursor-pointer ${
                    !dia.esMesActual
                      ? "bg-slate-50/50 text-slate-400"
                      : dia.esHoy
                      ? "bg-blue-50/20 text-slate-800 font-semibold"
                      : "bg-white text-slate-700 hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                        dia.esHoy ? "bg-blue-600 text-white font-bold" : "text-slate-600"
                      }`}
                    >
                      {dia.diaNumero}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirModalCrear(dia.fechaStr);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-opacity"
                      title="Agendar en este día"
                    >
                      <PlusIcon />
                    </button>
                  </div>

                  {/* Lista de chips de eventos */}
                  <div className="mt-1.5 space-y-1 flex-1 overflow-y-auto max-h-[85px]">
                    {eventosDelDia.slice(0, 3).map((ev, evIdx) => {
                      const catStyle = CATEGORIAS_COLORES[ev.categoria] || CATEGORIAS_COLORES.otro;
                      return (
                        <div
                          key={ev.id || `${dia.fechaStr}-${evIdx}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ev.categoria === "vencimiento") {
                              setModalDetalleVencimiento(ev);
                            } else {
                              abrirModalEditar(ev);
                            }
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] truncate font-medium border flex items-center justify-between cursor-pointer hover:shadow-xs transition-shadow ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                          title={`${ev.titulo} (${catStyle.label})`}
                        >
                          <span className="truncate">{ev.titulo}</span>
                          {ev.categoria === "vencimiento" && ev.dias <= 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0 ml-1"></span>
                          )}
                        </div>
                      );
                    })}
                    {eventosDelDia.length > 3 && (
                      <span className="text-[10px] text-slate-400 font-medium pl-1 block">
                        +{eventosDelDia.length - 3} más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISTA 2: AGENDA CRONOLÓGICA */}
      {vistaModo === "agenda" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
              <p className="text-sm">Cargando eventos de la agenda...</p>
            </div>
          ) : eventosList.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CalendarIcon />
              <p className="text-base font-semibold mt-3">Sin eventos registrados para los filtros seleccionados.</p>
              <p className="text-xs text-slate-400 mt-1">Usa el botón superior para agendar capacitaciones o mantenciones.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {eventosList.map((ev, idx) => {
                const catStyle = CATEGORIAS_COLORES[ev.categoria] || CATEGORIAS_COLORES.otro;
                const esVencimiento = ev.categoria === "vencimiento";

                return (
                  <div key={ev.id || idx} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 p-3 rounded-xl transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Fecha Badge */}
                      <div className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl text-center min-w-[70px] shrink-0">
                        <span className="text-xs font-bold uppercase tracking-wider block text-slate-500">
                          {new Date(ev.fecha + "T12:00:00").toLocaleString("es-CL", { month: "short" }).toUpperCase()}
                        </span>
                        <span className="text-xl font-bold text-slate-800 block">
                          {new Date(ev.fecha + "T12:00:00").getDate()}
                        </span>
                      </div>

                      {/* Detalles del evento */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-sm">{ev.titulo}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                            {catStyle.label}
                          </span>
                          {esVencimiento && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ev.dias < 0
                                ? "bg-red-100 text-red-800"
                                : ev.dias <= 7
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {ev.dias < 0 ? `Vencido hace ${Math.abs(ev.dias)} días` : ev.dias === 0 ? "Vence hoy" : `Vence en ${ev.dias} días`}
                            </span>
                          )}
                        </div>

                        {esVencimiento ? (
                          <p className="text-xs text-slate-500 flex flex-wrap gap-2">
                            {ev.sujeto && (
                              <span>
                                <strong>{ev.sujeto.tipo === "trabajador" ? "Trabajador:" : "Equipo:"}</strong> {ev.sujeto.nombre} ({ev.sujeto.rut || ev.sujeto.patente})
                              </span>
                            )}
                            {ev.contrato && (
                              <span>
                                • <strong>Contrato:</strong> {ev.contrato.nombre} ({ev.contrato.faena})
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">
                            {ev.descripcion || "Sin descripción adicional."}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2 shrink-0">
                      {esVencimiento ? (
                        <button
                          onClick={() => setModalDetalleVencimiento(ev)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          Ver detalle <ExternalLinkIcon />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleToggleCompletado(ev)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                              ev.completado
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {ev.completado ? "Completado" : "Marcar hecho"}
                          </button>
                          <button
                            onClick={() => abrirModalEditar(ev)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                            Editar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL CREAR EVENTO MANUAL */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Agendar Evento Manual (ADC)</h3>
              <button onClick={() => setModalNuevo(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleCrearEvento} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Título del evento *</label>
                <input
                  type="text"
                  required
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  placeholder="Ej. Capacitación Altura y Bloqueo de Energía"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
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
                    <option value="capacitacion">Capacitación</option>
                    <option value="mantencion">Mantención</option>
                    <option value="administrativo">Administrativo</option>
                    <option value="entrega">Entrega EPP/Equipos</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción o Notas</label>
                <textarea
                  rows={3}
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Instrucciones, sala de capacitación, responsable en faena..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
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
                  disabled={guardando || !formTitulo.trim() || !formFecha}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50 text-sm"
                >
                  {guardando ? "Agendando..." : "Guardar Evento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR / ELIMINAR EVENTO MANUAL */}
      {modalEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800">Editar Evento Manual</h3>
              <button onClick={() => setModalEditar(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <XIcon />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha</label>
                  <input
                    type="date"
                    required
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
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
                    <option value="capacitacion">Capacitación</option>
                    <option value="mantencion">Mantención</option>
                    <option value="administrativo">Administrativo</option>
                    <option value="entrega">Entrega EPP/Equipos</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-xl bg-slate-50">
                <input
                  type="checkbox"
                  id="modal_completado"
                  checked={formCompletado}
                  onChange={(e) => setFormCompletado(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="modal_completado" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                  Marcar este evento como completado
                </label>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-100 gap-3">
                <button
                  type="button"
                  onClick={() => modalEditar.id && handleEliminarEvento(modalEditar.id)}
                  className="px-3.5 py-2.5 text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold flex items-center gap-1.5 border border-red-200"
                >
                  <TrashIcon /> Eliminar
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalEditar(null)}
                    className="px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando || !formTitulo.trim() || !formFecha}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl disabled:opacity-50 text-sm"
                  >
                    {guardando ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE VENCIMIENTO PROYECTADO */}
      {modalDetalleVencimiento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                  <AlertTriangleIcon />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Vencimiento Documental Proyectado</h3>
                  <span className="text-xs text-slate-500">Origen: expedientes de acreditación</span>
                </div>
              </div>
              <button onClick={() => setModalDetalleVencimiento(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-md">
                <XIcon />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 block font-medium">Documento / Requisito:</span>
                  <span className="text-sm font-bold text-slate-800">{modalDetalleVencimiento.titulo}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400 block font-medium">Fecha de Vencimiento:</span>
                    <span className="font-semibold text-slate-700">{modalDetalleVencimiento.fecha}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Estado de Urgencia:</span>
                    <span className={`font-bold ${
                      modalDetalleVencimiento.dias < 0 ? "text-red-600" : modalDetalleVencimiento.dias <= 7 ? "text-amber-600" : "text-emerald-600"
                    }`}>
                      {modalDetalleVencimiento.dias < 0
                        ? `Vencido hace ${Math.abs(modalDetalleVencimiento.dias)} días`
                        : modalDetalleVencimiento.dias === 0
                        ? "Vence hoy"
                        : `Vence en ${modalDetalleVencimiento.dias} días`}
                    </span>
                  </div>
                </div>

                {modalDetalleVencimiento.sujeto && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-slate-400 block font-medium">
                      {modalDetalleVencimiento.sujeto.tipo === "trabajador" ? "Trabajador Afectado:" : "Equipo / Vehículo:"}
                    </span>
                    <span className="font-bold text-slate-800">{modalDetalleVencimiento.sujeto.nombre}</span>
                    <span className="text-slate-500 block">
                      {modalDetalleVencimiento.sujeto.rut || modalDetalleVencimiento.sujeto.patente}
                    </span>
                  </div>
                )}

                {modalDetalleVencimiento.contrato && (
                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-slate-400 block font-medium">Contrato y Faena:</span>
                    <span className="font-semibold text-slate-800">{modalDetalleVencimiento.contrato.nombre}</span>
                    <span className="text-slate-500 block">Faena: {modalDetalleVencimiento.contrato.faena}</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                Este vencimiento se proyecta en tiempo real desde la fecha de vigencia del documento. Al cargar o validar una versión renovada, el evento se actualizará automáticamente.
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalDetalleVencimiento(null)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 text-sm"
                >
                  Cerrar
                </button>
                {modalDetalleVencimiento.contrato && (
                  <Link
                    href={`/contratos/${modalDetalleVencimiento.contrato.id}`}
                    className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2"
                  >
                    Gestionar en Contrato <ExternalLinkIcon />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
