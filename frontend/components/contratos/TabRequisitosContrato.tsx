"use client";
import React, { useState, useEffect } from "react";
import { Modal, Spinner } from "@/components/ui";
import * as Api from "@/lib/cliente";
import { Contrato, PlataformaContrato, Sujeto } from "@/lib/tipos";

interface TabRequisitosContratoProps {
  contrato: Contrato;
  plataformas: PlataformaContrato[];
  onCambio?: () => void;
}



export function TabRequisitosContrato({ contrato, plataformas, onCambio }: TabRequisitosContratoProps) {
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
  const [cargos, setCargos] = useState<{ id: string | null; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  
  const [formName, setFormName] = useState('');
  const [formExigencia, setFormExigencia] = useState('obligatorio');
  const [formCargo, setFormCargo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [quitarId, setQuitarId] = useState<string | null>(null);
  const [arrFase, setArrFase] = useState<"idle" | "subiendo" | "analizando" | "propuesta" | "error">("idle");
  const [arrMsg, setArrMsg] = useState("");
  const [arrProp, setArrProp] = useState<{ empresa: string[]; personal: string[]; equipo: string[] }>({ empresa: [], personal: [], equipo: [] });
  const [arrGuardando, setArrGuardando] = useState(false);

  const kpis = {
    vinculos: vinculos.length,
    base: reqs.filter((r) => r.origen === "base").length,
    personalizados: reqs.filter((r) => r.origen !== "base").length,
    cargos: cargos.length,
  };

  const cargarReqs = async () => {
    try {
      setCargando(true);
      const [res, per] = await Promise.all([
        Api.contratos.requisitos(contrato.id, { page_size: 100 }),
        Api.contratos.personal(contrato.id, { page_size: 100 }).catch(() => ({ items: [] as Sujeto[] })),
      ]);
      setReqs(res.items || []);
      const vistos = new Map<string, string | null>();
      for (const s of per.items || []) {
        if (s.cargo && !vistos.has(s.cargo)) vistos.set(s.cargo, s.cargo_id);
      }
      setCargos(Array.from(vistos.keys()).map((nombre) => ({ nombre, id: vistos.get(nombre) || null })));
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
    setFormCargo('');
    setModalAbierto(true);
  };

  const handleAgregar = async () => {
    if (!formName.trim()) return alert('El nombre es requerido');
    setGuardando(true);
    try {
      const cargo = cargos.find((c) => c.nombre === formCargo);
      await Api.contratos.crearRequisitos(contrato.id, {
        vinculo_tipo: modalVinculo.tipo,
        vinculo_ref: modalVinculo.tipo === 'plataforma' ? modalVinculo.key : null,
        ambito: modalAmbito,
        titulo: formName.trim(),
        obligatorio: formExigencia === 'obligatorio',
        cargo_id: modalAmbito === 'personal' ? cargo?.id || null : null,
        origen: 'custom'
      });
      setModalAbierto(false);
      setFormName('');
      await cargarReqs();
      const resPlats = await Api.plataformas.listar(contrato.id);
      setLocalPlataformas(resPlats.items || []);
      if (onCambio) onCambio();
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (rid: string) => {
    if (quitarId !== rid) {
      setQuitarId(rid);
      setTimeout(() => setQuitarId((id) => (id === rid ? null : id)), 4000);
      return;
    }
    setQuitarId(null);
    try {
      await Api.contratos.eliminarRequisito(contrato.id, rid);
      cargarReqs();
      if (onCambio) onCambio();
    } catch(e) {
      alert(Api.mensajeError(e));
    }
  };

  const subirArranque = async (file: File) => {
    setArrFase("subiendo");
    setArrMsg(`Subiendo ${file.name}...`);
    try {
      const sas = await Api.ia.uploadTmp({
        filename: file.name,
        content_type: file.type || undefined,
        size_bytes: file.size,
        proposito: "carpeta_arranque",
      });
      await fetch(sas.upload_url, { method: "PUT", headers: sas.headers, body: file });
      setArrFase("analizando");
      setArrMsg("La IA está leyendo el checklist...");
      const job = await Api.contratos.carpetaArranque(contrato.id, sas.blob_path, file.name);
      const rev = await Api.esperarRevision(job.job_id, { timeoutMs: 120000 });
      const campos = (rev.campos_extraidos || {}) as Record<string, { titulo: string }[]>;
      const prop = {
        empresa: (campos.empresa || []).map((x) => x.titulo).filter(Boolean),
        personal: (campos.personal || []).map((x) => x.titulo).filter(Boolean),
        equipo: (campos.equipo || []).map((x) => x.titulo).filter(Boolean),
      };
      if (!prop.empresa.length && !prop.personal.length && !prop.equipo.length) {
        throw new Error("La IA no detectó requisitos en el archivo.");
      }
      setArrProp(prop);
      setArrFase("propuesta");
    } catch (e) {
      setArrFase("error");
      setArrMsg(Api.mensajeError(e));
    }
  };

  const confirmarArranque = async () => {
    const items = [
      ...arrProp.empresa.map((titulo) => ({ ambito: "empresa", titulo, obligatorio: true, origen: "arranque", vinculo_tipo: "arranque" })),
      ...arrProp.personal.map((titulo) => ({ ambito: "personal", titulo, obligatorio: true, origen: "arranque", vinculo_tipo: "arranque" })),
      ...arrProp.equipo.map((titulo) => ({ ambito: "equipo", titulo, obligatorio: true, origen: "arranque", vinculo_tipo: "arranque" })),
    ];
    if (!items.length) return;
    setArrGuardando(true);
    try {
      await Api.contratos.crearRequisitos(contrato.id, items, { bulk: true });
      setArrFase("idle");
      setArrProp({ empresa: [], personal: [], equipo: [] });
      await cargarReqs();
      if (onCambio) onCambio();
    } catch (e) {
      setArrFase("error");
      setArrMsg(Api.mensajeError(e));
    } finally {
      setArrGuardando(false);
    }
  };

  const filaKey = (r: any, ambito: string, idx: number) => `${r.id || "base"}-${ambito}-${r.titulo || r.t}-${idx}`;

  const renderFila = (r: any, ambito: string, idx: number) => (
    <div key={filaKey(r, ambito, idx)} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors px-2 rounded-lg">
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
          <button
            onClick={() => r.id && handleEliminar(r.id)}
            aria-label={quitarId === r.id ? `Confirmar eliminación de ${r.titulo || r.t}` : `Eliminar ${r.titulo || r.t}`}
            className={`h-5 min-w-5 px-1 flex items-center justify-center rounded transition-colors text-[0.7rem] font-bold ${
              quitarId === r.id ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-400 hover:text-red-500 hover:bg-red-50"
            }`}
            title="Eliminar"
          >
            {quitarId === r.id ? "¿Quitar?" : "✕"}
          </button>
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
            <div className="text-[1.3rem] font-black text-slate-800 leading-none my-0.5">{kpis.vinculos}</div>
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
              <div>
                <label className="border-2 border-dashed border-amber-400 bg-amber-50 rounded-xl p-4 text-center cursor-pointer mb-4 hover:bg-amber-100/50 transition-colors block">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <span className="text-[1.15rem]" aria-hidden="true">📤</span>
                    <span className="text-[0.85rem] font-bold text-amber-900">Subir Excel o documento de Carpeta de Arranque</span>
                    <span className="text-[0.65rem] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold">IA AUTOMÁTICO</span>
                  </div>
                  <div className="text-[0.78rem] text-amber-900/80">
                    Sube el checklist de arranque (.xlsx, .csv, .pdf) y ACREDITTIA detecta y deja definidos los requisitos por ti, en Empresa, Personal y Equipos.
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf,.doc,.docx"
                    className="hidden"
                    disabled={arrFase === "subiendo" || arrFase === "analizando" || arrGuardando}
                    onChange={(e) => {
                      if (e.target.files?.length) subirArranque(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </label>

                {(arrFase === "subiendo" || arrFase === "analizando") && (
                  <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-4 flex items-center gap-3">
                    <Spinner texto={arrMsg} />
                  </div>
                )}
                {arrFase === "error" && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4 text-[0.82rem] text-red-700">
                    {arrMsg}
                    <button onClick={() => setArrFase("idle")} className="ml-2 font-bold underline">Reintentar</button>
                  </div>
                )}
                {arrFase === "propuesta" && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 mb-4">
                    <b className="text-[0.85rem] text-slate-800">
                      La IA detectó {arrProp.empresa.length + arrProp.personal.length + arrProp.equipo.length} requisitos. ¿Los fijo al contrato?
                    </b>
                    {(
                      [
                        ["Empresa", arrProp.empresa],
                        ["Personal", arrProp.personal],
                        ["Equipos", arrProp.equipo],
                      ] as [string, string[]][]
                    ).map(([lbl, items]) =>
                      items.length ? (
                        <div key={lbl} className="mt-2 text-[0.78rem] text-slate-600">
                          <b>{lbl} ({items.length}):</b> {items.join(" · ")}
                        </div>
                      ) : null
                    )}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={confirmarArranque}
                        disabled={arrGuardando}
                        className="px-4 h-9 text-[0.82rem] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {arrGuardando ? "Fijando..." : "📌 Fijar requisitos"}
                      </button>
                      <button
                        onClick={() => setArrFase("idle")}
                        className="px-4 h-9 text-[0.82rem] font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1 border-b border-slate-100 pb-1">
                <span className="text-[0.75rem] font-bold text-blue-700">🏢 Empresa</span>
                <button className="text-[0.7rem] px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 font-medium text-slate-600 transition-colors" onClick={() => abrirModal(v, "empresa")}>+ Agregar</button>
              </div>
              <div>{reqs.filter(r => r.ambito === 'empresa' && r.vinculo_tipo === v.tipo && (v.tipo !== 'plataforma' || r.vinculo_ref === v.id || r.vinculo_ref === v.fpid)).map((r, i) => renderFila(r, 'empresa', i))}</div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1 border-b border-slate-100 pb-1">
                <span className="text-[0.75rem] font-bold text-blue-700">👤 Personal</span>
                <button className="text-[0.7rem] px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 font-medium text-slate-600 transition-colors" onClick={() => abrirModal(v, "personal")}>+ Agregar</button>
              </div>
              <div>{reqs.filter(r => r.ambito === 'personal' && r.vinculo_tipo === v.tipo && (v.tipo !== 'plataforma' || r.vinculo_ref === v.id || r.vinculo_ref === v.fpid)).map((r, i) => renderFila(r, 'personal', i))}</div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1 border-b border-slate-100 pb-1">
                <span className="text-[0.75rem] font-bold text-blue-700">🚛 Equipos</span>
                <button className="text-[0.7rem] px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-50 font-medium text-slate-600 transition-colors" onClick={() => abrirModal(v, "equipo")}>+ Agregar</button>
              </div>
              <div>{reqs.filter(r => r.ambito === 'equipo' && r.vinculo_tipo === v.tipo && (v.tipo !== 'plataforma' || r.vinculo_ref === v.id || r.vinculo_ref === v.fpid)).map((r, i) => renderFila(r, 'equipo', i))}</div>
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

          {modalAmbito === 'personal' && cargos.length > 0 && (
            <div className="mb-4">
              <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Cargo</label>
              <select className="w-full h-9 px-3 border border-slate-300 rounded-lg text-[0.85rem] focus:border-blue-500 outline-none bg-white" value={formCargo} onChange={e => setFormCargo(e.target.value)}>
                <option value="">Todos los cargos</option>
                {cargos.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>
          )}
          
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
