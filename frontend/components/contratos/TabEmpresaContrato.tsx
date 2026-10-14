import React, { useState, useEffect, useRef } from 'react';
import { Contrato, Documento } from '@/lib/tipos';
import * as Api from '@/lib/cliente';
import { Barra } from '../ui';

export function TabEmpresaContrato({ 
  contrato, 
  onSubir,
  subiendo,
  analizandoId
}: { 
  contrato: Contrato, 
  onSubir?: (docId: string, file: File) => void,
  subiendo?: { docId: string; pct: number; texto: string } | null,
  analizandoId?: string | null
}) {
  const [cargando, setCargando] = useState(false);
  const [docs, setDocs] = useState<Documento[]>([]);

  const cargar = async () => {
    try {
      setCargando(true);
      const res = await Api.contratos.documentos(contrato.id, { page_size: 50 });
      setDocs(res.items || []);
    } catch (e) {
      console.error("Error al cargar docs empresa", e);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [contrato.id]);

  const okN = docs.filter(d => d.estado_calc === 'ok').length;
  const pct = docs.length > 0 ? Math.round((okN / docs.length) * 100) : 100;
  
  const textColor = pct >= 80 ? 'text-[#16a34a]' : pct >= 50 ? 'text-[#d97706]' : 'text-[#dc2626]';

  const vencidos = docs.filter(d => d.estado_calc === 'venc');
  const porVencer = docs.filter(d => d.estado_calc === 'porvenc');
  const faltan = docs.filter(d => d.estado_calc === 'falta' && d.obligatorio);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [visorDoc, setVisorDoc] = useState<Documento | null>(null);

  const handleSubirClick = (docId: string) => {
    setSelectedDocId(docId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && selectedDocId && onSubir) {
      onSubir(selectedDocId, e.target.files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedDocId(null);
  };

  const handleDescargar = async (docId: string, archivoId: string) => {
    try {
      const res = await Api.documentos.urlDescarga(docId, archivoId);
      window.open(res.download_url, '_blank');
    } catch (e) {
      console.error("Error al descargar", e);
      alert(Api.mensajeError(e));
    }
  };

  const handleQuitar = async (docId: string, archivoId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este archivo?")) return;
    try {
      await Api.documentos.eliminarArchivo(docId, archivoId);
      cargar(); // Recargar la lista local
    } catch (e) {
      console.error("Error al quitar archivo", e);
      alert(Api.mensajeError(e));
    }
  };

  return (
    <div className="max-w-[960px]">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-[56px] h-[56px] bg-[#f1f5f9] border border-slate-200 rounded-[14px] flex items-center justify-center text-[1.6rem] shrink-0">
          🏢
        </div>
        <div className="flex-1">
          <h3 className="text-[1.05rem] text-[#1E293B] font-bold m-0 mb-1 leading-tight">Acreditación de Empresa — {contrato.nombre}</h3>
          <div className="text-[0.8rem] text-slate-500 font-medium">
            Tiex SpA · {contrato.faena?.nombre} · {contrato.faena?.mandante}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[1.8rem] font-black leading-none mb-1 ${textColor}`}>{pct}%</div>
          <div className="text-[0.72rem] text-slate-500 font-medium">{okN} de {docs.length} al día</div>
        </div>
      </div>

      {/* AI Box */}
      <div className="bg-gradient-to-r from-[#0F172A] to-[#1e293b] rounded-[16px] p-5 mb-8 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-black text-[0.75rem] shadow-sm">
            IA
          </div>
          <div>
            <div className="text-[0.95rem] text-white font-bold leading-tight">Diagnóstico de acreditación de empresa</div>
            <div className="text-[0.75rem] text-slate-400 font-medium mt-0.5">Revisado contra el estándar {contrato.faena?.nombre}</div>
          </div>
        </div>
        
        <div className="flex flex-col gap-2.5">
          {vencidos.map(d => (
            <div key={d.id} className="flex gap-3 items-center p-3 bg-[#1e293b]/80 border border-slate-700/50 rounded-[10px]">
              <span className="text-[1rem]">⛔</span>
              <div className="text-[0.82rem] text-slate-200 leading-snug">
                <span className="font-bold text-white">{d.titulo}</span> venció el {d.vence || 'desconocido'}.
              </div>
            </div>
          ))}
          {porVencer.map(d => (
            <div key={d.id} className="flex gap-3 items-center p-3 bg-[#1e293b]/80 border border-slate-700/50 rounded-[10px]">
              <span className="text-[1rem]">⏰</span>
              <div className="text-[0.82rem] text-slate-200 leading-snug">
                <span className="font-bold text-white">{d.titulo}</span> vence en pocos días ({d.vence}).
              </div>
            </div>
          ))}
          {faltan.length > 0 && (
            <div className="flex gap-3 items-center p-3 bg-[#1e293b]/80 border border-slate-700/50 rounded-[10px]">
              <span className="text-[1rem]">📋</span>
              <div className="text-[0.82rem] text-slate-200 leading-snug">
                Faltan <span className="font-bold text-white">{faltan.length} documentos obligatorios</span>: {faltan.map(d => d.titulo).join(', ')}.
              </div>
            </div>
          )}
          {vencidos.length === 0 && porVencer.length === 0 && faltan.length === 0 && (
            <div className="flex gap-3 items-center p-3 bg-[#1e293b]/80 border border-slate-700/50 rounded-[10px]">
              <span className="text-[1rem]">✅</span>
              <div className="text-[0.82rem] text-slate-200 leading-snug">
                La documentación de empresa está al día. Contrato en condiciones de acreditar.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title List */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
        <h3 className="text-[0.95rem] text-[#1E293B] font-bold m-0">Documentos requeridos ({docs.length})</h3>
        <div className="flex items-center gap-4">
          <span className="text-[0.78rem] text-slate-500 font-medium">
            {docs.filter(d => d.obligatorio).length} obligatorios · {docs.filter(d => !d.obligatorio).length} opcionales
          </span>
          <button className="h-[30px] px-3.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-[6px] text-[0.75rem] font-semibold text-emerald-700 flex items-center gap-1.5 transition-colors shadow-sm">
            <span className="text-emerald-600">📊</span> Ver en hoja de cálculo
          </button>
        </div>
      </div>

      {/* Docs List */}
      <div className="flex flex-col gap-3">
        {cargando ? (
          <div className="p-8 text-center text-slate-400 text-[0.85rem]">Cargando documentos...</div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-[0.85rem]">No hay documentos requeridos.</div>
        ) : (
          docs.map((d, i) => {
            const estado = d.estado_calc || 'falta';
            const isOk = estado === 'ok';
            const isVenc = estado === 'venc';
            const isPorVenc = estado === 'porvenc';
            
            const isSubiendo = subiendo?.docId === d.id;
            const isAnalizando = analizandoId === d.id;
            
            return (
              <div key={d.id || i} className="relative flex gap-3.5 p-4 rounded-[12px] bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-md overflow-hidden">
                {/* Overlay de Subida y Análisis */}
                {(isSubiendo || isAnalizando) && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg border-2 border-indigo-200">
                    {isSubiendo ? (
                      <div className="w-64 max-w-full">
                        <Barra pct={subiendo.pct} texto={subiendo.texto} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 animate-pulse">
                        <span className="text-xl">🤖</span> Analizando documento con IA...
                      </div>
                    )}
                  </div>
                )}

                {/* Icon Checkbox */}
                <div className={`w-[20px] h-[20px] mt-0.5 rounded-[4px] flex items-center justify-center shrink-0 border transition-colors ${
                  isOk || isPorVenc ? 'bg-[#10B981] border-[#10B981] text-white text-[0.7rem] font-bold' : 
                  'bg-white border-slate-300 text-transparent'
                }`}>
                  {isOk || isPorVenc ? '✓' : ''}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h4 className="text-[0.88rem] font-bold text-[#1E293B] m-0 mr-1">{d.titulo}</h4>
                    {d.obligatorio ? (
                      <span className="text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-red-50 text-red-600 border border-red-100">Obligatorio</span>
                    ) : (
                      <span className="text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-600 border border-slate-200">Opcional</span>
                    )}
                    <span className="text-[0.55rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-blue-50 text-blue-600 border border-blue-100">SIGA</span>
                  </div>

                  {/* Vence info */}
                  <div className={`text-[0.75rem] font-semibold mb-3.5 ${
                    isOk ? 'text-[#10B981]' : 
                    isPorVenc ? 'text-amber-500' :
                    isVenc ? 'text-red-500' : 'text-[#b45309]'
                  }`}>
                    {isOk ? `✓ Vigente hasta ${d.vence || 'indefinido'}` : 
                     isPorVenc ? `⏰ DOCUMENTO VA A VENCER - ${d.vence || ''}` :
                     isVenc ? `⛔ DOCUMENTO VENCIDO - ${d.vence || ''}` : 
                     `⏳ Pendiente de carga`}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center flex-wrap gap-2">
                    <label className="h-[28px] px-3 bg-blue-50/50 border border-blue-200 hover:bg-blue-50 rounded-[6px] text-[0.72rem] font-semibold text-blue-600 cursor-pointer flex items-center gap-1.5 transition-colors">
                      <span className="text-[0.8rem] font-normal leading-none">↑</span> Subir documento
                      <input type="file" className="hidden" onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0 && onSubir) {
                          onSubir(d.id, e.target.files[0]);
                          e.target.value = "";
                        }
                      }} />
                    </label>
                    
                    {isOk || isPorVenc || isVenc ? (
                      <div className="flex items-center gap-2">
                        <button className="h-[28px] px-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-[6px] text-[0.72rem] font-medium text-slate-600 transition-colors flex items-center gap-1">
                          📄 {d.archivos?.[0]?.filename || "documento.pdf"}
                        </button>
                        <button 
                          onClick={() => setVisorDoc(d)}
                          disabled={!d.archivos?.[0]?.id}
                          className="h-[28px] px-3 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4338CA] rounded-[6px] text-[0.72rem] font-bold transition-colors disabled:opacity-50">
                          Ver documento
                        </button>
                        <button 
                          onClick={() => {
                            if (d.archivos?.[0]?.id) handleQuitar(d.id, d.archivos[0].id);
                          }}
                          disabled={!d.archivos?.[0]?.id}
                          className="h-[28px] px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-[6px] text-[0.72rem] font-bold transition-colors disabled:opacity-50">
                          Quitar
                        </button>
                      </div>
                    ) : (
                      <button className="h-[28px] px-2.5 bg-[#FFFbeb] border border-[#fde68a] hover:bg-[#fef3c7] rounded-[6px] text-[0.72rem] font-medium text-amber-700 transition-colors flex items-center gap-1">
                        📄 Ver ejemplo
                      </button>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[0.7rem] font-semibold text-slate-400">SIGA:</span>
                      <select className="h-[28px] px-2 bg-slate-50 border border-slate-200 rounded-[6px] text-[0.7rem] text-slate-600 outline-none cursor-pointer">
                        <option>Sin subir</option>
                        <option>Subido</option>
                        <option>Aprobado</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Visor Modal - Custom Overlay to match Wireframe */}
      {visorDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#525252]/90 backdrop-blur-sm p-4" onClick={() => setVisorDoc(null)}>
          <div 
            className="flex flex-col w-full max-w-[800px] h-[90vh] max-h-[800px] bg-[#525252] rounded-xl overflow-hidden shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (White) */}
            <div className="bg-white px-6 py-4 flex items-start justify-between z-10 shrink-0 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-[1.1rem] font-bold text-slate-800 m-0">{visorDoc.titulo}</h2>
                  <span className={`px-2 py-0.5 rounded text-[0.7rem] font-bold ${
                    visorDoc.estado_calc === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                    visorDoc.estado_calc === 'porvenc' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {visorDoc.estado_calc === 'ok' ? 'Vigente' : visorDoc.estado_calc === 'porvenc' ? 'Por vencer' : 'Falta'}
                  </span>
                </div>
                <div className="text-[0.8rem] text-slate-500">
                  Empresa · {contrato.nombre} — {visorDoc.archivos?.[0]?.filename || 'documento.pdf'} · {visorDoc.vence ? `vence ${visorDoc.vence}` : 'sin vencimiento'}
                </div>
              </div>
              <button 
                onClick={() => setVisorDoc(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
              >
                <span className="text-[1.2rem] leading-none mb-[2px]">×</span>
              </button>
            </div>

            {/* Modal Body (Dark Gray with White Mockup) */}
            <div className="flex-1 p-8 overflow-y-auto flex justify-center w-full scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-transparent">
              <div className="bg-white shadow-lg w-full max-w-[600px] h-fit min-h-[500px] p-8 relative rounded-sm">
                <div className="absolute top-8 right-8 border-[2px] border-emerald-500 text-emerald-600 px-3 py-1 font-bold text-[0.75rem] rotate-12 opacity-80 uppercase tracking-widest rounded-sm bg-white">
                  Validado<br/><span className="text-[0.6rem] block text-center mt-0.5">Vigía IA</span>
                </div>
                
                <div className="text-[0.65rem] text-slate-400 font-bold uppercase tracking-wider mb-2">Documento</div>
                <h3 className="text-[1.3rem] font-black text-slate-800 uppercase m-0 mb-8 pb-4 border-b-2 border-slate-800">
                  {visorDoc.titulo}
                </h3>
                
                <table className="w-full text-left text-[0.8rem] mb-12">
                  <tbody>
                    <tr className="border-b border-slate-100"><td className="py-3 text-slate-500 w-[140px]">Titular</td><td className="py-3 font-semibold text-slate-800">Empresa</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 text-slate-500">RUT / ID</td><td className="py-3 font-semibold text-slate-800">{contrato.nombre}</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 text-slate-500">Fecha de emisión</td><td className="py-3 font-semibold text-slate-800">2025-11-27</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 text-slate-500">Vigencia</td><td className="py-3 font-semibold text-slate-800">{visorDoc.vence || '2026-11-27'}</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 text-slate-500">Faena</td><td className="py-3 font-semibold text-slate-800">{contrato.faena?.nombre} · {contrato.faena?.mandante}</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 text-slate-500">Plataforma de destino</td><td className="py-3 font-semibold text-slate-800">SIGA</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-3 text-slate-500">Archivo</td><td className="py-3 font-semibold text-slate-800">{visorDoc.archivos?.[0]?.filename || 'documento.pdf'}</td></tr>
                  </tbody>
                </table>
                
                <div className="space-y-3 opacity-30">
                  <div className="h-2 bg-slate-200 rounded-full w-full"></div>
                  <div className="h-2 bg-slate-200 rounded-full w-5/6"></div>
                  <div className="h-2 bg-slate-200 rounded-full w-full"></div>
                  <div className="h-2 bg-slate-200 rounded-full w-4/6"></div>
                  <div className="h-2 bg-slate-200 rounded-full w-full"></div>
                </div>
                
                <div className="mt-16 pt-4 border-t border-slate-200 flex justify-between items-end">
                  <div className="w-[120px] h-0 border-t border-slate-800 text-center text-[0.6rem] text-slate-500 pt-1">
                    Firma y timbre
                  </div>
                  <div className="text-[0.65rem] text-slate-400 italic">Vista previa del documento cargado · demo</div>
                </div>
              </div>
            </div>

            {/* Modal Footer (White) */}
            <div className="bg-white p-4 flex justify-between items-center z-10 shrink-0 border-t border-slate-200 rounded-b-xl">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => visorDoc.archivos?.[0]?.id && handleDescargar(visorDoc.id, visorDoc.archivos[0].id)}
                  className="h-[36px] px-4 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-[0.8rem] font-bold text-slate-700 flex items-center gap-2 transition-colors">
                  <span className="text-[1rem]">↓</span> Descargar
                </button>
                <button 
                  onClick={() => {
                    handleSubirClick(visorDoc.id);
                  }}
                  className="h-[36px] px-4 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-[0.8rem] font-bold text-slate-700 flex items-center gap-2 transition-colors">
                  <span className="text-[1rem]">↻</span> Reemplazar
                </button>
              </div>
              <button 
                onClick={() => {
                  if (visorDoc.archivos?.[0]?.id) handleQuitar(visorDoc.id, visorDoc.archivos[0].id);
                  setVisorDoc(null);
                }}
                className="h-[36px] px-4 bg-white border border-red-200 hover:bg-red-50 rounded-lg text-[0.8rem] font-bold text-red-600 transition-colors">
                Quitar documento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
