import { useEffect, useRef } from "react";

/* ============================================================================
   Teclado iOS
   ----------------------------------------------------------------------------
   iOS Safari NO soporta interactive-widget=resizes-content: el teclado se
   superpone y Safari desplaza el visualViewport. La técnica fiable es NO tocar
   el layout y, en su lugar, exponer la altura del teclado en una variable CSS
   (--kb-inset) que cada pantalla usa para dejar hueco al teclado.

   `useKeyboardInset` mantiene `--kb-inset` actualizada en :root (documentElement)
   con la altura real del teclado.

   `useFocusReveal` evita que un input enfocado quede tapado: ajusta el scrollTop
   de un contenedor propio. No usa scrollIntoView (mueve ancestros y provoca el
   "salto" hacia arriba típico de iOS).
============================================================================ */

export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const sync = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty("--kb-inset", inset + "px");
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    // Safari a veces reporta el valor definitivo uno o dos frames después.
    const raf = requestAnimationFrame(sync);
    const t = setTimeout(sync, 250);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      cancelAnimationFrame(raf);
      clearTimeout(t);
      root.style.setProperty("--kb-inset", "0px");
    };
  }, []);
}

export function useFocusReveal() {
  const scrollerRef = useRef(null);

  // Al enfocar un input dentro del contenedor, comprobamos si quedaría tapado
  // por el teclado y, solo entonces, desplazamos el scroller lo justo para
  // dejarlo visible. Nada de scrollIntoView ni de animar (Safari reposiciona el
  // viewport y animar empeora el salto).
  const onFocusCapture = (e) => {
    const el = e.target;
    if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const run = () => {
      const vv = window.visualViewport;
      const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const r = el.getBoundingClientRect();
      const margin = 16;
      if (r.bottom > visibleBottom - margin) {
        scroller.scrollTop += Math.round(r.bottom - (visibleBottom - margin));
      } else if (r.top < (vv ? vv.offsetTop : 0) + margin) {
        scroller.scrollTop -= Math.round((vv ? vv.offsetTop : 0) + margin - r.top);
      }
    };
    // Tras el foco y tras el primer frame de la apertura del teclado.
    requestAnimationFrame(run);
    setTimeout(run, 200);
  };

  return { scrollerRef, onFocusCapture };
}
