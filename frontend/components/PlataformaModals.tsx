"use client";
import React, { useState, useEffect } from "react";
import { Modal, Spinner } from "./ui";
import * as Api from "@/lib/cliente";
import type { PlataformaContrato, Credencial } from "@/lib/tipos";

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
    <Modal abierto={!!plataforma} titulo={`${plataforma.nombre} — Usuarios`} onCerrar={onCerrar} ancho="max-w-[520px]">
      <div className="text-[0.8rem] text-slate-500 mb-4 leading-relaxed">
        Credenciales de acceso a {plataforma.nombre}.
      </div>
      
      {loading ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : (
        <div className="mb-5 max-h-[300px] overflow-y-auto pr-2">
          {usuarios.length === 0 ? (
            <div className="text-[0.78rem] text-slate-500 py-2">Sin usuarios registrados aún.</div>
          ) : (
            usuarios.map(u => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-[0.83rem] font-bold text-slate-800">{u.nombre || '—'}</div>
                  <div className="text-[0.74rem] text-slate-500 mt-0.5">
                    👤 {u.usuario} &nbsp;·&nbsp; 🔑 <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">********</span>
                  </div>
                </div>
                <button 
                  className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  onClick={() => handleEliminar(u.id)}
                  title="Eliminar"
                >
                  ✕
                </button>
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
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              minLength={PASSWORD_MIN}
              className="w-full h-[34px] px-3 border border-slate-300 rounded text-[0.8rem] focus:outline-none focus:border-blue-500"
            />
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

export function DetallePlataformaModal({
  plataforma,
  contratoId,
  onCerrar,
}: {
  plataforma: PlataformaContrato | null;
  contratoId: string;
  onCerrar: () => void;
}) {
  const [reqs, setReqs] = useState<RequisitoPlataforma[]>([]);
  const [loading, setLoading] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [ambito, setAmbito] = useState<string>("empresa");
  const [obligatorio, setObligatorio] = useState(true);
  const [vigencia, setVigencia] = useState("");
  const [creando, setCreando] = useState(false);

  const cargar = async (plat: PlataformaContrato) => {
    setLoading(true);
    try {
      const res = await Api.contratos.requisitos(contratoId, { vinculo_tipo: "plataforma", page_size: 100 });
      const items = (res.items || []) as RequisitoPlataforma[];
      setReqs(items.filter((r) => r.vinculo_ref === plat.id || (plat.faena_plataforma_id && r.vinculo_ref === plat.faena_plataforma_id)));
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (plataforma) cargar(plataforma);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plataforma, contratoId]);

  const handleAgregar = async () => {
    if (!titulo.trim() || !plataforma) return alert("El título es requerido");
    const vig = vigencia === "" ? null : Number(vigencia);
    if (vig !== null && !(vig >= 1 && vig <= 120)) return alert("La vigencia debe estar entre 1 y 120 meses");
    setCreando(true);
    try {
      await Api.contratos.crearRequisitoPlataforma(contratoId, plataforma.id, {
        ambito, titulo: titulo.trim(), obligatorio, vigencia_meses: vig,
      });
      setTitulo(""); setVigencia("");
      await cargar(plataforma);
    } catch (e) {
      alert(Api.mensajeError(e));
    } finally {
      setCreando(false);
    }
  };

  const handleEliminar = async (rid: string, nombre: string) => {
    if (!plataforma || !confirm(`¿Quitar el requisito "${nombre}" de ${plataforma.nombre}?`)) return;
    try {
      await Api.contratos.eliminarRequisito(contratoId, rid);
      setReqs(reqs.filter((r) => r.id !== rid));
    } catch (e) {
      alert(Api.mensajeError(e));
    }
  };

  if (!plataforma) return null;
  const esUuid = UUID_RE.test(plataforma.id);

  return (
    <Modal abierto={!!plataforma} titulo={`${plataforma.nombre} — Requisitos`} onCerrar={onCerrar} ancho="max-w-[560px]">
      <div className="text-[0.8rem] text-slate-500 mb-4 leading-relaxed">
        Requisitos que esta plataforma exige para acreditar. Los de origen base son de solo lectura.
      </div>

      {!esUuid ? (
        <div className="text-[0.8rem] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Esta plataforma aún no tiene identificador válido para asociar requisitos.
        </div>
      ) : loading ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : (
        <div className="mb-5 max-h-[300px] overflow-y-auto pr-2">
          {reqs.length === 0 ? (
            <div className="text-[0.78rem] text-slate-500 py-2">Sin requisitos asociados aún.</div>
          ) : (
            reqs.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="text-[0.83rem] font-bold text-slate-800">{r.titulo}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[0.62rem] font-bold rounded uppercase">{r.ambito}</span>
                    <span className={`px-1.5 py-0.5 text-[0.62rem] font-bold rounded ${r.obligatorio ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                      {r.obligatorio ? "Obligatorio" : "Opcional"}
                    </span>
                    {r.editable === false && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[0.62rem] font-bold rounded">Base</span>
                    )}
                  </div>
                </div>
                {r.editable !== false && r.id && (
                  <button
                    className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    onClick={() => handleEliminar(r.id!, r.titulo || "")}
                    title="Quitar requisito"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {esUuid && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <div className="text-[0.75rem] font-bold text-slate-700 mb-2.5">NUEVO REQUISITO</div>
          <div className="mb-2.5">
            <label className="block text-[0.7rem] font-bold text-slate-600 mb-1 uppercase">Título *</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Certificado de afiliación"
              className="w-full h-[34px] px-3 border border-slate-300 rounded text-[0.8rem] focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-[0.7rem] font-bold text-slate-600 mb-1 uppercase">Ámbito</label>
              <select
                value={ambito}
                onChange={(e) => setAmbito(e.target.value)}
                className="w-full h-[34px] px-2 border border-slate-300 rounded text-[0.8rem] focus:outline-none focus:border-blue-500 bg-white"
              >
                {AMBITOS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[0.7rem] font-bold text-slate-600 mb-1 uppercase">Vigencia (meses)</label>
              <input
                value={vigencia}
                onChange={(e) => setVigencia(e.target.value)}
                placeholder="Opcional"
                type="number"
                min={1}
                max={120}
                className="w-full h-[34px] px-3 border border-slate-300 rounded text-[0.8rem] focus:outline-none focus:border-blue-500"
              />
            </div>
            <label className="flex items-end gap-1.5 pb-2 text-[0.75rem] font-semibold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={obligatorio} onChange={(e) => setObligatorio(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              Obligatorio
            </label>
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
              {creando ? "..." : "+ Agregar requisito"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
