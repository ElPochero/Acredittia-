"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as Api from "@/lib/platform/cliente";
import type {
  Contrato,
  AlertasIaDetalle,
  AreaResponsable,
  EncargadoArea,
  GrupoRequisito,
  RequisitoConfigArea,
  ProximoEnvio,
  AlertasIaPayload,
} from "@/lib/platform/tipos";
import { toast } from "sonner";

interface TabAlertasIAContratoProps {
  contrato: Contrato;
  onContratoActualizado?: (c: Contrato) => void;
  onVerCorreos?: () => void;
  alertasActivasNode?: React.ReactNode;
}

const NT_COLORS = [
  ["#0f766e", "#ccfbf1"],
  ["#be185d", "#fce7f3"],
  ["#4338ca", "#e0e7ff"],
  ["#a16207", "#fef9c3"],
];

const BASE_AREA_IDS = new Set(["seg", "cap", "rrhh", "flota", "prev", "acr"]);

const TIPO_ICON: Record<string, string> = {
  falta: "📋",
  venc: "⛔",
  porv: "⏰",
  prog: "🗓",
};

function fmtFechaAviso(iso: string): string {
  try {
    const f = new Date(iso);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diffDias = Math.round((f.getTime() - hoy.getTime()) / 864e5);
    if (diffDias <= 0) return "Hoy";
    if (diffDias === 1) return "Mañana";
    return f.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

export default function TabAlertasIAContrato({
  contrato,
  onContratoActualizado,
  onVerCorreos,
  alertasActivasNode,
}: TabAlertasIAContratoProps) {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reglas de tiempo (Req 5)
  const [anticipacion, setAnticipacion] = useState<number>(30);
  const [faltantes, setFaltantes] = useState<number>(5);

  // Canales
  const [mail, setMail] = useState<boolean>(true);
  const [wa, setWa] = useState<boolean>(false);
  const [ccAcreditaciones, setCcAcreditaciones] = useState<boolean>(true);

  // Áreas y asignaciones (Req 6)
  const [areas, setAreas] = useState<AreaResponsable[]>([]);
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});
  const [grupos, setGrupos] = useState<GrupoRequisito[]>([]);
  const [requisitos, setRequisitos] = useState<RequisitoConfigArea[]>([]);
  const [proximosEnvios, setProximosEnvios] = useState<ProximoEnvio[]>([]);

  // UI state
  const [openGrupos, setOpenGrupos] = useState<Record<string, boolean>>({});
  const [editAreaId, setEditAreaId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState<string>("");
  const [nuevoEmail, setNuevoEmail] = useState<string>("");

  // Snapshot inicial para detección de cambios
  const [snapshot, setSnapshot] = useState<string>("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await Api.contratos.alertasIa(contrato.id);
      setAnticipacion(data.anticipacion_dias ?? 30);
      setFaltantes(data.faltantes_dias ?? 5);
      setMail(data.mail ?? true);
      setWa(data.wa ?? false);
      setCcAcreditaciones(data.cc_acreditaciones ?? true);
      setAreas(data.areas || []);
      setAsignaciones(data.asignaciones || {});
      setGrupos(data.grupos || []);
      setRequisitos(data.requisitos || []);
      setProximosEnvios(data.proximos_envios || []);

      const snap = JSON.stringify({
        anticipacion: data.anticipacion_dias ?? 30,
        faltantes: data.faltantes_dias ?? 5,
        mail: data.mail ?? true,
        wa: data.wa ?? false,
        cc_acreditaciones: data.cc_acreditaciones ?? true,
        areas: data.areas || [],
        asignaciones: data.asignaciones || {},
      });
      setSnapshot(snap);
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, [contrato.id]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const esValida = anticipacion >= 1 && anticipacion <= 180 && faltantes >= 1 && faltantes <= 60;

  const sinGuardar = useMemo(() => {
    if (!snapshot) return false;
    const current = JSON.stringify({
      anticipacion,
      faltantes,
      mail,
      wa,
      cc_acreditaciones: ccAcreditaciones,
      areas,
      asignaciones,
    });
    return current !== snapshot;
  }, [snapshot, anticipacion, faltantes, mail, wa, ccAcreditaciones, areas, asignaciones]);

  // Mapa de áreas por ID para búsqueda rápida
  const areasMap = useMemo(() => {
    const map = new Map<string, AreaResponsable>();
    for (const a of areas) {
      map.set(a.id, a);
    }
    return map;
  }, [areas]);

  // Guardar configuración completa (Req 5 + Req 6)
  const guardar = async () => {
    if (!esValida) {
      toast.error("Parámetros inválidos", {
        description: "Anticipación debe estar entre 1 y 180 días. Faltantes entre 1 y 60 días.",
      });
      return;
    }
    setGuardando(true);
    try {
      const payload: AlertasIaPayload = {
        anticipacion_dias: anticipacion,
        faltantes_dias: faltantes,
        mail,
        wa,
        cc_acreditaciones: ccAcreditaciones,
        areas,
        asignaciones,
      };

      const res = await Api.contratos.guardarAlertasIaDetalle(contrato.id, payload);

      // Sincronizar en paralelo con endpoint legacy para compatibilidad del modelo
      await Api.contratos.guardarAlertasIa(contrato.id, {
        alerta_anticipacion_dias: anticipacion,
        alerta_frecuencia_dias: 1,
        alerta_faltantes_dias: faltantes,
      }).catch(() => {
        /* ya sincronizado en backend */
      });

      setAnticipacion(res.anticipacion_dias);
      setFaltantes(res.faltantes_dias);
      setMail(res.mail);
      setWa(res.wa);
      setCcAcreditaciones(res.cc_acreditaciones);
      setAreas(res.areas);
      setAsignaciones(res.asignaciones);
      setGrupos(res.grupos);
      setRequisitos(res.requisitos);
      setProximosEnvios(res.proximos_envios);

      setSnapshot(
        JSON.stringify({
          anticipacion: res.anticipacion_dias,
          faltantes: res.faltantes_dias,
          mail: res.mail,
          wa: res.wa,
          cc_acreditaciones: res.cc_acreditaciones,
          areas: res.areas,
          asignaciones: res.asignaciones,
        })
      );

      if (onContratoActualizado) {
        onContratoActualizado({
          ...contrato,
          alerta_anticipacion_dias: res.anticipacion_dias,
          alerta_faltantes_dias: res.faltantes_dias,
        });
      }

      toast.success("Configuración de alertas IA guardada");
    } catch (e) {
      toast.error("Error al guardar configuración", {
        description: Api.mensajeError(e),
      });
    } finally {
      setGuardando(false);
    }
  };

  // Disparo manual segmentado por área
  const probarEnvio = async () => {
    setEnviando(true);
    try {
      const res = await Api.contratos.enviarAlertasIaSegmentadas(contrato.id);
      const totalAreas = res.envios_por_area?.length ?? 0;
      toast.success("Alertas segmentadas enviadas", {
        description: `${res.total_alertas} alertas procesadas hacia ${totalAreas} área(s) responsable(s).`,
      });
    } catch (e) {
      toast.error("No se pudieron enviar las alertas", {
        description: Api.mensajeError(e),
      });
    } finally {
      setEnviando(false);
    }
  };

  // Handlers para Áreas
  const agregarArea = () => {
    const id = "a" + Date.now().toString(36);
    const col = NT_COLORS[areas.length % NT_COLORS.length];
    const nueva: AreaResponsable = {
      id,
      nombre: "Nueva área",
      color: col[0],
      bg: col[1],
      encargados: [],
    };
    setAreas([...areas, nueva]);
    setEditAreaId(id);
    setNuevoNombre("");
    setNuevoEmail("");
  };

  const eliminarArea = (aid: string) => {
    setAreas(areas.filter((a) => a.id !== aid));
    // Limpiar asignaciones que apuntaban a este área
    const nextAsig = { ...asignaciones };
    for (const [k, v] of Object.entries(nextAsig)) {
      if (v === aid) delete nextAsig[k];
    }
    setAsignaciones(nextAsig);
    if (editAreaId === aid) setEditAreaId(null);
  };

  const renombrarArea = (aid: string, n: string) => {
    setAreas(areas.map((a) => (a.id === aid ? { ...a, nombre: n.trim() || a.nombre } : a)));
  };

  const agregarEncargado = (aid: string) => {
    const nom = nuevoNombre.trim();
    const em = nuevoEmail.trim();
    if (!nom || !em.includes("@")) {
      toast.error("Ingresa nombre y correo válido");
      return;
    }
    setAreas(
      areas.map((a) => {
        if (a.id !== aid) return a;
        return {
          ...a,
          encargados: [...a.encargados, { nombre: nom, email: em }],
        };
      })
    );
    setNuevoNombre("");
    setNuevoEmail("");
    const area = areasMap.get(aid);
    toast.success(`${nom} agregado a ${area?.nombre || "área"}`);
  };

  const eliminarEncargado = (aid: string, idx: number) => {
    setAreas(
      areas.map((a) => {
        if (a.id !== aid) return a;
        const next = [...a.encargados];
        next.splice(idx, 1);
        return { ...a, encargados: next };
      })
    );
  };

  // Reasignación masiva de grupo
  const asignarGrupoArea = (gid: string, aid: string) => {
    const next = { ...asignaciones };
    next[gid] = aid;
    // Reasignar todos los requisitos pertenecientes a este grupo
    const reqsDelGrupo = requisitos.filter((r) => r.grupo_id === gid);
    for (const r of reqsDelGrupo) {
      next[r.titulo] = aid;
    }
    setAsignaciones(next);
    const gObj = grupos.find((g) => g.id === gid);
    const aObj = areasMap.get(aid);
    toast.success(`${gObj?.nombre || gid} → ${aObj?.nombre || aid}`);
  };

  // Reasignación individual de requisito
  const asignarRequisitoArea = (titulo: string, aid: string) => {
    setAsignaciones({
      ...asignaciones,
      [titulo]: aid,
    });
    const aObj = areasMap.get(aid);
    toast.success(`${titulo} → ${aObj?.nombre || aid}`);
  };

  // Cálculo de conteos por área
  const conteoReqPorArea = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of requisitos) {
      const aid = asignaciones[r.titulo] || asignaciones[r.grupo_id] || "acr";
      map[aid] = (map[aid] || 0) + 1;
    }
    return map;
  }, [requisitos, asignaciones]);

  const conteoAvisosPorArea = useMemo(() => {
    const map: Record<string, number> = {};
    for (const q of proximosEnvios) {
      map[q.area_id] = (map[q.area_id] || 0) + 1;
    }
    return map;
  }, [proximosEnvios]);

  if (cargando) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Cargando configuración de alertas IA…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
        <p className="font-bold">Error al cargar Alertas IA</p>
        <p>{error}</p>
        <button
          onClick={cargarDatos}
          className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Panel Principal NT (Reglas, Áreas, Asignaciones, Envíos) */}
      <div className="nt-panel rounded-2xl border border-[#dbe4f3] bg-white p-5 md:p-6 shadow-sm">
        {/* Cabecera y Canales */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="m-0 text-[1.05rem] font-bold text-[#0F172A] flex items-center gap-2">
              ⚙ Configuración de notificaciones
            </h3>
            <p className="m-0 mt-1 text-[0.8rem] text-slate-500 max-w-2xl leading-relaxed">
              Define con qué anticipación avisa la IA y a qué área del contrato le llega cada requisito.
              Solo los encargados de esa área reciben sus avisos.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2.5">
            <div className="nt-chs flex flex-wrap items-center gap-3.5 text-[0.8rem] text-[#334155]">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={mail}
                  onChange={(e) => setMail(e.target.checked)}
                  className="rounded text-[#1d4ed8] focus:ring-[#1d4ed8]"
                />
                ✉ Correo
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={wa}
                  onChange={(e) => setWa(e.target.checked)}
                  className="rounded text-[#1d4ed8] focus:ring-[#1d4ed8]"
                />
                WhatsApp
              </label>
              <label
                title="Acreditaciones recibe copia de todos los avisos"
                className="flex items-center gap-1.5 cursor-pointer font-medium"
              >
                <input
                  type="checkbox"
                  checked={ccAcreditaciones}
                  onChange={(e) => setCcAcreditaciones(e.target.checked)}
                  className="rounded text-[#1d4ed8] focus:ring-[#1d4ed8]"
                />
                Copia a Acreditaciones
              </label>
            </div>

            <div className="flex items-center gap-2">
              {sinGuardar && (
                <span role="status" className="text-[0.74rem] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Cambios sin guardar
                </span>
              )}
              <button
                onClick={guardar}
                disabled={guardando || !sinGuardar || !esValida}
                className="h-8 px-4 rounded-lg bg-[#1E40AF] text-[0.78rem] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors shadow-sm"
              >
                {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>

        {/* Tarea 2 [Req 5]: Reglas de Tiempo (Aviso previo y Recordatorio faltantes) */}
        <div className="nt-rules grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
          {/* Tarjeta 1: Aviso de vencimiento */}
          <div className="nt-rule bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5">
            <div className="nt-rl font-bold text-[0.88rem] text-[#0F172A] flex items-center gap-1.5">
              <span>⏰</span> Aviso de vencimiento
            </div>
            <div className="sub text-[0.74rem] text-slate-500 mt-0.5 mb-2.5 leading-snug">
              Se avisa al área responsable cuando un documento entra en este plazo antes de vencer, y se repite hasta que se renueve.
            </div>
            <div className="nt-step flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAnticipacion((prev) => Math.max(1, prev - 1))}
                className="w-8 h-8 rounded-lg border border-[#cbd5e1] bg-white text-base font-bold text-[#1E293B] hover:bg-slate-50 transition-colors"
                aria-label="Disminuir anticipación"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={180}
                aria-label="Días de anticipación"
                value={anticipacion}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setAnticipacion(Math.max(1, Math.min(180, val)));
                }}
                className="w-16 h-8 text-center font-extrabold text-[0.95rem] border border-[#cbd5e1] rounded-lg text-[#1d4ed8] focus:border-[#1d4ed8] focus:outline-none"
              />
              <span className="text-[0.82rem] font-medium text-[#475569] mr-1">días</span>
              <button
                type="button"
                onClick={() => setAnticipacion((prev) => Math.min(180, prev + 1))}
                className="w-8 h-8 rounded-lg border border-[#cbd5e1] bg-white text-base font-bold text-[#1E293B] hover:bg-slate-50 transition-colors"
                aria-label="Aumentar anticipación"
              >
                +
              </button>
            </div>
            <div className="nt-pres flex gap-1.5 mt-2.5 flex-wrap">
              {[15, 30, 45, 60].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setAnticipacion(v)}
                  className={`text-[0.72rem] font-medium px-2.5 py-0.5 rounded-full border transition-all ${
                    anticipacion === v
                      ? "bg-[#1d4ed8] text-white border-[#1d4ed8] shadow-sm"
                      : "bg-white text-[#475569] border-[#cbd5e1] hover:border-slate-400"
                  }`}
                >
                  {v} días
                </button>
              ))}
            </div>
          </div>

          {/* Tarjeta 2: Recordatorio de documentos faltantes */}
          <div className="nt-rule bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3.5">
            <div className="nt-rl font-bold text-[0.88rem] text-[#0F172A] flex items-center gap-1.5">
              <span>📋</span> Recordatorio de documentos faltantes
            </div>
            <div className="sub text-[0.74rem] text-slate-500 mt-0.5 mb-2.5 leading-snug">
              Mientras un requisito siga sin documento, se le recuerda al área responsable con esta frecuencia.
            </div>
            <div className="nt-step flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFaltantes((prev) => Math.max(1, prev - 1))}
                className="w-8 h-8 rounded-lg border border-[#cbd5e1] bg-white text-base font-bold text-[#1E293B] hover:bg-slate-50 transition-colors"
                aria-label="Disminuir frecuencia faltantes"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={60}
                aria-label="Frecuencia recordatorio faltantes"
                value={faltantes}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  setFaltantes(Math.max(1, Math.min(60, val)));
                }}
                className="w-16 h-8 text-center font-extrabold text-[0.95rem] border border-[#cbd5e1] rounded-lg text-[#1d4ed8] focus:border-[#1d4ed8] focus:outline-none"
              />
              <span className="text-[0.82rem] font-medium text-[#475569] mr-1">días</span>
              <button
                type="button"
                onClick={() => setFaltantes((prev) => Math.min(60, prev + 1))}
                className="w-8 h-8 rounded-lg border border-[#cbd5e1] bg-white text-base font-bold text-[#1E293B] hover:bg-slate-50 transition-colors"
                aria-label="Aumentar frecuencia faltantes"
              >
                +
              </button>
            </div>
            <div className="nt-pres flex gap-1.5 mt-2.5 flex-wrap">
              {[3, 5, 7, 15].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setFaltantes(v)}
                  className={`text-[0.72rem] font-medium px-2.5 py-0.5 rounded-full border transition-all ${
                    faltantes === v
                      ? "bg-[#1d4ed8] text-white border-[#1d4ed8] shadow-sm"
                      : "bg-white text-[#475569] border-[#cbd5e1] hover:border-slate-400"
                  }`}
                >
                  Cada {v} días
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tarea 3 [Req 6]: Áreas del contrato y sus encargados */}
        <div className="mt-6">
          <div className="ia-sec flex items-center justify-between mb-3">
            <h4 className="m-0 text-[0.9rem] font-bold text-[#0F172A]">
              Áreas del contrato y sus encargados
            </h4>
            <button
              type="button"
              onClick={agregarArea}
              className="text-[0.76rem] font-bold text-[#1d4ed8] hover:text-[#1e40af] hover:underline"
            >
              + Nueva área
            </button>
          </div>

          <div className="nt-areas grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {areas.map((a) => {
              const aColor = a.color || a.c || "#1d4ed8";
              const aBg = a.bg || "#dbeafe";
              const nReq = conteoReqPorArea[a.id] || 0;
              const nQ = conteoAvisosPorArea[a.id] || 0;
              const isEd = editAreaId === a.id;
              const isCustom = !BASE_AREA_IDS.has(a.id);

              return (
                <div
                  key={a.id}
                  className="nt-area bg-white border border-[#e2e8f0] rounded-xl p-3 flex flex-col justify-between shadow-xs transition-shadow"
                  style={{ borderTop: `3px solid ${aColor}` }}
                >
                  <div>
                    <div className="flex justify-between items-center gap-1.5 mb-2">
                      {isEd ? (
                        <input
                          type="text"
                          value={a.nombre}
                          onChange={(e) => renombrarArea(a.id, e.target.value)}
                          className="nt-in border border-[#cbd5e1] rounded-lg px-2 py-1 text-[0.78rem] w-full font-bold"
                          placeholder="Nombre del área"
                        />
                      ) : (
                        <b style={{ color: aColor }} className="text-[0.84rem] font-bold truncate">
                          {a.nombre}
                        </b>
                      )}
                      <span className="sub text-[0.7rem] text-slate-500 whitespace-nowrap ml-1 font-medium">
                        {nReq} requisito{nReq === 1 ? "" : "s"}
                      </span>
                    </div>

                    {/* Lista de encargados */}
                    <div className="nt-encs flex flex-col gap-1.5 mt-2">
                      {a.encargados.length > 0 ? (
                        a.encargados.map((e, idx) => {
                          const initials = e.nombre
                            .split(" ")
                            .map((x) => x[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase();

                          return (
                            <div key={idx} className="nt-enc flex items-center gap-2">
                              <span
                                className="nt-av w-7 h-7 rounded-full flex items-center justify-center text-[0.68rem] font-extrabold flex-shrink-0"
                                style={{ background: aBg, color: aColor }}
                              >
                                {initials}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-[0.78rem] font-semibold text-slate-800 truncate">
                                  {e.nombre}
                                </div>
                                <div className="sub text-[0.7rem] text-slate-500 truncate">
                                  {e.email}
                                </div>
                              </div>
                              {isEd && (
                                <button
                                  type="button"
                                  onClick={() => eliminarEncargado(a.id, idx)}
                                  className="nt-x text-[#94a3b8] hover:text-red-600 text-xs px-1"
                                  title="Quitar encargado"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="sub text-[0.74rem] text-red-700 bg-red-50 p-2 rounded-lg leading-tight font-medium">
                          Sin encargados: las notificaciones irán a Acreditaciones
                        </div>
                      )}
                    </div>

                    {/* Formulario de agregar encargado en modo edición */}
                    {isEd && (
                      <div className="nt-add flex flex-col gap-1.5 mt-3 pt-2 border-t border-slate-100">
                        <input
                          type="text"
                          value={nuevoNombre}
                          onChange={(e) => setNuevoNombre(e.target.value)}
                          placeholder="Nombre del encargado"
                          className="nt-in border border-[#cbd5e1] rounded-lg px-2 py-1 text-[0.78rem] w-full"
                        />
                        <input
                          type="email"
                          value={nuevoEmail}
                          onChange={(e) => setNuevoEmail(e.target.value)}
                          placeholder="correo@empresa.cl"
                          className="nt-in border border-[#cbd5e1] rounded-lg px-2 py-1 text-[0.78rem] w-full"
                        />
                        <button
                          type="button"
                          onClick={() => agregarEncargado(a.id)}
                          className="h-7 rounded-lg border border-[#cbd5e1] bg-white text-[0.74rem] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          + Agregar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Footer de tarjeta */}
                  <div className="nt-ft flex justify-between items-center mt-3 pt-2 border-t border-[#f1f5f9] text-[0.72rem]">
                    {isEd ? (
                      <>
                        {isCustom ? (
                          <button
                            type="button"
                            onClick={() => eliminarArea(a.id)}
                            className="text-red-700 font-medium hover:underline"
                          >
                            Eliminar área
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditAreaId(null);
                            setNuevoNombre("");
                            setNuevoEmail("");
                          }}
                          className="text-[#1d4ed8] font-bold hover:underline"
                        >
                          Listo
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="sub text-slate-500">
                          {nQ} aviso{nQ === 1 ? "" : "s"} esta semana
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditAreaId(a.id);
                            setNuevoNombre("");
                            setNuevoEmail("");
                          }}
                          className="text-[#1d4ed8] font-semibold hover:underline"
                        >
                          Editar encargados
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tarea 3 [Req 6]: Área responsable de cada requisito */}
        <div className="mt-6">
          <div className="ia-sec mb-3">
            <h4 className="m-0 text-[0.9rem] font-bold text-[#0F172A]">
              Área responsable de cada requisito
            </h4>
          </div>

          <div className="nt-gs border border-[#e2e8f0] rounded-xl overflow-hidden divide-y divide-[#e2e8f0]">
            {grupos.map((g) => {
              const reqsDelGrupo = requisitos.filter((r) => r.grupo_id === g.id);
              if (reqsDelGrupo.length === 0) return null;

              const ga = asignaciones[g.id] || g.area_default;
              const isOpen = openGrupos[g.id] ?? false;

              // Contar cuántos requisitos del grupo tienen asignada un área diferente a la del grupo
              const diffCount = reqsDelGrupo.filter((r) => {
                const assigned = asignaciones[r.titulo];
                return assigned && assigned !== ga;
              }).length;

              return (
                <div key={g.id} className="nt-g bg-white">
                  {/* Encabezado colapsable del grupo */}
                  <div
                    onClick={() =>
                      setOpenGrupos((prev) => ({ ...prev, [g.id]: !isOpen }))
                    }
                    className="nt-gh flex items-center gap-2.5 p-3 hover:bg-slate-50 cursor-pointer select-none transition-colors"
                  >
                    <span className="nt-car text-slate-500 w-3 text-sm">
                      {isOpen ? "▾" : "▸"}
                    </span>
                    <b className="text-[0.84rem] text-slate-800">{g.nombre}</b>
                    <span className="sub text-[0.74rem] text-slate-500 font-normal">
                      {reqsDelGrupo.length} requisito{reqsDelGrupo.length === 1 ? "" : "s"}
                      {diffCount > 0 && ` · ${diffCount} con área distinta`}
                    </span>

                    <div
                      className="ml-auto flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[0.72rem] text-slate-500 font-medium">
                        Notificar a
                      </span>
                      <select
                        value={ga}
                        onChange={(e) => asignarGrupoArea(g.id, e.target.value)}
                        className="nt-sel border border-[#cbd5e1] rounded-lg px-2 py-1 text-[0.76rem] bg-white text-[#1E293B] font-semibold"
                      >
                        {areas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Detalle de requisitos individuales */}
                  {isOpen && (
                    <div className="nt-rows bg-[#f8fafc] px-4 py-2 pl-9 space-y-1">
                      {reqsDelGrupo.map((r, rIdx) => {
                        const rAreaId = asignaciones[r.titulo] || ga;
                        return (
                          <div
                            key={rIdx}
                            className="nt-r flex items-center justify-between gap-3 py-1.5 border-b border-dashed border-[#e2e8f0] last:border-b-0"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-[0.8rem] font-semibold text-slate-800 truncate">
                                {r.titulo}
                              </div>
                              <div className="sub text-[0.7rem] text-slate-500">
                                {r.origen}
                              </div>
                            </div>

                            <select
                              value={rAreaId}
                              onChange={(e) =>
                                asignarRequisitoArea(r.titulo, e.target.value)
                              }
                              className="nt-sel border border-[#cbd5e1] rounded-lg px-2 py-1 text-[0.76rem] bg-white text-[#1E293B]"
                            >
                              {areas.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tarea 3 [Req 6]: Próximos envíos y Disparo */}
        <div className="mt-6">
          <div className="ia-sec flex items-center justify-between mb-3">
            <h4 className="m-0 text-[0.9rem] font-bold text-[#0F172A] flex items-center gap-2">
              Próximos envíos
              <span className="sub text-[0.74rem] text-slate-500 font-normal">
                {proximosEnvios.length} aviso{proximosEnvios.length === 1 ? "" : "s"} programados
              </span>
            </h4>

            <button
              type="button"
              onClick={probarEnvio}
              disabled={enviando || proximosEnvios.length === 0}
              className="h-8 px-3 rounded-lg border border-[#cbd5e1] bg-white text-[0.78rem] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-xs"
            >
              {enviando ? "Enviando…" : "✉ Probar / Enviar alertas segmentadas"}
            </button>
          </div>

          {proximosEnvios.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[0.74rem] font-bold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Envío</th>
                    <th className="py-2.5 px-3">Requisito</th>
                    <th className="py-2.5 px-3">Le llega a</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[0.78rem]">
                  {proximosEnvios.slice(0, 10).map((q, idx) => {
                    const icon = TIPO_ICON[q.tipo] || "📌";
                    const areaObj = areasMap.get(q.area_id);
                    const areaColor = areaObj?.color || areaObj?.c || "#1d4ed8";
                    const areaBg = areaObj?.bg || "#dbeafe";
                    const areaNombre = q.area_nombre || areaObj?.nombre || "Área";
                    const encargadosList =
                      areaObj?.encargados && areaObj.encargados.length > 0
                        ? areaObj.encargados.map((e) => e.nombre.split(" ")[0]).join(", ")
                        : "Acreditaciones";

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-700">
                          {fmtFechaAviso(q.fecha_aviso)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span>{icon}</span> {q.titulo}
                          </div>
                          <div className="sub text-[0.72rem] text-slate-500">
                            {q.destinatario} · {q.detalle}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="nt-chip text-[0.7rem] font-bold px-2 py-0.5 rounded-full inline-block"
                            style={{ background: areaBg, color: areaColor }}
                          >
                            {areaNombre}
                          </span>
                          <div className="sub text-[0.7rem] text-slate-500 mt-0.5">
                            {encargadosList}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 bg-slate-50">
              No hay avisos programados. Cuando existan documentos faltantes o por vencer, aparecerán aquí.
            </div>
          )}
        </div>
      </div>

      {/* Alertas Activas del Contrato (Mantiene la UI existente para revisar alertas y ver correos) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <p className="m-0 text-[0.78rem] text-slate-500">
            Alertas activas del contrato con acciones directas.
          </p>
          {onVerCorreos && (
            <button
              type="button"
              onClick={onVerCorreos}
              className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-[0.78rem] font-bold text-slate-600 hover:bg-slate-50 shadow-xs"
            >
              ✉ Ver correos de notificación
            </button>
          )}
        </div>

        {alertasActivasNode}
      </div>
    </div>
  );
}
