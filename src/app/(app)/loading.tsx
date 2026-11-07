import { Lottie } from "@/components/lottie";

export default function Carregando() {
  return (
    <div className="grid min-h-[50dvh] place-items-center" role="status">
      <div className="flex flex-col items-center gap-3">
        <Lottie src="/animacoes/carregando.json" loop className="h-14 w-24" />
        <p className="text-sm text-suave">Carregando…</p>
      </div>
    </div>
  );
}
