/** Sugestão de categoria para transações importadas: histórico do usuário > categoria da Pluggy > padrão. */

// Palavras da categoria da Pluggy (inglês ou português) → nome de categoria padrão do MyGrana.
const MAPA: [RegExp, string][] = [
  [/grocer|supermarket|supermercad|mercado/i, "Mercado"],
  [/restaurant|eating out|food and drinks|bar|restaurante/i, "Restaurante"],
  [/delivery|food delivery/i, "Delivery"],
  [/rent|aluguel/i, "Aluguel"],
  [/utilit|electricity|water|energia|água|gas bill/i, "Contas da casa"],
  [/telecom|internet|phone|mobile|celular/i, "Internet e celular"],
  [/gas station|fuel|combust/i, "Combustível"],
  [/taxi|ride|uber|99|transport app/i, "Aplicativo"],
  [/public transport|bus|metro|transporte público/i, "Transporte público"],
  [/pharma|drugstore|farmác/i, "Farmácia"],
  [/health|medical|doctor|hospital|saúde|dentist/i, "Consultas"],
  [/educat|school|course|educação/i, "Educação"],
  [/entertain|leisure|travel|lazer|cinema|game/i, "Lazer"],
  [/digital service|subscription|streaming|assinatura/i, "Assinaturas"],
  [/shopping|clothing|electronics|compras/i, "Compras"],
  [/salary|payroll|salário|wage/i, "Salário"],
  [/investment|dividend|rendimento|juros/i, "Investimentos"],
];

export function sugerirNomeCategoria(categoriaExterna: string | null, entrada: boolean) {
  if (categoriaExterna) {
    for (const [re, nome] of MAPA) {
      if (!re.test(categoriaExterna)) continue;
      const receita = nome === "Salário" || nome === "Investimentos";
      if (receita === entrada) return nome;
    }
  }
  return entrada ? "Outras receitas" : "Outros gastos";
}

export const normalizarDescricao = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\d+/g, "").replace(/\s+/g, " ").trim();
