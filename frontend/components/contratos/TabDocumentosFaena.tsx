"use client";
import React, { useState, useEffect, useCallback } from "react";
import * as Api from "@/lib/cliente";
import type { Contrato, Documento, Sujeto } from "@/lib/tipos";
import { toast } from "sonner";
import { Modal } from "@/components/ui";

type ReqFaena = {
  id: string;
  titulo: string;
  ambito: string;
  obligatorio: boolean;
  editable: boolean;
  doc?: Documento;
};

type AlertaTerreno = {
  equipoId: string;
  equipoNombre: string;
  patente: string;
  anio: number;
  antiguedadAnios: number;
  maxAnios: number;
  fuente: string;
};

// ponytail: convención — la antigüedad máxima se lee del texto de la regla
// ("...máximo 10 años"); una regla sin número no genera alertas.
function maxAniosDe(titulo: string): number | null {
  const m = titulo.match(/(\d+)\s*años?/i);
  return m ? Number(m[1]) : null;
}

export function TabDocumentosFaena({
  contrato,
  onVerEquipo,
  onSubir,
  subiendo,
  analizandoId,
}: {
  contrato: Contrato;
  onVerEquipo?: (patente: string) => void;
  onSubir: (docId: string, file: File) => void;
  subiendo: { docId: string; pct: number; texto: string } | null;
  analizandoId: string | null;
}) {
  const [reqs, setReqs] = useState<ReqFaena[]>([]);
  const [equipos, setEquipos] = useState<Sujeto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [docVer, setDocVer] = useState<ReqFaena | null>(null);
  const [equipoModal, setEquipoModal] = useState<AlertaTerreno | null>(null);
  const [modalSubir, setModalSubir] = useState(false);

  const [nuevoTitulo, setNuevoTitulo] = useState("");
  const [nuevoAmbito, setNuevoAmbito] = useState("empresa");
  const [guardando, setGuardando] = useState(false);

  const faenaNombre = contrato.faena?.nombre || "la faena";
  const mandanteNombre = contrato.faena?.mandante || faenaNombre;

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [reqRes, docRes, eqRes] = await Promise.all([
        Api.contratos.requisitos(contrato.id, { vinculo_tipo: "faena", page_size: 100 }),
        Api.contratos.documentos(contrato.id, { page_size: 100 }),
        Api.contratos.equipos(contrato.id, { page_size: 100 }),
      ]);
      const porTitulo = new Map<string, Documento>();
      for (const d of docRes.items || []) porTitulo.set(d.titulo.trim().toLowerCase(), d);
      setReqs(((reqRes.items || []) as any[]).map((r) => ({
        id: r.id,
        titulo: r.titulo,
        ambito: r.ambito,
        obligatorio: r.obligatorio,
        editable: r.editable ?? r.origen !== "base",
        doc: porTitulo.get((r.titulo || "").trim().toLowerCase()),
      })));
      setEquipos(eqRes.items || []);
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, [contrato.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Recarga cuando termina la revisión IA de una subida hecha desde este tab.
  const analizandoPrevio = React.useRef<string | null>(null);
  useEffect(() => {
    if (analizandoPrevio.current && !analizandoId) cargar();
    analizandoPrevio.current = analizandoId;
  }, [analizandoId, cargar]);

  // Alertas derivadas de reglas persistidas + flota real: se recalculan solas
  // al recargar, por eso persisten aunque nunca se guarden como filas.
  const alertas: AlertaTerreno[] = [];
  {
    const anioActual = new Date().getFullYear();
    const vistos = new Map<string, AlertaTerreno>();
    for (const r of reqs) {
      const max = maxAniosDe(r.titulo);
      if (max === null) continue;
      for (const s of equipos) {
        if (s.anio == null || s.estado === "baja") continue;
        const antiguedad = anioActual - s.anio;
        if (antiguedad > max) {
          const prev = vistos.get(s.id);
          if (!prev || max < prev.maxAnios) {
            vistos.set(s.id, {
              equipoId: s.id,
              equipoNombre: s.nombre || s.patente || "Equipo",
              patente: s.patente || "—",
              anio: s.anio,
              antiguedadAnios: antiguedad,
              maxAnios: max,
              fuente: r.titulo,
            });
          }
        }
      }
    }
    alertas.push(...Array.from(vistos.values()));
  }

  const conArchivo = reqs.filter((r) => (r.doc?.archivos_count || 0) > 0);

  const handleAgregar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTitulo.trim()) {
      toast.error("Ingresa el título del documento o regla");
      return;
    }
    setGuardando(true);
    try {
      await Api.contratos.crearRequisitos(
        contrato.id,
        { vinculo_tipo: "faena", ambito: nuevoAmbito, titulo: nuevoTitulo.trim(), obligatorio: true, origen: "custom" },
        { aplicar_retroactivo: true },
      );
      setNuevoTitulo("");
      setModalSubir(false);
      await cargar();
      toast.success("Documento de faena registrado");
    } catch (e) {
      toast.error(Api.mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const handleQuitar = async (r: ReqFaena) => {
    if (!confirm(`¿Quitar "${r.titulo}" de los documentos de faena?`)) return;
    try {
      await Api.contratos.eliminarRequisito(contrato.id, r.id);
      await cargar();
      toast.success("Documento removido");
    } catch (e) {
      toast.error(Api.mensajeError(e));
    }
  };

  const handleDescargar = async (docId: string, archivoId: string) => {
    try {
      const res = await Api.documentos.urlDescarga(docId, archivoId);
      window.open(res.download_url, "_blank");
    } catch (e) {
      toast.error(Api.mensajeError(e));
    }
  };

  const handleQuitarArchivo = async (docId: string, archivoId: string) => {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await Api.documentos.eliminarArchivo(docId, archivoId);
      await cargar();
      setDocVer(null);
    } catch (e) {
      toast.error(Api.mensajeError(e));
    }
  };

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 text-slate-800">
      {/* ── BARRA SUPERIOR CONTEXTUAL ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-[0.84rem] text-slate-600 max-w-3xl leading-relaxed m-0">
          Estándares, manuales y reglamentos de{" "}
          <span className="font-semibold text-slate-800">{mandanteNombre}</span>.
          Quedan disponibles para todo el contrato y sus reglas de terreno generan alertas sobre la flota.
        </p>

        <button
          onClick={() => setModalSubir(true)}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[0.8rem] rounded-[9px] shadow-sm transition-all"
        >
          <span className="text-[0.95rem] leading-none">+</span> Subir documento de faena
        </button>
      </div>

      {/* ── 3 CONTADORES (CARDS) ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-[14px] px-5 py-4 shadow-xs">
          <div className="flex items-center gap-2 text-[0.74rem] text-slate-500 font-medium mb-1">
            <span>Documentos de faena</span>
          </div>
          <div className="text-[1.85rem] font-bold text-slate-900 leading-none">
            {cargando ? "—" : reqs.length}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-[14px] px-5 py-4 shadow-xs">
          <div className="flex items-center gap-2 text-[0.74rem] text-slate-500 font-medium mb-1">
            <span>Con archivo subido</span>
          </div>
          <div className="text-[1.85rem] font-bold text-slate-900 leading-none">
            {cargando ? "—" : conArchivo.length}
          </div>
        </div>

        <div className="bg-white border border-red-300 rounded-[14px] px-5 py-4 shadow-xs">
          <div className="flex items-center gap-2 text-[0.74rem] text-slate-500 font-medium mb-1">
            <span>Alertas generadas</span>
          </div>
          <div className="text-[1.85rem] font-bold text-red-600 leading-none">
            {cargando ? "—" : alertas.length}
          </div>
        </div>
      </div>

      {/* ── CAJA DE ALERTAS POR REQUISITOS DE TERRENO ──────────────────────── */}
      {!cargando && alertas.length > 0 && (
        <div className="bg-[#FFF5F5] border border-[#FED7D7] rounded-[14px] p-5 shadow-xs">
          <div className="text-[0.68rem] font-black uppercase tracking-wider text-red-600 mb-3.5">
            ALERTAS POR REQUISITOS DE TERRENO
          </div>

          <div className="flex flex-col divide-y divide-red-200/70">
            {alertas.map((a) => (
              <div
                key={a.equipoId}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-red-500 mt-0.5 text-base select-none shrink-0">
                    ⊘
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.82rem] text-slate-800 leading-snug m-0">
                      <span className="font-bold text-slate-900">{a.equipoNombre}</span>{" "}
                      <span className="text-slate-500">({a.patente})</span> es del año{" "}
                      <span className="font-bold text-red-700">{a.anio}</span>: tiene{" "}
                      <span className="font-bold text-red-700">{a.antiguedadAnios} años</span> y supera la
                      antigüedad máxima de{" "}
                      <span className="font-bold text-red-700">{a.maxAnios} años</span>.
                    </p>
                    <p className="text-[0.72rem] text-slate-500 mt-1 m-0">
                      Fuente: {a.fuente}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (onVerEquipo) onVerEquipo(a.patente);
                    else setEquipoModal(a);
                  }}
                  className="shrink-0 self-end sm:self-center px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-blue-600 text-[0.74rem] font-semibold rounded-[7px] transition-colors shadow-2xs whitespace-nowrap"
                >
                  Ver equipo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TABLA DE DOCUMENTOS ────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-[14px] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-5">DOCUMENTO</th>
                <th className="py-3.5 px-4">ESTADO</th>
                <th className="py-3.5 px-4">VENCIMIENTO</th>
                <th className="py-3.5 px-4">ARCHIVOS</th>
                <th className="py-3.5 px-5 text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[0.82rem]">
              {cargando ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Cargando documentos de faena...</td></tr>
              ) : reqs.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Sin documentos de faena. Sube el primero con el botón superior.</td></tr>
              ) : (
                reqs.map((r) => {
                  const est = r.doc?.estado_calc || "falta";
                  const isSubiendo = subiendo?.docId === r.doc?.id;
                  const isAnalizando = analizandoId === r.doc?.id;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="py-4 px-5 align-middle">
                        <div className="font-semibold text-slate-900 leading-snug">{r.titulo}</div>
                        <div className="text-[0.72rem] text-slate-500 mt-0.5 capitalize">
                          {r.ambito}{r.obligatorio ? " · Obligatorio" : ""}
                        </div>
                        {(isSubiendo || isAnalizando) && (
                          <div className="text-[0.7rem] font-medium text-indigo-700 animate-pulse mt-1">
                            {isSubiendo ? `Subiendo… ${subiendo!.pct}%` : "🤖 Analizando con IA..."}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4 align-middle">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[0.7rem] font-semibold ${
                          est === "ok" ? "bg-emerald-100 text-emerald-700" :
                          est === "porvenc" ? "bg-amber-100 text-amber-700" :
                          est === "venc" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {est === "ok" ? "Vigente" : est === "porvenc" ? "Por vencer" : est === "venc" ? "Vencido" : "Pendiente"}
                        </span>
                      </td>
                      <td className="py-4 px-4 align-middle text-slate-600 font-normal">
                        {r.doc?.vence || "—"}
                      </td>
                      <td className="py-4 px-4 align-middle font-bold text-slate-800">
                        {r.doc?.archivos_count || 0}
                      </td>
                      <td className="py-4 px-5 align-middle text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.doc && (
                            <label className="px-3 py-1 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[0.72rem] font-semibold rounded-[6px] transition-colors cursor-pointer">
                              Subir
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) onSubir(r.doc!.id, e.target.files[0]);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                          <button
                            onClick={() => setDocVer(r)}
                            className="px-3 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[0.72rem] font-semibold rounded-[6px] transition-colors"
                          >
                            Ver
                          </button>
                          {r.editable && (
                            <button
                              onClick={() => handleQuitar(r)}
                              className="px-2.5 py-1 bg-red-50/80 hover:bg-red-100 border border-red-200 text-red-600 text-[0.72rem] font-semibold rounded-[6px] transition-colors"
                            >
                              Quitar
                            </button>
                          )}
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

      {/* ── REGLAS DE TERRENO ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-[14px] p-6 shadow-xs">
        <div className="text-[0.68rem] font-black uppercase tracking-wider text-slate-700 mb-1">
          REGLAS DE TERRENO
        </div>
        <p className="text-[0.75rem] text-slate-500 m-0 mb-4">
          Se guardan en el contrato: siguen aquí al recargar. Si una regla indica
          una antigüedad máxima en años, la flota que la supere genera alerta.
        </p>

        {cargando ? (
          <p className="text-sm text-slate-400">Cargando reglas...</p>
        ) : reqs.length === 0 ? (
          <p className="text-sm text-slate-400">Sin reglas. Agrega documentos o reglas con el botón superior.</p>
        ) : (
          <ul className="space-y-1.5 pl-3 m-0 list-none">
            {reqs.map((r) => (
              <li key={r.id} className="flex items-start gap-2.5 text-[0.79rem] text-slate-700 leading-snug group">
                <span className="text-slate-400 select-none mt-1 text-[0.65rem] shrink-0">•</span>
                <span className="flex-1">{r.titulo}</span>
                {r.editable && (
                  <button
                    onClick={() => handleQuitar(r)}
                    className="text-slate-300 hover:text-red-500 text-[0.7rem] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Quitar regla"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── MODAL VER DOCUMENTO ────────────────────────────────────────────── */}
      <Modal
        abierto={!!docVer}
        titulo={docVer?.titulo || "Detalle del Documento"}
        onCerrar={() => setDocVer(null)}
        ancho="max-w-2xl"
      >
        {docVer && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 capitalize">
                {docVer.ambito}
              </span>
              {docVer.obligatorio && (
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-600">
                  Obligatorio
                </span>
              )}
              <span className="text-xs text-slate-500 ml-auto">
                {docVer.doc ? `Estado: ${docVer.doc.estado_calc}` : "Sin documento asociado"}
              </span>
            </div>

            {(docVer.doc?.archivos || []).length === 0 ? (
              <p className="text-sm text-slate-500">
                Sin archivos subidos. Usa «Subir» en la tabla para agregar uno.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                {docVer.doc!.archivos!.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="flex-1 truncate font-medium">{a.filename}</span>
                    <button onClick={() => handleDescargar(docVer.doc!.id, a.id)} className="text-blue-700 font-semibold hover:underline">
                      Descargar
                    </button>
                    <button onClick={() => handleQuitarArchivo(docVer.doc!.id, a.id)} className="text-red-600 font-semibold hover:underline">
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDocVer(null)}
                className="btn-primary text-sm px-5 py-2"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL VER EQUIPO / ALERTA ──────────────────────────────────────── */}
      <Modal
        abierto={!!equipoModal}
        titulo={`Detalle de Alerta: ${equipoModal?.equipoNombre || ""}`}
        onCerrar={() => setEquipoModal(null)}
        ancho="max-w-lg"
      >
        {equipoModal && (
          <div className="space-y-4">
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-900 space-y-2">
              <div className="font-bold flex items-center gap-2 text-red-700">
                <span>⊘</span> Antigüedad máxima superada
              </div>
              <p className="text-xs text-red-800 leading-relaxed">
                El vehículo con patente <span className="font-bold">{equipoModal.patente}</span> fue
                fabricado en <span className="font-bold">{equipoModal.anio}</span> y tiene{" "}
                <span className="font-bold">{equipoModal.antiguedadAnios} años</span> de antigüedad.
                La regla de faena exige un límite de{" "}
                <span className="font-bold">{equipoModal.maxAnios} años</span>.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Patente:</span>
                <span className="font-bold text-slate-800">{equipoModal.patente}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Año de fabricación:</span>
                <span className="font-bold text-slate-800">{equipoModal.anio}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 shrink-0">Regla aplicable:</span>
                <span className="font-medium text-slate-700 text-right">{equipoModal.fuente}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEquipoModal(null)}
                className="btn-primary text-sm px-5 py-2"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL NUEVO DOCUMENTO DE FAENA ─────────────────────────────────── */}
      <Modal
        abierto={modalSubir}
        titulo={`Nuevo documento de faena — ${faenaNombre}`}
        onCerrar={() => {
          if (!guardando) setModalSubir(false);
        }}
        ancho="max-w-xl"
      >
        <form onSubmit={handleAgregar} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Nombre o Título del Documento *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Estándar de vehículos livianos y buses"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Ámbito
            </label>
            <select
              value={nuevoAmbito}
              onChange={(e) => setNuevoAmbito(e.target.value)}
              className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-600 bg-white"
            >
              <option value="empresa">Empresa</option>
              <option value="personal">Personal</option>
              <option value="equipo">Equipos</option>
            </select>
          </div>

          <p className="text-[0.75rem] text-slate-500 m-0">
            Se crea el requisito y su documento en estado pendiente; después usa
            «Subir» en la fila para cargar el archivo, que se revisa con IA.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={guardando}
              onClick={() => setModalSubir(false)}
              className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="btn-primary text-sm px-5 py-2"
            >
              {guardando ? "Guardando..." : "Crear documento"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
