"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import type { Alerta, ResumenAlertas } from "@/lib/tipos";

// Iconos útiles
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);

const MoreVerticalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);

// Helpers
const formatDateStr = (dateStr: string) => {
  const d = new Date(dateStr);
  const diffDays = Math.floor((new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 30) return `Hace ${diffDays} días`;
  return d.toLocaleDateString("es-CL");
};

export default function AlertasPage() {
  const [loading, setLoading] = useState(true);
  const [alertasList, setAlertasList] = useState<Alerta[]>([]);
  const [resumen, setResumen] = useState<ResumenAlertas | null>(null);
  const [filtroTab, setFiltroTab] = useState("Todas");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [resList, resSum] = await Promise.all([
          Api.alertas.listar({ page_size: 50 }),
          Api.alertas.resumen()
        ]);
        setAlertasList(resList.items || []);
        setResumen(resSum);
      } catch (err) {
        console.error("Error al cargar alertas:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getFilteredAlerts = () => {
    if (filtroTab === "Críticas") return alertasList.filter(a => a.severidad === "critica");
    if (filtroTab === "Advertencias") return alertasList.filter(a => a.severidad === "advertencia" || a.severidad === "alta");
    if (filtroTab === "Informativas") return alertasList.filter(a => a.severidad === "informativa");
    if (filtroTab === "Resueltas") return alertasList.filter(a => a.estado === "resuelta");
    return alertasList;
  };

  const alertasFiltradas = getFilteredAlerts();

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Alertas</h2>
          <p className="text-sm text-slate-500 mt-1">
            Supervisa y gestiona las alertas críticas y preventivas que requieren atención.
          </p>
        </div>
        <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
          <SettingsIcon /> Configurar notificaciones
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Críticas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            Críticas
          </div>
          <div className="text-3xl font-bold text-red-500">{resumen?.criticas || 0}</div>
          <div className="text-xs text-red-400 font-medium mt-1">requieren atención</div>
        </div>

        {/* Advertencias */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <div className="bg-amber-100 text-amber-500 p-1 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            </div>
            Advertencias
          </div>
          <div className="text-3xl font-bold text-amber-500">{resumen?.advertencias || 0}</div>
          <div className="text-xs text-amber-400 font-medium mt-1">requieren atención</div>
        </div>

        {/* Informativas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <div className="bg-blue-100 text-blue-500 p-1 rounded">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </div>
            Informativas
          </div>
          <div className="text-3xl font-bold text-slate-800">{resumen?.informativas || 0}</div>
          <div className="text-xs text-slate-500 font-medium mt-1">nuevas</div>
        </div>

        {/* Resueltas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <div className="bg-emerald-100 text-emerald-500 p-1 rounded">
              <CheckCircleIcon />
            </div>
            Resueltas (30 días)
          </div>
          <div className="text-3xl font-bold text-slate-800">{resumen?.resueltas_30d || 0}</div>
          <div className="text-xs text-emerald-600 font-medium mt-1">en los últimos 30 días</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {["Todas", "Críticas", "Advertencias", "Informativas", "Resueltas"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFiltroTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${
              filtroTab === tab
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab}
            {tab === "Críticas" && resumen?.criticas ? (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${filtroTab === tab ? "bg-red-500 text-white" : "bg-red-100 text-red-600"}`}>
                {resumen.criticas}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input 
            type="text" 
            placeholder="Buscar alerta por palabra clave..." 
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <select className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-2 outline-none">
            <option>Estado: Todas</option>
          </select>
          <select className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-2 outline-none">
            <option>Tipo: Todos</option>
          </select>
          <select className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-2 outline-none">
            <option>Ámbito: Todos</option>
          </select>
          <select className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-2 outline-none">
            <option>Faena: Todas</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-4 whitespace-nowrap">Prioridad</th>
              <th className="px-4 py-4">Alerta</th>
              <th className="px-4 py-4 whitespace-nowrap">Tipo</th>
              <th className="px-4 py-4 whitespace-nowrap">Ámbito</th>
              <th className="px-4 py-4">Relacionado con</th>
              <th className="px-4 py-4">Faena / Contrato</th>
              <th className="px-4 py-4 whitespace-nowrap">Fecha</th>
              <th className="px-4 py-4 whitespace-nowrap">Estado</th>
              <th className="px-4 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mb-2"></div>
                  <p>Cargando alertas...</p>
                </td>
              </tr>
            ) : alertasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                  No hay alertas que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              alertasFiltradas.map((a) => {
                // Derive values to mimic screenshot
                const isCritical = a.severidad === "critica" || a.severidad === "alta";
                const isWarning = a.severidad === "advertencia";
                
                // Try to split description for "Relacionado con" if it contains a name
                const relName = a.sujeto_id ? "Sujeto / Empleado" : "Empresa / Contrato";
                const letter = relName.charAt(0).toUpperCase();

                return (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      {isCritical ? (
                         <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold bg-red-50 text-red-600 border border-red-100">
                           <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                           Crítica
                         </span>
                      ) : isWarning ? (
                         <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                           <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                           Advertencia
                         </span>
                      ) : (
                         <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                           <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                           Informativa
                         </span>
                      )}
                    </td>
                    <td className="px-4 py-4 min-w-[250px]">
                      <div className="font-bold text-slate-800">{a.titulo}</div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-1">{a.descripcion}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {isCritical ? (
                         <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold bg-red-50 text-red-600 border border-red-100">
                           Crítica
                         </span>
                      ) : (
                         <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                           {a.severidad}
                         </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs whitespace-nowrap">
                      {a.sujeto_id ? "Personal" : "Empresa"}
                    </td>
                    <td className="px-4 py-4 min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${isCritical ? 'bg-blue-600' : 'bg-slate-400'}`}>
                          {letter}
                        </div>
                        <span className="font-semibold text-slate-700 text-xs">{relName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500 min-w-[200px]">
                      {a.contrato_id ? "Asociado a Contrato" : "General"}
                    </td>
                    <td className="px-4 py-4 text-xs whitespace-nowrap text-slate-500">
                      {formatDateStr(a.created_at)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {!a.leida ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold bg-red-50 text-red-600 border border-red-100">
                          No leída
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          Leída
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors">
                          <EyeIcon />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-colors">
                          <MoreVerticalIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
