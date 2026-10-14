"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";

// --- Icons ---
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
);
const AlertTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
);
const MapPinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
);
const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
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

export default function CalendarioPage() {
  const [loading, setLoading] = useState(true);
  const [eventosList, setEventosList] = useState<any[]>([]);

  useEffect(() => {
    async function fetchEventos() {
      setLoading(true);
      try {
        const hoy = new Date();
        const hace30d = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
        const en90d = new Date(hoy.getTime() + 90 * 24 * 60 * 60 * 1000);
        const desde = hace30d.toISOString().split("T")[0];
        const hasta = en90d.toISOString().split("T")[0];
        const res = await Api.calendario.eventos(desde, hasta);
        setEventosList(res.items || []);
      } catch (err) {
        console.error("Error al cargar eventos del calendario:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEventos();
  }, []);

  // Mock static layout events for the grid to match the visual exactly
  const mockupEvents = [
    { day: 5, label: "Inducción de faena", color: "bg-amber-100 text-amber-800" },
    { day: 14, label: "Entrega EPP", color: "bg-emerald-100 text-emerald-800" },
    { day: 20, label: "Capacitación SSMA", color: "bg-amber-100 text-amber-800" },
  ];

  // Map API events or mock them for the sidebar
  const sidebarEvents = eventosList.length > 0 ? eventosList.slice(0, 5).map((e: any) => {
    const d = new Date(e.fecha);
    const day = d.getDate();
    const month = d.toLocaleString('es-CL', { month: 'short' }).toUpperCase();
    return {
      id: e.id,
      day, month,
      title: e.titulo,
      subtitle: e.descripcion || "General",
      status: "Vencido"
    }
  }) : [
    { id: 1, day: 28, month: 'MAY', title: "Cédula de Identidad", subtitle: "Gallardo Pérez Luis\nLos Pelambres", status: "Vencido" },
    { id: 2, day: 18, month: 'MAY', title: "Anexo Contrato", subtitle: "Gallardo Pérez Luis\nLos Pelambres", status: "Vencido" },
    { id: 3, day: 28, month: 'MAY', title: "Cédula de Identidad", subtitle: "Castro Vera Marcelo\nLos Pelambres", status: "Vencido" },
    { id: 4, day: 18, month: 'MAY', title: "Anexo Contrato", subtitle: "Castro Vera Marcelo\nLos Pelambres", status: "Vencido" },
    { id: 5, day: 28, month: 'MAY', title: "Autorización de Uso de Datos Personales", subtitle: "Rojas Fuentes Matías\nAndina", status: "Vencido" }
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 flex flex-col gap-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Calendario</h2>
          <p className="text-sm text-slate-500 mt-1">
            Visualiza y gestiona los vencimientos y eventos importantes de acreditaciones, requisitos y mantenciones.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors">
            <DownloadIcon /> Exportar calendario
          </button>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors">
            <PlusIcon /> Nuevo evento
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
        {/* Card 1 */}
        <div className="bg-white p-4 lg:p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-indigo-50 text-indigo-500 p-2.5 rounded-lg shrink-0">
            <CalendarIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Vencimientos próximos</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-800">35</span>
            </div>
            <span className="text-xs text-amber-500 font-medium truncate">en los próximos 30 días</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-4 lg:p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-red-50 text-red-500 p-2.5 rounded-lg shrink-0">
            <AlertTriangleIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Eventos críticos</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-800">28</span>
            </div>
            <span className="text-xs text-red-500 font-medium truncate">requieren atención</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-4 lg:p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-slate-100 text-slate-500 p-2.5 rounded-lg shrink-0">
            <MapPinIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Eventos programados</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-800">14</span>
            </div>
            <span className="text-xs text-slate-400 font-medium truncate">este mes</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-4 lg:p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-emerald-50 text-emerald-500 p-2.5 rounded-lg shrink-0">
            <CheckCircleIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-xs font-semibold">Eventos completados</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-slate-800">1048</span>
            </div>
            <span className="text-xs text-emerald-500 font-medium truncate">este mes</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Calendar Main Area */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-w-0">
          
          {/* Calendar Toolbar */}
          <div className="p-3 md:p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center bg-white gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg">
                <button className="p-1.5 md:p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"><ChevronLeftIcon /></button>
                <button className="px-3 md:px-4 py-1.5 text-sm font-semibold text-slate-700 border-l border-r border-slate-200 hover:bg-slate-100 transition-colors">Hoy</button>
                <button className="p-1.5 md:p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"><ChevronRightIcon /></button>
              </div>
              <h3 className="text-base md:text-lg font-bold text-slate-800 ml-2">Octubre 2026</h3>
            </div>
            
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden text-[11px] md:text-sm font-semibold text-slate-600">
              <button className="px-3 md:px-4 py-1.5 bg-white text-slate-800 shadow-sm">Mes</button>
              <button className="px-3 md:px-4 py-1.5 hover:bg-slate-100 border-l border-slate-200">Semana</button>
              <button className="px-3 md:px-4 py-1.5 hover:bg-slate-100 border-l border-slate-200">Día</button>
              <button className="px-3 md:px-4 py-1.5 hover:bg-slate-100 border-l border-slate-200">Agenda</button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 flex flex-col bg-slate-50 min-h-0 overflow-hidden">
            {/* Days Header */}
            <div 
              className="grid border-b border-slate-200 text-center bg-white shrink-0"
              style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
            >
              {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map(day => (
                <div key={day} className="py-3 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest border-r border-slate-100 last:border-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid - Changed to inline styles to force 7 columns exactly */}
            <div 
              className="flex-1 grid bg-slate-200 gap-[1px] min-h-0"
              style={{ 
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(5, minmax(0, 1fr))'
              }}
            >
              {Array.from({ length: 35 }).map((_, i) => {
                // Determine day number (assume 1st is Thursday = index 3)
                const dayNum = i - 2; 
                const isCurrentMonth = dayNum > 0 && dayNum <= 31;
                const hasEvent = isCurrentMonth && mockupEvents.find(e => e.day === dayNum);

                return (
                  <div key={i} className={`bg-white p-1 md:p-2 flex flex-col overflow-y-auto ${!isCurrentMonth ? 'bg-slate-50 opacity-50' : ''}`}>
                    {isCurrentMonth && (
                      <span className="text-[10px] md:text-xs font-semibold text-slate-700 ml-1">{dayNum}</span>
                    )}
                    {hasEvent && (
                      <div className={`mt-1 md:mt-2 text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded truncate shadow-sm border border-white/50 ${hasEvent.color}`}>
                        {hasEvent.label}
                      </div>
                    )}
                    {/* Mock small badge for day 8 MAR as seen in screenshot */}
                    {dayNum === 6 && (
                      <div className="mt-1 flex items-center justify-center w-4 h-4 md:w-5 md:h-5 rounded-full bg-blue-500 text-white text-[9px] md:text-[10px] font-bold shadow-sm">
                        8
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="p-2 md:p-3 border-t border-slate-200 bg-white flex flex-wrap items-center gap-3 md:gap-4 text-[10px] md:text-xs font-semibold text-slate-500 shrink-0">
            <div className="flex items-center gap-1.5"><span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded bg-red-400"></span>Vencimiento</div>
            <div className="flex items-center gap-1.5"><span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded bg-blue-400"></span>Mantención</div>
            <div className="flex items-center gap-1.5"><span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded bg-amber-400"></span>Capacitación</div>
            <div className="flex items-center gap-1.5"><span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded bg-purple-400"></span>Administrativo</div>
            <div className="flex items-center gap-1.5"><span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded bg-emerald-400"></span>Entrega / Otro</div>
          </div>

        </div>

        {/* Right Sidebar: Próximos eventos */}
        <div className="w-full lg:w-72 xl:w-80 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-slate-800">Próximos eventos</h3>
            <a href="#" className="text-xs text-blue-600 font-semibold hover:underline">Ver completo →</a>
          </div>
          
          <div className="p-2 space-y-2 overflow-y-auto flex-1 h-[400px] lg:h-auto">
            {loading ? (
               <div className="p-8 text-center text-slate-400 text-xs">Cargando eventos...</div>
            ) : (
              sidebarEvents.map((evt, idx) => (
                <div key={idx} className="p-3 bg-white border border-slate-100 rounded-lg hover:border-slate-300 hover:shadow-sm transition-all flex gap-3 group cursor-pointer">
                  <div className="flex flex-col items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-lg bg-red-50 text-red-500 border border-red-100 shrink-0">
                    <span className="text-base md:text-lg font-bold leading-none">{evt.day}</span>
                    <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest mt-0.5">{evt.month}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] md:text-xs font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{evt.title}</h4>
                    <p className="text-[9px] md:text-[10px] text-slate-500 mt-1 leading-snug whitespace-pre-line">{evt.subtitle}</p>
                    <div className="mt-1 md:mt-2 inline-flex px-1.5 py-0.5 md:px-2 md:py-0.5 rounded text-[8px] md:text-[9px] font-bold uppercase bg-red-50 text-red-600 border border-red-100">
                      {evt.status}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
