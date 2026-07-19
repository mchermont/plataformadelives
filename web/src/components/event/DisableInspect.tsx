"use client";

import { useEffect } from "react";

/**
 * Bloqueia clique-direito e atalhos comuns de inspeção (F12, Ctrl+Shift+I/J/C,
 * Ctrl+U). Dificulta o acesso casual — NÃO impede o DevTools de fato: o
 * navegador reserva F12 e o menu "Mais ferramentas > Ferramentas do
 * desenvolvedor" continua acessível independente de JS. Não há como bloquear
 * isso de verdade a partir da página.
 */
export function DisableInspect() {
  useEffect(() => {
    function blockContext(e: MouseEvent) {
      e.preventDefault();
    }
    function blockKeys(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(k)) ||
        (e.ctrlKey && k === "u")
      ) {
        e.preventDefault();
      }
    }
    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("keydown", blockKeys);
    return () => {
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("keydown", blockKeys);
    };
  }, []);

  return null;
}
