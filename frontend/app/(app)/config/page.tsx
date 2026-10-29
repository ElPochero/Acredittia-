"use client";

import React, { useState, useEffect } from "react";
import * as Api from "@/lib/cliente";
import type { Usuario, EmpresaDetalle } from "@/lib/tipos";

interface EventoPref {
  evento: string;
  descripcion?: string;
  canal_email: boolean;
  canal_whatsapp: boolean;
  origen?: string;
}

export default function ConfigPage() {
  const [tab, setTab] = useState<"perfil" | "empresa" | "notificaciones">("perfil");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  // Datos de Perfil
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // Datos de Empresa
  const [empresaDatos, setEmpresaDatos] = useState<any>(null);
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [empresaEmail, setEmpresaEmail] = useState("");

  // Preferencias de Notificación
  const [preferencias, setPreferencias] = useState<EventoPref[]>([]);
  const [catalogoEventos, setCatalogoEventos] = useState<Record<string, string>>({});

  const currentUser = typeof window !== "undefined" ? Api.currentUser() : null;
  const esCompanyOAdmin = currentUser?.role === "company" || currentUser?.role === "admin";

  const cargarDatos = async () => {
    setCargando(true);
    setMensaje(null);
    try {
      // 1. Cargar Perfil de Usuario
      const userRes = await Api.auth.me();
      setPerfil(userRes);
      setNombre(userRes.nombre || "");
      setEmail(userRes.email || "");

      // 2. Cargar Perfil de Empresa
      try {
        const empRes = await Api.empresa.perfil();
        setEmpresaDatos(empRes);
        setEmpresaNombre((empRes as any).nombre || "");
        setEmpresaEmail((empRes as any).email || "");
      } catch (e) {
        console.warn("No se pudo cargar perfil de empresa:", e);
      }

      // 3. Cargar Preferencias de Notificación
      try {
        const notifRes = await Api.notificaciones.preferencias();
        const items = (notifRes as any).items || [];
        const catalogoMap: Record<string, string> = {};
        ((notifRes as any).eventos || []).forEach((ev: any) => {
          catalogoMap[ev.evento] = ev.descripcion;
        });
        setCatalogoEventos(catalogoMap);
        setPreferencias(
          items.map((it: any) => ({
            evento: it.evento,
            descripcion: catalogoMap[it.evento] || it.evento,
            canal_email: Boolean(it.canal_email),
            canal_whatsapp: Boolean(it.canal_whatsapp),
            origen: it.origen,
          }))
        );
      } catch (e) {
        console.warn("No se pudieron cargar preferencias de notificación:", e);
      }
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: Api.mensajeError(err) });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleGuardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (passwordNueva) {
      if (passwordNueva.length < 8 || !/[A-Z]/.test(passwordNueva) || !/[0-9]/.test(passwordNueva)) {
        setMensaje({
          tipo: "error",
          texto: "La nueva contraseña debe tener al menos 8 caracteres, una mayúscula y un número.",
        });
        return;
      }
      if (passwordNueva !== passwordConfirm) {
        setMensaje({ tipo: "error", texto: "La nueva contraseña y su confirmación no coinciden." });
        return;
      }
      if (!passwordActual) {
        setMensaje({ tipo: "error", texto: "Debe ingresar su contraseña actual para confirmar el cambio." });
        return;
      }
    }

    setGuardando(true);
    try {
      const payload: any = { nombre, email };
      if (passwordNueva) {
        payload.password = passwordNueva;
        payload.password_actual = passwordActual;
        const refToken = Api.refreshToken();
        if (refToken) payload.refresh_token = refToken;
      }

      const res = await Api.auth.editarMe(payload);
      setPerfil(res as any);
      setPasswordActual("");
      setPasswordNueva("");
      setPasswordConfirm("");
      setMensaje({ tipo: "exito", texto: "Perfil actualizado correctamente." });
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: Api.mensajeError(err) });
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!esCompanyOAdmin) return;
    setMensaje(null);
    setGuardando(true);
    try {
      const res = await Api.empresa.editar({
        nombre: empresaNombre,
        email: empresaEmail,
      });
      setEmpresaDatos(res);
      setMensaje({ tipo: "exito", texto: "Datos de la empresa actualizados correctamente." });
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: Api.mensajeError(err) });
    } finally {
      setGuardando(false);
    }
  };

  const handleTogglePreferencia = (evento: string, canal: "canal_email" | "canal_whatsapp") => {
    setPreferencias((prev) =>
      prev.map((p) => (p.evento === evento ? { ...p, [canal]: !p[canal] } : p))
    );
  };

  const handleGuardarPreferencias = async () => {
    setMensaje(null);
    setGuardando(true);
    try {
      const body = preferencias.map((p) => ({
        evento: p.evento,
        canal_email: p.canal_email,
        canal_whatsapp: p.canal_whatsapp,
      }));
      await Api.notificaciones.editarPreferencias(body);
      setMensaje({ tipo: "exito", texto: "Preferencias de notificación guardadas con éxito." });
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: Api.mensajeError(err) });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Cargando configuración de la cuenta...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Banner de feedback */}
      {mensaje && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            mensaje.tipo === "exito"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{mensaje.tipo === "exito" ? "✅" : "⚠️"}</span>
            <span>{mensaje.texto}</span>
          </div>
          <button
            onClick={() => setMensaje(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          className={`pb-3 px-5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            tab === "perfil"
              ? "border-[#0F172A] text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => {
            setTab("perfil");
            setMensaje(null);
          }}
        >
          👤 Mi Perfil
        </button>
        <button
          className={`pb-3 px-5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            tab === "empresa"
              ? "border-[#0F172A] text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => {
            setTab("empresa");
            setMensaje(null);
          }}
        >
          🏢 Datos de Empresa
        </button>
        <button
          className={`pb-3 px-5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
            tab === "notificaciones"
              ? "border-[#0F172A] text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => {
            setTab("notificaciones");
            setMensaje(null);
          }}
        >
          🔔 Notificaciones y Alertas
        </button>
      </div>

      {/* Pestaña 1: Mi Perfil */}
      {tab === "perfil" && (
        <form onSubmit={handleGuardarPerfil} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-900">Información Personal</h3>
            <p className="text-xs text-slate-500">Actualice sus datos de contacto y credenciales de acceso</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Nombre Completo</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Correo Electrónico (Login)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Atributos del rol */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Rol en Sistema</span>
              <span className="font-bold text-slate-800 capitalize">
                {perfil?.role === "contract_admin"
                  ? "Administrador de Contrato (ADC)"
                  : perfil?.role === "visor"
                  ? "Visor de Contrato (Solo Lectura)"
                  : perfil?.role === "admin"
                  ? "Administrador Global"
                  : "Empresa Administradora"}
              </span>
            </div>
            {perfil?.contrato && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Contrato Asignado</span>
                <span className="font-bold text-cyan-700">{perfil.contrato.nombre}</span>
              </div>
            )}
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Estado de Cuenta</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Activa y verificada
              </span>
            </div>
          </div>

          {/* Sección Cambio de Contraseña */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Cambio de Contraseña</h4>
              <p className="text-xs text-slate-500">Deje estos campos en blanco si no desea modificar su clave</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Contraseña Actual</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Nueva Contraseña</label>
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={passwordNueva}
                  onChange={(e) => setPasswordNueva(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  placeholder="Repita la nueva clave"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={guardando}
              className="px-6 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {guardando ? "Guardando cambios..." : "Guardar Cambios de Perfil"}
            </button>
          </div>
        </form>
      )}

      {/* Pestaña 2: Datos de Empresa */}
      {tab === "empresa" && (
        <form onSubmit={handleGuardarEmpresa} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Razón Social y Datos Tributarios</h3>
              <p className="text-xs text-slate-500">Identificación fiscal de la empresa contratista proveedora</p>
            </div>
            {!esCompanyOAdmin && (
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-lg text-xs font-semibold">
                🔒 Vista de solo lectura (Rol ADC / Visor)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">RUT de la Empresa</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled
                  value={empresaDatos?.rut || ""}
                  className="w-full px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-mono cursor-not-allowed"
                />
                <span className="bg-slate-100 text-slate-600 px-2.5 py-2 rounded-xl text-[10px] font-bold uppercase whitespace-nowrap border border-slate-200">
                  Inmutable
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                El RUT identifica tributariamente a la cuenta y no puede ser modificado.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Razón Social / Nombre de Fantasía</label>
              <input
                type="text"
                required
                disabled={!esCompanyOAdmin}
                value={empresaNombre}
                onChange={(e) => setEmpresaNombre(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Correo Electrónico de Contacto</label>
              <input
                type="email"
                required
                disabled={!esCompanyOAdmin}
                value={empresaEmail}
                onChange={(e) => setEmpresaEmail(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Cumplimiento Global Consolidado</label>
              <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold flex items-center justify-between">
                <span>Promedio Ponderado de Contratos</span>
                <span className="text-emerald-700 font-mono text-sm">
                  {empresaDatos?.cumplimiento_global_pct != null
                    ? `${empresaDatos.cumplimiento_global_pct}%`
                    : "100%"}
                </span>
              </div>
            </div>
          </div>

          {esCompanyOAdmin && (
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={guardando}
                className="px-6 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {guardando ? "Guardando datos..." : "Actualizar Datos de Empresa"}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Pestaña 3: Preferencias de Notificación */}
      {tab === "notificaciones" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Matriz de Notificaciones y Alertas</h3>
              <p className="text-xs text-slate-500">
                Configure los canales de recepción para cada evento crítico de acreditación
              </p>
            </div>
            <button
              onClick={handleGuardarPreferencias}
              disabled={guardando}
              className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {guardando ? "Guardando..." : "Guardar Preferencias"}
            </button>
          </div>

          <div className="overflow-hidden border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Evento Notificable</th>
                  <th className="p-3.5 text-center w-36">📧 Correo Electrónico</th>
                  <th className="p-3.5 text-center w-36">💬 WhatsApp Business</th>
                  <th className="p-3.5 text-center w-28">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preferencias.map((pref) => (
                  <tr key={pref.evento} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{pref.descripcion || pref.evento}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{pref.evento}</div>
                    </td>
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={pref.canal_email}
                        onChange={() => handleTogglePreferencia(pref.evento, "canal_email")}
                        className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={pref.canal_whatsapp}
                        onChange={() => handleTogglePreferencia(pref.evento, "canal_whatsapp")}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          pref.origen === "configurado"
                            ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {pref.origen || "defecto"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleGuardarPreferencias}
              disabled={guardando}
              className="px-6 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {guardando ? "Guardando preferencias..." : "Guardar Preferencias de Notificación"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
