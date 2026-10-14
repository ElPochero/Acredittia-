"use client";
import React, { useState, useEffect, useRef } from "react";
import { Modal, Spinner } from "@/components/ui";
import * as Api from "@/lib/cliente";
import type { Faena } from "@/lib/tipos";
import { useRouter } from "next/navigation";

interface NuevaModalContratoProps {
  abierto: boolean;
  onCerrar: () => void;
}

const EXTRA_PLATS = ["SIGA", "Workmate", "Webcontrol", "Metacontratas", "SUCAL", "DIRECTIC", "Otra plataforma"];

const SUGS = [
  "📷 Subir pantallazo de requisitos",
  "📊 Subir Excel de requisitos",
  "Agrega examen de altura para trabajadores",
  "Agrega curso de manejo en faena a licencia interna",
];

type Card = { empresa: string[]; personal: string[]; equipos: string[]; licencia: string[] };
type Msg = { r: "user" | "bot"; t: string; file?: string; card?: Card; fixed?: boolean };

const hoyIso = () => new Date().toISOString().slice(0, 10);

const unir = (prev: string[], nuevos: string[]) => {
  const vistos = new Set(prev.map((x) => x.toLowerCase().trim()));
  return [...prev, ...nuevos.filter((x) => x.trim() && !vistos.has(x.toLowerCase().trim()))];
};

