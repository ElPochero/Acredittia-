"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const path = usePathname();

  const items = [
    { href: "/dashboard", icono: "🏠", nombre: "Inicio" },
    { href: "/contratos", icono: "📋", nombre: "Contratos" },
    { href: "/certificacion-laboral", icono: "📊", nombre: "Certificación" },
    { href: "/personal", icono: "👥", nombre: "Personal" },
    { href: "/equipos", icono: "🚛", nombre: "Equipos" },
    { href: "/alertas", icono: "🔔", nombre: "Alertas" },
  ];

  return (
    <div className="app-bottom-nav">
      <div className="abn-items">
        {items.map((item) => {
          const active = path.startsWith(item.href) ? "active" : "";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`abn-item ${active}`}
            >
              <span className="abn-ico">{item.icono}</span>
              {item.nombre}
              {item.href === "/alertas" && (
                <span className="abn-badge" style={{ display: "none" }}>
                  !
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
