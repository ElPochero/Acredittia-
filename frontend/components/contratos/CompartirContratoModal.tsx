"use client";
/**
 * Modal «Compartir contrato».
 *
 * Tres cosas conviven aquí: el formulario de invitación (correo + permiso), el
 * listado de quién tiene acceso y el enlace directo. El acceso no siempre es
 * explícito: los encargados jerárquicos de la Unidad de Negocio del contrato
 * entran automáticamente, y eso se muestra aparte para que quede claro por
 * qué están dentro.
 */
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
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
  contract_admin: {
    nombre: "Editor",
    desc: "Ve y puede modificar este contrato.",
    fondo: "bg-blue-100 text-blue-800",
  },
  visor: {
    nombre: "Visor",
    desc: "Ve este contrato sin poder modificar nada.",
    fondo: "bg-slate-100 text-slate-600",
  },
  company: {
    nombre: "Administrador",
    desc: "Acceso total a contratos y configuración.",
    fondo: "bg-slate-200 text-slate-700",
  },
} as const;

type Rol = keyof typeof ROLES;

const iniciales = (n: string | null) =>
  (n || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function CompartirContratoModal({
  abierto,
  onCerrar,
  contrato,
  puedeGestionar = true,
}: CompartirContratoModalProps) {
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("contract_admin");
  const [unidad, setUnidad] = useState("");
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
      const todos = res.items || [];
      setUsuarios(
        todos.filter(
          (u) =>
            u.contrato_id === contrato.id ||
            u.role === "company" ||
            (contrato.unidad_negocio &&
              u.unidad_negocio === contrato.unidad_negocio),
        ),
      );
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
      setUnidad("");
      setError(null);
      cargar();
      Api.contratos
        .unidadesNegocio()
        .then((r) => setUnidades((r.items || []).map((u) => u.nombre)))
        .catch(() => setUnidades([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, contrato?.id]);

  if (!contrato) return null;

  // Acceso heredado: quienes leads la Unidad de Negocio del contrato entran
  // por jerarquía, sin que nadie los haya invitado a este contrato.
  const heredados = usuarios.filter(
    (u) =>
      contrato.unidad_negocio &&
      u.unidad_negocio === contrato.unidad_negocio &&
      u.contrato_id !== contrato.id,
  );
  const directos = usuarios.filter((u) => !heredados.includes(u));

  const valido = nombre.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const invitar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await Api.empresa.invitar({
        nombre: nombre.trim(),
        email: email.trim(),
        role: rol,
        contrato_id: rol === "company" ? null : contrato.id,
        unidad_negocio: unidad || null,
      });
      setNombre("");
      setEmail("");
      setUnidad("");
      await cargar();
      // En desarrollo el backend devuelve la clave temporal para poder
      // probarlo sin SMTP; en producción solo llega por correo.
      const clave = (res as unknown as { _dev_clave?: string })._dev_clave;
      toast.success("Usuario creado y acceso compartido", {
        description: clave
          ? `Se envió la invitación a ${email.trim()}. Clave temporal: ${clave}`
          : `Se envió la invitación a ${email.trim()}.`,
      });
    } catch (e) {
      setError(Api.mensajeError(e));
      toast.error("No se pudo compartir", { description: Api.mensajeError(e) });
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
      toast.success(`Permiso de ${u.nombre || u.email}: ${ROLES[nuevo].nombre}`);
    } catch (e) {
      setError(Api.mensajeError(e));
      toast.error("No se pudo cambiar el permiso", {
        description: Api.mensajeError(e),
      });
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
      toast.success(`Se quitó el acceso de ${u.nombre || u.email}`);
    } catch (e) {
      setError(Api.mensajeError(e));
      toast.error("No se pudo quitar el acceso", {
        description: Api.mensajeError(e),
      });
    }
  };

  const enlace =
    typeof window !== "undefined"
      ? `${window.location.origin}/contratos/${contrato.id}`
      : "";
  const copiar = async () => {
    // `navigator.clipboard` solo existe en contextos seguros (https o
    // localhost) y puede estar denegado por permisos. El fallback con
    // `execCommand` cubre ambos casos, y es lo que permite que el botón
    // funcione en http (la intranet).
    let copiadoOk = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(enlace);
        copiadoOk = true;
      }
    } catch {
      // sin permiso: se intenta el fallback
    }
    if (!copiadoOk) {
      try {
        const ta = document.createElement("textarea");
        ta.value = enlace;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        copiadoOk = document.execCommand("copy");
        ta.remove();
      } catch {
        copiadoOk = false;
      }
    }
    if (copiadoOk) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success("Enlace copiado al portapapeles");
    } else {
      setError("No se pudo copiar el enlace.");
      toast.error("No se pudo copiar el enlace");
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
        {numeroContrato(contrato)} · {contrato.nombre}. Las personas que agregues
        entran a ACREDITTIA y solo ven este contrato.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.82rem] text-red-700"
        >
          {error}
        </div>
      )}

      {puedeGestionar && (
        <>
          <div className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Dar acceso a una persona
          </div>
          <div
            className="gap-2.5"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            }}
          >
            <div>
              <label htmlFor="sh-nombre" className="block text-[0.8rem] font-semibold text-slate-700 mb-1">
                Nombre
              </label>
              <input
                id="sh-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Boris Jara"
                className="w-full h-10 px-3 border border-slate-300 rounded-lg text-[0.88rem] outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="sh-correo" className="block text-[0.8rem] font-semibold text-slate-700 mb-1">
                Correo
              </label>
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
              <label htmlFor="sh-rol" className="block text-[0.8rem] font-semibold text-slate-700 mb-1">
                Permiso
              </label>
              <select
                id="sh-rol"
                value={rol}
                onChange={(e) => setRol(e.target.value as Rol)}
                className="w-full h-10 px-2 border border-slate-300 rounded-lg text-[0.88rem] outline-none bg-white focus:border-blue-500"
              >
                <option value="contract_admin">Editor</option>
                <option value="visor">Visor — solo lectura</option>
                <option value="company">Administrador — toda la empresa</option>
              </select>
            </div>
            <div>
              <label htmlFor="sh-unidad" className="block text-[0.8rem] font-semibold text-slate-700 mb-1">
                Unidad de Negocio
              </label>
              <select
                id="sh-unidad"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                className="w-full h-10 px-2 border border-slate-300 rounded-lg text-[0.88rem] outline-none bg-white focus:border-blue-500"
              >
                <option value="">Sin unidad (acceso a este contrato)</option>
                {unidades.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
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

      {contrato.unidad_negocio && (
        <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2.5">
          <div className="text-[0.8rem] font-bold text-indigo-900">
            Acceso heredado por Unidad de Negocio
          </div>
          <div className="text-[0.78rem] text-indigo-700 mt-0.5">
            Los encargados de «{contrato.unidad_negocio}» entran a este contrato
            automáticamente, sin invitación.
          </div>
          {heredados.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {heredados.map((u) => (
                <li key={u.id} className="flex items-center gap-2 text-[0.8rem] text-indigo-900">
                  <span
                    aria-hidden="true"
                    className="w-7 h-7 rounded-full bg-indigo-200 text-indigo-900 grid place-items-center text-[0.65rem] font-bold flex-shrink-0"
                  >
                    {iniciales(u.nombre)}
                  </span>
                  <span className="font-semibold">{u.nombre || "Sin nombre"}</span>
                  <span className="text-indigo-600 truncate">{u.email}</span>
                  <span className="ml-auto px-2 py-0.5 rounded-md text-[0.65rem] font-bold bg-indigo-100 text-indigo-800">
                    Encargado de {u.unidad_negocio}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="text-[0.72rem] font-bold uppercase tracking-wider text-slate-500 mt-5 mb-2">
        Personas con acceso ({directos.length})
      </div>
      {cargando ? (
        <Spinner texto="Cargando accesos..." />
      ) : directos.length === 0 ? (
        <p className="text-[0.85rem] text-slate-500">
          Aún nadie más tiene acceso a este contrato.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {directos.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
            >
              <span
                aria-hidden="true"
                className="w-9 h-9 rounded-full bg-slate-800 text-white grid place-items-center text-[0.75rem] font-bold flex-shrink-0"
              >
                {iniciales(u.nombre)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[0.88rem] font-bold text-slate-800 truncate">
                  {u.nombre || "Sin nombre"}
                </div>
                <div className="text-[0.75rem] text-slate-500 truncate">{u.email}</div>
              </div>
              {puedeGestionar ? (
                <select
                  aria-label={`Permiso de ${u.nombre || u.email}`}
                  value={u.role}
                  onChange={(e) => cambiarRol(u, e.target.value as Rol)}
                  className="h-8 px-2 border border-slate-200 rounded-lg text-[0.78rem] font-semibold text-slate-600 bg-white outline-none"
                >
                  <option value="contract_admin">Editor</option>
                  <option value="visor">Visor — solo lectura</option>
                  <option value="company">Administrador — toda la empresa</option>
                </select>
              ) : (
                <span className="text-[0.75rem] font-semibold text-slate-500">
                  {ROLES[u.role as Rol]?.nombre ?? u.role}
                </span>
              )}
              {puedeGestionar && (
                <button
                  onClick={() => quitar(u)}
                  aria-label={
                    quitarId === u.id
                      ? `Confirmar quitar acceso a ${u.nombre || u.email}`
                      : `Quitar acceso a ${u.nombre || u.email}`
                  }
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
            <span
              className={`px-2 py-0.5 rounded-md text-[0.7rem] font-bold ${ROLES[r].fondo}`}
            >
              {ROLES[r].nombre}
            </span>
            {ROLES[r].desc}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
        <span className="text-[0.8rem] text-slate-600">🔗 Enlace del contrato:</span>
        <code className="flex-1 min-w-0 truncate text-[0.78rem] text-slate-700">
          {enlace}
        </code>
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
