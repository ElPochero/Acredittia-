import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | ACREDITTIA",
  description:
    "Política de tratamiento y protección de datos personales de ACREDITTIA conforme a la Ley 19.628 de la República de Chile.",
};

export default function PrivacidadPage() {
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
              AVISO LEGAL Y PROTECCIÓN DE DATOS
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Política de Privacidad
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Última actualización: 2026 · Conforme a la Ley N° 19.628 de Chile
            </p>
          </div>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              1. Identificación del Responsable
            </h2>
            <p>
              ACREDITTIA SpA (en adelante, &quot;ACREDITTIA&quot;), plataforma tecnológica para la gestión y
              acreditación de contratos, empresas, trabajadores y equipamiento en faenas mineras e
              industriales, resguarda la privacidad y seguridad de los datos personales suministrados por
              sus usuarios y clientes corporativos.
            </p>
          </section>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              2. Marco Normativo Aplicable
            </h2>
            <p>
              El tratamiento de datos personales se rige estrictamente por la Ley N° 19.628 sobre
              Protección de la Vida Privada de la República de Chile y sus modificaciones, así como por los
              estándares de seguridad exigidos por las compañías mandantes de la industria minera y
              energética nacional (conforme a la Ley N° 16.744 y deberes de coordinación de seguridad).
            </p>
          </section>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              3. Finalidad del Tratamiento de Información
            </h2>
            <p>
              Los antecedentes recabados a través de nuestro sitio web y plataforma —incluyendo datos de
              contacto comercial, certificados ocupacionales, licencias de conducir, pólizas de seguros y
              registros documentales de contratistas— son tratados con las siguientes finalidades
              exclusivas:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Atención y respuesta de solicitudes de contacto comercial y coordinación de
                demostraciones de la plataforma.
              </li>
              <li>
                Verificación de vigencia y consistencia documental requerida para el ingreso a faenas
                mineras.
              </li>
              <li>
                Generación de alertas preventivas automatizadas de vencimiento a administradores y
                trabajadores.
              </li>
            </ul>
          </section>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              4. Seguridad y Confidencialidad
            </h2>
            <p>
              ACREDITTIA adopta medidas técnicas de cifrado en tránsito (TLS/HTTPS) y en reposo para evitar
              la alteración, pérdida o acceso no autorizado a la información. En ningún caso comercializamos,
              arrendamos ni transferimos datos personales a terceros ajenos a la operación de acreditación
              contratada.
            </p>
          </section>

          <section className="space-y-3 text-sm text-slate-600 leading-relaxed">
            <h2 className="text-base font-bold text-slate-900">
              5. Derechos de los Titulares y Contacto
            </h2>
            <p>
              Los titulares de datos podrán ejercer en cualquier momento sus derechos de información,
              modificación, cancelación o bloqueo consagrados en la Ley N° 19.628, dirigiendo su
              solicitud por correo electrónico a:
            </p>
            <p className="font-semibold text-landing-azul">
              <a href="mailto:acredittia.contacto@gmail.com" className="hover:underline">
                acredittia.contacto@gmail.com
              </a>
            </p>
          </section>

          <div className="pt-6 border-t border-slate-200 text-xs text-slate-400 flex flex-col sm:flex-row justify-between gap-2">
            <span>© 2026 ACREDITTIA SpA · Todos los derechos reservados</span>
            <Link href="/terminos" className="text-landing-azul hover:underline">
              Ver Términos y Condiciones →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
