"use client";

import React, { useState, useEffect, useCallback } from "react";
import * as Api from "@/lib/platform/cliente";
import { EventoCalendario } from "@/lib/platform/tipos";
import { Modal, Spinner } from "@/components/shared/ui";
import { toast } from "sonner";

interface AgendarExamenModalProps {
  sujeto: {
    id: string;
    nombre: string;
    rut?: string | null;
    email?: string | null;
    telefono?: string | null;
  };
  contratoId?: string | null;
  abierto: boolean;
  onCerrar: () => void;
  onSaved?: () => void;
}

const CENTROS_COMUNES = [
  "Mutual de Seguridad",
  "ACHS",
  "IST",
  "Centro Médico Faena",
  "Clínica Bupa",
  "Megasalud",
  "OTEC Capacitación Minera",
];

export function AgendarExamenModal({
  sujeto,
  contratoId,
  abierto,
  onCerrar,
  onSaved,
}: AgendarExamenModalProps) {
  const [cargandoActivo, setCargandoActivo] = useState(false);
  const [eventoActivo, setEventoActivo] = useState<EventoCalendario | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Formulario
  const [tipo, setTipo] = useState<"administrativo" | "capacitacion">("administrativo");
  const [titulo, setTitulo] = useState("Examen Ocupacional y Altura Física");
  const [fecha, setFecha] = useState(() => {
    const d = new Date(Date.now() + 7 * 864e5);
    return d.toISOString().split("T")[0];
  });
  const [hora, setHora] = useState("09:00");
  const [centroAtencion, setCentroAtencion] = useState(CENTROS_COMUNES[0]);
  const [descripcion, setDescripcion] = useState(
    "Presentarse en ayunas de 8 horas, bien hidratado y con cédula de identidad vigente."
  );
  const [enviarNotificacion, setEnviarNotificacion] = useState(true);

  // Cargar evento activo si existe
  const consultarActivo = useCallback(async () => {
    if (!sujeto?.id) return;
    setCargandoActivo(true);
    try {
      const res = await Api.calendario.activoDeSujeto(sujeto.id);
      if (res?.activo) {
        setEventoActivo(res.activo);
        // Precargar formulario con datos del evento activo
        setTitulo(res.activo.titulo);
        if (res.activo.categoria === "capacitacion" || res.activo.categoria === "administrativo") {
          setTipo(res.activo.categoria);
        }
        if (res.activo.fecha) {
          const partes = res.activo.fecha.split("T");
          setFecha(partes[0] || "");
          if (partes[1]) {
            setHora(partes[1].slice(0, 5));
          }
        }
        if (res.activo.centro_atencion) {
          setCentroAtencion(res.activo.centro_atencion);
        }
        if (res.activo.descripcion) {
          setDescripcion(res.activo.descripcion);
        }
        if (typeof res.activo.enviar_notificacion === "boolean") {
          setEnviarNotificacion(res.activo.enviar_notificacion);
        }
      } else {
        setEventoActivo(null);
      }
    } catch {
      setEventoActivo(null);
    } finally {
      setCargandoActivo(false);
    }
  }, [sujeto?.id]);

  useEffect(() => {
    if (abierto) {
      consultarActivo();
    } else {
      setEventoActivo(null);
    }
  }, [abierto, consultarActivo]);

  // Ajustar sugerencias de texto al cambiar de tipo
  const handleCambioTipo = (nuevoTipo: "administrativo" | "capacitacion") => {
    setTipo(nuevoTipo);
    if (!eventoActivo) {
      if (nuevoTipo === "capacitacion") {
        setTitulo("Curso Inducción Faena y Manejo Defensivo");
        setDescripcion("Presentarse 15 minutos antes con cédula de identidad y zapatos de seguridad.");
      } else {
        setTitulo("Examen Ocupacional y Altura Física");
        setDescripcion("Presentarse en ayunas de 8 horas, bien hidratado y con cédula de identidad vigente.");
      }
    }
  };

  const handleMarcarCompletado = async () => {
    if (!eventoActivo?.id) return;
    setGuardando(true);
    try {
      await Api.calendario.editar(eventoActivo.id, { completado: true });
      toast.success("✓ Agendamiento marcado como completado");
      setEventoActivo(null);
      onSaved?.();
      onCerrar();
    } catch (e: any) {
      toast.error(e.message || "Error al completar evento");
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    if (!eventoActivo?.id) return;
    if (!confirm("¿Seguro que deseas cancelar y eliminar este agendamiento?")) return;
    setGuardando(true);
    try {
      await Api.calendario.eliminar(eventoActivo.id);
      toast.success("Agendamiento cancelado correctamente");
      setEventoActivo(null);
      onSaved?.();
      onCerrar();
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar agendamiento");
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Indica el título del curso o examen");
      return;
    }
    if (!fecha) {
      toast.error("Selecciona una fecha válida");
      return;
    }

    setGuardando(true);
    try {
      const fechaIso = hora ? `${fecha}T${hora}:00` : fecha;

      if (eventoActivo?.id) {
        // Actualizar agendamiento existente
        await Api.calendario.editar(eventoActivo.id, {
          titulo: titulo.trim(),
          fecha: fechaIso,
          categoria: tipo,
          descripcion: descripcion.trim() || null,
          centro_atencion: centroAtencion.trim() || null,
          enviar_notificacion: enviarNotificacion,
        });
        toast.success(`✓ Agendamiento actualizado para ${sujeto.nombre}`);
      } else {
        // Crear nuevo agendamiento
        await Api.calendario.crear({
          titulo: titulo.trim(),
          fecha: fechaIso,
          categoria: tipo,
          descripcion: descripcion.trim() || null,
          sujeto_id: sujeto.id,
          contrato_id: contratoId || null,
          centro_atencion: centroAtencion.trim() || null,
          enviar_notificacion: enviarNotificacion,
        });
        toast.success(
          enviarNotificacion
            ? `✓ Agendado para ${fecha} · Citación y recordatorio programados`
            : `✓ Agendado para ${fecha}`
        );
      }

      onSaved?.();
      onCerrar();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el agendamiento");
    } finally {
      setGuardando(false);
    }
  };

  const primerNombre = sujeto.nombre?.split(" ")[0] || "Trabajador";

  return (
    <Modal
      abierto={abierto}
      titulo={
        <div className="flex items-center gap-2 text-slate-800">
          <span className="text-xl">📅</span>
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">
              Agendar examen médico o capacitación
            </h3>
            <p className="text-xs text-slate-500 font-normal m-0">
              {sujeto.nombre} {sujeto.rut ? `(${sujeto.rut})` : ""}
            </p>
          </div>
        </div>
      }
      onCerrar={onCerrar}
      ancho="max-w-2xl"
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* Banner de agendamiento activo */}
        {cargandoActivo ? (
          <div className="p-4 bg-slate-50 rounded-lg flex items-center justify-center">
            <Spinner texto="Consultando agendamientos activos..." />
          </div>
        ) : eventoActivo ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="text-lg">📌</span>
              <div>
                <div className="font-bold text-amber-900 text-sm">
                  Agendamiento activo vigente
                </div>
                <div className="text-amber-800 mt-0.5">
                  <b>{eventoActivo.titulo}</b> · {eventoActivo.fecha?.replace("T", " a las ")}
                  {eventoActivo.centro_atencion ? ` · ${eventoActivo.centro_atencion}` : ""}
                </div>
                <div className="text-[11px] text-amber-700 mt-1">
                  Puedes editar los datos abajo, marcarlo completado o cancelarlo.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={handleMarcarCompletado}
                disabled={guardando}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-sm transition-colors"
                title="Marcar como realizado"
              >
                ✓ Completado
              </button>
              <button
                type="button"
                onClick={handleEliminar}
                disabled={guardando}
                className="px-2.5 py-1 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded text-xs font-semibold transition-colors"
                title="Cancelar agendamiento"
              >
                ✕ Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleGuardar} className="flex flex-col gap-3.5">
          {/* Selector de Tipo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tipo de agendamiento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCambioTipo("administrativo")}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                  tipo === "administrativo"
                    ? "border-blue-600 bg-blue-50/50 text-blue-900 font-bold shadow-xs ring-1 ring-blue-600"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="text-base">🩺</span>
                <div>
                  <div className="text-xs">Examen Ocupacional</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    Salud, Altura, Batería Minera
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleCambioTipo("capacitacion")}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                  tipo === "capacitacion"
                    ? "border-blue-600 bg-blue-50/50 text-blue-900 font-bold shadow-xs ring-1 ring-blue-600"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="text-base">🎓</span>
                <div>
                  <div className="text-xs">Curso / Inducción</div>
                  <div className="text-[10px] text-slate-400 font-normal">
                    Inducción faena, Manejo defensivo
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nombre del examen o curso *
            </label>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Ej: Examen de Altura Física, Inducción Faena"
            />
          </div>

          {/* Fecha y Hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha de citación *
              </label>
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hora de citación
              </label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Centro de Atención */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Centro de atención o lugar
            </label>
            <input
              list="centros-comunes"
              value={centroAtencion}
              onChange={(e) => setCentroAtencion(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Ej: Mutual de Seguridad, ACHS, IST, Faena..."
            />
            <datalist id="centros-comunes">
              {CENTROS_COMUNES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* Indicaciones */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Indicaciones para el trabajador (opcional)
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              placeholder="Ej: Presentarse en ayunas, llevar cédula de identidad..."
            />
          </div>

          {/* Checkbox Notificación */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={enviarNotificacion}
                onChange={(e) => setEnviarNotificacion(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold text-slate-800 text-xs">
                  Enviar citación y recordatorio automático al trabajador
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5 mb-0">
                  Notifica al trabajador por correo/WhatsApp con los detalles del agendamiento y envía recordatorio previo.
                </p>
              </div>
            </label>
          </div>

          {/* Burbuja Preview estilo WhatsApp */}
          {enviarNotificacion && (
            <div>
              <div className="text-[11px] font-bold text-slate-500 mb-1">
                Vista previa del mensaje que recibirá el trabajador:
              </div>
              <div className="bg-[#EFEAE2] p-3 rounded-lg border border-[#E0D8CC]">
                <div className="bg-white rounded-lg p-2.5 shadow-xs max-w-sm text-slate-800 text-[11px] leading-relaxed border-l-4 border-emerald-500">
                  <p className="m-0 font-medium">
                    Hola <b>{primerNombre}</b> 👋, te recordamos que tienes agendado tu{" "}
                    <b>{tipo === "capacitacion" ? "curso" : "examen"} "{titulo}"</b> el día{" "}
                    <b>{fecha}</b> a las <b>{hora}</b>
                    {centroAtencion ? ` en ${centroAtencion}` : ""}.
                  </p>
                  {descripcion && (
                    <p className="m-0 mt-1 text-slate-600 italic">
                      Indicaciones: {descripcion}
                    </p>
                  )}
                  <p className="m-0 mt-1 text-[10px] text-slate-400 text-right">
                    ACREDITTIA · Notificaciones
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Guardando...
                </>
              ) : eventoActivo ? (
                "Guardar cambios en agendamiento"
              ) : (
                "📅 Agendar y citar trabajador"
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
