/**
 * Single source of truth for all category definitions.
 * Import from here instead of duplicating enums across files.
 */

export const VARIABLE_CATEGORIES = [
  "lazer",
  "alimentacao",
  "saude",
  "transporte",
  "pessoal",
  "outros",
  "imprevistos",
] as const;

export const FULL_CATEGORIES = [
  ...VARIABLE_CATEGORIES,
  "receita",
  "receita_contabilizada",
  "fixo",
  "investimento",
  "nao_categorizado",
] as const;

export type VariableCategory = (typeof VARIABLE_CATEGORIES)[number];
export type FinanceCategory = (typeof FULL_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  lazer: "Lazer",
  alimentacao: "Alimentação",
  transporte: "Transporte",
  saude: "Saúde",
  outros: "Outros",
  pessoal: "Pessoal",
  imprevistos: "Imprevistos",
  receita: "Receita Extra",
  receita_contabilizada: "Já Contabilizado",
  fixo: "Fixo",
  investimento: "Investimento",
  nao_categorizado: "Não categorizado",
};

export const CATEGORY_COLORS: Record<string, string> = {
  lazer: "#a855f7",
  alimentacao: "#f97316",
  transporte: "#60a5fa",
  saude: "#34d399",
  outros: "#9ca3af",
  pessoal: "#f472b6",
  imprevistos: "#fbbf24",
};

export const DEFAULT_CATEGORY_PERCENTAGES: Record<string, number> = {
  lazer: 25,
  alimentacao: 25,
  saude: 15,
  transporte: 8,
  pessoal: 10,
  outros: 10,
  imprevistos: 7,
};
