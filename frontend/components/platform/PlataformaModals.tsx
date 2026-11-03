"use client";
import React, { useState, useEffect, useRef } from "react";
import { Modal, Spinner } from "@/components/shared/ui";
import * as Api from "@/lib/platform/cliente";
import type { PlataformaContrato, Credencial } from "@/lib/platform/tipos";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PASSWORD_MIN = 8;

export function AgregarPlataformaModal({
  abierto,
  onCerrar,
  contratoId,
  onAgregada,
}: {
  abierto: boolean;
  onCerrar: () => void;
  contratoId: string;
  onAgregada: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [url, setUrl] = useState("");
  const [creando, setCreando] = useState(false);

  const handleGuardar = async () => {
    if (!nombre) return alert("El nombre es requerido");
    setCreando(true);
    try {
      await Api.plataformas.crear(contratoId, { nombre, descripcion, url });
      onAgregada();
      onCerrar();
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setCreando(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo="Agregar plataforma custom" onCerrar={onCerrar}>
      <div className="text-[0.8rem] text-slate-500 mb-4 leading-relaxed">
        Se asociará al contrato actual. Luego podrás agregar los requisitos que esta plataforma exige.
      </div>
      <div className="mb-3">
        <label className="block text-[0.75rem] font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nombre de la plataforma *</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: SICEP, Portal Contratistas..."
          className="w-full h-[38px] px-3.5 border border-slate-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="mb-3">
        <label className="block text-[0.75rem] font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Descripción</label>
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: Sistema de control de acceso de la faena"
          className="w-full h-[38px] px-3.5 border border-slate-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="mb-5">
        <label className="block text-[0.75rem] font-bold text-slate-700 mb-1.5 uppercase tracking-wide">URL de acceso (opcional)</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Ej: https://..."
          className="w-full h-[38px] px-3.5 border border-slate-300 rounded-lg text-[0.85rem] focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button className="px-4 py-2 text-[0.85rem] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" onClick={onCerrar}>
          Cancelar
        </button>
        <button
          className="px-4 py-2 text-[0.85rem] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 min-w-[120px] flex justify-center"
          onClick={handleGuardar}
          disabled={creando}
        >
          {creando ? <Spinner /> : "Agregar"}
        </button>
      </div>
    </Modal>
  );
}

export function GestionarUsuariosModal({
  plataforma,
  contratoId,
  onCerrar,
}: {
  plataforma: PlataformaContrato | null;
  contratoId: string;
  onCerrar: () => void;
}) {
  const [usuarios, setUsuarios] = useState<Credencial[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [creando, setCreando] = useState(false);

  // Estados para visualización y copia de contraseñas
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});
  const [cargandoPassword, setCargandoPassword] = useState<Record<string, boolean>>({});
  const [copiado, setCopiado] = useState<Record<string, boolean>>({});
  const [mostrarNuevoPassword, setMostrarNuevoPassword] = useState(false);

  // Estados para rotación de contraseña
  const [rotandoId, setRotandoId] = useState<string | null>(null);
  const [rotarPassword, setRotarPassword] = useState("");
  const [mostrarRotarPassword, setMostrarRotarPassword] = useState(false);
  const [guardandoRotacion, setGuardandoRotacion] = useState(false);

  // Plataforma heredada sin materializar: viene sin `id` propio; el backend
  // acepta el id de la faena y materializa la lista al crear la cuenta.
  const pid = plataforma ? plataforma.id || plataforma.faena_plataforma_id || null : null;
  const pidValido = !!pid && UUID_RE.test(pid);

  useEffect(() => {
    if (!plataforma) return;
    if (!pidValido || !pid) {
      setUsuarios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Api.credenciales.listar(contratoId, pid)
      .then(res => setUsuarios(res.items || []))
      .catch(e => alert(Api.mensajeError(e)))
      .finally(() => setLoading(false));
  }, [plataforma, contratoId, pid, pidValido]);

  const copiarTexto = async (texto: string, key: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = texto;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiado(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiado(prev => ({ ...prev, [key]: false }));
      }, 2000);
    } catch (err) {
      console.error("Error al copiar al portapapeles:", err);
    }
  };

  const handleTogglePassword = async (uid: string) => {
    if (visiblePasswords[uid]) {
      setVisiblePasswords(prev => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
      return;
    }
    if (!plataforma || !pid) return;
    setCargandoPassword(prev => ({ ...prev, [uid]: true }));
    try {
      const res = await Api.credenciales.revelarPassword(contratoId, pid, uid);
      setVisiblePasswords(prev => ({ ...prev, [uid]: res.password }));
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setCargandoPassword(prev => ({ ...prev, [uid]: false }));
    }
  };

  const handleCopiarPassword = async (uid: string) => {
    if (visiblePasswords[uid]) {
      await copiarTexto(visiblePasswords[uid], `pw_${uid}`);
      return;
    }
    if (!plataforma || !pid) return;
    setCargandoPassword(prev => ({ ...prev, [uid]: true }));
    try {
      const res = await Api.credenciales.revelarPassword(contratoId, pid, uid);
      setVisiblePasswords(prev => ({ ...prev, [uid]: res.password }));
      await copiarTexto(res.password, `pw_${uid}`);
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setCargandoPassword(prev => ({ ...prev, [uid]: false }));
    }
  };

  const handleAgregar = async () => {
    if (!plataforma) return;
    if (!pidValido || !pid) return alert("Esta plataforma aún no tiene identificador válido para guardar usuarios.");
    if (!nombre.trim()) return alert("El nombre del titular es obligatorio");
    if (!usuario.trim()) return alert("El usuario es obligatorio");
    if (password.length < PASSWORD_MIN) return alert(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`);
    setCreando(true);
    try {
      await Api.credenciales.crear(contratoId, pid, { nombre: nombre.trim(), usuario, password });
      setNombre(""); setUsuario(""); setPassword("");
      const res = await Api.credenciales.listar(contratoId, pid);
      setUsuarios(res.items || []);
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setCreando(false);
    }
  };

  const handleRotar = async (uid: string) => {
    if (!plataforma || !pid) return;
    if (rotarPassword.length < PASSWORD_MIN) {
      return alert(`La nueva contraseña debe tener al menos ${PASSWORD_MIN} caracteres`);
    }
    setGuardandoRotacion(true);
    try {
      await Api.credenciales.rotar(contratoId, pid, uid, rotarPassword);
      setVisiblePasswords(prev => ({ ...prev, [uid]: rotarPassword }));
      setRotandoId(null);
      setRotarPassword("");
      const res = await Api.credenciales.listar(contratoId, pid);
      setUsuarios(res.items || []);
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setGuardandoRotacion(false);
    }
  };

  const handleEliminar = async (uid: string) => {
    if (!plataforma || !pid || !confirm("¿Eliminar esta cuenta?")) return;
    try {
      await Api.credenciales.eliminar(contratoId, pid, uid);
      setUsuarios(usuarios.filter(u => u.id !== uid));
    } catch (e) {
      alert(Api.mensajeError(e));
    }
  };

  if (!plataforma) return null;

  return (
    <Modal abierto={!!plataforma} titulo={`${plataforma.nombre} — Usuarios y claves`} onCerrar={onCerrar} ancho="max-w-[560px]">
      <div className="text-[0.8rem] text-slate-500 mb-4 leading-relaxed">
        Credenciales de acceso a {plataforma.nombre}. Las contraseñas están almacenadas cifradas en el vault.
      </div>
      
      {loading ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : (
        <div className="mb-5 max-h-[300px] overflow-y-auto pr-2 divide-y divide-slate-100">
          {usuarios.length === 0 ? (
            <div className="text-[0.78rem] text-slate-500 py-2">Sin usuarios registrados aún.</div>
          ) : (
            usuarios.map(u => (
              <div key={u.id} className="py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="text-[0.83rem] font-bold text-slate-800">{u.nombre || '—'}</div>
                    <div className="text-[0.74rem] text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        👤 <span className="font-semibold text-slate-700">{u.usuario}</span>
                        <button 
                          type="button"
                          className="text-slate-400 hover:text-slate-700 transition-colors ml-0.5"
                          onClick={() => copiarTexto(u.usuario, `user_${u.id}`)}
                          title="Copiar usuario"
                        >
                          {copiado[`user_${u.id}`] ? <span className="text-[0.7rem] text-emerald-600 font-bold">✓</span> : "⧉"}
                        </button>
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1">
                        🔑 <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 text-xs">
                          {cargandoPassword[u.id] ? "..." : (visiblePasswords[u.id] || "••••••••")}
                        </span>
                        <button 
                          type="button"
                          className="text-slate-400 hover:text-slate-700 text-xs p-0.5 transition-colors"
                          onClick={() => handleTogglePassword(u.id)}
                          disabled={cargandoPassword[u.id]}
                          title={visiblePasswords[u.id] ? "Ocultar contraseña" : "Ver contraseña"}
                        >
                          {visiblePasswords[u.id] ? "🙈" : "👁"}
                        </button>
                        <button 
                          type="button"
                          className="text-slate-400 hover:text-slate-700 text-xs p-0.5 transition-colors"
                          onClick={() => handleCopiarPassword(u.id)}
                          disabled={cargandoPassword[u.id]}
                          title="Copiar contraseña"
                        >
                          {copiado[`pw_${u.id}`] ? <span className="text-[0.7rem] text-emerald-600 font-bold">✓ Copiado</span> : "⧉"}
                        </button>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="px-1.5 py-1 text-[0.7rem] font-semibold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      onClick={() => {
                        setRotandoId(rotandoId === u.id ? null : u.id);
                        setRotarPassword("");
                      }}
                      title="Rotar contraseña"
                    >
                      Rotar
                    </button>
                    <button 
                      className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      onClick={() => handleEliminar(u.id)}
                      title="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {rotandoId === u.id && (
                  <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        value={rotarPassword}
                        onChange={(e) => setRotarPassword(e.target.value)}
                        placeholder="Nueva contraseña"
                        type={mostrarRotarPassword ? "text" : "password"}
                        minLength={PASSWORD_MIN}
                        className="w-full h-[30px] pl-2.5 pr-7 border border-slate-300 rounded text-[0.78rem] font-mono focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-0.5"
                        onClick={() => setMostrarRotarPassword(prev => !prev)}
                        title={mostrarRotarPassword ? "Ocultar" : "Mostrar"}
                      >
                        {mostrarRotarPassword ? "🙈" : "👁"}
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={guardandoRotacion}
                      onClick={() => handleRotar(u.id)}
                      className="px-2.5 py-1 text-[0.75rem] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
                    >
                      {guardandoRotacion ? "..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRotandoId(null); setRotarPassword(""); }}
                      className="px-2 py-1 text-[0.75rem] font-semibold text-slate-600 hover:bg-slate-200 rounded transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {!pidValido ? (
        <div className="text-[0.8rem] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Esta plataforma aún no tiene identificador válido para asociar usuarios.
        </div>
      ) : (
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
        <div className="text-[0.75rem] font-bold text-slate-700 mb-2.5">NUEVO USUARIO</div>
        <div className="mb-2.5">
          <label className="block text-[0.7rem] font-bold text-slate-600 mb-1 uppercase">Nombre del responsable *</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Carolina Pérez"
            className="w-full h-[34px] px-3 border border-slate-300 rounded text-[0.8rem] focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-[0.7rem] font-bold text-slate-600 mb-1 uppercase">Usuario *</label>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="c.perez"
              className="w-full h-[34px] px-3 border border-slate-300 rounded text-[0.8rem] focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[0.7rem] font-bold text-slate-600 mb-1 uppercase">Contraseña *</label>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type={mostrarNuevoPassword ? "text" : "password"}
                minLength={PASSWORD_MIN}
                className="w-full h-[34px] pl-3 pr-8 border border-slate-300 rounded text-[0.8rem] focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs p-1"
                onClick={() => setMostrarNuevoPassword(prev => !prev)}
                title={mostrarNuevoPassword ? "Ocultar" : "Mostrar"}
              >
                {mostrarNuevoPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 text-[0.75rem] font-semibold text-slate-600 hover:bg-slate-200 rounded transition-colors" onClick={onCerrar}>
            Cerrar
          </button>
          <button
            className="px-3 py-1.5 text-[0.75rem] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
            onClick={handleAgregar}
            disabled={creando}
          >
            {creando ? "..." : "+ Agregar usuario"}
          </button>
        </div>
      </div>
      )}
    </Modal>
  );
}

const AMBITOS = ["empresa", "personal", "equipo"] as const;

type RequisitoPlataforma = {
  id?: string;
  titulo?: string;
  ambito?: string;
  obligatorio?: boolean;
  vigencia_meses?: number | null;
  origen?: string;
  editable?: boolean;
  vinculo_ref?: string | null;
};

const PR_CATS = [
  { key: "empresa", icon: "🏢", label: "Empresa" },
  { key: "personal", icon: "👷", label: "Personal" },
  { key: "equipo", icon: "🚛", label: "Equipos" },
] as const;

interface PropRequisitos {
  cat: "empresa" | "personal" | "equipo";
  items: Array<{
    t: string;
    o: boolean;
    on: boolean;
    dup: boolean;
  }>;
}

export function DetallePlataformaModal({
  plataforma,
  contratoId,
  onCerrar,
  onRefreshPlataformas,
}: {
  plataforma: PlataformaContrato | null;
  contratoId: string;
  onCerrar: () => void;
  onRefreshPlataformas?: () => void;
}) {
  const [reqs, setReqs] = useState<RequisitoPlataforma[]>([]);
  const [loading, setLoading] = useState(true);

  // Pestañas de modo adición: manual vs chat
  const [tabModo, setTabModo] = useState<"manual" | "chat">("manual");

  // Modo manual
  const [catManual, setCatManual] = useState<"empresa" | "personal" | "equipo">("personal");
  const [titulo, setTitulo] = useState("");
  const [obligatorio, setObligatorio] = useState(true);
  const [vigencia, setVigencia] = useState("");
  const [creando, setCreando] = useState(false);

  // Modo chat IA
  const [mensajesChat, setMensajesChat] = useState<
    Array<{ w: "ia" | "me"; t: string; archivo?: string; esImg?: boolean }>
  >([
    {
      w: "ia",
      t: 'Hola 👋 Puedo cargar los requisitos de esta plataforma por ti. Escríbeme a qué corresponden (por ejemplo <i>"estos son los requisitos empresa"</i>) y adjunta un <b>pantallazo</b> o un <b>Excel</b> con la lista. También puedes pegar los nombres, uno por línea.',
    },
  ]);
  const [inputChat, setInputChat] = useState("");
  const [busyChat, setBusyChat] = useState(false);
  const [propRequisitos, setPropRequisitos] = useState<PropRequisitos | null>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);

  const targetPlatId = plataforma?.id || plataforma?.faena_plataforma_id || "";
  const esUuid = UUID_RE.test(targetPlatId);

  const cargar = async (plat: PlataformaContrato) => {
    setLoading(true);
    try {
      const res = await Api.contratos.requisitos(contratoId, {
        vinculo_tipo: "plataforma",
        page_size: 100,
      });
      const items = (res.items || []) as RequisitoPlataforma[];
      setReqs(
        items.filter(
          (r) =>
            r.vinculo_ref === plat.id ||
            (plat.faena_plataforma_id && r.vinculo_ref === plat.faena_plataforma_id)
        )
      );
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (plataforma) {
      cargar(plataforma);
      setPropRequisitos(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plataforma, contratoId]);

  const showToast = (msg: string) => {
    if (typeof window !== "undefined" && (window as any).toast) {
      (window as any).toast(msg);
    }
  };

  const handleAgregarManual = async () => {
    if (!titulo.trim() || !plataforma) return alert("El nombre del requisito es requerido");
    const vig = vigencia === "" ? null : Number(vigencia);
    if (vig !== null && !(vig >= 1 && vig <= 120)) {
      return alert("La vigencia debe estar entre 1 y 120 meses");
    }
    setCreando(true);
    try {
      await Api.contratos.crearRequisitoPlataforma(contratoId, targetPlatId, {
        ambito: catManual,
        titulo: titulo.trim(),
        obligatorio,
        vigencia_meses: vig,
      });
      setTitulo("");
      setVigencia("");
      showToast(`Requisito agregado a ${catManual}`);
      await cargar(plataforma);
      onRefreshPlataformas?.();
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setCreando(false);
    }
  };

  const handleEliminar = async (rid: string, nombreReq: string) => {
    if (!plataforma || !confirm(`¿Quitar el requisito "${nombreReq}" de ${plataforma.nombre}?`)) {
      return;
    }
    try {
      await Api.contratos.eliminarRequisito(contratoId, rid);
      setReqs((prev) => prev.filter((r) => r.id !== rid));
      showToast("Requisito eliminado");
      onRefreshPlataformas?.();
    } catch (e) {
      alert(Api.mensajeError(e));
    }
  };

  const detectarCat = (t: string): "empresa" | "personal" | "equipo" => {
    const s = t.toLowerCase();
    if (/equipo|veh[ií]cul|cami[oó]n|maquinaria|flota/.test(s)) return "equipo";
    if (/personal|trabajador|persona|conductor|operador/.test(s)) return "personal";
    return "empresa";
  };

  const handleChatSend = async (textoOverride?: string) => {
    const rawTxt = textoOverride !== undefined ? textoOverride : inputChat;
    const txt = rawTxt.trim();
    if (!txt) return;

    const catDetectada = detectarCat(txt);
    setMensajesChat((prev) => [...prev, { w: "me", t: txt }]);
    setInputChat("");
    setBusyChat(true);

    try {
      const res = await Api.ia.extraerListado({
        tipo: "requisitos",
        texto: txt,
      });

      const itemsDetectados = res.items || [];
      const titulosExistentes = new Set(
        reqs.map((r) => (r.titulo || "").toLowerCase().trim())
      );

      const propItems = itemsDetectados.map((it: any) => {
        const nombreItem = String(it.nombre || it.titulo || "").trim();
        const dup = titulosExistentes.has(nombreItem.toLowerCase());
        return {
          t: nombreItem,
          o: it.obligatorio !== false,
          on: !dup,
          dup,
        };
      });

      setPropRequisitos({
        cat: catDetectada,
        items: propItems,
      });

      setMensajesChat((prev) => [
        ...prev,
        {
          w: "ia",
          t: `Encontré <b>${propItems.length} requisitos</b> para <b>${
            PR_CATS.find((c) => c.key === catDetectada)?.label
          }</b>. Revisa la lista abajo, ajusta lo que necesites y presiona Guardar.`,
        },
      ]);
    } catch (e: any) {
      setMensajesChat((prev) => [
        ...prev,
        {
          w: "ia",
          t: `Error procesando la solicitud: ${e.message || "Error desconocido"}`,
        },
      ]);
    } finally {
      setBusyChat(false);
    }
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith("image/");
    const reader = new FileReader();

    reader.onload = async () => {
      const b64 = reader.result as string;
      const catDetectada = detectarCat(inputChat || file.name);

      setMensajesChat((prev) => [
        ...prev,
        {
          w: "me",
          t: inputChat.trim() || `Adjunté archivo ${file.name}`,
          archivo: file.name,
          esImg: isImg,
        },
      ]);
      setInputChat("");
      setBusyChat(true);

      try {
        const res = await Api.ia.extraerListado({
          tipo: "requisitos",
          file_b64: b64,
          file_name: file.name,
        });

        const itemsDetectados = res.items || [];
        const titulosExistentes = new Set(
          reqs.map((r) => (r.titulo || "").toLowerCase().trim())
        );

        const propItems = itemsDetectados.map((it: any) => {
          const nombreItem = String(it.nombre || it.titulo || "").trim();
          const dup = titulosExistentes.has(nombreItem.toLowerCase());
          return {
            t: nombreItem,
            o: it.obligatorio !== false,
            on: !dup,
            dup,
          };
        });

        setPropRequisitos({
          cat: catDetectada,
          items: propItems,
        });

        setMensajesChat((prev) => [
          ...prev,
          {
            w: "ia",
            t: `Leí <b>${file.name}</b> y extraje <b>${propItems.length} requisitos</b> para <b>${
              PR_CATS.find((c) => c.key === catDetectada)?.label
            }</b>. Revísalos abajo y confirma para agregarlos a la plataforma.`,
          },
        ]);
      } catch (err: any) {
        setMensajesChat((prev) => [
          ...prev,
          {
            w: "ia",
            t: `Ocurrió un error al procesar el archivo: ${err.message || "Error desconocido"}`,
          },
        ]);
      } finally {
        setBusyChat(false);
        if (chatFileRef.current) chatFileRef.current.value = "";
      }
    };

    reader.readAsDataURL(file);
  };

  const handleConfirmarProp = async () => {
    if (!propRequisitos || !plataforma) return;
    const seleccionados = propRequisitos.items.filter((it) => it.on && it.t.trim());
    if (seleccionados.length === 0) {
      alert("Selecciona al menos un requisito para agregar");
      return;
    }

    setCreando(true);
    try {
      const payload = seleccionados.map((it) => ({
        ambito: propRequisitos.cat,
        titulo: it.t.trim(),
        obligatorio: it.o,
      }));

      await Api.contratos.crearRequisitoPlataforma(
        contratoId,
        targetPlatId,
        payload,
        { bulk: true, aplicar_retroactivo: true }
      );

      showToast(
        `✓ ${seleccionados.length} requisitos agregados a ${
          PR_CATS.find((c) => c.key === propRequisitos.cat)?.label
        }`
      );
      setPropRequisitos(null);
      await cargar(plataforma);
      onRefreshPlataformas?.();
    } catch (e: any) {
      alert(Api.mensajeError(e));
    } finally {
      setCreando(false);
    }
  };

  if (!plataforma) return null;

  return (
    <Modal
      abierto={!!plataforma}
      titulo={`Requisitos de ${plataforma.nombre}`}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
    >
      <div className="text-[0.78rem] text-slate-500 mb-4 leading-relaxed">
        {plataforma.descripcion || "Sistema de acreditación"} — {reqs.length} requisito
        {reqs.length === 1 ? "" : "s"} asociados
      </div>

      {!esUuid ? (
        <div className="text-[0.8rem] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Esta plataforma aún no tiene identificador válido para asociar requisitos.
        </div>
      ) : loading ? (
        <div className="py-8 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Listado de requisitos agrupados por categoría */}
          <div className="space-y-3">
            {PR_CATS.map((cat) => {
              const itemsCat = reqs.filter(
                (r) =>
                  r.ambito === cat.key || (cat.key === "equipo" && r.ambito === "equipos")
              );
              return (
                <div
                  key={cat.key}
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs"
                >
                  <div className="flex items-center justify-between font-bold text-xs text-slate-800 border-b border-slate-100 pb-2 mb-2">
                    <span className="flex items-center gap-1.5">
                      <span>{cat.icon}</span>
                      <span>Requisitos — {cat.label}</span>
                    </span>
                    <span className="bg-slate-100 text-slate-600 text-[0.65rem] font-bold px-2 py-0.5 rounded-full">
                      {itemsCat.length}
                    </span>
                  </div>

                  {itemsCat.length === 0 ? (
                    <div className="text-[0.73rem] text-slate-400 py-1 italic">
                      Sin requisitos aún en {cat.label}.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[130px] overflow-y-auto pr-1">
                      {itemsCat.map((r) => (
                        <div
                          key={r.id || r.titulo}
                          className="flex items-center justify-between py-1 px-1.5 hover:bg-slate-50 rounded text-xs"
                        >
                          <span className="text-slate-800 text-[0.78rem] font-medium">
                            {r.titulo}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 text-[0.6rem] font-bold rounded ${
                                r.obligatorio
                                  ? "bg-red-50 text-red-600"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {r.obligatorio ? "Obligatorio" : "Opcional"}
                            </span>
                            {r.editable === false ? (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[0.6rem] font-bold rounded">
                                Base
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => r.id && handleEliminar(r.id, r.titulo || "")}
                                className="text-slate-400 hover:text-red-500 text-xs px-1"
                                title="Eliminar requisito"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Conmutador de modo adición */}
          <div className="flex border border-slate-200 bg-slate-100 rounded-lg p-1">
            <button
              type="button"
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                tabModo === "manual"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setTabModo("manual")}
            >
              ✍ Agregar manual
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
                tabModo === "chat"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => setTabModo("chat")}
            >
              💬 Chat IA · pantallazo o Excel
            </button>
          </div>

          {/* 1. MODO AGREGAR MANUAL */}
          {tabModo === "manual" && (
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                    Categoría
                  </label>
                  <select
                    value={catManual}
                    onChange={(e) => setCatManual(e.target.value as any)}
                    className="w-full h-8 px-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="personal">👷 Personal</option>
                    <option value="equipo">🚛 Equipos</option>
                    <option value="empresa">🏢 Empresa</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                    Nombre del requisito *
                  </label>
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ej: Certificado de afiliación"
                    className="w-full h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={obligatorio}
                    onChange={(e) => setObligatorio(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                  />
                  <span>Obligatorio</span>
                </label>
                <button
                  type="button"
                  onClick={handleAgregarManual}
                  disabled={creando || !titulo.trim()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {creando ? "..." : "+ Agregar"}
                </button>
              </div>
            </div>
          )}

          {/* 2. MODO CHAT IA · PANTALLAZO O EXCEL */}
          {tabModo === "chat" && (
            <div className="space-y-3">
              {/* Log de mensajes */}
              <div className="max-h-[180px] overflow-y-auto space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                {mensajesChat.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.w === "me" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed shadow-xs ${
                        m.w === "me"
                          ? "bg-blue-600 text-white rounded-br-xs"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs"
                      }`}
                    >
                      {m.archivo && (
                        <div className="font-bold text-[0.7rem] mb-1 opacity-90">
                          {m.esImg ? "🖼️" : "📊"} {m.archivo}
                        </div>
                      )}
                      <div dangerouslySetInnerHTML={{ __html: m.t }} />
                    </div>
                  </div>
                ))}
                {busyChat && (
                  <div className="flex justify-start">
                    <div className="bg-white text-slate-600 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs flex items-center gap-2">
                      <Spinner />
                      <span>Leyendo archivo y extrayendo requisitos…</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sugerencias rápidas */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Estos son los requisitos empresa",
                  "Estos son los requisitos de personal",
                  "Estos son los requisitos de equipos",
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      setInputChat(sug);
                      handleChatSend(sug);
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[0.68rem] font-semibold rounded-full transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>

              {/* Input y adjuntar */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={chatFileRef}
                  accept="image/*,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileAttach}
                />
                <button
                  type="button"
                  onClick={() => chatFileRef.current?.click()}
                  title="Adjuntar pantallazo o Excel"
                  className="h-8 px-2.5 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center text-sm"
                >
                  📎
                </button>
                <input
                  type="text"
                  value={inputChat}
                  onChange={(e) => setInputChat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleChatSend();
                    }
                  }}
                  placeholder='Ej: "estos son los requisitos de personal" + adjunta el pantallazo'
                  className="flex-1 h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleChatSend()}
                  disabled={busyChat || !inputChat.trim()}
                  className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>

              {/* Previsualización editable de requisitos detectados */}
              {propRequisitos && (
                <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      {propRequisitos.items.length} requisitos detectados
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.7rem] text-slate-500 font-medium">
                        Se agregarán a:
                      </span>
                      <select
                        value={propRequisitos.cat}
                        onChange={(e) =>
                          setPropRequisitos({
                            ...propRequisitos,
                            cat: e.target.value as any,
                          })
                        }
                        className="h-7 px-2 border border-slate-300 rounded text-xs bg-white font-semibold"
                      >
                        <option value="empresa">🏢 Empresa</option>
                        <option value="personal">👷 Personal</option>
                        <option value="equipo">🚛 Equipos</option>
                      </select>
                    </div>
                  </div>

                  <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1">
                    {propRequisitos.items.map((it, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-1.5 bg-white border rounded-lg text-xs ${
                          it.on ? "border-slate-200" : "border-slate-100 opacity-60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={it.on}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setPropRequisitos({
                              ...propRequisitos,
                              items: propRequisitos.items.map((x, i) =>
                                i === idx ? { ...x, on: val } : x
                              ),
                            });
                          }}
                          className="rounded accent-blue-600"
                        />
                        <input
                          value={it.t}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPropRequisitos({
                              ...propRequisitos,
                              items: propRequisitos.items.map((x, i) =>
                                i === idx ? { ...x, t: val } : x
                              ),
                            });
                          }}
                          className="flex-1 h-6 px-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPropRequisitos({
                              ...propRequisitos,
                              items: propRequisitos.items.map((x, i) =>
                                i === idx ? { ...x, o: !x.o } : x
                              ),
                            });
                          }}
                          className={`px-1.5 py-0.5 text-[0.6rem] font-bold rounded cursor-pointer ${
                            it.o ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {it.o ? "Obligatorio" : "Opcional"}
                        </button>
                        {it.dup && (
                          <span className="text-[0.62rem] text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-medium">
                            ya existe
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPropRequisitos(null)}
                      className="px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Descartar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmarProp}
                      disabled={
                        creando ||
                        propRequisitos.items.filter((x) => x.on).length === 0
                      }
                      className="px-3.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {creando
                        ? "Guardando..."
                        : `✓ Agregar ${
                            propRequisitos.items.filter((x) => x.on).length
                          } a ${
                            PR_CATS.find((c) => c.key === propRequisitos.cat)?.label
                          }`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botón cerrar */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCerrar}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
