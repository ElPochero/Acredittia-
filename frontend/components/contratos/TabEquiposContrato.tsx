"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import * as Api from "@/lib/cliente";
import { Contrato, PlataformaContrato, Sujeto, EquipoIn } from "@/lib/tipos";
import { Paginador, Modal } from "@/components/ui";
import { toast } from "sonner";

interface TabEquiposContratoProps {
  contrato: Contrato;
  plataformas: PlataformaContrato[];
}

export function TabEquiposContrato({ contrato, plataformas }: TabEquiposContratoProps) {
  const [equipos, setEquipos] = useState<Api.Pagina<Sujeto> | null>(null);
  const [page, setPage] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [showAddEquipo, setShowAddEquipo] = useState(false);
  const [tipos, setTipos] = useState<string[]>([]);
  const [newEquipo, setNewEquipo] = useState<EquipoIn>({
    patente: "",
    tipo_equipo: "",
    marca: "",
    modelo: "",
    anio: null,
    contrato_id: contrato.id,
  });
  const [creando, setCreando] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showFiltros, setShowFiltros] = useState(true);
  const [qFlota, setQFlota] = useState("");
  const [flota, setFlota] = useState<Sujeto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selIds, setSelIds] = useState<string[]>([]);
  const [importando, setImportando] = useState(false);

  const cargar = async () => {
    try {
      setCargando(true);
      const res = await Api.contratos.equipos(contrato.id, { page, page_size: 50 });
      setEquipos(res);
    } catch (e) {
      console.error("Error al cargar equipos", e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [page, contrato.id]);

  const abrirAddEquipo = async () => {
    setShowAddEquipo(true);
    if (tipos.length === 0) {
      try {
        const res = await Api.catalogo.tiposEquipo();
        setTipos(res.items || []);
      } catch (e) {
        toast.error(Api.mensajeError(e));
      }
    }
  };

  const handleAddEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquipo.patente.trim() || !newEquipo.tipo_equipo) {
      toast.error("Patente y tipo son obligatorios");
      return;
    }
    setCreando(true);
    try {
      await Api.equipos.crear({ ...newEquipo, patente: newEquipo.patente.trim().toUpperCase(), contrato_id: contrato.id });
      toast.success("Equipo agregado correctamente");
      setShowAddEquipo(false);
      setNewEquipo({ patente: "", tipo_equipo: "", marca: "", modelo: "", anio: null, contrato_id: contrato.id });
      cargar();
    } catch (e: any) {
      toast.error(e.message || "Error al agregar equipo");
    } finally {
      setCreando(false);
    }
  };

  const buscarFlota = async () => {
    setBuscando(true);
    try {
      const res = await Api.equipos.listar({ search: qFlota.trim() || undefined, page_size: 50 });
      setFlota(res.items || []);
      setSelIds([]);
    } catch (e: any) {
      toast.error(e.message || "Error al buscar en la flota");
    } finally {
      setBuscando(false);
    }
  };

  const patentesEnContrato = new Set(
    (equipos?.items || []).filter((s) => s.estado !== "baja").map((s) => (s.patente || "").toUpperCase()),
  );

  const handleImportar = async () => {
    if (selIds.length === 0) {
      toast.error("Selecciona al menos un equipo");
      return;
    }
    setImportando(true);
    try {
      const res = await Api.contratos.importarEquipos(contrato.id, selIds);
      toast.success(`${res.importados} equipo(s) agregados al contrato`);
      setShowPicker(false);
      setSelIds([]);
      cargar();
    } catch (e: any) {
      toast.error(e.message || "Error al importar equipos");
    } finally {
      setImportando(false);
    }
  };

  const list = equipos ? equipos.items : [];
  
  const total = contrato.stats?.equipos?.total || 0;
  const acred = contrato.stats?.equipos?.acreditados || 0;
  
  const mant = list.filter(s => s.estado === 'proc' || s.estado === 'falta').length;
  const fueraSvc = list.filter(s => s.estado === 'venc').length;
  const baja = list.filter(s => s.estado === 'baja').length;

  const kpis = [
    { ic: '🚛', lbl: 'Total equipos', n: total, sub: 'unidades', c: '#64748B' },
    { ic: '✅', lbl: 'Operativos', n: acred, sub: `${Math.round((acred / (total || 1)) * 100)}% del total`, c: '#15803d' },
    { ic: '🔧', lbl: 'En mantención', n: mant, sub: 'En esta página', c: '#b45309' },
    { ic: '❌', lbl: 'Fuera de servicio', n: fueraSvc, sub: 'En esta página', c: '#b91c1c' },
    { ic: '⊖', lbl: 'Dados de baja', n: baja, sub: 'En esta página', c: '#64748b' }
  ];

  // Datos mockeados para el gráfico basándonos en stats globales
  const ok = contrato.stats?.docs_empresa?.ok || acred * 3 || 300;
  const pv = 2;
  const vc = fueraSvc || 4;
  const totDocs = (ok + pv + vc) || 1;
  const pct = Math.round((ok / totDocs) * 100);

  const r = 52, C = 2 * Math.PI * r;
  const segs = [['#3f8f5b', ok], ['#d68a2e', pv], ['#c0392b', vc]];
  let off = 0;

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-start justify-between flex-wrap mb-3.5 gap-3">
          <div className="min-w-[220px] flex-1">
            <h3 className="text-[#1E293B] text-[0.95rem] font-bold">Equipos y vehículos del contrato</h3>
            <p className="text-[0.78rem] text-slate-500 m-0 mt-0.5">Consulta y gestiona todos los equipos y vehículos asociados a este contrato.</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap justify-end">
            <button onClick={abrirAddEquipo} className="px-3 py-1.5 bg-blue-600 text-white rounded text-[0.78rem] font-medium hover:bg-blue-700 transition-colors shadow-sm">
              + Agregar equipo
            </button>
            <button onClick={() => { setShowPicker(true); setFlota([]); setQFlota(""); setSelIds([]); }} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded text-[0.78rem] font-medium hover:bg-slate-50 transition-colors shadow-sm">
              ⧉ Desde flota
            </button>
            <label className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-[0.78rem] font-medium cursor-pointer hover:bg-slate-50 transition-colors shadow-sm bg-white" onClick={() => toast.info("Próximamente", { description: "La subida masiva de documentos llegará pronto." })}>
              ↑ Subir documento
              <input type="file" className="hidden" />
            </label>
            <button onClick={() => setShowFiltros(v => !v)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-[0.78rem] font-medium hover:bg-slate-50 transition-colors shadow-sm bg-white">
              🔽 Filtros
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-4 flex-wrap">
          {kpis.map((k, i) => (
            <div key={i} className="bg-[#F8FAFC] rounded-xl px-4 py-3 flex items-center gap-2.5 border border-slate-200 min-w-[140px] shadow-sm flex-1">
              <span className="text-[1.1rem]">{k.ic}</span>
              <div>
                <div className="text-[0.72rem] text-slate-500">{k.lbl}</div>
                <div className="text-[1.3rem] font-extrabold text-[#0F172A] leading-tight">{k.n}</div>
                <div className="text-[0.7rem]" style={{ color: k.c }}>{k.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={`flex flex-wrap gap-2.5 mb-4 items-center ${showFiltros ? "" : "hidden"}`}>
          <input className="flex-1 min-w-[200px] max-w-[360px] bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[0.88rem] text-slate-800 placeholder-slate-400 outline-none shadow-sm" placeholder="Buscar por patente, tipo o marca..." />
          <select className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"><option>Tipo: Todos</option></select>
          <select className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"><option>Estado: Todos</option></select>
          <select className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"><option>Acreditación: Todas</option></select>
          <select className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"><option>Faena: Todas</option></select>
          <select className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"><option>Plataformas: Todas</option></select>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm mb-4">
          {cargando ? (
            <div className="p-8 text-center text-slate-500 text-sm">Cargando equipos...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[0.75rem] text-slate-500 font-bold uppercase tracking-wider">
                  <th className="p-3 font-semibold">Patente</th>
                  <th className="p-3 font-semibold">Tipo</th>
                  <th className="p-3 font-semibold">Marca / Modelo</th>
                  <th className="p-3 font-semibold">Faena</th>
                  <th className="p-3 font-semibold">Plataformas</th>
                  <th className="p-3 font-semibold">Estado</th>
                  <th className="p-3 font-semibold">Acreditación</th>
                  <th className="p-3 font-semibold">Últ. act.</th>
                  <th className="p-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => {
                  const pct = s.stats.cumplimiento_pct || 0;
                  const acredLbl = pct >= 70 ? 'Acreditado' : pct >= 40 ? 'Por acreditar' : 'No acreditado';
                  const estLbl = s.estado === 'ok' ? 'Operativo' : s.estado === 'venc' ? 'Fuera de servicio' : s.estado === 'baja' ? 'Dado de baja' : 'En mantención';
                  
                  return (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-[0.78rem] font-semibold text-cyan-700">
                        <Link href={`/equipos/${s.id}`} className="hover:underline">{s.patente || `EQ-${String(i+1).padStart(3,'0')}`}</Link>
                      </td>
                      <td className="p-3 text-[0.8rem] text-slate-500">{s.tipo_equipo || 'Equipo'}</td>
                      <td className="p-3 text-[0.8rem]">{s.marca || '—'} {s.modelo || ''}</td>
                      <td className="p-3 text-[0.8rem]">{contrato.faena.nombre}</td>
                      <td className="p-3 text-[0.75rem]">
                        {plataformas.map((p) => (
                          <span key={p.id ?? p.faena_plataforma_id ?? p.nombre} className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mr-1">{p.nombre}</span>
                        ))}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[0.68rem] font-bold ${
                          s.estado === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                          s.estado === 'venc' ? 'bg-red-100 text-red-700' :
                          s.estado === 'baja' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {estLbl}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[0.68rem] font-bold ${
                          pct >= 70 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {acredLbl} ({pct}%)
                        </span>
                      </td>
                      <td className="p-3 text-[0.72rem] text-slate-500">—</td>
                      <td className="p-3 text-[0.8rem] text-right">
                        <Link href={`/equipos/${s.id}`} className="text-blue-600 font-semibold hover:underline">Ver detalle</Link>
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && !cargando && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500 text-sm">Sin equipos registrados</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {equipos && equipos.total_pages > 1 && (
          <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm text-[0.8rem]">
            <span className="text-slate-500">Mostrando {(page - 1) * 50 + 1} a {Math.min(page * 50, equipos.total)} de {equipos.total} equipos</span>
            <Paginador page={page} totalPaginas={equipos.total_pages} total={equipos.total} etiqueta="equipos" onPagina={setPage} />
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

      <Modal abierto={showAddEquipo} titulo="Agregar Equipo" onCerrar={() => setShowAddEquipo(false)} ancho="max-w-md">
        <form onSubmit={handleAddEquipo} className="flex flex-col gap-4">
          <div>
            <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Patente *</label>
            <input
              type="text"
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none uppercase"
              placeholder="Ej. ABCD12"
              value={newEquipo.patente}
              onChange={e => setNewEquipo({...newEquipo, patente: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Tipo de equipo *</label>
            <select
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none"
              value={newEquipo.tipo_equipo}
              onChange={e => setNewEquipo({...newEquipo, tipo_equipo: e.target.value})}
            >
              <option value="">Selecciona un tipo...</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Marca</label>
              <input
                type="text"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none"
                placeholder="Ej. Volvo"
                value={newEquipo.marca || ''}
                onChange={e => setNewEquipo({...newEquipo, marca: e.target.value})}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Modelo</label>
              <input
                type="text"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none"
                placeholder="Ej. FH 540"
                value={newEquipo.modelo || ''}
                onChange={e => setNewEquipo({...newEquipo, modelo: e.target.value})}
              />
            </div>
            <div className="w-[90px]">
              <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Año</label>
              <input
                type="number"
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none"
                placeholder="2024"
                value={newEquipo.anio ?? ''}
                onChange={e => setNewEquipo({...newEquipo, anio: e.target.value ? Number(e.target.value) : null})}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setShowAddEquipo(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-[0.85rem] rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creando}
              className="px-4 py-2 bg-blue-600 text-white font-bold text-[0.85rem] rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creando ? "Guardando..." : "Agregar equipo"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal abierto={showPicker} titulo="Agregar desde la flota" onCerrar={() => setShowPicker(false)} ancho="max-w-lg">
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              aria-label="Buscar en la flota"
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[0.85rem] text-slate-800 outline-none"
              placeholder="Buscar por patente, marca o modelo..."
              value={qFlota}
              onChange={(e) => setQFlota(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") buscarFlota(); }}
            />
            <button
              onClick={buscarFlota}
              disabled={buscando}
              className="px-4 py-2 bg-slate-800 text-white font-bold text-[0.85rem] rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {buscando ? "Buscando..." : "Buscar"}
            </button>
          </div>
          {flota.length > 0 && (
            <ul className="flex flex-col gap-1.5 m-0 p-0 list-none max-h-[300px] overflow-y-auto">
              {flota.map((s) => {
                const yaEsta = patentesEnContrato.has((s.patente || "").toUpperCase());
                const marcado = selIds.includes(s.id);
                return (
                  <li key={s.id}>
                    <label className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-[0.82rem] ${yaEsta ? "border-slate-100 bg-slate-50 text-slate-400" : "border-slate-200 bg-white cursor-pointer hover:bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        disabled={yaEsta}
                        checked={marcado}
                        onChange={() => setSelIds(prev => marcado ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className="font-bold">{s.patente}</span>
                      <span className="text-slate-500 truncate">{s.tipo_equipo} {s.marca} {s.modelo}</span>
                      {yaEsta && <span className="ml-auto text-[0.7rem] font-bold">En este contrato</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => setShowPicker(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-[0.85rem] rounded-lg hover:bg-slate-50"
            >
              Cerrar
            </button>
            <button
              onClick={handleImportar}
              disabled={importando || selIds.length === 0}
              className="px-4 py-2 bg-blue-600 text-white font-bold text-[0.85rem] rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {importando ? "Agregando..." : `Agregar ${selIds.length} equipo(s)`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
