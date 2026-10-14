"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import * as Api from "@/lib/cliente";
import type { Faena } from "@/lib/tipos";

// --- Icons ---
const BuildingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
);
const MountainIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>
);
const ClipboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
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
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const MoreVerticalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
);
const LocationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
);
const DocumentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
);

// --- Helpers ---
const getAvatarColor = (name: string) => {
  const char = name.charAt(0).toUpperCase();
  if (['A', 'E', 'I', 'O', 'U'].includes(char)) return "bg-blue-900 text-white";
  if (['L', 'M', 'N', 'C'].includes(char)) return "bg-amber-800 text-white";
  if (['R', 'S', 'T'].includes(char)) return "bg-cyan-700 text-white";
  return "bg-slate-800 text-white";
};

const getSubtitle = (name: string) => {
  if (name.includes("Antofagasta")) return "AMSA";
  if (name.includes("Lundin")) return "Lundin";
  if (name.includes("Codelco")) return "Codelco";
  if (name.includes("Repsol")) return "Energía";
  return "Grupo Minero";
};

// Gradient for the Catalog Header bars
const getCatalogHeaderColor = (name: string) => {
  if (name.includes("Antofagasta")) return "bg-blue-100 text-blue-900";
  if (name.includes("Lundin")) return "bg-amber-100 text-amber-900";
  if (name.includes("Codelco")) return "bg-red-100 text-red-900";
  return "bg-slate-200 text-slate-800";
};

// Gradient for the Catalog Cards
const getCatalogGradient = (name: string) => {
  if (name.includes("Antofagasta")) return "bg-gradient-to-br from-blue-700 to-indigo-900";
  if (name.includes("Lundin")) return "bg-gradient-to-br from-amber-700 to-stone-900";
  if (name.includes("Codelco")) return "bg-gradient-to-br from-red-800 to-rose-950";
  return "bg-gradient-to-br from-slate-600 to-slate-800";
};

const mockDataForMandante = (name: string, index: number) => {
  const isAMSA = name.includes("Antofagasta");
  const isLundin = name.includes("Lundin");
  const isCodelco = name.includes("Codelco");
  const isRepsol = name.includes("Repsol");

  let contratos = 1 + (index % 3);
  let personal = 15 + (index * 7);
  let compText = "100 / 100";
  let compPct = 100;

  if (isAMSA) { contratos = 2; personal = 51; compText = "486 / 487"; compPct = 98; }
  else if (isLundin) { contratos = 2; personal = 28; compText = "252 / 262"; compPct = 96; }
  else if (isCodelco) { contratos = 2; personal = 28; compText = "183 / 182"; compPct = 95; }
  else if (isRepsol) { contratos = 1; personal = 14; compText = "127 / 132"; compPct = 96; }

  return { contratos, personal, compText, compPct };
};

