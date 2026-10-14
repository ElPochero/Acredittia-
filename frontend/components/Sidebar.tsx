"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";

const ITEMS = [
  { href: "/dashboard", icono: "🏠", nombre: "Inicio" },
  { href: "/contratos", icono: "📋", nombre: "Contratos" },
  { href: "/certificacion-laboral", icono: "📊", nombre: "Certificación Laboral" },
  { href: "/mandantes", icono: "🏢", nombre: "Mandantes" },
  { href: "/personal", icono: "👥", nombre: "Personal" },
  { href: "/docs-trabajadores", icono: "📁", nombre: "Docs. Trabajadores" },
  { href: "/equipos", icono: "🚛", nombre: "Equipos / Vehículos" },
  { href: "/cargos", icono: "🪪", nombre: "Cargos" },
  { href: "/requisitos", icono: "📑", nombre: "Requisitos" },
  { href: "/plantillas", icono: "📐", nombre: "Plantillas" },
  { href: "/reportes", icono: "📊", nombre: "Reportes" },
  { href: "/alertas", icono: "🔔", nombre: "Alertas" },
  { href: "/calendario", icono: "📅", nombre: "Calendario" },
  { href: "/integraciones", icono: "🔌", nombre: "Integraciones" },
];

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const path = usePathname();
  const router = useRouter();
  const [currentRoute, setCurrentRoute] = useState(path || "/dashboard");
  const [noLeidas, setNoLeidas] = useState(0);
  const user = typeof window !== "undefined" ? Api.currentUser() : null;
  const esAdmin = user?.role === "admin";
  const impersonando =
    typeof window !== "undefined"
      ? sessionStorage.getItem("impersonar_nombre")
      : null;

  useEffect(() => {
    if (path) setCurrentRoute(path);
  }, [path]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        setCurrentRoute(window.location.pathname);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (esAdmin && !impersonando) return;
    Api.alertas
      .resumen()
      .then((r) => setNoLeidas(r?.no_leidas ?? 0))
      .catch(() => {});
  }, [esAdmin, impersonando]);

  const handleNav = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setCurrentRoute(href);
    if (typeof (window as any).setAppRoute === "function") {
      (window as any).setAppRoute(href);
    } else {
      router.push(href);
    }
  };

  const salir = async () => {
    const refresh = Api.refreshToken();
    if (refresh) await Api.auth.logout(refresh).catch(() => {});
    Api.clearSession();
    sessionStorage.clear();
    router.push("/login");
  };

  const subtitulo = esAdmin
    ? "Administración"
    : (user?.contrato?.nombre ?? user?.company?.nombre ?? "Mi Empresa");
  const name = user?.nombre ?? "Usuario";
  const initial = name.charAt(0).toUpperCase();

  const isItemActive = (href: string) => {
    if (href === "/dashboard") return currentRoute === "/dashboard" || currentRoute === "/";
    return currentRoute.startsWith(href);
  };

  return (
    <>
      <aside className={`side ${isOpen ? "mob-open" : ""}`}>
        {/* Logo */}
        <div className="slogo" onClick={(e) => handleNav(e, "/dashboard")} style={{ cursor: "pointer" }}>
          <svg
            className="mark"
            viewBox="0 0 100 92"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="cop1b" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#e3ad74" />
                <stop offset=".5" stopColor="#c98a4b" />
                <stop offset="1" stopColor="#8f5223" />
              </linearGradient>
              <linearGradient id="cop2b" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f2cda0" />
                <stop offset="1" stopColor="#b06a30" />
              </linearGradient>
            </defs>
            <path
              d="M50 6 L92 80 L66 80 L50 42 L34 80 L8 80 Z"
              fill="url(#cop1b)"
            />
            <path d="M50 6 L66 36 L50 44 Z" fill="url(#cop2b)" />
            <path
              d="M50 6 L92 80 L80 80 L50 24 Z"
              fill="#6e3e18"
              opacity=".22"
            />
          </svg>
          <div>
            <span className="wm">
              ACREDIT<span className="cyan">TIA</span>
            </span>
            <span className="wmsub">Plataforma de Acreditación</span>
          </div>
        </div>

        {/* User Info */}
        <div className="suser">
          <div className="su-av" id="su-av">
            {initial}
          </div>
          <div className="su-info">
            <b id="su-name">{name}</b>
            <small id="su-role">{esAdmin ? "Administrador" : "Usuario"}</small>
          </div>
        </div>

        {/* Company Selector */}
        <div
          className="orgsw"
          onClick={() => alert("Cambiar de empresa — demo")}
        >
          <span className="orgic">⛏️</span>
          <span className="orgnm" id="dyn-orgname">
            {subtitulo}
          </span>
          <span className="chev">⌄</span>
        </div>

        {impersonando && (
          <div className="mx-3 mb-2 rounded-lg bg-amber-500/90 px-3 py-2 text-xs font-semibold text-white">
            Viendo como {impersonando}
            <button
              className="ml-2 underline"
              onClick={(e) => {
                sessionStorage.clear();
                handleNav(e, "/admin");
              }}
            >
              salir
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav className="snav" id="snav">
          {esAdmin && (
            <Link
              href="/admin"
              onClick={(e) => handleNav(e, "/admin")}
              className={`snavi ${isItemActive("/admin") ? "active" : ""}`}
              title="Panel admin"
              data-tooltip="Panel admin"
            >
              <span className="ico">🛡️</span>Panel admin
            </Link>
          )}
          {(!esAdmin || impersonando) &&
            ITEMS.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={(e) => handleNav(e, i.href)}
                className={`snavi ${isItemActive(i.href) ? "active" : ""}`}
                title={i.nombre}
                data-tooltip={i.nombre}
              >
                <span className="ico">{i.icono}</span>
                {i.nombre}
                {i.href === "/alertas" && noLeidas > 0 && (
                  <span className="nbadge">{noLeidas}</span>
                )}
              </Link>
            ))}
        </nav>

        {/* Bottom Menu */}
        <div className="sbottom">
          <Link
            href="/config"
            onClick={(e) => handleNav(e, "/config")}
            className={`snavi ${isItemActive("/config") ? "active" : ""}`}
            title="Configuración"
            data-tooltip="Configuración"
          >
            <span className="ico">⚙️</span>Configuración
          </Link>
          <a
            className="snavi"
            onClick={() => alert("Centro de ayuda — próximamente")}
            style={{ cursor: "pointer" }}
            title="Ayuda"
            data-tooltip="Ayuda"
          >
            <span className="ico">❓</span>Ayuda
          </a>
          <a
            className="snavi snavi-logout"
            onClick={salir}
            style={{ cursor: "pointer" }}
            title="Cerrar sesión"
            data-tooltip="Cerrar sesión"
          >
            <span className="ico">🚪</span>Cerrar sesión
          </a>
        </div>
      </aside>

      {isOpen && (
        <div
          className="mob-overlay"
          onClick={onClose}
          style={{ display: "block" }}
        ></div>
      )}
    </>
  );
}
