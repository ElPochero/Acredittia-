"use client";
import React, { useState, useEffect, useRef } from "react";
import * as Api from "@/lib/cliente";
import { Contrato, Sujeto } from "@/lib/tipos";
import { Spinner } from "@/components/ui";
import { numeroContrato } from "./ContratoLayout";

interface TabChatContratoProps {
  contrato: Contrato;
}

type Msg = { r: "user" | "bot"; t: string; date?: string; card?: Card; pendiente?: boolean; hecho?: "ok" | "no" };
type Card = { agregados?: Record<string, string[]>; eliminados?: Record<string, string[]> };

const AMBITOS = ["empresa", "personal", "equipos", "licencia"] as const;
const AMBITO_API: Record<string, string> = { empresa: "empresa", personal: "personal", equipos: "equipo", licencia: "emsipor" };
const AMBITO_LBL: Record<string, string> = { empresa: "empresa", personal: "trabajadores", equipos: "equipos", licencia: "licencia interna" };

const norm = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const hayContenido = (card?: Card) =>
  !!card && (AMBITOS.some((k) => (card.agregados?.[k] || []).length > 0) || AMBITOS.some((k) => (card.eliminados?.[k] || []).length > 0));

const SUGS_BASE = [
  "¿Cómo va el contrato?",
  "¿Qué vence en los próximos 30 días?",
  "Muéstrame las alertas",
  "Agrega el requisito Examen de Altura Física para trabajadores",
  "Elimina el requisito Finiquito Anterior",
  "Lista los requisitos del contrato",
];

function EstadoFila({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div className="flex justify-between text-[0.78rem] py-0.5">
      <span className="text-slate-500">{label}</span>
      <b style={{ color }}>{n}</b>
    </div>
  );
}