export function NuevaModalContrato({ abierto, onCerrar }: NuevaModalContratoProps) {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [fechaInicio, setFechaInicio] = useState(hoyIso());
  const [fechaTermino, setFechaTermino] = useState("");
  const [sinVigencia, setSinVigencia] = useState(false);
  const [faenaId, setFaenaId] = useState("");
  const [faenasList, setFaenasList] = useState<Faena[]>([]);
  const [creando, setCreando] = useState(false);

  // Faena no integrada
  const [customFaenaNombre, setCustomFaenaNombre] = useState("");
  const [customFaenaMandante, setCustomFaenaMandante] = useState("");
  const [customPlats, setCustomPlats] = useState<string[]>([]);
  const [platToAdd, setPlatToAdd] = useState(EXTRA_PLATS[0]);
  const [integratedPlats, setIntegratedPlats] = useState<any[]>([]);

  // Requisitos
  const [reqsEmpresa, setReqsEmpresa] = useState<string[]>([]);
  const [reqsPersonal, setReqsPersonal] = useState<string[]>([]);
  const [reqsEquipos, setReqsEquipos] = useState<string[]>([]);
  const [reqsLicencia, setReqsLicencia] = useState<string[]>([]);

  // Asistente
  const [mode, setMode] = useState<"chat" | "man">("chat");
  const [chatMsgs, setChatMsgs] = useState<Msg[]>([
    { r: "bot", t: "¡Hola! Soy el asistente de ACREDITTIA. Súbeme pantallazos, un Excel o un PDF con los requisitos del contrato, o escríbemelos, y los dejo mapeados para empresa, trabajadores, equipos y licencia interna." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [pendiente, setPendiente] = useState<Card | null>(null);
  const [manInputs, setManInputs] = useState({ empresa: "", personal: "", equipo: "", licencia: "" });

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMsgs, isBusy]);

  useEffect(() => {
    if (!abierto) return;
    setFechaInicio(hoyIso());
    Api.faenas.listar({ page_size: 100 })
      .then((res) => {
        setFaenasList(res.items || []);
        setFaenaId(res.items?.length ? res.items[0].id : "");
      })
      .catch(console.error);
  }, [abierto]);

  useEffect(() => {
    if (faenaId && faenaId !== "__otra") {
      Api.faenas.plataformas(faenaId).then((res) => setIntegratedPlats(res.items || [])).catch(console.error);
    } else {
      setIntegratedPlats([]);
    }
  }, [faenaId]);

  const isCustom = faenaId === "__otra";

  const aplicarCard = (card: Card) => {
    setReqsEmpresa((p) => unir(p, card.empresa));
    setReqsPersonal((p) => unir(p, card.personal));
    setReqsEquipos((p) => unir(p, card.equipos));
    setReqsLicencia((p) => unir(p, card.licencia));
  };

  const fijarRequisitos = (irManual: boolean) => {
    if (!pendiente) return;
    aplicarCard(pendiente);
    setChatMsgs((prev) => prev.map((m) => (m.card ? { ...m, fixed: true } : m)));
    setPendiente(null);
    if (irManual) setMode("man");
  };

  const procesarRespuesta = (res: any) => {
    const card: Card | undefined = res?.agregados
      ? {
          empresa: res.agregados.empresa || [],
          personal: res.agregados.personal || [],
          equipos: res.agregados.equipos || [],
          licencia: res.agregados.licencia || [],
        }
      : undefined;

    setChatMsgs((prev) => [...prev, { r: "bot", t: res?.respuesta || "Requisitos detectados.", card }]);
    if (card) setPendiente(card);

    if (res?.eliminados) {
      const del = res.eliminados;
      if (del.empresa) setReqsEmpresa((p) => p.filter((x) => !del.empresa.includes(x)));
      if (del.personal) setReqsPersonal((p) => p.filter((x) => !del.personal.includes(x)));
      if (del.equipos) setReqsEquipos((p) => p.filter((x) => !del.equipos.includes(x)));
      if (del.licencia) setReqsLicencia((p) => p.filter((x) => !del.licencia.includes(x)));
    }
  };

  const historial = () => chatMsgs.map((m) => ({ role: m.r === "user" ? "user" : "assistant", content: m.t }));

  const enviar = async (texto: string) => {
    const t = texto.trim();
    if (!t || isBusy) return;
    setChatMsgs((prev) => [...prev, { r: "user", t }]);
    setChatInput("");
    setIsBusy(true);
    try {
      const res = await Api.ia.chat({ contexto: "contratos_modal", mensaje: t, historial: historial() });
      procesarRespuesta(res);
    } catch {
      setChatMsgs((prev) => [...prev, { r: "bot", t: "Ocurrió un error al contactar al asistente." }]);
    } finally {
      setIsBusy(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo es muy grande (máximo 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setChatMsgs((prev) => [...prev, { r: "user", t: "", file: file.name }]);
      setIsBusy(true);
      try {
        const res = await Api.ia.chat({
          contexto: "contratos_modal",
          mensaje: "Analiza el archivo adjunto y extrae los requisitos.",
          file_name: file.name,
          file_b64: reader.result as string,
          historial: historial(),
        });
        procesarRespuesta(res);
      } catch {
        setChatMsgs((prev) => [...prev, { r: "bot", t: "Ocurrió un error al analizar el archivo." }]);
      } finally {
        setIsBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCrear = async () => {
    if (!nombre.trim()) return alert("Ingresa el nombre del contrato");
    if (!faenaId) return alert("Selecciona una faena");
    if (isCustom && !customFaenaNombre.trim()) return alert("Ingresa el nombre de la faena");
    if (!sinVigencia && !fechaTermino) return alert("Indica la fecha de término del contrato o marca «sin vigencia»");
    if (!sinVigencia && fechaTermino < fechaInicio) return alert("La fecha de término debe ser posterior al inicio");

    setCreando(true);
    try {
      let finalFaenaId = faenaId;
      if (isCustom) {
        alert("Nota: para el prototipo se guardará en la primera faena integrada.");
        finalFaenaId = faenasList[0]?.id || "";
      }

      const c = await Api.contratos.crear({
        nombre: nombre.trim(),
        codigo: codigo.trim() || null,
        faena_id: finalFaenaId,
        fecha_inicio: fechaInicio || null,
        fecha_termino: sinVigencia ? null : fechaTermino || null,
        requisitos_custom: {
          empresa: reqsEmpresa,
          personal: reqsPersonal,
          equipos: reqsEquipos,
          licencia: reqsLicencia,
        },
      });
      onCerrar();
      router.push(`/contratos/${c.id}`);
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setCreando(false);
    }
  };

  const totalReqs = reqsEmpresa.length + reqsPersonal.length + reqsEquipos.length + reqsLicencia.length;

  if (!abierto) return null;

  const columnas = [
    { k: "empresa" as const, t: "🏢 Empresa", arr: reqsEmpresa, set: setReqsEmpresa },
    { k: "personal" as const, t: "👤 Trabajadores", arr: reqsPersonal, set: setReqsPersonal },
    { k: "equipo" as const, t: "🚛 Equipos", arr: reqsEquipos, set: setReqsEquipos },
    { k: "licencia" as const, t: "🪪 Licencia interna", arr: reqsLicencia, set: setReqsLicencia },
  ];

  const resumen = [
    { t: "Empresa", i: "🏢", n: reqsEmpresa.length },
    { t: "Trabajadores", i: "👤", n: reqsPersonal.length },
    { t: "Equipos", i: "🚛", n: reqsEquipos.length },
    { t: "Licencia", i: "🪪", n: reqsLicencia.length },
  ];

  return (
    <Modal
      abierto={abierto}
      titulo={
        <span className="flex items-center gap-2.5">
          <span className="w-9 h-9 bg-blue-100 rounded-[10px] grid place-items-center text-[1.1rem]" aria-hidden="true">📋</span>
          Crear nuevo contrato
        </span>
      }
      onCerrar={onCerrar}
      ancho="max-w-[1080px]"
    >
      <div className="text-[0.85rem] text-slate-500 mb-4">
        Define el contrato, elige la faena y fija sus requisitos: con el asistente ACREDITTIA (chat, pantallazos o Excel) o manualmente.
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* COLUMNA IZQUIERDA */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="gap-2.5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Nombre del contrato *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Transporte de personal MLP" className="w-full h-9 px-3 border border-slate-300 rounded-lg text-[0.85rem] focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Código / N° contrato</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: HUA-MLP-2026" className="w-full h-9 px-3 border border-slate-300 rounded-lg text-[0.85rem] focus:border-blue-500 outline-none" />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-3 bg-white">
            <label className="block text-[0.75rem] font-bold text-slate-700 mb-2">Vigencia del contrato *</label>
            <div className="gap-2.5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label className="block text-[0.72rem] text-slate-500 mb-1">Inicio</label>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full h-9 px-3 border border-slate-300 rounded-lg text-[0.82rem] focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-[0.72rem] text-slate-500 mb-1">Término</label>
                <input type="date" value={fechaTermino} disabled={sinVigencia} onChange={(e) => setFechaTermino(e.target.value)} className={`w-full h-9 px-3 border border-slate-300 rounded-lg text-[0.82rem] focus:border-blue-500 outline-none ${sinVigencia ? "opacity-45" : ""}`} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[0.8rem] text-slate-700 mt-2.5 font-medium cursor-pointer">
              <input type="checkbox" checked={sinVigencia} onChange={(e) => { setSinVigencia(e.target.checked); if (e.target.checked) setFechaTermino(""); }} className="w-auto" />
              Contrato sin fecha de término (sin vigencia)
            </label>
          </div>

          <div>
            <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Faena (mandante) *</label>
            <select value={faenaId} onChange={(e) => setFaenaId(e.target.value)} className="w-full h-9 px-3 border border-slate-300 rounded-lg text-[0.85rem] focus:border-blue-500 outline-none bg-white">
              {faenasList.map((f) => <option key={f.id} value={f.id}>{f.nombre} ({f.mandante})</option>)}
              <option value="__otra">➕ Otra faena (no integrada)</option>
            </select>
          </div>

          {isCustom && (
            <div className="gap-2.5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Nombre de la faena</label>
                <input value={customFaenaNombre} onChange={(e) => setCustomFaenaNombre(e.target.value)} placeholder="Ej: Planta Coronel" className="w-full h-9 px-3 border border-slate-300 rounded-lg text-[0.85rem] focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-[0.75rem] font-bold text-slate-700 mb-1">Mandante</label>
                <input value={customFaenaMandante} onChange={(e) => setCustomFaenaMandante(e.target.value)} placeholder="Ej: Empresa mandante" className="w-full h-9 px-3 border border-slate-300 rounded-lg text-[0.85rem] focus:border-blue-500 outline-none" />
              </div>
            </div>
          )}

          {/* PLATAFORMAS */}
          <div className="border border-slate-200 rounded-xl p-3 bg-white">
            <div className="flex justify-between items-center mb-1">
              <b className="text-[0.8rem] text-slate-800">🔌 Plataformas de la faena</b>
              <span className="text-[0.7rem] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                {isCustom ? customPlats.length : integratedPlats.length} plataforma{(isCustom ? customPlats.length : integratedPlats.length) === 1 ? "" : "s"}
              </span>
            </div>
            {!isCustom ? (
              <>
                <div className="text-[0.74rem] text-emerald-700 mb-2">✓ Esta es una faena integrada: sus plataformas y requisitos ya están mapeados.</div>
                <div className="flex flex-wrap gap-1.5">
                  {integratedPlats.map((p) => (
                    <span key={p.id} className="text-[0.7rem] bg-indigo-50 text-indigo-800 font-bold px-2 py-1 rounded-md uppercase border border-indigo-100">{p.nombre}</span>
                  ))}
                  {integratedPlats.length === 0 && <span className="text-[0.76rem] text-slate-400">Sin plataformas registradas.</span>}
                </div>
              </>
            ) : (
              <>
                <div className="text-[0.74rem] text-amber-700 mb-2">Esta faena no está integrada. Agrega las plataformas que usa el mandante (opcional).</div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {customPlats.map((p) => (
                    <span key={p} className="text-[0.7rem] bg-slate-100 text-slate-700 font-bold px-2 py-1 rounded-md uppercase border border-slate-200 flex items-center gap-1">
                      {p}
                      <button aria-label={`Quitar plataforma ${p}`} className="cursor-pointer text-slate-400 hover:text-red-500" onClick={() => setCustomPlats(customPlats.filter((x) => x !== p))}>✕</button>
                    </span>
                  ))}
                  {customPlats.length === 0 && <span className="text-[0.76rem] text-slate-400">Sin plataformas asignadas</span>}
                </div>
                <div className="flex gap-1.5">
                  <select value={platToAdd} onChange={(e) => setPlatToAdd(e.target.value)} className="flex-1 h-8 px-2 border border-slate-300 rounded text-[0.8rem] outline-none bg-white">
                    {EXTRA_PLATS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button onClick={() => { if (!customPlats.includes(platToAdd)) setCustomPlats([...customPlats, platToAdd]); }} className="h-8 px-3 text-[0.78rem] border border-slate-300 rounded hover:bg-slate-50 transition-colors font-medium whitespace-nowrap">+ Agregar</button>
                </div>
              </>
            )}
          </div>

          {/* RESUMEN DE REQUISITOS */}
          <div className={`border rounded-xl p-3 bg-white flex flex-col gap-2 ${totalReqs ? "border-emerald-300 bg-emerald-50/40" : isCustom ? "border-dashed border-slate-300" : "border-slate-200"}`}>
            <div className="flex justify-between items-center">
              <b className="text-[0.8rem] text-slate-800">
                {totalReqs ? "📌 Requisitos fijados" : isCustom ? "📋 Requisitos del contrato" : "📋 Requisitos de la faena"}
              </b>
              <span className={`text-[0.7rem] px-2 py-0.5 rounded-full font-bold ${totalReqs ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {totalReqs ? `${totalReqs} en total` : isCustom ? "0 mapeados" : "ya mapeados"}
              </span>
            </div>

            <div className="gap-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
              {resumen.map((r) => (
                <div key={r.t} className="bg-white border border-slate-200 rounded-lg p-2 flex flex-col items-center justify-center text-center">
                  <div className="text-[1.2rem] font-bold text-slate-800 leading-none mb-1">{r.n}</div>
                  <div className="text-[0.62rem] text-slate-500 font-bold uppercase tracking-wider leading-tight flex flex-col items-center gap-0.5">
                    <span className="text-[0.7rem]" aria-hidden="true">{r.i}</span> {r.t}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[0.72rem] text-slate-500">
              {totalReqs
                ? "Estos requisitos se fijarán al contrato al crearlo."
                : isCustom
                ? "Sube pantallazos o el Excel de requisitos al asistente, o agrégalos manualmente."
                : "Si el contrato pide algo adicional, cuéntaselo al asistente o agrégalo manualmente."}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="flex-1 min-w-0 flex flex-col h-[520px]">
          <div className="flex gap-1.5 mb-2" role="tablist" aria-label="Modo de carga de requisitos">
            <button role="tab" aria-selected={mode === "chat"} className={`flex-1 text-center p-2 rounded-[10px] border border-slate-200 text-[0.82rem] font-bold cursor-pointer ${mode === "chat" ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-slate-600 hover:bg-slate-50 transition-colors"}`} onClick={() => setMode("chat")}>🤖 Asistente ACREDITTIA</button>
            <button role="tab" aria-selected={mode === "man"} className={`flex-1 text-center p-2 rounded-[10px] border border-slate-200 text-[0.82rem] font-bold cursor-pointer ${mode === "man" ? "bg-[#0F172A] text-white border-[#0F172A]" : "bg-white text-slate-600 hover:bg-slate-50 transition-colors"}`} onClick={() => setMode("man")}>✍️ Manual</button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 border border-slate-200 rounded-[14px] bg-white overflow-hidden">
            {mode === "chat" && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-2.5 p-2.5 px-3.5 border-b border-slate-200 bg-slate-50">
                  <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#3D62F5] to-[#6B8FFF] text-white flex items-center justify-center font-extrabold" aria-hidden="true">A</div>
                  <div className="flex flex-col leading-tight">
                    <b className="text-[0.86rem] text-[#0F172A]">Asistente ACREDITTIA</b>
                    <span className="text-[0.72rem] text-slate-500">Lee pantallazos, Excel y PDF de requisitos</span>
                  </div>
                </div>

                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5 bg-[#FCFDFF]">
                  {chatMsgs.map((m, i) => (
                    <div key={i} className={`flex ${m.r === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] text-[0.82rem] leading-relaxed rounded-[14px] px-3 py-2.5 ${m.r === "user" ? "bg-[#3D62F5] text-white rounded-br-[4px]" : "bg-white text-[#1E293B] border border-slate-200 rounded-bl-[4px]"}`}>
                        {m.file && (
                          <div className="bg-white/20 rounded-lg px-2.5 py-1.5 font-semibold text-[0.78rem] mb-1">
                            {/\.(xlsx|xls|csv)$/i.test(m.file) ? "📊" : /\.pdf$/i.test(m.file) ? "📄" : "🖼️"} {m.file}
                          </div>
                        )}
                        {m.t}
                        {m.card && (
                          <div>
                            <div className="gap-1.5 mt-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                              {[
                                { n: m.card.empresa.length, t: "empresa" },
                                { n: m.card.personal.length, t: "trabajadores" },
                                { n: m.card.equipos.length, t: "equipos" },
                                { n: m.card.licencia.length, t: "licencia" },
                              ].map((c) => (
                                <div key={c.t} className="bg-indigo-50 rounded-lg px-2 py-1.5">
                                  <b className="block text-[1.05rem] text-blue-900 leading-none">{c.n}</b>
                                  <span className="text-[0.66rem] text-slate-600">{c.t}</span>
                                </div>
                              ))}
                            </div>
                            {m.fixed ? (
                              <div className="mt-2.5 text-[0.78rem] text-emerald-700 font-bold">📌 Requisitos fijados en el contrato</div>
                            ) : (
                              <div className="flex gap-1.5 mt-2.5">
                                <button onClick={() => fijarRequisitos(false)} className="px-3 py-1.5 text-[0.78rem] bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">📌 Fijar requisitos</button>
                                <button onClick={() => fijarRequisitos(true)} className="px-3 py-1.5 text-[0.78rem] border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50">✏️ Revisar / editar</button>
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
                        Leyendo...
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                  {SUGS.map((t) => (
                    <button
                      key={t}
                      className="text-[0.72rem] bg-[#EEF2FF] text-[#1E40AF] px-2.5 py-1 rounded-[20px] hover:bg-blue-100 transition-colors"
                      onClick={() => (t.startsWith("📷") || t.startsWith("📊") ? fileInputRef.current?.click() : enviar(t))}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 px-3 py-2.5">
                  <button
                    type="button"
                    aria-label="Adjuntar pantallazo, Excel o PDF"
                    title="Adjuntar pantallazo, Excel o PDF"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-9 h-9 flex items-center justify-center rounded-[10px] border border-slate-200 text-[1rem] bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    📎
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,.xlsx,.xls,.csv,.pdf" className="hidden" onChange={handleFileChange} />
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); enviar(chatInput); } }}
                    placeholder="Escribe o pega los requisitos…"
                    className="flex-1 px-3 py-[9px] border border-slate-200 rounded-[10px] text-[0.84rem] outline-none focus:border-blue-500"
                  />
                  <button className="px-[14px] py-[8px] bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50" disabled={isBusy || !chatInput.trim()} onClick={() => enviar(chatInput)}>➤</button>
                </div>
              </div>
            )}

            {mode === "man" && (
              <div className="flex-1 p-2.5 overflow-y-auto content-start bg-[#FCFDFF] gap-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                {columnas.map((g) => (
                  <div key={g.k} className="border border-slate-200 rounded-[12px] p-2.5 bg-white flex flex-col">
                    <b className="flex justify-between items-center text-[0.8rem] text-[#0F172A] mb-1.5 font-bold">
                      {g.t}
                      <span className="bg-[#DBEAFE] text-[#1E40AF] rounded-[20px] px-[7px] text-[0.7rem] font-bold">{g.arr.length}</span>
                    </b>

                    <div className="flex flex-col gap-1 mt-1">
                      {g.arr.map((r, i) => (
                        <div key={i} className="flex justify-between items-center gap-1.5 text-[0.72rem] bg-slate-50 border border-slate-100 px-2 py-1 rounded">
                          <span className="text-slate-700">{r}</span>
                          <button aria-label={`Quitar ${r}`} onClick={() => g.set((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">✕</button>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-1 mt-1.5">
                      <input
                        value={manInputs[g.k]}
                        onChange={(e) => setManInputs((prev) => ({ ...prev, [g.k]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && manInputs[g.k].trim()) {
                            g.set((prev) => unir(prev, [manInputs[g.k]]));
                            setManInputs((prev) => ({ ...prev, [g.k]: "" }));
                          }
                        }}
                        placeholder="Nuevo requisito"
                        className="flex-1 min-w-0 h-[30px] px-2 border border-slate-300 rounded-[6px] text-[0.76rem] outline-none focus:border-blue-500"
                      />
                      <button
                        aria-label={`Agregar a ${g.t}`}
                        onClick={() => {
                          if (manInputs[g.k].trim()) {
                            g.set((prev) => unir(prev, [manInputs[g.k]]));
                            setManInputs((prev) => ({ ...prev, [g.k]: "" }));
                          }
                        }}
                        className="px-[9px] h-[30px] bg-white border border-slate-300 rounded-[6px] hover:bg-slate-50 text-[0.76rem] font-bold text-slate-600 transition-colors flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2.5 mt-3.5 pt-3.5 border-t border-slate-100">
        <button className="px-4 py-2 text-[0.85rem] font-semibold text-slate-600 hover:bg-slate-100 rounded-[8px] transition-colors" onClick={onCerrar}>
          Cancelar
        </button>
        <button className="px-5 py-2 bg-blue-600 text-white font-bold text-[0.85rem] rounded-[8px] hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center min-w-[140px] disabled:opacity-50" onClick={handleCrear} disabled={creando}>
          {creando ? <Spinner /> : "Crear contrato →"}
        </button>
      </div>
    </Modal>
  );
}
