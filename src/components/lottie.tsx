"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** Caminho em /public, ex.: "/animacoes/vazio.json" */
  src: string;
  loop?: boolean;
  className?: string;
  /** Texto para leitores de tela. Sem label, a animação é decorativa. */
  label?: string;
};

/**
 * Toca uma animação Lottie com o player "light" (SVG, sem expressões/eval — compatível com a CSP).
 * Com prefers-reduced-motion, mostra só o quadro final, parado.
 */
export function Lottie({ src, loop = false, className, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    let destruir: (() => void) | undefined;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    (async () => {
      try {
        const [{ default: lottie }, dados] = await Promise.all([
          import("lottie-web/build/player/lottie_light"),
          fetch(src).then((r) => r.json()),
        ]);
        if (cancelado || !ref.current) return;
        const anim = lottie.loadAnimation({
          container: ref.current,
          renderer: "svg",
          loop: reduzir ? false : loop,
          autoplay: !reduzir,
          animationData: dados,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        });
        if (reduzir) anim.addEventListener("DOMLoaded", () => anim.goToAndStop(anim.totalFrames - 1, true));
        destruir = () => anim.destroy();
      } catch (e) {
        // Animação é enfeite: se falhar, some o espaço reservado e a página segue funcionando.
        if (ref.current) ref.current.hidden = true;
        if (process.env.NODE_ENV !== "production") console.warn("[Lottie]", src, e);
      }
    })();

    return () => {
      cancelado = true;
      destruir?.();
    };
  }, [src, loop]);

  return label ? (
    <div ref={ref} className={className} role="img" aria-label={label} />
  ) : (
    <div ref={ref} className={className} aria-hidden="true" />
  );
}