export function TabChatContrato({ contrato }: TabChatContratoProps) {
  const [chatMsgs, setChatMsgs] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [personal, setPersonal] = useState<Sujeto[]>([]);
  const [equipos, setEquipos] = useState<Sujeto[]>([]);
  const [nCriticas, setNCriticas] = useState(0);
  const [nOtras, setNOtras] = useState(0);
  const [segundos, setSegundos] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const contexto = `contrato_${contrato.id}`;

  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const hist = await Api.ia.historial(contexto);
        const mapped = hist.flatMap((h: any) => [
          { r: 'user' as const, t: h.mensaje_usuario, date: h.created_at },
          { r: 'bot' as const, t: typeof h.respuesta_ia === 'string' ? h.respuesta_ia : h.respuesta_ia.respuesta || JSON.stringify(h.respuesta_ia), date: h.created_at }
        ]);
        setChatMsgs(mapped);
      } catch (e) {
        console.error("No se pudo cargar el historial", e);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [contexto]);

  useEffect(() => {
    Api.contratos.personal(contrato.id, { page_size: 100 }).then((r) => setPersonal(r.items || [])).catch(() => {});
    Api.contratos.equipos(contrato.id, { page_size: 100 }).then((r) => setEquipos(r.items || [])).catch(() => {});
    Api.contratos.alertas(contrato.id, { page_size: 50, solo_activas: true })
      .then((r) => {
        const items = r.items || [];
        setNCriticas(items.filter((a) => a.severidad === "critica").length);
        setNOtras(items.filter((a) => a.severidad !== "critica").length);
      })
      .catch(() => {});
  }, [contrato.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs, isBusy]);

  useEffect(() => {
    if (!isBusy) {
      setSegundos(0);
      return;
    }
    const t0 = Date.now();
    const t = setInterval(() => setSegundos(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [isBusy]);

  const sugs = [...SUGS_BASE, personal[0] ? `¿Qué le falta a ${personal[0].nombre}?` : "¿Qué documentos faltan?"];

  const sendMsg = async (texto?: string) => {
    const msg = (texto ?? chatInput).trim();
    if (!msg || isBusy) return;
    setChatInput("");
    setChatMsgs((prev) => [...prev, { r: "user", t: msg }]);
    setIsBusy(true);

    try {
      const recentHistory = [...chatMsgs.slice(-10), { r: "user" as const, t: msg }].map((m) => ({
        role: m.r === "user" ? "user" : "assistant",
        content: m.t,
      }));

      const res = await Api.ia.chat({
        contexto: contexto,
        mensaje: msg,
        historial: recentHistory,
      });

      const card: Card | undefined = res.agregados || res.eliminados
        ? { agregados: res.agregados, eliminados: res.eliminados }
        : undefined;
      const conPropuesta = hayContenido(card);
      setChatMsgs((prev) => [
        ...prev,
        { r: "bot", t: res.respuesta || "Requisitos detectados y/o consulta respondida.", card, pendiente: conPropuesta },
      ]);
    } catch (error) {
      setChatMsgs((prev) => [...prev, { r: "bot", t: "Ocurrió un error al contactar al asistente." }]);
    } finally {
      setIsBusy(false);
    }
  };

  const cuenta = (l: Sujeto[], estados: string[]) => l.filter((s) => estados.includes(s.estado)).length;
  const num = numeroContrato(contrato);
  const saludo =
    `Hola, soy el asistente del contrato <b>${num}${num !== contrato.nombre ? ` · ${contrato.nombre}` : ""}</b> ` +
    `(${contrato.faena?.nombre}). Puedo responderte sobre el estado del contrato, vencimientos y alertas, ` +
    `y también <b>agregar o eliminar requisitos</b>. ¿Qué necesitas?`;

  const aplicar = async (idx: number) => {
    const msg = chatMsgs[idx];
    if (!msg?.card || !msg.pendiente) return;
    setChatMsgs((prev) => prev.map((m, i) => (i === idx ? { ...m, pendiente: false, hecho: "ok" as const } : m)));
    const partes: string[] = [];
    try {
      const nuevos: { ambito: string; titulo: string; obligatorio: boolean; origen: string }[] = [];
      for (const k of AMBITOS) {
        for (const t of msg.card.agregados?.[k] || []) {
          nuevos.push({ ambito: AMBITO_API[k], titulo: t, obligatorio: true, origen: "custom" });
        }
      }
      if (nuevos.length) {
        await Api.contratos.crearRequisitos(contrato.id, nuevos, { bulk: true });
        partes.push(`Agregué ${nuevos.length} requisito${nuevos.length === 1 ? "" : "s"}.`);
      }
      const porEliminar: string[] = [];
      for (const k of AMBITOS) {
        for (const t of msg.card.eliminados?.[k] || []) porEliminar.push(t);
      }
      if (porEliminar.length) {
        const actuales = await Api.contratos.requisitos(contrato.id, { page_size: 100 });
        let borrados = 0;
        let base = 0;
        for (const t of porEliminar) {
          const hit = (actuales.items || []).find((r: any) => norm(r.titulo) === norm(t));
          if (hit && (hit as any).id) {
            await Api.contratos.eliminarRequisito(contrato.id, (hit as any).id);
            borrados++;
          } else {
            base++;
          }
        }
        if (borrados) partes.push(`Eliminé ${borrados} requisito${borrados === 1 ? "" : "s"}.`);
        if (base) partes.push(`${base} no se ${base === 1 ? "pudo" : "pudieron"} eliminar porque ${base === 1 ? "es" : "son"} requisito${base === 1 ? "" : "s"} base del catálogo.`);
      }
      setChatMsgs((prev) => [...prev, { r: "bot", t: partes.join(" ") || "Listo." }]);
    } catch (e) {
      setChatMsgs((prev) => [...prev, { r: "bot", t: `No pude aplicar el cambio: ${Api.mensajeError(e)}` }]);
    }
  };

  const descartar = (idx: number) => {
    setChatMsgs((prev) => prev.map((m, i) => (i === idx ? { ...m, pendiente: false, hecho: "no" as const } : m)));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <div className="flex-1 min-w-0 w-full flex flex-col h-[600px] border border-slate-200 rounded-[16px] bg-white overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#3D62F5] to-[#6B8FFF] text-white flex items-center justify-center font-extrabold" aria-hidden="true">A</div>
          <div className="leading-tight">
            <b className="text-[0.86rem] text-[#0F172A]">Chat del contrato</b>
            <div className="text-[0.72rem] text-slate-500">Pregunta por el estado, vencimientos y alertas, o pide cambios en los requisitos</div>
          </div>
        </div>

        <div className="flex-1 p-3.5 overflow-y-auto bg-[#FCFDFF] flex flex-col gap-2.5">
          {loadingHistory ? (
            <div className="flex justify-center items-center h-full">
              <Spinner />
            </div>
          ) : (
            <>
              {chatMsgs.length === 0 && (
                <div className="flex justify-start">
                  <div
                    className="max-w-[88%] text-[0.82rem] leading-relaxed rounded-[14px] rounded-bl-[4px] px-3 py-2.5 bg-white text-[#1E293B] border border-slate-200"
                    dangerouslySetInnerHTML={{ __html: saludo }}
                  />
                </div>
              )}
              {chatMsgs.map((m, i) => (
                <div key={i} className={`flex ${m.r === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] text-[0.82rem] leading-relaxed rounded-[14px] px-3 py-2.5 ${m.r === "user" ? "bg-[#3D62F5] text-white rounded-br-[4px]" : "bg-white text-[#1E293B] border border-slate-200 rounded-bl-[4px]"}`}>
                    {m.t}
                    {m.r === "bot" && m.card && hayContenido(m.card) && (
                      <div>
                        <div className="gap-1.5 mt-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                          {AMBITOS.map((k) => {
                            const n = (m.card!.agregados?.[k] || []).length + (m.card!.eliminados?.[k] || []).length;
                            return (
                              <div key={k} className="bg-indigo-50 rounded-lg px-2 py-1.5 text-center">
                                <b className="block text-[1.05rem] text-blue-900 leading-none">{n}</b>
                                <span className="text-[0.66rem] text-slate-600">{AMBITO_LBL[k]}</span>
                              </div>
                            );
                          })}
                        </div>
                        {m.pendiente ? (
                          <div className="flex gap-1.5 mt-2.5">
                            <button onClick={() => aplicar(i)} className="px-3 py-1.5 text-[0.78rem] bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">Confirmar</button>
                            <button onClick={() => descartar(i)} className="px-3 py-1.5 text-[0.78rem] border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
                          </div>
                        ) : (
                          <div className={`mt-2.5 text-[0.78rem] font-bold ${m.hecho === "ok" ? "text-emerald-700" : "text-slate-400"}`}>
                            {m.hecho === "ok" ? "Cambio aplicado al contrato" : "Cancelado"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isBusy && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 px-3 py-2.5 rounded-[14px] rounded-bl-[4px] text-slate-500 text-[0.82rem] flex items-center gap-2">
                    <span className="flex gap-1" aria-hidden="true">
                      <i className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></i>
                      <i className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></i>
                      <i className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></i>
                    </span>
                    Consultando a la IA… {segundos > 3 ? `${segundos}s (puede tardar ~1 min)` : ""}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {sugs.map((t) => (
            <button
              key={t}
              disabled={isBusy}
              onClick={() => sendMsg(t)}
              className="text-[0.72rem] bg-[#EEF2FF] text-[#1E40AF] px-2.5 py-1 rounded-[20px] hover:bg-blue-100 transition-colors disabled:opacity-60"
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-2.5">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMsg(); } }}
            placeholder="Escribe una pregunta o una instrucción para este contrato…"
            className="flex-1 px-3 py-[9px] border border-slate-200 rounded-[10px] text-[0.84rem] outline-none focus:border-blue-500"
            disabled={isBusy || loadingHistory}
          />
          <button
            className="px-[14px] py-[8px] bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
            onClick={() => sendMsg()}
            disabled={!chatInput.trim() || isBusy || loadingHistory}
          >
            Enviar
          </button>
        </div>
      </div>

      <aside className="w-full lg:w-[260px] flex-shrink-0 flex flex-col gap-3" aria-label="Resumen del contrato">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-500 mb-1">Contrato</div>
          <div className="font-extrabold text-[#0F172A]">{numeroContrato(contrato)}</div>
          <div className="text-[0.76rem] text-slate-500">{contrato.faena?.nombre} · {contrato.faena?.mandante}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-500 mb-1">Trabajadores ({personal.length})</div>
          <EstadoFila label="Acreditados" n={cuenta(personal, ["ok"])} color="#16a34a" />
          <EstadoFila label="En proceso" n={cuenta(personal, ["proc"])} color="#d97706" />
          <EstadoFila label="Vencidos" n={cuenta(personal, ["venc"])} color="#dc2626" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-500 mb-1">Equipos ({equipos.length})</div>
          <EstadoFila label="Acreditados" n={cuenta(equipos, ["ok"])} color="#16a34a" />
          <EstadoFila label="En proceso" n={cuenta(equipos, ["proc"])} color="#d97706" />
          <EstadoFila label="Vencidos" n={cuenta(equipos, ["venc"])} color="#dc2626" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="text-[0.7rem] font-bold uppercase tracking-wider text-slate-500 mb-1">Alertas</div>
          <EstadoFila label="Críticas" n={nCriticas} color="#b91c1c" />
          <EstadoFila label="Otras activas" n={nOtras} color="#b45309" />
        </div>
      </aside>
    </div>
  );
}
