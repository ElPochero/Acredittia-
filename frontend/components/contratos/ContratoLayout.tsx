"use client";
import React from "react";
import Link from "next/link";
import * as Api from "@/lib/cliente";
import { Contrato, PlataformaContrato } from "@/lib/tipos";
import { ContratoTabs, Tab } from "./ContratoTabs";
import { ReporteContratoModal } from "./ReporteContratoModal";
import { CompartirContratoModal } from "./CompartirContratoModal";
import { ExportarDocumentosModal } from "../ExportarDocumentosModal";
import { CorreosContratoModal } from "./CorreosContratoModal";
import { DetallePlataformaModal } from "../PlataformaModals";

interface ContratoLayoutProps {
  contrato: Contrato;
  plataformas: PlataformaContrato[];
  vigente: boolean;
  onDeletePlataforma: (id: string) => void;
  onAddPlataforma: () => void;
  onManagePlataforma: (plataforma: PlataformaContrato) => void;
  onRefreshPlataformas: () => void;
  tabActual: Tab;
  onTabChange: (tab: Tab) => void;
  children: React.ReactNode;
}

/** Nº de contrato estilo referencia (`ctNumero`: `CT-` + 8 primeros del id). */
export function numeroContrato(c: Contrato): string {
  return c.codigo || `CT-${c.id.slice(0, 8).toUpperCase()}`;
}

function fmtCorta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-CL").replace(/\//g, "-");
}

/** Línea de vigencia estilo `ctVigHtml`: fechas + días restantes o aviso. */
function infoVigencia(c: Contrato): { texto: string; fondo: string; color: string } {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const ini = c.fecha_inicio ? new Date(c.fecha_inicio + "T00:00:00") : null;
  const fin = c.fecha_termino ? new Date(c.fecha_termino + "T00:00:00") : null;
  const neutro = { fondo: "#f1f5f9", color: "#334155" };
  if (!fin) return { ...neutro, texto: `Vigencia: ${ini ? fmtCorta(c.fecha_inicio) : "—"} · sin fecha de término` };
  const dias = Math.ceil((fin.getTime() - hoy.getTime()) / 86_400_000);
  const rango = `${fmtCorta(c.fecha_inicio)} → ${fmtCorta(c.fecha_termino)}`;
  if (dias < 0) return { fondo: "#fee2e2", color: "#b91c1c", texto: `Vigencia: ${rango} · vencido hace ${-dias} días` };
  if (dias <= 60) return { fondo: "#fef3c7", color: "#b45309", texto: `Vigencia: ${rango} · ${dias} días restantes` };
  return { ...neutro, texto: `Vigencia: ${rango} · ${dias} días restantes` };
}

const PLATFORM_LOGOS = [
  { m: 'SIGA',           f: '/plat_siga.png' },
  { m: 'DIRECTIC',       f: '/directic_logo.png' },
  { m: 'SGES',           f: '/plat_sges.png' },
  { m: 'ACADEMIA',       f: '/academia_mlp.png' },
  { m: 'EMSIPOR',        f: '/logo_emsipor.png' },
  { m: 'WEBCONTROL',     f: '/plat_webcontrol.png' },
  { m: 'METACONTRATAS',  f: '/plat_metacontratas.png' },
  { m: 'META CONTRATAS', f: '/plat_metacontratas.png' },
  { m: 'SUCAL',          f: '/plat_sucal.png' },
];

function logoForPlatform(nom: string) {
  const up = (nom || '').toUpperCase();
  const hit = PLATFORM_LOGOS.find(x => up.includes(x.m));
  return hit ? hit.f : null;
}

