"use client";
import React, { useEffect, useState } from "react";
import { Modal, Spinner } from "@/components/ui";
import * as Api from "@/lib/cliente";
import type { Contrato, UsuarioEmpresa } from "@/lib/tipos";
import { numeroContrato } from "./ContratoLayout";

interface CompartirContratoModalProps {
  abierto: boolean;
  onCerrar: () => void;
  contrato: Contrato | null;
  /** Falso para rol visor: oculta el formulario y los controles de gestión. */
  puedeGestionar?: boolean;
}

const ROLES = {
  contract_admin: { nombre: "Este contrato", desc: "Ve y gestiona solo este contrato.", fondo: "bg-blue-100 text-blue-800" },
  visor: { nombre: "Solo lectura", desc: "Ve este contrato sin poder modificar nada.", fondo: "bg-slate-100 text-slate-600" },
  company: { nombre: "Toda la empresa", desc: "Acceso total a contratos y configuración.", fondo: "bg-slate-200 text-slate-700" },
} as const;

type Rol = keyof typeof ROLES;

const iniciales = (n: string | null) =>
  (n || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function CompartirContratoModal({ abierto, onCerrar, contrato, puedeGestionar = true }: CompartirContratoModalProps) {
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([]);
  const [cargando, setCargando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("contract_admin");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [quitarId, setQuitarId] = useState<string | null>(null);

  const cargar = async () => {
    if (!contrato) return;
    setCargando(true);
    setError(null);
    try {
      const res = await Api.empresa.usuarios({ page_size: 100 });
      setUsuarios((res.items || []).filter((u) => u.contrato_id === contrato.id || u.role === "company"));
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (abierto) {
      setNombre("");
      setEmail("");
      setError(null);
      cargar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, contrato?.id]);

  if (!contrato) return null;

  const valido = nombre.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const invitar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await Api.empresa.invitar({
        nombre: nombre.trim(),
        email: email.trim(),
        role: rol,
        contrato_id: rol === "company" ? null : contrato.id,
      });
      setNombre("");
      setEmail("");
      await cargar();
    } catch (e) {
      setError(Api.mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarRol = async (u: UsuarioEmpresa, nuevo: Rol) => {
    try {
      await Api.empresa.editarUsuario(u.id, {
        role: nuevo,
        contrato_id: nuevo === "company" ? null : contrato.id,
      });
      await cargar();
    } catch (e) {
      setError(Api.mensajeError(e));
    }
  };

  const quitar = async (u: UsuarioEmpresa) => {
    if (quitarId !== u.id) {
      setQuitarId(u.id);
      setTimeout(() => setQuitarId((id) => (id === u.id ? null : id)), 4000);
      return;
    }
    setQuitarId(null);
    try {
      await Api.empresa.desactivarUsuario(u.id);
      await cargar();
    } catch (e) {
      setError(Api.mensajeError(e));
    }
  };

  const enlace = typeof window !== "undefined" ? `${window.location.origin}/contratos/${contrato.id}` : "";
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar el enlace.");
    }
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Compartir contrato"
      onCerrar={onCerrar}
      ancho="max-w-[680px]"
    >
      <p className="-mt-2 mb-4 text-[0.85rem] text-slate-500">
        {numeroContrato(contrato)} · {contrato.nombre}. Las personas que agregues entran a ACREDITTIA y solo ven este contrato.
      </p>

      {error && (
        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.82rem] text-red-700">
          {error}
        </div>
      )}

      {puedeGestionar && (
      <>
      <div className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-500 mb-2">Dar acceso a una persona</div>
      <div className="gap-2.5" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
        <div>
          <label htmlFor="sh-nombre" className="block text-[0.8rem] font-semibold text-slate-700 mb-1">Nombre</label>
          <input
            id="sh-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Boris Jara"
            className="w-full h-10 px-3 border border-slate-300 rounded-lg text-[0.88rem] outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="sh-correo" className="block text-[0.8rem] font-semibold text-slate-700 mb-1">Correo</label>
          <input
            id="sh-correo"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.cl"
            className="w-full h-10 px-3 border border-slate-300 rounded-lg text-[0.88rem] outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="sh-rol" className="block text-[0.8rem] font-semibold text-slate-700 mb-1">Permiso</label>
          <select
            id="sh-rol"
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            className="w-full h-10 px-2 border border-slate-300 rounded-lg text-[0.88rem] outline-none bg-white focus:border-blue-500"
          >
            <option value="contract_admin">Solo este contrato</option>
            <option value="visor">Solo lectura</option>
            <option value="company">Toda la empresa</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end mt-2.5">
        <button
          onClick={invitar}
          disabled={!valido || guardando}
          className="h-10 px-4 rounded-lg bg-blue-600 text-white text-[0.85rem] font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {guardando ? "Creando..." : "Crear usuario y compartir"}
        </button>
      </div>
      </>
      )}

      <div className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-500 mt-5 mb-2">
        Personas con acceso ({usuarios.length})
      </div>
      {cargando ? (
        <Spinner texto="Cargando accesos..." />
      ) : usuarios.length === 0 ? (
        <p className="text-[0.85rem] text-slate-500">Aún nadie más tiene acceso a este contrato.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {usuarios.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <span aria-hidden="true" className="w-9 h-9 rounded-full bg-slate-800 text-white grid place-items-center text-[0.75rem] font-bold flex-shrink-0">
                {iniciales(u.nombre)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[0.88rem] font-bold text-slate-800 truncate">{u.nombre || "Sin nombre"}</div>
                <div className="text-[0.75rem] text-slate-500 truncate">{u.email}</div>
              </div>
              {puedeGestionar ? (
              <select
                aria-label={`Permiso de ${u.nombre || u.email}`}
                value={u.role}
                onChange={(e) => cambiarRol(u, e.target.value as Rol)}
                className="h-8 px-2 border border-slate-200 rounded-lg text-[0.78rem] font-semibold text-slate-600 bg-white outline-none"
              >
                <option value="contract_admin">Este contrato</option>
                <option value="visor">Solo lectura</option>
                <option value="company">Toda la empresa</option>
              </select>
              ) : (
                <span className="text-[0.75rem] font-semibold text-slate-500">
                  {u.role === "company" ? "Toda la empresa" : u.role === "visor" ? "Solo lectura" : "Este contrato"}
                </span>
              )}
              {puedeGestionar && (
              <button
                onClick={() => quitar(u)}
                aria-label={quitarId === u.id ? `Confirmar quitar acceso a ${u.nombre || u.email}` : `Quitar acceso a ${u.nombre || u.email}`}
                title="Quitar acceso"
                className={`h-7 min-w-7 px-1 grid place-items-center rounded-lg text-[0.75rem] font-bold ${
                  quitarId === u.id
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                }`}
              >
                {quitarId === u.id ? "¿Quitar?" : "✕"}
              </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1 mt-3 text-[0.78rem] text-slate-500">
        {(Object.keys(ROLES) as Rol[]).map((r) => (
          <div key={r} className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-[0.7rem] font-bold ${ROLES[r].fondo}`}>{ROLES[r].nombre}</span>
            {ROLES[r].desc}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
        <span className="text-[0.8rem] text-slate-600">🔗 Enlace del contrato:</span>
        <code className="flex-1 min-w-0 truncate text-[0.78rem] text-slate-700">{enlace}</code>
        <button
          onClick={copiar}
          className="h-8 px-3 rounded-lg border border-slate-300 bg-white text-[0.78rem] font-bold text-slate-600 hover:bg-slate-100 whitespace-nowrap"
        >
          {copiado ? "¡Copiado!" : "Copiar enlace"}
        </button>
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={onCerrar}
          className="h-10 px-6 rounded-lg border border-slate-300 bg-white text-[0.88rem] font-semibold text-slate-700 hover:bg-slate-50"
        >
          Listo
        </button>
      </div>
    </Modal>
  );
}
