"use client";
import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import type { Contrato } from "@/lib/tipos";

/**
 * Pestaña «Agentes»: historial de interacciones del chatbot con el contrato y
 * avisos que el canal de WhatsApp dejó registrados.
 *
 * No hay una tabla de conversaciones de WhatsApp: lo que la plataforma guarda
 * son las conversaciones del asistente (`chat_historial` del contrato) y las
 * alertas del contrato marcadas como provenientes del canal.
 */
interface TabAgentesProps {
  contrato: Contrato;
}

type Conversacion = {
  id: string;
  mensaje_usuario: string;
  respuesta_ia: string;
  created_at: string | null;
};

type Aviso = {
  id: string;
  titulo: string;
  descripcion: string | null;
  severidad: string;
  estado: string;
  created_at: string | null;
};

type Respuesta = {
  conversaciones: Conversacion[];
  avisos_whatsapp: Aviso[];
  totales: { conversaciones: number; avisos_whatsapp: number };
};

const SEV: Record<string, string> = {
  critica: "bg-red-100 text-red-700",
  alta: "bg-orange-100 text-orange-700",
  media: "bg-amber-100 text-amber-700",
  baja: "bg-sky-100 text-sky-700",
  advertencia: "bg-amber-100 text-amber-700",
  informativa: "bg-slate-100 text-slate-600",
};

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-CL");
}

/** La respuesta de la IA se guarda como texto; a veces viene serializada. */
function textoRespuesta(v: string): string {
  try {
    const obj = JSON.parse(v);
    if (obj && typeof obj === "object") {
      const r = (obj as Record<string, unknown>).respuesta;
      if (typeof r === "string") return r;
    }
  } catch {
    // No es JSON: es texto plano.
  }
  return v;
}

export function TabAgentesContrato({ contrato }: TabAgentesProps) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    Api.contratos.agentes(contrato.id)
      .then((r) => {
        if (!vivo) return;
        setDatos({
          conversaciones: r.conversaciones || [],
          avisos_whatsapp: r.avisos_whatsapp || [],
          totales: r.totales || { conversaciones: 0, avisos_whatsapp: 0 },
        });
        setError("");
      })
      .catch((e) => {
        if (vivo) setError(Api.mensajeError(e));
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [contrato.id]);

  const conversaciones = datos?.conversaciones || [];
  const avisos = datos?.avisos_whatsapp || [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[#1E293B] text-[0.95rem] font-bold m-0">Agentes del contrato</h3>
        <p className="text-[0.78rem] text-slate-500 mt-0.5 mb-0">
          Conversaciones del asistente con el contrato y avisos enviados por el canal de WhatsApp.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 border border-red-200">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-500 mb-1">Conversaciones</div>
          <div className="text-2xl font-black text-[#0F172A]">{cargando ? "…" : conversaciones.length}</div>
          <div className="text-[0.72rem] text-slate-500">interacciones del chatbot</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-500 mb-1">Avisos WhatsApp</div>
          <div className="text-2xl font-black text-[#0F172A]">{cargando ? "…" : avisos.length}</div>
          <div className="text-[0.72rem] text-slate-500">notificaciones del canal</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[12px] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <b className="text-[0.85rem] text-slate-800">Historial de conversaciones</b>
        </div>
        {cargando ? (
          <p className="p-8 text-center text-slate-400 text-[0.85rem]">Cargando interacciones...</p>
        ) : conversaciones.length === 0 ? (
          <p className="p-8 text-center text-slate-500 text-[0.85rem]">
            Todavía no hay conversaciones con el asistente de este contrato.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {conversaciones.map((c) => (
              <li key={c.id} className="p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-400">
                    {fmtFecha(c.created_at)}
                  </span>
                </div>
                <div className="rounded-lg bg-blue-50/70 border border-blue-100 px-3 py-2 text-[0.82rem] text-slate-800 mb-2">
                  <b className="text-blue-700">Trabajador:</b> {c.mensaje_usuario}
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[0.82rem] text-slate-700">
                  <b className="text-slate-600">Agente:</b> {textoRespuesta(c.respuesta_ia)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-[12px] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <b className="text-[0.85rem] text-slate-800">Avisos por WhatsApp</b>
        </div>
        {cargando ? (
          <p className="p-8 text-center text-slate-400 text-[0.85rem]">Cargando avisos...</p>
        ) : avisos.length === 0 ? (
          <p className="p-8 text-center text-slate-500 text-[0.85rem]">
            El canal de WhatsApp no ha dejado avisos en este contrato.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {avisos.map((a) => (
              <li key={a.id} className="px-4 py-3 flex items-start gap-3 flex-wrap">
                <span className={`inline-flex items-center h-5 px-2 rounded-full text-[0.62rem] font-bold uppercase tracking-wider ${SEV[a.severidad] ?? "bg-slate-100 text-slate-600"}`}>
                  {a.severidad}
                </span>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-[0.85rem] font-bold text-slate-800">{a.titulo}</div>
                  {a.descripcion && <div className="text-[0.8rem] text-slate-500">{a.descripcion}</div>}
                </div>
                <span className="text-[0.72rem] text-slate-400">{fmtFecha(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
