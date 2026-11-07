import { SubnavInvestimentos } from "@/components/investimentos/subnav";

export default function InvestimentosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SubnavInvestimentos />
      {children}
    </>
  );
}
