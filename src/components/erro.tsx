export function Erro({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return (
    <p role="alert" className="rounded-xl bg-despesa/10 px-4 py-3 text-[15px] font-medium text-despesa">
      {msg}
    </p>
  );
}
