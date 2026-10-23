"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import * as Api from "@/lib/cliente";

export default function AppHeader({
  onToggleMenu,
}: {
  onToggleMenu: () => void;
}) {
  const router = useRouter();
  const path = usePathname();
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Precarga los destinos del menú para que el primer clic no espere compilación/carga
  useEffect(() => {
    router.prefetch("/alertas");
    router.prefetch("/config");
  }, [router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpenUserMenu(true);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setOpenUserMenu(false);
    }, 250);
  };

  const getTitulo = () => {
    if (path.includes("/docs-trabajadores"))
      return { title: "Documentación de Trabajadores", sub: "Carga y vigencia de documentos del personal" };
    if (path.includes("/certificacion-laboral"))
      return { title: "Certificación Laboral", sub: "Períodos laborales y matriz documental" };
    if (path.includes("/admin"))
      return { title: "Administración", sub: "Gestión de empresas y usuarios" };
    if (path.includes("/contratos"))
      return { title: "Contratos", sub: "Administración de contratos" };
    if (path.includes("/faenas"))
      return { title: "Faenas", sub: "Proyectos activos" };
    if (path.includes("/mandantes"))
      return { title: "Mandantes", sub: "Empresas mandantes y grupos mineros" };
    if (path.includes("/personal"))
      return { title: "Personal", sub: "Trabajadores y credenciales" };
    if (path.includes("/equipos"))
      return { title: "Equipos", sub: "Vehículos y maquinaria" };
    if (path.includes("/cargos"))
      return { title: "Cargos", sub: "Catálogo de cargos operativos" };
    if (path.includes("/requisitos"))
      return { title: "Requisitos", sub: "Matriz documental" };
    if (path.includes("/plantillas"))
      return { title: "Plantillas", sub: "Plantillas de requisitos" };
    if (path.includes("/reportes"))
      return { title: "Reportes", sub: "Métricas y descargas" };
    if (path.includes("/alertas"))
      return { title: "Alertas", sub: "Notificaciones y vencimientos" };
    if (path.includes("/calendario"))
      return { title: "Calendario", sub: "Vista mensual" };
    if (path.includes("/integraciones"))
      return { title: "Integraciones", sub: "Conexiones externas" };
    if (path.includes("/config"))
      return { title: "Configuración", sub: "Ajustes de cuenta" };
    return { title: "Inicio", sub: "Resumen de la plataforma" };
  };

  const { title, sub } = getTitulo();
  const user = typeof window !== "undefined" ? Api.currentUser() : null;
  const name = user?.nombre ?? "Usuario";
  const initial = name.charAt(0).toUpperCase();

  const salir = async () => {
    const refresh = Api.refreshToken();
    if (refresh) await Api.auth.logout(refresh).catch(() => {});
    Api.clearSession();
    sessionStorage.clear();
    router.push("/login");
  };

  return (
    <header className="apphead">
      <button className="mob-menu-btn" onClick={onToggleMenu}>
        ☰
      </button>
      <div className="hleft">
        <h1 className="pagetitle">{title}</h1>
        <p className="pagesub">{sub}</p>
      </div>
      <div className="hright">
        <button
          className="hico-btn"
          onClick={() => alert("Centro de ayuda — próximamente")}
          title="Centro de ayuda"
        >
          ?
        </button>
        <button className="bell" onClick={() => router.push("/alertas")} title="Alertas">
          🔔<span className="bdot"></span>
        </button>

        {/* User Profile Chip with Dropdown */}
        <div
          ref={menuRef}
          className={`uchip-container relative ${openUserMenu ? "active" : ""}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ position: "relative", paddingBottom: "12px", marginBottom: "-12px" }}
        >
          <div
            className="uchip"
            onClick={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              setOpenUserMenu((prev) => !prev);
            }}
            style={{ cursor: "pointer", userSelect: "none" }}
            title="Opciones de usuario"
          >
            <div className="uav">{initial}</div>
            <div className="uinfo">
              <b>{name}</b>
              <small>{user?.email ?? ""}</small>
            </div>
            <span
              className="chev"
              style={{
                transform: openUserMenu ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "4px 6px",
                marginLeft: "4px",
              }}
            >
              ⌄
            </span>
          </div>

          {/* User Options Dropdown Menu */}
          {openUserMenu && (
            <div
              className="user-dropdown-menu"
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "0px",
                width: "220px",
                backgroundColor: "#0F172A",
                border: "1px solid #1E3A5F",
                borderRadius: "12px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                padding: "8px 0",
                zIndex: 9999,
              }}
            >
              <div
                style={{
                  padding: "8px 16px 10px",
                  borderBottom: "1px solid #1E3A5F",
                  marginBottom: "4px",
                }}
              >
                <div style={{ color: "#F8FAFC", fontWeight: 700, fontSize: "0.9rem" }}>
                  {name}
                </div>
                <div style={{ color: "#94A3B8", fontSize: "0.78rem" }}>
                  {user?.email ?? ""}
                </div>
                {user?.company?.nombre && (
                  <div
                    style={{
                      color: "#38BDF8",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      marginTop: "2px",
                    }}
                  >
                    🏢 {user.company.nombre}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setOpenUserMenu(false);
                  router.push("/config");
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 16px",
                  background: "transparent",
                  border: "none",
                  color: "#E2E8F0",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <span>⚙️</span> Mi Perfil / Configuración
              </button>

              <button
                onClick={() => {
                  setOpenUserMenu(false);
                  router.push("/contratos");
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 16px",
                  background: "transparent",
                  border: "none",
                  color: "#E2E8F0",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <span>📋</span> Mis Contratos
              </button>

              <div
                style={{
                  height: "1px",
                  backgroundColor: "#1E3A5F",
                  margin: "4px 0",
                }}
              />

              <button
                onClick={() => {
                  setOpenUserMenu(false);
                  salir();
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 16px",
                  background: "transparent",
                  border: "none",
                  color: "#F87171",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.15)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <span>🚪</span> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

