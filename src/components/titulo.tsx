export function Titulo({ children, sub, acao }: { children: React.ReactNode; sub?: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[34px]">{children}</h1>
        {sub && <p className="mt-1.5 text-[15px] text-suave">{sub}</p>}
      </div>
      {acao}
    </div>
  );
}
