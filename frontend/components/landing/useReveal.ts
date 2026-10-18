"use client";

import { useEffect, useRef } from "react";

/**
 * useReveal — Singleton IntersectionObserver compartido para toda la landing (Regla R12).
 * Gestiona apariciones de elementos mediante la clase 'in-view' y callbacks únicos.
 * Respeta 'prefers-reduced-motion: reduce'.
 */

let sharedObserver: IntersectionObserver | null = null;
const observerCallbacks = new Map<Element, () => void>();

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
    return null;
  }

  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            const cb = observerCallbacks.get(entry.target);
            if (cb) {
              cb();
              observerCallbacks.delete(entry.target);
            }
            sharedObserver?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
  }

  return sharedObserver;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>(onReveal?: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof window !== "undefined") {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        el.classList.add("in-view");
        onReveal?.();
        return;
      }
    }

    const observer = getSharedObserver();
    if (!observer) {
      el.classList.add("in-view");
      onReveal?.();
      return;
    }

    if (onReveal) {
      observerCallbacks.set(el, onReveal);
    }
    observer.observe(el);

    return () => {
      observerCallbacks.delete(el);
      observer.unobserve(el);
    };
  }, [onReveal]);

  return ref;
}

export default useReveal;