export function ContratoLayout({
  contrato: c,
  plataformas,
  vigente,
  onDeletePlataforma,
  onAddPlataforma,
  onManagePlataforma,
  onRefreshPlataformas,
  tabActual,
  onTabChange,
  children
}: ContratoLayoutProps) {
  const [modalReporte, setModalReporte] = React.useState(false);
  const [modalCompartir, setModalCompartir] = React.useState(false);
  const [modalExportar, setModalExportar] = React.useState(false);
  const [modalCorreos, setModalCorreos] = React.useState(false);
  const [detallePlat, setDetallePlat] = React.useState<PlataformaContrato | null>(null);
  // UX solamente: el control real es el middleware del backend. Sin sesión
  // conocida se muestra todo para no romper a usuarios normales.
  const [soloLectura] = React.useState(() => Api.esVisor(Api.currentUser()));
  const [solicitando, setSolicitando] = React.useState<string | null>(null);

  const solicitarAcceso = async (pid: string) => {
    setSolicitando(pid);
    try {
      await Api.plataformas.solicitarAcceso(c.id, pid);
      onRefreshPlataformas();
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setSolicitando(null);
    }
  };
  
  // Dynamic colors based on Mandante
  let colorTheme = "blue";
  const mandante = (c.faena?.mandante || "").toLowerCase();
  if (mandante.includes("codelco")) colorTheme = "orange";
  else if (mandante.includes("bhp")) colorTheme = "orange";
  else if (mandante.includes("anglo")) colorTheme = "red";
  else if (mandante.includes("pelambres")) colorTheme = "teal";
  
  const themeStyles = {
    blue: "from-blue-50/80 border-t-blue-600 bg-blue-600",
    orange: "from-orange-50/80 border-t-orange-500 bg-orange-500",
    red: "from-red-50/80 border-t-red-600 bg-red-600",
    teal: "from-teal-50/80 border-t-teal-600 bg-teal-600",
  }[colorTheme] || "from-blue-50/80 border-t-blue-600 bg-blue-600";
  
  const headerBgGradient = `bg-gradient-to-br border-t-4 ${themeStyles.split(" bg-")[0]}`;
  const circleColor = themeStyles.split(" bg-")[1];
  const borderTop = `border-t-[3px] ${themeStyles.split(" ")[1]}`;
  const btnClass = `bg-${circleColor.replace("bg-", "")} hover:bg-${circleColor.replace("bg-", "")}/90`;

  return (
    <div className="max-w-[1400px] mx-auto pb-20 p-6">
      {/* Breadcrumb */}
      <nav aria-label="Migas de pan" className="flex items-center gap-1.5 text-[0.8rem] text-slate-500 mb-4">
        <Link href="/contratos" className="hover:underline hover:text-slate-700 cursor-pointer text-[0.8rem]">Contratos</Link>
        <span aria-hidden="true">›</span>
        <Link href="/contratos" className="cursor-pointer text-[0.8rem] hover:underline hover:text-slate-700">Detalle del contrato</Link>
      </nav>

      {/* AMBIENTE DEL MANDANTE */}
      <div className={`relative overflow-hidden ${headerBgGradient} to-white border border-slate-200 rounded-[18px] px-6 py-5 mb-5 shadow-sm`}>
        <div className={`absolute -top-[70px] -right-[50px] w-[230px] h-[230px] rounded-full ${circleColor} opacity-[0.06] pointer-events-none`} />
        <div className={`absolute -bottom-[90px] right-[110px] w-[170px] h-[170px] rounded-full ${circleColor} opacity-[0.04] pointer-events-none`} />
        
        {/* Header row */}
        <div className="relative flex items-center justify-between flex-wrap gap-3 mb-3.5">
          <div className="flex items-center gap-3.5">
            <h2 className="text-[#0F172A] text-[1.45rem] font-bold m-0">Contrato {numeroContrato(c)}</h2>
            <span className={`px-2 py-0.5 text-[0.78rem] font-bold rounded ${vigente ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {vigente ? 'Vigente' : 'En evaluación'}
            </span>
            {soloLectura && (
              <span className="px-2 py-0.5 text-[0.78rem] font-bold rounded bg-slate-200 text-slate-600" title="Tu rol solo permite ver este contrato">
                👁 Solo lectura
              </span>
            )}
            <span className="text-slate-500 text-[0.95rem] font-medium">{c.nombre}</span>
          </div>
          <div className="flex items-center gap-2">
            {!soloLectura && (
              <button className="h-[34px] px-3.5 border border-slate-300 rounded-[8px] bg-white text-slate-700 font-semibold text-[0.85rem] hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm cursor-pointer" onClick={() => setModalCompartir(true)}>
                👥 Compartir
              </button>
            )}
            <button className="h-[34px] px-3.5 border-none rounded-[8px] bg-[#0F172A] text-white font-semibold text-[0.85rem] hover:bg-slate-800 transition-colors shadow-sm cursor-pointer" onClick={() => setModalExportar(true)}>
              📦 Exportar
            </button>
            <button className="h-[34px] px-3.5 border border-slate-300 rounded-[8px] bg-white text-slate-700 font-semibold text-[0.85rem] hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm cursor-pointer" onClick={() => setModalReporte(true)}>
              <span className="text-[0.9rem] mr-1">↓</span> Descargar reporte
            </button>
            {!soloLectura && (
              <button className={`h-[34px] px-3.5 border-none rounded-[8px] ${btnClass} text-white font-semibold text-[0.85rem] transition-colors shadow-sm cursor-pointer`} onClick={() => alert('Editar contrato — demo')}>
                ✎ Editar contrato
              </button>
            )}
            {!soloLectura && (
              <button className="h-[34px] px-2.5 border border-slate-300 rounded-[8px] bg-white text-slate-700 font-semibold text-[0.85rem] hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm flex items-center justify-center cursor-pointer" title="Correos de notificación" onClick={() => setModalCorreos(true)}>
                ✉ Correos
              </button>
            )}
          </div>
        </div>

        {/* Mandante logo + faena + vigencia */}
        <div className="relative flex items-center gap-3 flex-wrap">
          <div className="bg-white border border-slate-200 rounded-[10px] px-3 py-1.5 flex items-center h-10 shadow-[0_2px_8px_rgba(0,0,0,0.04)] font-bold text-slate-700 text-sm">
            {c.faena?.mandante}
          </div>
          <span className="text-slate-800 text-[0.88rem] font-semibold">{c.faena?.nombre} · {c.faena?.mandante}</span>
          {(() => {
            const v = infoVigencia(c);
            return (
              <span
                className="inline-block text-[0.74rem] font-bold px-2.5 py-0.5 rounded-md whitespace-nowrap"
                style={{ backgroundColor: v.fondo, color: v.color }}
              >
                {v.texto}
              </span>
            );
          })()}
        </div>
      </div>

      {/* SECCIÓN PLATAFORMAS (SIEMPRE VISIBLE) */}
      <div className={`bg-white border border-slate-200 ${borderTop} rounded-[16px] px-5 py-4 mb-6 shadow-sm`}>
         <div className="flex items-center justify-between mb-3.5">
           <div>
             <span className="text-[0.88rem] font-bold text-slate-800">Plataformas — {c.faena?.mandante}</span>
             <div className="text-[0.75rem] text-slate-500 mt-0.5">Plataformas requeridas para acreditar en <strong>{c.faena?.nombre}</strong>, con sus propios requisitos por plataforma.</div>
           </div>
           {!soloLectura && (
           <button className={`h-[34px] px-3.5 border-none rounded-[8px] ${btnClass} text-white font-semibold text-[0.75rem] transition-colors shadow-sm cursor-pointer`} onClick={onAddPlataforma}>
             + Agregar plataforma
           </button>
           )}
         </div>
         
         <div className="flex gap-0 border border-slate-200 rounded-[12px] overflow-x-auto overflow-y-hidden snap-x">
           {plataformas.length === 0 ? (
             <div className="p-8 text-center w-full text-slate-500 text-sm">No hay plataformas configuradas</div>
           ) : (
             plataformas.map((pl, i) => {
                const logo = logoForPlatform(pl.nombre);
                return (
                  <div key={pl.id || pl.faena_plataforma_id || pl.nombre} className={`flex-1 min-w-[200px] shrink-0 snap-start py-3.5 px-4 bg-white ${i < plataformas.length - 1 ? 'border-r border-slate-200' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      {logo ? (
                        <div className="h-[34px] min-w-[64px] px-1 bg-white border border-slate-200 rounded-md flex items-center justify-center overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={logo} alt={pl.nombre} className="max-w-[50px] max-h-[22px] object-contain" onError={(e) => {
                            const target = e.target as HTMLElement;
                            const parent = target.parentElement;
                            if (parent) {
                              parent.outerHTML = `<div class="h-[32px] min-w-[52px] px-2 bg-slate-100 rounded-md flex items-center justify-center text-[0.65rem] font-black text-slate-800 text-center leading-tight">${pl.nombre.split(' ')[0]}</div>`;
                            }
                          }} />
                        </div>
                      ) : (
                        <div className="h-[32px] min-w-[52px] px-2 bg-slate-100 rounded-md flex items-center justify-center text-[0.65rem] font-black text-slate-800 text-center leading-tight" style={{ backgroundColor: pl.color || '#f1f5f9' }}>
                          {pl.nombre.split(' ')[0]}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1.5">
                        <span className={`flex items-center gap-1 text-[0.65rem] font-bold px-2 py-0.5 rounded-lg ${
                          pl.estado === 'activa' ? 'text-emerald-700 bg-emerald-50' :
                          pl.estado === 'solicitada' ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                            pl.estado === 'activa' ? 'bg-emerald-500' :
                            pl.estado === 'solicitada' ? 'bg-amber-500' : 'bg-red-500'
                          }`}></span>
                          {pl.estado.charAt(0).toUpperCase() + pl.estado.slice(1)}
                        </span>
                        {pl.es_custom && !soloLectura && (
                          <button
                            onClick={() => onDeletePlataforma(pl.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 flex items-center justify-center"
                            title="Desvincular plataforma"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  <div className="text-[0.8rem] font-bold text-slate-800">
                    {pl.nombre} {pl.es_custom && <span className="text-purple-700 text-[0.65rem] font-normal">(custom)</span>}
                  </div>
                  <div className="text-[0.65rem] text-slate-500 mt-0.5 min-h-[30px]">{pl.descripcion || 'Sistema de Gestión de Acceso'}</div>
                  {pl.url && pl.url !== '#' && (
                    <a href={pl.url} target="_blank" rel="noopener noreferrer" className="text-[0.65rem] text-blue-600 no-underline mt-0.5 block opacity-80" title={`Abrir ${pl.nombre}`}>
                      {pl.url.replace('https://', '')}
                    </a>
                  )}
                  
                  <div className="text-[0.7rem] text-slate-500 mt-2.5">Usuarios activos</div>
                  <div className="text-[1.15rem] font-bold text-slate-800 leading-tight">{pl.credenciales || 0}</div>
                  {pl.estado === "sin_acceso" && pl.id && !soloLectura && (
                    <button
                      onClick={() => solicitarAcceso(pl.id)}
                      disabled={solicitando === pl.id}
                      className="mt-2 h-8 px-3 rounded-lg border border-amber-300 bg-amber-50 text-[0.72rem] font-bold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 w-full"
                    >
                      {solicitando === pl.id ? "Solicitando..." : "Solicitar acceso"}
                    </button>
                  )}
                  {pl.nota && <div className="text-[0.65rem] text-emerald-600 mt-0.5 font-semibold">{pl.nota}</div>}
                  {(!pl.nota || pl.credenciales === 0) && <div className="text-[0.65rem] text-slate-500 mt-0.5">Sin cuentas registradas</div>}
                  <div className="mt-2.5 flex gap-3">{!soloLectura && <span className="text-[0.7rem] text-blue-600 hover:underline cursor-pointer font-medium" onClick={() => onManagePlataforma(pl)}>Gestionar usuarios →</span>}<span className="text-[0.7rem] text-blue-600 hover:underline cursor-pointer font-medium" onClick={() => setDetallePlat(pl)}>Ver requisitos →</span></div>
                </div>
                );
             })
           )}
         </div>
      </div>

      <ContratoTabs currentTab={tabActual} onTabChange={onTabChange} colorTheme={circleColor} />
      
      {/* Tab Content rendering */}
      <div className="mt-5">
        {children}
      </div>

      {/* Volver al listado */}
      <div className="mt-7 flex justify-between items-center border-t border-slate-200 pt-4">
        <Link href="/contratos" className="text-[0.82rem] font-medium text-slate-500 hover:text-blue-700 hover:underline">
          ← Volver al listado de contratos
        </Link>
      </div>

      <ReporteContratoModal
        abierto={modalReporte}
        onCerrar={() => setModalReporte(false)}
        contrato={c}
      />
      <ExportarDocumentosModal
        abierto={modalExportar}
        onCerrar={() => setModalExportar(false)}
        contrato={c}
        plataformas={plataformas}
      />
      <CorreosContratoModal
        abierto={modalCorreos}
        onCerrar={() => setModalCorreos(false)}
        contrato={c}
      />
      <CompartirContratoModal
        abierto={modalCompartir}
        onCerrar={() => setModalCompartir(false)}
        contrato={c}
        puedeGestionar={!soloLectura}
      />
      <DetallePlataformaModal
        plataforma={detallePlat}
        contratoId={c.id}
        onCerrar={() => setDetallePlat(null)}
      />
    </div>
  );
}
