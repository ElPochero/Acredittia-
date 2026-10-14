"use client";
import React, { useEffect, useState } from "react";
import { Modal, Spinner } from "@/components/ui";
import { toast } from "sonner";
import * as Api from "@/lib/cliente";
import type { Alerta, Contrato } from "@/lib/tipos";
import { numeroContrato } from "./ContratoLayout";

interface CorreosContratoModalProps {
  abierto: boolean;
  onCerrar: () => void;
  contrato: Contrato | null;
}

type Plantilla = "resumen" | "porvencer" | "observado" | "semanal" | "invitacion";

const PLANTILLAS: { k: Plantilla; t: string; icono: string }[] = [
  { k: "resumen", t: "Resumen mensual de vencimientos", icono: "📅" },
  { k: "porvencer", t: "Alerta: documento por vencer", icono: "⏰" },
  { k: "observado", t: "Documento observado por la IA", icono: "⚠️" },
  { k: "semanal", t: "Estado semanal del contrato", icono: "📊" },
  { k: "invitacion", t: "Invitación a un contrato", icono: "👥" },
];

export function CorreosContratoModal({ abierto, onCerrar, contrato }: CorreosContratoModalProps) {
  const [sel, setSel] = useState<Plantilla>("resumen");
  const [para, setPara] = useState("");
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || !contrato) return;
    setAviso(null);
    setCargando(true);
    Api.contratos
      .alertas(contrato.id, { page_size: 5 })
      .then((res) => setAlertas(res.items || []))
      .catch(() => setAlertas([]))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, contrato?.id]);

  if (!contrato) return null;

  const stats = contrato.stats;
  const pct = stats?.cumplimiento_pct ?? 0;
  const nAlertas = stats?.alertas_activas ?? 0;
  const primera = alertas[0];

  const asunto: Record<Plantilla, string> = {
    resumen: `ACREDITTIA · Resumen mensual: ${nAlertas} vencimientos`,
    porvencer: primera ? `⏰ ${primera.titulo} — ${contrato.nombre}` : "Alerta de vencimiento",
    observado: "⚠️ La IA observó un documento: requiere corrección",
    semanal: `📊 Estado semanal — ${contrato.nombre}`,
    invitacion: `Te dieron acceso al contrato ${contrato.nombre} en ACREDITTIA`,
  };

  const preview: Record<Plantilla, React.ReactNode> = {
    resumen: (
      <>
        <p className="m-0 mb-3 text-[0.9rem] leading-relaxed text-slate-700">
          Este es el resumen de documentos <b>vencidos y por vencer en los próximos 30 días</b> del contrato{" "}
          <b>{contrato.nombre}</b> ({contrato.faena?.nombre}).
        </p>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {alertas.length === 0 && (
            <p className="m-0 p-4 text-[0.85rem] text-slate-500">Sin vencimientos activos en este contrato. 👍</p>
          )}
          {alertas.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 last:border-b-0">
              <div className="min-w-0">
                <div className="text-[0.85rem] font-bold text-slate-800 truncate">{a.titulo}</div>
                <div className="text-[0.75rem] text-slate-500 truncate">{a.descripcion}</div>
              </div>
              <span className="text-[0.7rem] font-bold text-amber-700 whitespace-nowrap">{a.severidad}</span>
            </div>
          ))}
        </div>
      </>
    ),
    porvencer: (
      <>
        <p className="m-0 mb-3 text-[0.9rem] leading-relaxed text-slate-700">
          La IA de ACREDITTIA detectó un documento que vence pronto en el contrato <b>{contrato.nombre}</b>.
        </p>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="text-[0.72rem] font-bold uppercase tracking-wider text-amber-700">Por vencer</div>
          <div className="text-[1.05rem] font-black text-slate-900 mt-1">{primera?.titulo ?? "Sin alertas activas"}</div>
          <div className="text-[0.8rem] text-slate-600 mt-0.5">{primera?.descripcion ?? ""}</div>
        </div>
        <p className="mt-3 mb-0 text-[0.85rem] text-slate-600">
          Qué hacer: pide el documento renovado, súbelo en ACREDITTIA y expórtalo a la plataforma del mandante antes del vencimiento.
        </p>
      </>
    ),
    observado: (
      <>
        <p className="m-0 mb-3 text-[0.9rem] leading-relaxed text-slate-700">
          Al revisar un documento recién subido al contrato <b>{contrato.nombre}</b>, la IA encontró problemas que harían que la
          plataforma del mandante lo rechace.
        </p>
        <div className="rounded-xl border border-red-300 overflow-hidden">
          <div className="bg-red-50 px-4 py-3">
            <div className="text-[0.9rem] font-black text-slate-900">Documento observado por Vigía IA</div>
            <div className="text-[0.75rem] text-slate-500">Revisa el detalle en la pestaña Alertas IA del contrato</div>
          </div>
          <div className="px-4 py-3 text-[0.85rem] text-red-700">● El archivo no cumple el estándar del mandante: requiere corrección.</div>
        </div>
      </>
    ),
    semanal: (
      <>
        <p className="m-0 mb-3 text-[0.9rem] leading-relaxed text-slate-700">
          {contrato.faena?.nombre} · {contrato.faena?.mandante}
        </p>
        <div className="rounded-xl bg-slate-900 text-white p-4">
          <div className="text-[0.72rem] text-slate-400">Cumplimiento documental</div>
          <div className="text-[2rem] font-black leading-tight">{pct}%</div>
          <div className="h-2 bg-slate-700 rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2.5 text-center" style={{ display: "grid" }}>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
            <div className="text-[1.1rem] font-black text-slate-800">{stats?.personal?.acreditados ?? 0}/{stats?.personal?.total ?? 0}</div>
            <div className="text-[0.68rem] text-slate-500">Personal</div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
            <div className="text-[1.1rem] font-black text-slate-800">{stats?.equipos?.acreditados ?? 0}/{stats?.equipos?.total ?? 0}</div>
            <div className="text-[0.68rem] text-slate-500">Equipos</div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
            <div className="text-[1.1rem] font-black text-slate-800">{nAlertas}</div>
            <div className="text-[0.68rem] text-slate-500">Alertas</div>
          </div>
        </div>
      </>
    ),
    invitacion: (
      <>
        <p className="m-0 mb-3 text-[0.9rem] leading-relaxed text-slate-700">
          Te invitaron a colaborar en ACREDITTIA en el contrato <b>{contrato.nombre}</b> ({contrato.faena?.nombre}).
        </p>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-[0.85rem] text-slate-700 leading-loose">
          Permiso: <b>Colaborador del contrato</b> <span className="text-slate-500">— puede ver este contrato</span>
          <br />
          Contrato: <b>{numeroContrato(contrato)}</b>
        </div>
        <p className="mt-3 mb-0 text-[0.85rem] text-slate-600">Gestiona quién tiene acceso desde el botón Compartir del contrato.</p>
      </>
    ),
  };

  const enviar = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para.trim())) {
      setAviso("Ingresa un correo válido.");
      return;
    }
    setEnviando(true);
    setAviso(null);
    try {
      const res = await Api.contratos.enviarMail(contrato.id, { plantilla: sel, para: para.trim() });
      toast.success("Correo enviado", {
        description: `${res.enviados} destinatario(s) · ${res.asunto}`,
      });
      setPara("");
    } catch (e) {
      const msg = Api.mensajeError(e);
      setAviso(msg);
      toast.error("No se pudo enviar", { description: msg });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Correos de notificación" ancho="max-w-[860px]">
      <div className="flex flex-col md:flex-row gap-4 min-h-[380px]">
        <div className="md:w-[240px] flex-shrink-0 flex flex-col gap-1">
          {PLANTILLAS.map((p) => (
            <button
              key={p.k}
              onClick={() => {
                setSel(p.k);
                setAviso(null);
              }}
              aria-pressed={sel === p.k}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[0.85rem] font-semibold transition-colors ${
                sel === p.k ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span aria-hidden="true">{p.icono}</span> {p.t}
            </button>
          ))}
          <p className="mt-2 text-[0.75rem] leading-relaxed text-slate-500">
            Así llegan los avisos de ACREDITTIA al correo de cada responsable: vencimientos, observaciones de la IA, estado semanal e invitaciones.
          </p>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[0.8rem] text-slate-600 flex flex-col gap-0.5 mb-3">
            <div><b className="text-slate-800">De:</b> ACREDITTIA &lt;notificaciones@acredittia.cl&gt;</div>
            <div><b className="text-slate-800">Para:</b> {para || "—"}</div>
            <div className="truncate"><b className="text-slate-800">Asunto:</b> {asunto[sel]}</div>
          </div>

          <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 overflow-y-auto">
            {cargando ? <Spinner texto="Cargando datos del contrato..." /> : preview[sel]}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <input
              value={para}
              onChange={(e) => setPara(e.target.value)}
              type="email"
              placeholder="correo@empresa.cl"
              aria-label="Correo destinatario"
              className="flex-1 min-w-[180px] h-10 px-3 border border-slate-300 rounded-lg text-[0.85rem] outline-none focus:border-blue-500"
            />
            <button
              onClick={enviar}
              disabled={enviando}
              className="h-10 px-4 rounded-lg border border-slate-300 bg-white text-[0.82rem] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {enviando ? "Enviando..." : "Enviar este correo"}
            </button>
            <button
              onClick={onCerrar}
              aria-label="Cerrar"
              className="h-10 w-10 grid place-items-center rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
            >
              ✕
            </button>
          </div>
          {aviso && (
            <div role="status" className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[0.82rem] text-amber-800">
              {aviso}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
