import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y Condiciones | ACREDITTIA",
  description:
    "Términos y condiciones de uso de la plataforma de acreditación ACREDITTIA.",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-[6%] py-4">
        <div className="max-w-[900px] mx-auto flex items-center justify-between">
          <Link href="/" aria-label="Volver al inicio">
            <Image
              src="/acredittia-logo.svg"
              alt="ACREDITTIA"
              width={150}
              height={38}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <Link
            href="/"
            className="text-xs sm:text-sm font-semibold text-landing-azul hover:text-landing-azul-d transition-colors flex items-center gap-1.5"
          >
            ← Volver al inicio
          </Link>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-[6%] py-12 sm:py-16">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 shadow-sm space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 text-[0.72rem] tracking-wider uppercase font-bold text-landing-azul bg-landing-azul-claro px-3 py-1 rounded-full mb-3">
              CONDICIONES GENERALES DEL SERVICIO
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Términos y Condiciones de Uso
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Vigencia 2026 · ACREDITTIA SpA
            </p>
          </div>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              1. Aceptación de los Términos
            </h2>
            <p>
              El acceso y uso de los servicios prestados por ACREDITTIA SpA (en adelante, &quot;ACREDITTIA&quot;) a
              través de su sitio web y entorno de software de acreditación implica la aceptación plena de
              las presentes condiciones por parte de los usuarios, contratistas y empresas mandantes.
            </p>
          </section>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              2. Objeto del Servicio
            </h2>
            <p>
              ACREDITTIA provee una solución SaaS asistida por inteligencia artificial orientada a
              facilitar la gestión, verificación de vigencias, centralización documental y preparación de
              expedientes para la acreditación en plataformas de faenas mineras e industriales (tales como
              SIGA, SUCAL, WebControl, Metacontratas u homólogas).
            </p>
          </section>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              3. Responsabilidad sobre la Documentación
            </h2>
            <p>
              Cada empresa proveedora y usuario administrador es responsable exclusivo de la veracidad,
              autenticidad, vigencia y legalidad de los certificados, licencias y antecedentes cargados en
              la plataforma. ACREDITTIA actúa como facilitador tecnológico y motor de alertas preventivas,
              correspondiendo la aprobación formal de ingreso a las faenas a los mandantes y sus
              plataformas de control respectivas.
            </p>
          </section>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              4. Disponibilidad y Continuidad Operativa
            </h2>
            <p>
              ACREDITTIA despliega su infraestructura sobre proveedores de nube de alta disponibilidad y
              aplica estándares de mantenimiento preventivo para asegurar la continuidad del servicio,
              notificando oportunamente ventanas de mantenimiento programado.
            </p>
          </section>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              5. Propiedad Intelectual
            </h2>
            <p>
              Las marcas, código fuente, algoritmos de lectura documental, flujos de agentes y diseños
              asociados a ACREDITTIA son propiedad exclusiva de ACREDITTIA SpA y están protegidos por las
              leyes de propiedad industrial e intelectual de Chile.
            </p>
          </section>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              6. Legislación y Jurisdicción
            </h2>
            <p>
              Estos términos se rigen por las leyes de la República de Chile. Para cualquier controversia
              derivada de su interpretación o cumplimiento, las partes se someten a los tribunales
              ordinarios de justicia de Santiago de Chile. Consultas o requerimientos pueden canalizarse a:
            </p>
            <p className="font-semibold text-landing-azul">
              <a href="mailto:acredittia.contacto@gmail.com" className="hover:underline">
                acredittia.contacto@gmail.com
              </a>
            </p>
          </section>

          <div className="pt-6 border-t border-slate-200 text-xs text-slate-400 flex flex-col sm:flex-row justify-between gap-2">
            <span>© 2026 ACREDITTIA SpA · Todos los derechos reservados</span>
            <Link href="/privacidad" className="text-landing-azul hover:underline">
              Ver Política de Privacidad →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
