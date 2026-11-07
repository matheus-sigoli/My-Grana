/** O circunflexo do ê como indicador: ^ para positivo, ˇ para negativo. */
export function Acento({ positivo, className = "" }: { positivo: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block size-[0.9em] ${className}`} fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={positivo ? "M5 15l7-7 7 7" : "M5 9l7 7 7-7"} />
    </svg>
  );
}
