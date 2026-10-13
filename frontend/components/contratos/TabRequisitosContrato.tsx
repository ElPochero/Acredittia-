"use client";
import React, { useState, useEffect } from "react";
import { Modal, Spinner } from "@/components/ui";
import * as Api from "@/lib/cliente";
import { Contrato, PlataformaContrato } from "@/lib/tipos";

interface TabRequisitosContratoProps {
  contrato: Contrato;
  plataformas: PlataformaContrato[];
}



export function TabRequisitosContrato({ contrato, plataformas }: TabRequisitosContratoProps) {
  const [localPlataformas, setLocalPlataformas] = useState<PlataformaContrato[]>(plataformas);

  useEffect(() => {
    setLocalPlataformas(plataformas);
  }, [plataformas]);

  // Combinar plataformas reales con vínculos base (arranque, otro)
  const vinculos = [
    ...localPlataformas.map(p => ({
      key: p.id || (p as any).faena_plataforma_id, 
      id: p.id,
      fpid: (p as any).faena_plataforma_id,
      nom: (p as any).nombre || 'Plataforma', tipo: 'plataforma', 
      color: '#e0f2fe', tc: '#1E293B'
    })),
    { key: 'arranque', id: 'arranque', fpid: null, nom: 'Carpeta de Arranque', tipo: 'arranque', color: '#fef3c7', tc: '#92400e' },
    { key: 'otro', id: 'otro', fpid: null, nom: 'Otro', tipo: 'otro', color: '#f1f5f9', tc: '#475569' }
  ];

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalVinculo, setModalVinculo] = useState<any>(null);
  const [modalAmbito, setModalAmbito] = useState<string>('');
  
  const [reqs, setReqs] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ vinculos: 0, base: 0, personalizados: 0, cargos: 0 });
  const [cargando, setCargando] = useState(true);
  
  const [formName, setFormName] = useState('');
  const [formExigencia, setFormExigencia] = useState('obligatorio');
  const [guardando, setGuardando] = useState(false);

  const cargarReqs = async () => {
    try {
      setCargando(true);
      const res = await Api.contratos.requisitos(contrato.id, { page_size: 100 }) as any;
      setReqs(res.items || []);
      if (res.kpis) setKpis(res.kpis as any);
    } catch (e) {
      console.error('Error al cargar requisitos:', e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarReqs();
  }, [contrato.id]);

  const abrirModal = (vinculo: any, ambito: string) => {
    setModalVinculo(vinculo);
    setModalAmbito(ambito);
    setModalAbierto(true);
  };

  const handleAgregar = async () => {
    if (!formName.trim()) return alert('El nombre es requerido');
    setGuardando(true);
    try {
      await Api.contratos.crearRequisitos(contrato.id, {
        vinculo_tipo: modalVinculo.tipo,
        vinculo_ref: modalVinculo.tipo === 'plataforma' ? modalVinculo.key : null,
        ambito: modalAmbito,
        titulo: formName.trim(),
        obligatorio: formExigencia === 'obligatorio',
        origen: 'custom'
      });
      setModalAbierto(false);
      setFormName('');
      await cargarReqs();
      const resPlats = await Api.plataformas.listar(contrato.id);
      setLocalPlataformas(resPlats.items || []);
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (rid: string) => {
    if (!confirm('¿Eliminar este requisito personalizado?')) return;
    try {
      await Api.contratos.eliminarRequisito(contrato.id, rid);
      cargarReqs();
    } catch(e) {
      alert(Api.mensajeError(e));
    }
  };

  const renderFila = (r: any, ambito: string) => (
    <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors px-2 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-[0.83rem] text-slate-700">{r.titulo || r.t}</span>
        {r.cargo_id ? (
          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[0.6rem] font-bold rounded">🪪 Cargo específico</span>
        ) : (
          ambito === 'personal' && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[0.6rem] font-bold rounded">Todos los cargos</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`px-1.5 py-0.5 text-[0.62rem] font-bold rounded ${r.obligatorio ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
          {r.obligatorio ? 'Obligatorio' : 'Opcional'}
        </span>
        {r.origen === 'base' ? (
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[0.6rem] font-bold rounded">Base ACREDITTIA</span>
        ) : (
          <button onClick={() => handleEliminar(r.id)} className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors text-[0.7rem]" title="Eliminar">✕</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-4">
        <h2 className="text-[1.2rem] font-bold text-slate-800 mb-1">Requisitos del contrato</h2>
        <p className="text-[0.85rem] text-slate-500 m-0">Cada requisito queda ligado a una plataforma, a la Carpeta de Arranque, o marcado como Otro — y puede exigirse a todos los cargos o solo a uno.</p>
      </div>

      <div className="flex bg-white border border-slate-200 rounded-xl shadow-sm divide-x divide-slate-100 mb-6">
        <div className="flex-1 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-[1.2rem]">📡</div>
          <div>
            <div className="text-[0.65rem] font-bold text-slate-500 uppercase">Vínculos disponibles</div>
            <div className="text-[1.3rem] font-black text-slate-800 leading-none my-0.5">{kpis.vinculos || vinculos.length}</div>
            <div className="text-[0.65rem] text-slate-400">plataformas + arranque + otro</div>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-[1.2rem]">📚</div>
          <div>
            <div className="text-[0.65rem] font-bold text-slate-500 uppercase">Requisitos base ACREDITTIA</div>
            <div className="text-[1.3rem] font-black text-slate-800 leading-none my-0.5">{kpis.base}</div>
            <div className="text-[0.65rem] text-slate-400">ya mapeados para esta faena</div>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100/50 flex items-center justify-center text-[1.2rem]">✏️</div>
          <div>
            <div className="text-[0.65rem] font-bold text-slate-500 uppercase">Requisitos personalizados</div>
            <div className="text-[1.3rem] font-black text-slate-800 leading-none my-0.5">{kpis.personalizados}</div>
            <div className="text-[0.65rem] text-slate-400">agregados por ti</div>
          </div>
        </div>
        <div className="flex-1 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100/50 flex items-center justify-center text-[1.2rem]">🪪</div>
          <div>
            <div className="text-[0.65rem] font-bold text-slate-500 uppercase">Cargos en este contrato</div>
            <div className="text-[1.3rem] font-black text-slate-800 leading-none my-0.5">{kpis.cargos}</div>
            <div className="text-[0.65rem] text-slate-400">puedes exigir por cargo</div>
          </div>
        </div>
      </div>

      <div>
        {vinculos.map(v => (
          <div key={v.key} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[0.78rem] font-bold px-3 py-1.5 rounded-lg" style={{ background: v.color, color: v.tc }}>{v.nom}</span>
              <span className="text-[0.78rem] text-slate-400 font-medium">
                {reqs.filter(r => r.vinculo_tipo === v.tipo && (v.tipo !== 'plataforma' || r.vinculo_ref === v.id || r.vinculo_ref === v.fpid)).length} requisitos
              </span>
            </div>

            {v.tipo === 'arranque' && (
              <div className="border-2 border-dashed border-amber-400 bg-amber-50 rounded-xl p-4 text-center cursor-pointer mb-4 hover:bg-amber-100/50 transition-colors" onClick={() => alert("Simular subida de archivo para extraer requisitos con IA")}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className="text-[1.15rem]">📤</span>
                  <span className="text-[0.85rem] font-bold text-amber-900">Subir Excel o documento de Carpeta de Arranque</span>
                  <span className="text-[0.65rem] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold">IA AUTOMÁTICO</span>
                </div>
                <div className="text-[0.78rem] text-amber-900/80">
                  Sube el checklist de arranque (.xlsx, .csv, .pdf) y ACREDITTIA detecta y deja definidos los requisitos por ti, en Empresa, Personal y Equipos.
                </div>
              </div>
            )}

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1 border-b border-slate-100 pb-1">
                <span className="text-[0.75rem] font-bold text-blue-700">🏢 Empresa</span>
                <button className="text-[0.7rem] px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 font-medium text-slate-600 transition-colors" onClick={() => abrirModal(v, "empresa")}>+ Agregar</button>
              </div>
              <div>{reqs.filter(r => r.ambito === 'empresa' && r.vinculo_tipo === v.tipo && (v.tipo !== 'plataforma' || r.vinculo_ref === v.id || r.vinculo_ref === v.fpid)).map(r => renderFila(r, 'empresa'))}</div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1 border-b border-slate-100 pb-1">
                <span className="text-[0.75rem] font-bold text-blue-700">👤 Personal</span>
                <button className="text-[0.7rem] px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 font-medium text-slate-600 transition-colors" onClick={() => abrirModal(v, "personal")}>+ Agregar</button>
              </div>
              <div>{reqs.filter(r => r.ambito === 'personal' && r.vinculo_tipo === v.tipo && (v.tipo !== 'plataforma' || r.vinculo_ref === v.id || r.vinculo_ref === v.fpid)).map(r => renderFila(r, 'personal'))}</div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1 border-b border-slate-100 pb-1">
                <span className="text-[0.75rem] font-bold text-blue-700">🚛 Equipos</span>
                <button className="text-[0.7rem] px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 font-medium text-slate-600 transition-colors" onClick={() => abrirModal(v, "equipo")}>+ Agregar</button>
              </div>
              <div>{reqs.filter(r => r.ambito === 'equipo' && r.vinculo_tipo === v.tipo && (v.tipo !== 'plataforma' || r.vinculo_ref === v.id || r.vinculo_ref === v.fpid)).map(r => renderFila(r, 'equipo'))}</div>
            </div>
          </div>
        ))}
      </div>
      
      {modalAbierto && modalVinculo && (
        <Modal abierto={modalAbierto} onCerrar={() => setModalAbierto(false)} titulo="Agregar requisito" ancho="max-w-lg">
          <div className="mb-4 text-[0.8rem] text-slate-500">
            Vínculo: <b className="text-slate-800">{modalVinculo.nom}</b> · <span className="capitalize">{modalAmbito}</span> · Contrato <b className="text-slate-800">{contrato.nombre}</b>
          </div>
          
          <div className="mb-4">
            <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Nombre del requisito *</label>
            <input placeholder="Ej: Certificado de inducción" className="w-full h-9 px-3 border border-slate-300 rounded-lg text-[0.85rem] focus:border-blue-500 outline-none" value={formName} onChange={e => setFormName(e.target.value)} />
          </div>
          
          <div className="mb-6">
            <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Exigencia</label>
            <select className="w-full h-9 px-3 border border-slate-300 rounded-lg text-[0.85rem] focus:border-blue-500 outline-none bg-white" value={formExigencia} onChange={e => setFormExigencia(e.target.value)}>
              <option value="obligatorio">Obligatorio</option>
              <option value="opcional">Opcional</option>
            </select>
          </div>
          
          <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-slate-100">
            <button className="px-4 h-9 text-[0.85rem] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" onClick={() => setModalAbierto(false)}>Cancelar</button>
            <button disabled={guardando} className="px-5 h-9 text-[0.85rem] font-bold text-white bg-[#3D62F5] hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex gap-2 items-center" onClick={handleAgregar}>
              {guardando ? <Spinner /> : "Agregar →"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
