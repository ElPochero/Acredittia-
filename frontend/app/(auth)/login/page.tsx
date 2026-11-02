"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

import * as Api from "@/lib/cliente";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [rut, setRut] = useState("");
  const [err, setErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/");
  }, [router]);

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    setErr("");
  };

  const getInputStyle = (field: string) => {
    if (fieldErrors[field]) {
      return {
        borderColor: "#EF4444",
        boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.25)",
        marginBottom: "4px",
      };
    }
    return {};
  };

  const handleLogin = async (e?: React.FormEvent, creds?: { email: string; password: string }) => {
    if (e) e.preventDefault();
    setErr("");
    const newFieldErrors: Record<string, string> = {};

    const userEmail = (creds?.email ?? email).trim();
    const userPass = (creds?.password ?? password).trim();

    if (!userEmail) {
      newFieldErrors.lEmail = "Falta ingresar el correo electrónico.";
    }
    if (!userPass) {
      newFieldErrors.lPassword = "Falta ingresar la contraseña.";
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setErr("Por favor completa los campos requeridos para ingresar.");
      return;
    }

    setFieldErrors({});

    try {
      const sesion = await Api.auth.login(userEmail, userPass);
      Api.setSession(sesion.access_token, sesion.refresh_token, sesion.user);
      router.push("/dashboard");
    } catch (error: any) {
      const code = error?.code || "";
      const msg = error?.message || "Credenciales inválidas. Revisa tus datos.";

      if (code === "CREDENCIALES_INVALIDAS" || error?.status === 401) {
        setFieldErrors({
          lEmail: "Verifica el correo electrónico.",
          lPassword: "Verifica la contraseña.",
        });
        setErr("Correo electrónico o contraseña incorrectos. Revisa ambos campos.");
      } else if (code === "ACCOUNT_PENDING" || error?.status === 403) {
        setErr("Tu cuenta está en revisión. Contacta a soporte para su aprobación.");
      } else if (code === "CUENTA_DESACTIVADA") {
        setErr("Tu cuenta ha sido desactivada por el administrador.");
      } else {
        setErr(msg);
      }
    }
  };

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErr("");
    const newFieldErrors: Record<string, string> = {};

    const userEmail = email.trim();
    const userPass = password.trim();
    const nombreEmpresa = empresa.trim();
    const rutEmpresa = rut.trim();

    if (!nombreEmpresa) {
      newFieldErrors.empresa = "Falta ingresar el nombre de la empresa.";
    }
    if (!rutEmpresa) {
      newFieldErrors.rut = "Falta ingresar el RUT de la empresa (ej: 76.543.210-3).";
    }
    if (!userEmail) {
      newFieldErrors.rEmail = "Falta ingresar el correo de contacto.";
    } else if (!userEmail.includes("@") || !userEmail.includes(".")) {
      newFieldErrors.rEmail = "Formato de correo inválido (ej: contacto@empresa.cl).";
    }

    if (!userPass) {
      newFieldErrors.rPassword = "Falta ingresar la contraseña.";
    } else {
      if (userPass.length < 8) {
        newFieldErrors.rPassword = "La contraseña requiere mínimo 8 caracteres.";
      } else if (!/[A-Z]/.test(userPass)) {
        newFieldErrors.rPassword = "La contraseña debe incluir al menos 1 mayúscula (A-Z).";
      } else if (!/[0-9]/.test(userPass)) {
        newFieldErrors.rPassword = "La contraseña debe incluir al menos 1 número (0-9).";
      }
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setErr("Por favor corrige los campos destacados en rojo.");
      return;
    }

    setFieldErrors({});

    try {
      await Api.auth.register({
        empresa: nombreEmpresa,
        rut: rutEmpresa,
        email: userEmail,
        password: userPass,
      });
      const sesion = await Api.auth.login(userEmail, userPass);
      Api.setSession(sesion.access_token, sesion.refresh_token, sesion.user);
      router.push("/dashboard");
    } catch (error: any) {
      const code = error?.code || "";
      const msg = error?.message || "Error al registrar la empresa.";

      if (code === "PASSWORD_DEBIL") {
        setFieldErrors({ rPassword: "Mínimo 8 caracteres, 1 mayúscula y 1 número." });
        setErr("La contraseña es muy débil. Debe incluir mínimo 8 caracteres, 1 mayúscula y 1 número.");
      } else if (code === "RUT_INVALIDO") {
        setFieldErrors({ rut: "RUT inválido o dígito verificador erróneo." });
        setErr("El RUT ingresado no es válido. Formato ejemplo: 76.543.210-3.");
      } else if (code === "EMAIL_EN_USO") {
        setFieldErrors({ rEmail: "Este correo electrónico ya está registrado." });
        setErr("El correo ingresado ya existe. Intenta ingresar en la pestaña 'Ingresar'.");
      } else if (code === "RUT_EN_USO") {
        setFieldErrors({ rut: "Este RUT de empresa ya está registrado." });
        setErr("El RUT ya existe registrado en el sistema.");
      } else {
        setErr(msg);
      }
    }
  };

  return (
    <>
      {/* ================= LOGIN SCREEN ================= */}
      <div id="login-screen">
        <div className="lcard">
          <div className="llogo" onClick={() => router.push("/")} style={{ cursor: "pointer" }}>
            <img
              src="/acredittia-mark.svg"
              alt=""
              style={{ width: 26, height: 24 } as any}
            />
            <span className="lwm">
              ACREDIT<span className="lcyan">TIA</span>
            </span>
          </div>
          <p className="lsub">IA + Minería · Plataforma de Acreditación</p>
          <div className="ltab">
            <button
              id="tab-login"
              className={tab === "login" ? "on" : ""}
              onClick={() => {
                setTab("login");
                setErr("");
                setFieldErrors({});
              }}
            >
              Ingresar
            </button>
            <button
              id="tab-register"
              className={tab === "register" ? "on" : ""}
              onClick={() => {
                setTab("register");
                setErr("");
                setFieldErrors({});
              }}
            >
              Registrar empresa
            </button>
          </div>

          {/* LOGIN FORM */}
          <form
            id="lform-login"
            className={`lform ${tab === "login" ? "active" : ""}`}
            onSubmit={handleLogin}
          >
            <input
              id="l-email"
              className="linput"
              style={getInputStyle("lEmail")}
              type="email"
              placeholder="Correo electrónico"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("lEmail");
              }}
            />
            {fieldErrors.lEmail && (
              <div style={{ color: "#EF4444", fontSize: "0.8rem", marginTop: "-6px", marginBottom: "10px", fontWeight: 500 }}>
                ⚠️ {fieldErrors.lEmail}
              </div>
            )}

            <input
              id="l-pass"
              className="linput"
              style={getInputStyle("lPassword")}
              type="password"
              placeholder="Contraseña"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("lPassword");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
            />
            {fieldErrors.lPassword && (
              <div style={{ color: "#EF4444", fontSize: "0.8rem", marginTop: "-6px", marginBottom: "10px", fontWeight: 500 }}>
                ⚠️ {fieldErrors.lPassword}
              </div>
            )}

            <button className="lbtn" type="submit" id="l-btn">
              Ingresar a la plataforma →
            </button>

            {err && tab === "login" && (
              <p className="lerr" id="l-err" style={{ marginTop: "12px" }}>
                {err}
              </p>
            )}
            <div className="ldemo space-y-2">
              <p>¿Quieres probar la plataforma? Ingresa con la cuenta Demo preconfigurada:</p>
              <button
                type="button"
                onClick={() => {
                  setEmail("demo@acredittia.cl");
                  setPassword("Demo2026!");
                  handleLogin(undefined, { email: "demo@acredittia.cl", password: "Demo2026!" });
                }}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer mt-2"
              >
                ⚡ Ingresar como Demo (demo@acredittia.cl)
              </button>
            </div>
          </form>

          {/* REGISTER FORM */}
          <form
            id="lform-register"
            className={`lform ${tab === "register" ? "active" : ""}`}
            onSubmit={handleRegister}
          >
            <input
              id="r-empresa"
              className="linput"
              style={getInputStyle("empresa")}
              type="text"
              placeholder="Nombre de la empresa"
              value={empresa}
              onChange={(e) => {
                setEmpresa(e.target.value);
                clearFieldError("empresa");
              }}
            />
            {fieldErrors.empresa && (
              <div style={{ color: "#EF4444", fontSize: "0.8rem", marginTop: "-6px", marginBottom: "10px", fontWeight: 500 }}>
                ⚠️ {fieldErrors.empresa}
              </div>
            )}

            <input
              id="r-rut"
              className="linput"
              style={getInputStyle("rut")}
              type="text"
              placeholder="RUT empresa (ej: 76.543.210-3)"
              value={rut}
              onChange={(e) => {
                setRut(e.target.value);
                clearFieldError("rut");
              }}
            />
            {fieldErrors.rut && (
              <div style={{ color: "#EF4444", fontSize: "0.8rem", marginTop: "-6px", marginBottom: "10px", fontWeight: 500 }}>
                ⚠️ {fieldErrors.rut}
              </div>
            )}

            <input
              id="r-email"
              className="linput"
              style={getInputStyle("rEmail")}
              type="email"
              placeholder="Correo de contacto"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("rEmail");
              }}
            />
            {fieldErrors.rEmail && (
              <div style={{ color: "#EF4444", fontSize: "0.8rem", marginTop: "-6px", marginBottom: "10px", fontWeight: 500 }}>
                ⚠️ {fieldErrors.rEmail}
              </div>
            )}

            <input
              id="r-pass"
              className="linput"
              style={getInputStyle("rPassword")}
              type="password"
              placeholder="Contraseña (mínimo 8 caracteres, 1 mayúscula, 1 número)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError("rPassword");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRegister();
              }}
            />
            {fieldErrors.rPassword && (
              <div style={{ color: "#EF4444", fontSize: "0.8rem", marginTop: "-6px", marginBottom: "10px", fontWeight: 500 }}>
                ⚠️ {fieldErrors.rPassword}
              </div>
            )}

            <button className="lbtn" type="submit" id="r-btn">
              Crear cuenta y comenzar →
            </button>

            {err && tab === "register" && (
              <p className="lerr" id="r-err" style={{ marginTop: "12px" }}>
                {err}
              </p>
            )}
          </form>

          <span
            className="lback"
            onClick={() => router.push("/")}
            style={{ cursor: "pointer" }}
          >
            ← Volver al inicio
          </span>
        </div>
      </div>
    </>
  );
}



