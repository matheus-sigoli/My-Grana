import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="font-display text-5xl font-bold text-marca">404</p>
        <p className="mt-2 text-suave">Não encontramos essa página.</p>
        <Link href="/" className="btn mt-6">Voltar ao painel</Link>
      </div>
    </main>
  );
}
