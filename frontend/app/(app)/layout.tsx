"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import { currentUser } from "@/lib/api";

import DashboardPage from "./dashboard/page";
import ContratosPage from "./contratos/page";
import MandantesPage from "./mandantes/page";
import AcreditacionesPage from "./faenas/page";
import PersonasPage from "./personal/page";
import DocsTrabajadoresPage from "./docs-trabajadores/page";
import EquiposPage from "./equipos/page";
import CargosPage from "./cargos/page";
import RequisitosPage from "./requisitos/page";
import PlantillasPage from "./plantillas/page";
import ReportesPage from "./reportes/page";
import AlertasPage from "./alertas/page";
import CalendarioPage from "./calendario/page";
import IntegracionesPage from "./integraciones/page";
import ConfigPage from "./config/page";
import AdminPage from "./admin/page";
import CertificacionLaboralPage from "./certificacion-laboral/page";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeRoute, setActiveRoute] = useState(pathname || "/dashboard");
  const [listo, setListo] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    if (!currentUser()) {
      router.replace("/login");
      return;
    }
    setListo(true);
  }, [router]);

  useEffect(() => {
    if (pathname) setActiveRoute(pathname);
  }, [pathname]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== "undefined") {
        setActiveRoute(window.location.pathname);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const setAppRoute = (route: string) => {
      setActiveRoute(route);
      if (typeof window !== "undefined" && window.location.pathname !== route) {
        window.history.pushState({}, "", route);
      }
    };
    (window as any).setAppRoute = setAppRoute;

    (window as any).navTo = (screen: string) => {
      const map: Record<string, string> = {
        dashboard: "/dashboard",
        contratos: "/contratos",
        proyectos: "/contratos",
        mandantes: "/mandantes",
        faenas: "/faenas",
        personas: "/personal",
        personal: "/personal",
        roster: "/personal",
        "docs-trabajadores": "/docs-trabajadores",
        certificacion: "/certificacion-laboral",
        "certificacion-laboral": "/certificacion-laboral",
        equipos_global: "/equipos",
        equipos: "/equipos",
        cargos: "/cargos",
        alertas: "/alertas",
        reportes: "/reportes",
        requisitos: "/requisitos",
        plantillas: "/plantillas",
        calendario: "/calendario",
        integraciones: "/integraciones",
        config: "/config",
        admin: "/admin",
      };
      const target = map[screen] || (screen.startsWith("/") ? screen : `/${screen}`);
      setAppRoute(target);
    };

    (window as any).goFaenas = () => (window as any).navTo("faenas");
    (window as any).openSubject = () => (window as any).navTo("personal");
    (window as any).openProj = () => (window as any).navTo("contratos");
    (window as any).openP = () => (window as any).navTo("personal");
    (window as any).openE = () => (window as any).navTo("equipos");

    (window as any).toast = (msg: string) => {
      let t = document.getElementById("app-toast");
      if (!t) {
        t = document.createElement("div");
        t.id = "app-toast";
        t.style.cssText =
          "position:fixed;bottom:24px;right:24px;background:#0F172A;color:#fff;padding:12px 20px;border-radius:12px;font-size:0.85rem;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.3);z-index:9999;transition:all 0.2s ease;";
        document.body.appendChild(t);
      }
      t.innerText = msg;
      t.style.opacity = "1";
      t.style.transform = "translateY(0)";
      setTimeout(() => {
        if (t) {
          t.style.opacity = "0";
          t.style.transform = "translateY(10px)";
        }
      }, 2500);
    };

    (window as any).toggleFold = (id: string, btn: HTMLElement, moreLabel: string, lessLabel: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      const isHidden = el.style.display === "none";
      el.style.display = isHidden ? "table-row-group" : "none";
      if (btn) {
        btn.innerText = isHidden ? (lessLabel || "▲ Mostrar menos") : (moreLabel || "▼ Mostrar más...");
      }
    };

    (window as any).filterTable = (query: string, tableId: string) => {
      const table = document.getElementById(tableId);
      if (!table) return;
      const rows = table.querySelectorAll("tbody tr");
      const q = query.toLowerCase().trim();
      rows.forEach((row: any) => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(q) ? "" : "none";
      });
    };
  }, []);

  if (!listo) return null;

  const isMatch = (r: string) => {
    if (r === "/dashboard") return activeRoute === "/dashboard" || activeRoute === "/";
    return activeRoute === r;
  };

  const knownRoutes = [
    "/dashboard", "/contratos", "/mandantes", "/faenas",
    "/personal", "/docs-trabajadores", "/equipos", "/cargos", "/requisitos",
    "/plantillas", "/reportes", "/alertas", "/calendario",
    "/integraciones", "/config", "/admin", "/certificacion-laboral"
  ];

  const isKnown = knownRoutes.some(r => r === "/dashboard" ? (activeRoute === "/dashboard" || activeRoute === "/") : activeRoute === r);

  return (
    <div id="app">
      <Sidebar isOpen={menuAbierto} onClose={() => setMenuAbierto(false)} />
      <main className="main">
        <AppHeader onToggleMenu={() => setMenuAbierto(!menuAbierto)} />
        <div className="content" id="view">
          <div style={{ display: isMatch("/dashboard") ? "block" : "none" }}><DashboardPage /></div>
          <div style={{ display: isMatch("/contratos") ? "block" : "none" }}><ContratosPage /></div>
          <div style={{ display: isMatch("/mandantes") ? "block" : "none" }}><MandantesPage /></div>
          <div style={{ display: isMatch("/faenas") ? "block" : "none" }}><AcreditacionesPage /></div>
          <div style={{ display: isMatch("/personal") ? "block" : "none" }}><PersonasPage /></div>
          <div style={{ display: isMatch("/docs-trabajadores") ? "block" : "none" }}><DocsTrabajadoresPage /></div>
          <div style={{ display: isMatch("/equipos") ? "block" : "none" }}><EquiposPage /></div>
          <div style={{ display: isMatch("/cargos") ? "block" : "none" }}><CargosPage /></div>
          <div style={{ display: isMatch("/requisitos") ? "block" : "none" }}><RequisitosPage /></div>
          <div style={{ display: isMatch("/plantillas") ? "block" : "none" }}><PlantillasPage /></div>
          <div style={{ display: isMatch("/reportes") ? "block" : "none" }}><ReportesPage /></div>
          <div style={{ display: isMatch("/alertas") ? "block" : "none" }}><AlertasPage /></div>
          <div style={{ display: isMatch("/calendario") ? "block" : "none" }}><CalendarioPage /></div>
          <div style={{ display: isMatch("/integraciones") ? "block" : "none" }}><IntegracionesPage /></div>
          <div style={{ display: isMatch("/config") ? "block" : "none" }}><ConfigPage /></div>
          <div style={{ display: isMatch("/admin") ? "block" : "none" }}><AdminPage /></div>
          <div style={{ display: isMatch("/certificacion-laboral") ? "block" : "none" }}><CertificacionLaboralPage /></div>
          {!isKnown && children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
