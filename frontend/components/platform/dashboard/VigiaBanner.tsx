"use client";

export default function VigiaBanner() {
  return (
    <div className="bg-emerald-50/90 border border-emerald-300/70 rounded-xl p-3.5 flex items-center gap-3 text-xs text-emerald-950 shadow-sm">
      <span className="text-base shrink-0" aria-hidden="true">🛡️</span>
      <div className="flex-1 font-medium">
        <span className="font-bold">Vigía IA Activo</span> — Todo documento que se sube en cualquier contrato se revisa al instante, sin días de validación manual.
      </div>
    </div>
  );
}
