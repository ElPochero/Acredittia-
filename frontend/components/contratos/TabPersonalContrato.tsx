"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import * as Api from "@/lib/cliente";
import { Contrato, PlataformaContrato, Sujeto, TrabajadorIn } from "@/lib/tipos";
import { Paginador, Modal } from "@/components/ui";
import { toast } from "sonner";

interface TabPersonalContratoProps {
  contrato: Contrato;
  plataformas: PlataformaContrato[];
}

export function TabPersonalContrato({ contrato, plataformas }: TabPersonalContratoProps) {
  const [personal, setPersonal] = useState<Api.Pagina<Sujeto> | null>(null);
  const [page, setPage] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [vista, setVista] = useState<'lista' | 'cuadricula'>('lista');
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [newWorker, setNewWorker] = useState<TrabajadorIn>({
    nombre: "",
    rut: "",
    cargo: "",
    telefono: "",
    email: "",
    es_conductor: false,
    contrato_id: contrato.id
  });
  const [creando, setCreando] = useState(false);

  const toggleConduce = async (id: string, actual: boolean) => {
    try {
      // Optimistic update
      setPersonal(prev => prev ? {
        ...prev,
        items: prev.items.map(s => s.id === id ? { ...s, es_conductor: !actual } : s)
      } : null);
      
      await Api.personal.editar(id, { es_conductor: !actual });
      toast.success("Trabajador actualizado");
    } catch (e: any) {
      toast.error(e.message || "Error al actualizar trabajador");
      cargar(); // revert
    }
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorker.nombre || !newWorker.rut || !newWorker.cargo) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }
    setCreando(true);
    try {
      await Api.personal.crear(newWorker);
      toast.success("Trabajador agregado correctamente");
      setShowAddWorker(false);
      setNewWorker({ nombre: "", rut: "", cargo: "", telefono: "", email: "", es_conductor: false, contrato_id: contrato.id });
      cargar();
    } catch (e: any) {
      toast.error(e.message || "Error al agregar trabajador");
    } finally {
      setCreando(false);
    }
  };

  const handleSubirDocumento = () => {
    toast.info("Próximamente", { description: "Esta funcionalidad se agregará muy pronto." });
  };

  const descargarExcel = () => {
    if (!list.length) {
      toast.error("No hay personal para descargar");
      return;
    }
    const header = "Nombre,RUT,Cargo,Conduce,Faena,Estado,Cumplimiento\n";
    const csv = list.map(s => {
      const pct = s.stats?.cumplimiento_pct || 0;
      const estadoStr = s.estado === 'ok' ? 'Acreditado' : s.estado === 'venc' ? 'Vencido' : s.estado === 'baja' ? 'Suspendido' : 'Por acreditar';
      return `"${s.nombre}","${s.rut || ''}","${s.cargo || ''}",${s.es_conductor ? 'Si' : 'No'},"${contrato.faena?.nombre}","${estadoStr}","${pct}%"`;
    }).join("\n");
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), header + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Personal_${contrato.nombre || 'contrato'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Planilla generada correctamente");
  };

  const cargar = async () => {
    try {
      setCargando(true);
      const res = await Api.contratos.personal(contrato.id, { page, page_size: 50 });
      setPersonal(res);
    } catch (e) {
      console.error("Error al cargar personal", e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [page, contrato.id]);

  const list = personal ? personal.items : [];
  
  // En lugar de globales precisas (que requerirían un endpoint de stats de personal), 
  // usamos las stats del contrato para lo básico y el resto aproximado o en 0.
  const total = contrato.stats?.personal?.total || 0;
  const acred = contrato.stats?.personal?.acreditados || 0;
  
  // Calculamos la proporción basada en la página actual para los otros KPIs (solo visual referencial)
  const porAcred = list.filter(s => s.estado === 'proc' || s.estado === 'falta').length;
  const venc = list.filter(s => s.estado === 'venc').length;
  const suspend = list.filter(s => s.estado === 'baja').length;

  const kpis = [
    { ic: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
    ), lbl: 'Total personal', n: total, sub: 'personas', c: '#64748B', border: 'border-slate-300' },
    { ic: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
    ), lbl: 'Acreditados', n: acred, sub: `${Math.round((acred / (total || 1)) * 100)}% del total`, c: '#15803d', border: 'border-emerald-500' },
    { ic: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
    ), lbl: 'Vencidos', n: venc, sub: `${Math.round((venc / (total || 1)) * 100)}% del total`, c: '#b91c1c', border: 'border-red-500' },
    { ic: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
    ), lbl: 'En proceso', n: porAcred, sub: `${Math.round((porAcred / (total || 1)) * 100)}% del total`, c: '#b45309', border: 'border-amber-500' },
    { ic: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
    ), lbl: 'Bloqueados', n: suspend, sub: `${Math.round((suspend / (total || 1)) * 100)}% del total`, c: '#64748b', border: 'border-slate-500' }
  ];

  // Datos mockeados para el gráfico basándonos en stats globales
  const ok = contrato.stats?.docs_empresa?.ok || acred * 3 || 300;
  const pv = 2;
  const vc = venc || 4;
  const totDocs = (ok + pv + vc) || 1;
  const pct = Math.round((ok / totDocs) * 100);

  const r = 52, C = 2 * Math.PI * r;
  const segs = [['#3f8f5b', ok], ['#d68a2e', pv], ['#c0392b', vc]];
  let off = 0;

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <h3 className="text-[#1E293B] text-[0.95rem] font-bold">Personal del contrato</h3>
            <p className="text-[0.78rem] text-slate-500 m-0 mt-0.5">Consulta y gestiona todo el personal asociado a este contrato.</p>
          </div>
          <div className="flex gap-2 shrink-0 items-center flex-wrap justify-end">
            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm mr-2 h-[34px]">
              <button 
                onClick={() => setVista('lista')}
                className={`px-3 h-full font-bold text-[0.75rem] rounded-md flex items-center justify-center gap-1.5 transition-colors ${vista === 'lista' ? 'bg-white text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <span className="text-sm">≡</span> Lista
              </button>
              <button 
                onClick={() => setVista('cuadricula')}
                className={`px-3 h-full font-bold text-[0.75rem] rounded-md flex items-center justify-center gap-1.5 transition-colors ${vista === 'cuadricula' ? 'bg-white text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200' : 'bg-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <span className="text-sm">⊞</span> Cuadrícula
              </button>
            </div>
            <button onClick={descargarExcel} className="h-[34px] px-3 bg-white border border-slate-200 text-emerald-700 rounded-lg text-[0.75rem] font-bold hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Ver en hoja de cálculo
            </button>
            <button onClick={() => setShowAddWorker(true)} className="h-[34px] px-3 bg-blue-600 text-white rounded-lg text-[0.75rem] font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-1.5">
              + Agregar trabajador
            </button>
            <button className="h-[34px] px-3 bg-white border border-slate-200 text-slate-700 rounded-lg text-[0.75rem] font-bold hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center gap-1.5">
              ✨ Asignar con Sofía IA
            </button>
            <button onClick={handleSubirDocumento} className="h-[34px] px-3 bg-white border border-slate-200 text-slate-700 rounded-lg text-[0.75rem] font-bold hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
              ↑ Subir documento
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-5 flex-wrap">
          {kpis.map((k, i) => (
            <div key={i} className={`bg-white rounded-xl px-4 py-3 flex flex-col min-w-[130px] flex-1 shadow-sm border border-slate-200 border-t-[3px] ${k.border}`}>
              <div className="text-[0.72rem] font-semibold text-slate-500 mb-1 flex items-center gap-1.5 w-full">
                {k.ic} <span className="mt-0.5">{k.lbl}</span>
              </div>
              <div className="flex items-end gap-2 mb-1 mt-1">
                <span className="text-[1.3rem] font-extrabold text-[#0F172A] leading-none">{k.n}</span>
              </div>
              <div className="text-[0.7rem] font-medium mt-1" style={{ color: k.c }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2.5 mb-4 items-center">
          <input className="flex-1 min-w-[200px] max-w-[360px] bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[0.88rem] text-slate-800 placeholder-slate-400 outline-none shadow-sm" placeholder="Buscar por nombre, RUT o cargo..." />
          <select className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"><option>Plataforma: Todas</option></select>
          <select className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"><option>Estado: Todos</option></select>
          <select className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"><option>Acreditación: Todas</option></select>
          <select className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"><option>Faena: Todas</option></select>
          <select className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"><option>Cargo: Todos</option></select>
        </div>

          {cargando ? (
            <div className="p-8 text-center text-slate-500 text-sm">Cargando personal...</div>
          ) : vista === 'lista' ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm mb-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-200 text-[0.65rem] text-slate-400 font-bold uppercase tracking-wider text-left">
                    <th className="p-4 pl-5">Nombre</th>
                    <th className="p-4">RUT</th>
                    <th className="p-4">Cargo</th>
                    <th className="p-4">Conduce</th>
                    <th className="p-4">Faena</th>
                    <th className="p-4">Plataformas</th>
                    <th className="p-4">Estado</th>
                    <th className="p-4">Acreditación</th>
                    <th className="p-4">Vencimiento</th>
                    <th className="p-4">Últ. Actualización</th>
                    <th className="p-4 text-center pr-5">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(s => {
                    const pct = s.stats?.cumplimiento_pct || 0;
                    const acredLbl = pct >= 70 ? 'Completa' : pct >= 40 ? 'Incompleta' : 'Sin acreditar';
                    const estLbl = s.estado === 'ok' ? 'Acreditado' : s.estado === 'venc' ? 'Vencido' : s.estado === 'baja' ? 'Suspendido' : 'Por acreditar';
                    
                    return (
                      <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors bg-white">
                        <td className="p-4 pl-5 align-top">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[0.75rem] font-bold text-white shrink-0 overflow-hidden mt-1 bg-slate-200 shadow-sm">
                              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.nombre)}&background=random`} alt={s.nombre} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col">
                              <Link href={`/personal/${s.id}`} className="text-[0.75rem] font-bold text-blue-700 hover:text-blue-800 leading-tight bg-[#EEF2FF] px-2.5 py-1.5 rounded-lg inline-block break-words">
                                {s.nombre}
                              </Link>
                              <div className="text-[0.65rem] text-slate-400 mt-1.5 font-medium px-1">{s.rut}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-[0.75rem] text-slate-500 font-medium align-top pt-5">{s.rut}</td>
                        <td className="p-4 text-[0.75rem] font-medium text-slate-700 leading-tight align-top pt-5 min-w-[100px]">{s.cargo}</td>
                        <td className="p-4 align-top pt-5">
                          <div className="flex items-center gap-1.5">
                            <button 
                              type="button"
                              onClick={() => toggleConduce(s.id, s.es_conductor)}
                              className={`w-8 h-[18px] rounded-full relative shadow-inner flex items-center cursor-pointer transition-colors ${s.es_conductor ? 'bg-[#3B82F6]' : 'bg-slate-300'}`}
                            >
                              <div className={`w-[14px] h-[14px] bg-white rounded-full absolute shadow-sm transition-transform ${s.es_conductor ? 'right-[2px]' : 'left-[2px]'}`}></div>
                            </button>
                            <span className={`text-[0.7rem] font-bold ${s.es_conductor ? 'text-slate-700' : 'text-slate-400'}`}>
                              {s.es_conductor ? 'Sí' : 'No'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-[0.75rem] font-medium text-slate-700 leading-tight align-top pt-5 min-w-[90px]">{contrato.faena?.nombre}</td>
                        <td className="p-4 flex items-center gap-1 align-top pt-5">
                          <span className="text-[0.65rem] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded italic lowercase">siga</span>
                          <span className="text-[0.65rem] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">WC</span>
                        </td>
                        <td className="p-4 align-top pt-4">
                          <span className={`px-2.5 py-1 rounded-md text-[0.7rem] font-bold ${
                            s.estado === 'ok' ? 'bg-emerald-50 text-emerald-600' :
                            s.estado === 'venc' ? 'bg-red-50 text-red-600' :
                            s.estado === 'baja' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {estLbl}
                          </span>
                        </td>
                        <td className="p-4 align-top pt-4">
                          <span className={`px-2.5 py-1 rounded-md border text-[0.7rem] font-bold bg-white ${
                            pct >= 70 ? 'border-emerald-200 text-emerald-600' :
                            pct >= 40 ? 'border-amber-200 text-amber-600' : 'border-red-200 text-red-600'
                          }`}>
                            {acredLbl}
                          </span>
                        </td>
                        <td className="p-4 text-[0.75rem] text-slate-500 font-medium align-top pt-5">2026-10-28</td>
                        <td className="p-4 text-[0.75rem] text-slate-500 font-medium align-top pt-5">Hoy</td>
                        <td className="p-4 align-top pt-3 pr-5">
                          <div className="flex flex-col items-center justify-center gap-1.5 min-w-[65px] mx-auto">
                            <Link href={`/personal/${s.id}`} className="text-[0.7rem] text-blue-600 font-bold hover:bg-[#E0E7FF] bg-[#EEF2FF] w-full text-center py-1.5 rounded-lg leading-tight transition-colors">
                              Ver perfil
                            </Link>
                            <button className="w-full h-[22px] rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] flex items-center justify-center text-blue-400 hover:text-blue-600 transition-colors">
                              <span className="text-xs pb-2 tracking-widest font-bold">...</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && !cargando && (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-slate-500 text-sm">Sin personal registrado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
              {list.map(s => {
                const pct = s.stats?.cumplimiento_pct || 0;
                return (
                  <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow transition-shadow flex flex-col">
                    <div className="flex items-start gap-3 mb-3">
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(s.nombre)}&background=random`} alt={s.nombre} className="w-10 h-10 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <Link href={`/personal/${s.id}`} className="text-[0.85rem] font-bold text-blue-700 hover:underline block truncate">
                          {s.nombre}
                        </Link>
                        <div className="text-[0.7rem] text-slate-500">{s.rut}</div>
                      </div>
                      <button className="w-6 h-6 rounded-md hover:bg-slate-50 border border-transparent hover:border-slate-200 flex items-center justify-center text-slate-400 transition-all">
                        <span className="text-xs pb-1.5 tracking-widest font-bold">...</span>
                      </button>
                    </div>
                    
                    <div className="text-[0.8rem] font-medium text-slate-700 mb-2 truncate">{s.cargo}</div>
                    
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[0.7rem] text-slate-500 font-medium">Acreditación:</span>
                        <span className="text-[0.75rem] font-bold text-emerald-600">Completa ({pct}%)</span>
                      </div>
                      <Link href={`/personal/${s.id}`} className="text-[0.75rem] text-blue-600 font-bold hover:underline">Ver</Link>
                    </div>
                  </div>
                );
              })}
              {list.length === 0 && !cargando && (
                <div className="col-span-full p-8 text-center text-slate-500 text-sm bg-white rounded-xl border border-slate-200">
                  Sin personal registrado
                </div>
              )}
            </div>
          )}
        
        {personal && personal.total_pages > 1 && (
          <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm text-[0.8rem]">
            <span className="text-slate-500">Mostrando {(page - 1) * 50 + 1} a {Math.min(page * 50, personal.total)} de {personal.total} personas</span>
            <Paginador page={page} totalPaginas={personal.total_pages} total={personal.total} etiqueta="trabajadores" onPagina={setPage} />
          </div>
        )}
      </div>

      <div className="w-full xl:w-[260px] shrink-0 flex flex-col gap-4">
        {/* Cumplimiento Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-[0.85rem] text-slate-800 leading-tight">Cumplimiento<br/>del proyecto</h3>
            <select className="text-[0.7rem] border border-slate-200 rounded px-1.5 py-1 text-slate-600 outline-none cursor-pointer"><option>Últimos 30 días</option></select>
          </div>
          <div className="flex flex-col items-center">
            <div className="relative w-[130px] h-[130px] mb-5">
              <svg width="130" height="130" viewBox="0 0 170 170" className="rotate-[-90deg]">
                <circle cx="85" cy="85" r={r} fill="none" stroke="#eee5da" strokeWidth="18" />
                {segs.map(([col, val], i) => {
                  const len = (Number(val) / totDocs) * C;
                  const el = <circle key={i} cx="85" cy="85" r={r} fill="none" stroke={col as string} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />;
                  off += len;
                  return el;
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-extrabold text-[#0F172A] leading-none mb-0.5">{pct}%</span>
                <span className="text-[0.55rem] text-slate-500 font-semibold leading-tight uppercase tracking-wide">Cumplimiento<br/>general</span>
              </div>
            </div>
            <div className="w-full space-y-2.5 text-[0.75rem]">
              <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#3f8f5b]"></div><span className="text-slate-600 font-medium">Vigentes</span></div><span className="font-bold text-slate-800">{ok} <span className="text-slate-400 font-normal">({Math.round(ok/totDocs*100)}%)</span></span></div>
              <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#d68a2e]"></div><span className="text-slate-600 font-medium">Por vencer</span></div><span className="font-bold text-slate-800">{pv} <span className="text-slate-400 font-normal">({Math.round(pv/totDocs*100)}%)</span></span></div>
              <div className="flex justify-between items-center"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#c0392b]"></div><span className="text-slate-600 font-medium">Vencidas</span></div><span className="font-bold text-slate-800">{vc} <span className="text-slate-400 font-normal">({Math.round(vc/totDocs*100)}%)</span></span></div>
            </div>
          </div>
        </div>

        {/* Requisitos Críticos */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[0.85rem] text-slate-800">Requisitos<br/>críticos</h3>
            <span className="text-[0.7rem] text-blue-600 font-bold cursor-pointer hover:underline">Ver<br/>todos</span>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { t: 'Anexo Contrato', reg: '1 registro con vencidos' },
              { t: 'Revisión Técnica', reg: '1 registro con vencidos' },
              { t: 'Cédula de Identidad', reg: '1 registro con vencidos' },
              { t: 'Permiso de Circulación', reg: '2 registros con vencidos' }
            ].map((rc, i) => (
              <div key={i} className="flex gap-2.5 items-start bg-red-50/50 p-2.5 rounded-lg border border-red-100">
                <span className="text-red-500 text-[0.85rem] mt-0.5">⚠️</span>
                <div className="flex-1">
                  <div className="text-[0.75rem] font-bold text-slate-800">{rc.t}</div>
                  <div className="text-[0.65rem] text-slate-500">{rc.reg}</div>
                </div>
                <span className="text-[0.6rem] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">Vencido</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal abierto={showAddWorker} titulo="Agregar Trabajador" onCerrar={() => setShowAddWorker(false)} ancho="max-w-md">
        <form onSubmit={handleAddWorker} className="flex flex-col gap-4">
          <div>
            <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">RUT *</label>
            <input 
              type="text" 
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none" 
              placeholder="Ej. 12.345.678-9" 
              value={newWorker.rut || ''}
              onChange={e => setNewWorker({...newWorker, rut: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Nombre Completo *</label>
            <input 
              type="text" 
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none" 
              placeholder="Ej. Juan Pérez" 
              value={newWorker.nombre}
              onChange={e => setNewWorker({...newWorker, nombre: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Cargo *</label>
            <input 
              type="text" 
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none" 
              placeholder="Ej. Conductor de Bus" 
              value={newWorker.cargo || ''}
              onChange={e => setNewWorker({...newWorker, cargo: e.target.value})}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Teléfono</label>
              <input 
                type="text" 
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none" 
                placeholder="Ej. +56912345678" 
                value={newWorker.telefono || ''}
                onChange={e => setNewWorker({...newWorker, telefono: e.target.value})}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Email</label>
              <input 
                type="email" 
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none" 
                placeholder="correo@ejemplo.com" 
                value={newWorker.email || ''}
                onChange={e => setNewWorker({...newWorker, email: e.target.value})}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input 
              type="checkbox" 
              id="es_conductor_check"
              className="w-4 h-4 cursor-pointer"
              checked={newWorker.es_conductor || false}
              onChange={e => setNewWorker({...newWorker, es_conductor: e.target.checked})}
            />
            <label htmlFor="es_conductor_check" className="text-[0.85rem] text-slate-700 font-medium cursor-pointer">
              Este trabajador es conductor (requiere requisitos adicionales)
            </label>
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <button 
              type="button" 
              onClick={() => setShowAddWorker(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-[0.85rem] rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={creando}
              className="px-4 py-2 bg-blue-600 text-white font-bold text-[0.85rem] rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creando ? "Guardando..." : "Agregar trabajador"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
