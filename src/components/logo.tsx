/** A moeda: a marca do MyGrana. Disco ipê com um "G" em tinta (cores fixas: funciona nos dois temas). */
export function Moeda({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#F6C343" />
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="#0F1B17" strokeOpacity=".18" strokeWidth="1.6" />
      <path d="M20.6 12.1A6.2 6.2 0 1 0 22.2 16.4H16.6" fill="none" stroke="#0F1B17" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight text-marca ${className}`}>
      <Moeda className="size-[1.1em] shrink-0" />
      <span>
        <span className="font-semibold opacity-75">My</span>Grana
      </span>
    </span>
  );
}
