import React, { useEffect, useRef, useState } from 'react';
import { Contrato, DocumentoFila, Documento, Ejemplo } from '@/lib/tipos';
import * as Api from '@/lib/cliente';
import { Barra, Modal } from '../ui';

type Cat = 'todos' | 'empresa' | 'personal' | 'equipo';

function categoriaDe(f: DocumentoFila): Exclude<Cat, 'todos'> {
  const t = f.dueno?.tipo;
  if (t === 'trabajador') return 'personal';
  if (t === 'equipo') return 'equipo';
  return 'empresa';
}

export function TabDocumentosContrato({
  contrato,
  onSubir,
  subiendo,
  analizandoId,
}: {
  contrato: Contrato;
  onSubir: (docId: string, file: File) => void;
  subiendo: { docId: string; pct: number; texto: string } | null;
  analizandoId: string | null;
}) {
  const [cargando, setCargando] = useState(false);
  const [filas, setFilas] = useState<DocumentoFila[]>([]);
  const [cat, setCat] = useState<Cat>('todos');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [visorId, setVisorId] = useState<string | null>(null);
  const [visorDoc, setVisorDoc] = useState<Documento | null>(null);
  const [ejemplo, setEjemplo] = useState<Ejemplo | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState('');
  const analizandoPrevio = useRef<string | null>(null);

  const cargar = async () => {
    try {
      setCargando(true);
      setError('');
      const res = await Api.documentos.listar({ contrato_id: contrato.id, page_size: 100 });
      setFilas(res.items || []);
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contrato.id]);

  // Recarga cuando termina la revisión IA de una subida hecha desde este tab.
  useEffect(() => {
    if (analizandoPrevio.current && !analizandoId) cargar();
    analizandoPrevio.current = analizandoId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analizandoId]);

  useEffect(() => {
    if (!visorId) {
      setVisorDoc(null);
      return;
    }
    Api.documentos.detalle(visorId).then(setVisorDoc).catch((e) => setError(Api.mensajeError(e)));
  }, [visorId]);

  const contar = (c: Cat) => (c === 'todos' ? filas.length : filas.filter((f) => categoriaDe(f) === c).length);
  const cats: { k: Cat; lbl: string; n: number }[] = [
    { k: 'todos', lbl: 'Todos los documentos', n: contar('todos') },
    { k: 'empresa', lbl: 'Empresa', n: contar('empresa') },
    { k: 'personal', lbl: 'Personal', n: contar('personal') },
    { k: 'equipo', lbl: 'Equipos / Vehículos', n: contar('equipo') },
  ];

  const qn = q.trim().toLowerCase();
  const lista = filas.filter(
    (f) =>
      (cat === 'todos' || categoriaDe(f) === cat) &&
      (!estado || f.estado_calc === estado) &&
      (!qn || f.titulo.toLowerCase().includes(qn) || (f.dueno?.nombre || '').toLowerCase().includes(qn)),
  );

  const toggle = async (f: DocumentoFila) => {
    setEditando(f.id);
    try {
      await Api.documentos.editar(f.id, { estado: f.estado === 'ok' ? 'falta' : 'ok' });
      await cargar();
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setEditando(null);
    }
  };

  const quitar = async (docId: string, archivoId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este archivo?')) return;
    try {
      await Api.documentos.eliminarArchivo(docId, archivoId);
      if (visorId === docId) {
        const det = await Api.documentos.detalle(docId);
        setVisorDoc(det);
      }
      await cargar();
    } catch (e) {
      setError(Api.mensajeError(e));
    }
  };

  const descargar = async (docId: string, archivoId: string) => {
    try {
      const res = await Api.documentos.urlDescarga(docId, archivoId);
      window.open(res.download_url, '_blank');
    } catch (e) {
      setError(Api.mensajeError(e));
    }
  };

  const verEjemplo = async (clave: string) => {
    try {
      setEjemplo(await Api.catalogo.ejemplo(clave));
    } catch (e) {
      setError(Api.mensajeError(e));
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-5 items-start">
      {/* Sidebar Categorías */}
      <div className="w-full xl:w-[220px] shrink-0 flex flex-col gap-4">
        <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden shadow-sm">
          <div className="px-3.5 py-3 bg-slate-50 border-b border-slate-200 text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider">
            Categoría
          </div>
          <div className="flex flex-col p-2 gap-1 bg-white" role="tablist" aria-label="Filtrar por categoría">
            {cats.map((c) => (
              <button
                key={c.k}
                role="tab"
                aria-selected={cat === c.k}
                onClick={() => setCat(c.k)}
                className={`flex justify-between items-center px-3 py-2.5 rounded-[8px] text-[0.82rem] transition-colors ${
                  cat === c.k
                    ? 'bg-blue-50/60 text-blue-800 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 font-medium'
                }`}
              >
                <span>{c.lbl}</span>
                <span className={`px-2 py-0.5 rounded-[6px] text-[0.68rem] font-bold ${
                  cat === c.k ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  {c.n}
                </span>
              </button>
            ))}
          </div>
          <div className="px-3.5 py-3.5 bg-emerald-50 border-t border-slate-200">
            <div className="text-[0.68rem] font-black text-emerald-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>🤖</span> Vigía IA
            </div>
            <div className="text-[0.72rem] text-emerald-700 leading-snug">
              Revisa cada documento al instante, apenas se sube. Sin cola de validación manual.
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-start justify-between mb-3.5 gap-3">
          <div>
            <h3 className="text-[#1E293B] text-[0.95rem] font-bold">Gestor documental</h3>
            <p className="text-[0.78rem] text-slate-500 m-0 mt-0.5">Vista consolidada de todos los documentos asociados a este contrato.</p>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 mb-4">{error}</p>}

        {/* Filtros funcionales */}
        <div className="flex flex-wrap gap-2.5 mb-4 items-center">
          <input
            aria-label="Buscar documentos"
            className="flex-1 min-w-[200px] max-w-[360px] bg-white border border-slate-200 rounded-[10px] px-3.5 py-2.5 text-[0.88rem] text-slate-800 placeholder-slate-400 outline-none shadow-sm"
            placeholder="Buscar por nombre o dueño..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            aria-label="Filtrar por estado"
            className="bg-white border border-slate-200 rounded-[10px] px-3 py-2.5 text-[0.82rem] text-slate-500 cursor-pointer outline-none shadow-sm"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Estado: Todos</option>
            <option value="ok">Vigente</option>
            <option value="porvenc">Por vencer</option>
            <option value="venc">Vencido</option>
            <option value="falta">Pendiente</option>
          </select>
        </div>

        {/* Tabla Documentos */}
        <div className="bg-white border border-slate-200 rounded-[14px] overflow-x-auto shadow-sm">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-[0.68rem] text-slate-500 font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Cumplido</th>
                <th className="py-3.5 px-4">Documento</th>
                <th className="py-3.5 px-4">Plataforma</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-4">Vencimiento</th>
                <th className="py-3.5 px-4">Archivos</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-[0.85rem]">
                    Cargando documentos...
                  </td>
                </tr>
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-[0.85rem]">
                    No se encontraron documentos.
                  </td>
                </tr>
              ) : (
                lista.map((d) => {
                  const est = d.estado_calc || 'falta';
                  const isSubiendo = subiendo?.docId === d.id;
                  const isAnalizando = analizandoId === d.id;
                  return (
                    <tr key={d.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 align-middle">
                        <input
                          type="checkbox"
                          aria-label={`Marcar "${d.titulo}" como cumplido`}
                          checked={d.estado === 'ok'}
                          disabled={editando === d.id}
                          onChange={() => toggle(d)}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer disabled:opacity-50"
                        />
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[1.1rem]">📄</span>
                          <div>
                            <div className="text-[0.82rem] font-bold text-slate-800">{d.titulo}</div>
                            <div className="text-[0.68rem] text-slate-500 mt-0.5">
                              {d.dueno ? `${d.dueno.nombre} · ` : ''}{categoriaDe(d) === 'empresa' ? 'Empresa' : categoriaDe(d) === 'personal' ? 'Personal' : 'Equipo'}
                              {d.obligatorio ? ' · Obligatorio' : ''}
                            </div>
                            {(isSubiendo || isAnalizando) && (
                              <div className="w-48 mt-1.5">
                                {isSubiendo && subiendo ? (
                                  <Barra pct={subiendo.pct} texto={subiendo.texto} />
                                ) : (
                                  <span className="text-[0.7rem] font-medium text-indigo-700 animate-pulse">🤖 Analizando con IA...</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <div className="h-[22px] min-w-[44px] w-fit px-2 bg-slate-100 rounded-[5px] flex items-center justify-center text-[0.55rem] font-black text-slate-600">
                          {d.plataforma || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <span className={`inline-flex items-center h-5 px-2 rounded-full text-[0.62rem] font-bold uppercase tracking-wider ${
                          est === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                          est === 'porvenc' ? 'bg-amber-100 text-amber-700' :
                          est === 'venc' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {est === 'ok' ? 'Vigente' : est === 'porvenc' ? 'Por vencer' : est === 'venc' ? 'Vencido' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <div className={`text-[0.78rem] font-semibold ${est === 'venc' ? 'text-red-500' : 'text-slate-700'}`}>
                          {d.vence || '-'}
                        </div>
                        {d.dias_para_vencer != null && (
                          <div className="text-[0.65rem] text-slate-500 mt-0.5">
                            {d.dias_para_vencer < 0 ? `Vencido hace ${-d.dias_para_vencer} días` : `Vence en ${d.dias_para_vencer} días`}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <span className="text-[0.78rem] text-slate-700">{d.archivos_count}</span>
                      </td>
                      <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                        <label className="inline-flex px-2.5 py-1 border border-blue-200 bg-blue-50/50 rounded-[6px] text-[0.72rem] font-medium text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer mr-1.5">
                          Subir
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) onSubir(d.id, e.target.files[0]);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          onClick={() => setVisorId(d.id)}
                          className="px-2.5 py-1 border border-slate-200 rounded-[6px] text-[0.72rem] font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors bg-white mr-1.5"
                        >
                          Ver
                        </button>
                        {d.ejemplo_clave && (
                          <button
                            onClick={() => verEjemplo(d.ejemplo_clave!)}
                            className="px-2.5 py-1 border border-amber-200 bg-amber-50 rounded-[6px] text-[0.72rem] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                          >
                            Ejemplo
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="bg-slate-50 border-t border-slate-200 p-3 flex justify-between items-center text-[0.75rem] text-slate-500">
            <span>Mostrando {lista.length} de {filas.length} documentos</span>
          </div>
        </div>
      </div>

      {/* Visor con archivos reales */}
      <Modal abierto={!!visorId} titulo={visorDoc?.titulo ?? 'Documento'} onCerrar={() => setVisorId(null)} ancho="max-w-xl">
        {!visorDoc ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-[0.8rem]">
              <span className="text-slate-500">Estado</span>
              <b>{visorDoc.estado_calc === 'ok' ? 'Vigente' : visorDoc.estado_calc === 'porvenc' ? 'Por vencer' : visorDoc.estado_calc === 'venc' ? 'Vencido' : 'Pendiente'}</b>
              <span className="text-slate-500">Vence</span>
              <b>{visorDoc.vence || '—'}</b>
              <span className="text-slate-500">Plataforma</span>
              <b>{visorDoc.plataforma || '—'}</b>
            </div>
            {(visorDoc.archivos || []).length === 0 ? (
              <p className="text-slate-500">Sin archivos subidos. Usa «Subir» en la tabla para agregar uno.</p>
            ) : (
              <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                {visorDoc.archivos!.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="flex-1 truncate font-medium">{a.filename}</span>
                    <button onClick={() => descargar(visorDoc.id, a.id)} className="text-blue-700 font-semibold hover:underline">
                      Descargar
                    </button>
                    <button onClick={() => quitar(visorDoc.id, a.id)} className="text-red-600 font-semibold hover:underline">
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="inline-flex w-fit px-3 py-1.5 border border-blue-200 bg-blue-50/50 rounded-lg text-[0.8rem] font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer">
              ↻ Reemplazar / subir nuevo
              <input
                type="file"
                className="hidden"
                onChange={async (e) => {
                  if (e.target.files?.[0] && visorDoc) {
                    onSubir(visorDoc.id, e.target.files[0]);
                    setVisorId(null);
                  }
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Ejemplo del catálogo */}
      <Modal abierto={!!ejemplo} titulo={ejemplo?.nombre ?? ''} onCerrar={() => setEjemplo(null)}>
        {ejemplo && (
          <div className="flex flex-col gap-3 text-sm">
            {ejemplo.referencia && <p className="text-slate-500 m-0">Referencia: {ejemplo.referencia}</p>}
            {ejemplo.campos_clave && ejemplo.campos_clave.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="mb-2 font-semibold text-slate-700">Campos clave que valida la IA:</div>
                {ejemplo.campos_clave.map(([k, v], i) => (
                  <div key={i} className="flex justify-between border-b border-slate-200 py-1 last:border-0">
                    <span className="font-medium">{k}</span>
                    <span className="text-slate-500">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {ejemplo.notas && ejemplo.notas.length > 0 && (
              <ul className="list-inside list-disc text-slate-600 m-0 pl-1">
                {ejemplo.notas.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            )}
            {ejemplo.tip && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800 m-0">💡 {ejemplo.tip}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