export default function MandantesPage() {
  const [loading, setLoading] = useState(true);
  const [faenasList, setFaenasList] = useState<Faena[]>([]);
  const [viewMode, setViewMode] = useState<"mandantes" | "catalogo">("mandantes");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchMandantes() {
      setLoading(true);
      try {
        const res = await Api.faenas.listar({ page_size: 50 });
        setFaenasList(res.items || []);
      } catch (err) {
        console.error("Error al cargar mandantes:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMandantes();
  }, []);

  // Agrupar faenas por mandante
  const faenasPorMandante = faenasList.reduce((acc, f) => {
    const m = f.mandante || "Otros";
    if (!acc[m]) acc[m] = { mandante: m, faenas: [] };
    acc[m].faenas.push(f);
    return acc;
  }, {} as Record<string, { mandante: string, faenas: Faena[] }>);
  
  const mandantesArray = Object.values(faenasPorMandante);
  const totalMandantes = mandantesArray.length;
  const totalFaenas = faenasList.length;

  if (viewMode === "catalogo") {
    // Vista Catálogo de Faenas Activas (Imagen 2)
    return (
      <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumbs y Volver */}
          <div className="mb-6 flex flex-col items-start gap-4">
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
              <span className="text-blue-600">Proyectos</span>
              <span>›</span>
              <span>Faenas de Chile</span>
            </div>
            
            <button 
              onClick={() => setViewMode("mandantes")}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            >
              ← VOLVER A MIS PROYECTOS
            </button>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Faenas activas en ACREDITTIA</h1>
          <p className="text-sm text-slate-500 mt-1.5 mb-8">
            {totalFaenas} faenas integradas - AMSA - Lundin Mining - Codelco. Selecciona la faena donde necesitas acreditar.
          </p>

          <div className="relative max-w-sm mb-10">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <SearchIcon />
            </div>
            <input 
              type="text" 
              placeholder="Buscar faena o región..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>

          {/* Listado agrupado en formato Catálogo */}
          <div className="space-y-10">
            {mandantesArray.map((m) => {
              // Filtrado local por busqueda
              const filteredFaenas = m.faenas.filter(f => 
                f.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (f.region || "").toLowerCase().includes(searchTerm.toLowerCase())
              );
              
              if (filteredFaenas.length === 0) return null;

              return (
                <div key={m.mandante} className="space-y-4">
                  {/* Header de la sección */}
                  <div className={`px-4 py-2 rounded-lg flex justify-between items-center ${getCatalogHeaderColor(m.mandante)}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></div>
                      <span className="font-bold text-sm">{m.mandante} {getSubtitle(m.mandante) !== "Grupo Minero" && `(${getSubtitle(m.mandante)})`}</span>
                    </div>
                    <span className="text-xs font-semibold opacity-80">{filteredFaenas.length} faenas activas</span>
                  </div>

                  {/* Grid de Faenas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {filteredFaenas.map((f) => (
                      <Link href={`/contratos?faena=${encodeURIComponent(f.nombre)}`} key={f.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group block">
                        {/* Gradient Top */}
                        <div className={`h-28 p-4 flex justify-between items-start ${getCatalogGradient(m.mandante)}`}>
                          <MountainIcon />
                          <span className="bg-white text-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                            Activa
                          </span>
                        </div>
                        {/* Bottom info */}
                        <div className="p-4 flex flex-col gap-1.5">
                          <h3 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{f.nombre}</h3>
                          <span className="text-xs text-slate-500 font-medium">{f.mandante}</span>
                          <div className="mt-2.5 flex items-center gap-1.5 text-blue-600 text-[11px] font-bold">
                            <LocationIcon /> Región {f.region ? `de ${f.region.replace('Región de ', '').replace('Región del ', '')}` : 'No definida'}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                            <DocumentIcon /> {1 + (f.nombre.length % 3)} contratos activos
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Vista Dashboard Mandantes Original (Imagen 1)
  return (
    <div className="p-4 md:p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Mandantes</h2>
          <p className="text-sm text-slate-500 mt-1">
            Empresas mandantes y grupos mineros que administran las faenas donde operas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors">
            <DownloadIcon /> Exportar
          </button>
          <button 
            onClick={() => setViewMode("catalogo")}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors"
          >
            <PlusIcon /> Nueva faena
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-slate-100 text-slate-500 p-2.5 rounded-lg shrink-0">
            <BuildingIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Mandantes</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{totalMandantes > 0 ? totalMandantes : 4}</span>
            <span className="text-xs text-slate-400 font-medium mt-0.5">empresas mandantes</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-indigo-50 text-indigo-500 p-2.5 rounded-lg shrink-0">
            <MountainIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Faenas asociadas</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">{totalFaenas > 0 ? totalFaenas : 9}</span>
            <span className="text-xs text-slate-400 font-medium mt-0.5">en todos los mandantes</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-blue-50 text-blue-500 p-2.5 rounded-lg shrink-0">
            <ClipboardIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Contratos vigentes</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">7</span>
            <span className="text-xs text-slate-400 font-medium mt-0.5">activos hoy</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="bg-emerald-50 text-emerald-500 p-2.5 rounded-lg shrink-0">
            <CheckCircleIcon />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Cumplimiento promedio</span>
            <span className="text-2xl font-bold text-slate-800 mt-0.5">97%</span>
            <span className="text-xs text-emerald-500 font-medium mt-0.5">121 personas/equipos</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <SearchIcon />
          </div>
          <input 
            type="text" 
            placeholder="Buscar mandante o grupo..." 
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select className="bg-white border border-slate-200 text-slate-600 text-sm rounded-lg px-4 py-2 outline-none w-full sm:w-auto">
          <option>Estado: Todos</option>
        </select>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 whitespace-nowrap">
          <thead className="bg-white border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <tr>
              <th className="px-5 py-4 w-64">Mandante</th>
              <th className="px-5 py-4">Faenas</th>
              <th className="px-5 py-4 text-center">Contratos</th>
              <th className="px-5 py-4 text-center">Personal + Equipos</th>
              <th className="px-5 py-4 w-56">Cumplimiento</th>
              <th className="px-5 py-4 text-center">Estado</th>
              <th className="px-5 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-2"></div>
                  <p>Cargando mandantes...</p>
                </td>
              </tr>
            ) : mandantesArray.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                  No hay mandantes registrados.
                </td>
              </tr>
            ) : (
              mandantesArray.map((m, idx) => {
                const { contratos, personal, compText, compPct } = mockDataForMandante(m.mandante, idx);
                const colorClass = getAvatarColor(m.mandante);
                const sub = getSubtitle(m.mandante);
                
                return (
                  <tr key={m.mandante} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${colorClass}`}>
                          {m.mandante.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-[13px]">{m.mandante}</span>
                          <span className="text-[11px] text-slate-400 font-medium">{sub}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-sm">
                        {m.faenas.map((f, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-1 bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-semibold rounded-md">
                            {f.nombre}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-700 text-center">
                      {contratos}
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-slate-500 text-center">
                      {personal}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-slate-600 w-12 text-right">{compText}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${compPct}%` }}></div>
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 w-6">{compPct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                        Al día
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
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
        
        {/* Pagination Footer */}
        {!loading && mandantesArray.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
            <span>Mostrando 1 a {mandantesArray.length} de {mandantesArray.length} mandantes</span>
            <span className="font-medium text-slate-800">10 por página</span>
          </div>
        )}
      </div>
    </div>
  );
}
