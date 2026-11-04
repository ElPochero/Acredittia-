// Validación de RUT (Módulo 11) espejo del backend (`app/security.py`).
// Devuelve null si es inválido para mostrar el mensaje inline bajo el campo.
export function normalizarRut(entrada: string): string | null {
  const raw = (entrada || "").trim().toUpperCase().replace(/\s|\./g, "");
  const m = raw.match(/^(\d{7,8})-?([\dK])$/);
  if (!m) return null;
  const [, cuerpo, dv] = m;
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  if (dv !== esperado) return null;
  return `${cuerpo.slice(0, -6)}.${cuerpo.slice(-6, -3)}.${cuerpo.slice(-3)}-${dv}`;
}

export function validarRut(entrada: string): boolean {
  return normalizarRut(entrada) !== null;
}
