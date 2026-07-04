# Finance Master - TODO

## Database Schema
- [x] users table (already exists)
- [x] income_sources table (receitas: fixed, variable, extra)
- [x] income_entries table (valores mensais por fonte)
- [x] fixed_expenses table (gastos fixos: categorias)
- [x] fixed_expense_entries table (valores mensais por categoria)
- [x] qol_expenses table (qualidade de vida: cartão + à vista)
- [x] installment_expenses table (gastos a prazo com propagação automática)
- [x] installment_expense_months table (parcelas propagadas por mês)
- [x] planned_expenses table (gastos pontuais programados)
- [x] credit_cards table (cartões de crédito)
- [x] credit_card_monthly table (totais mensais por cartão)
- [x] financial_goals table (metas financeiras)
- [x] pluggy_connections table (conexões Pluggy/Open Finance)
- [x] pluggy_transactions table (transações importadas)
- [x] budget_settings table (orçamento base mensal)

## Backend (tRPC Routers)
- [x] router: dashboard (resumo mensal, FCP, saldo)
- [x] router: income (CRUD receitas + entradas mensais)
- [x] router: fixedExpenses (CRUD gastos fixos + entradas mensais)
- [x] router: qolExpenses (CRUD qualidade de vida por categoria)
- [x] router: installmentExpenses (CRUD + propagação automática de parcelas)
- [x] router: plannedExpenses (CRUD gastos pontuais programados)
- [x] router: creditCards (CRUD cartões + totais mensais)
- [x] router: financialGoals (CRUD metas financeiras)
- [x] router: annualHistory (histórico anual por categoria)
- [x] router: pluggy (configuração, sync, webhook handler)
- [x] router: budgetSettings (orçamento base mensal)

## Pluggy Integration
- [x] Endpoint POST /api/webhooks/pluggy para receber eventos
- [x] Lógica de auto-categorização de transações importadas
- [x] Sync manual via tRPC (pluggy.syncTransactions)
- [x] Armazenar CLIENT_ID e CLIENT_SECRET via secrets
- [x] Listar conexões ativas (items Pluggy)

## Frontend - Design System
- [x] Paleta de cores: dark theme premium (fundo #0A0F1E, accent verde/teal)
- [x] Tipografia: Inter para UI, fonte mono para valores financeiros
- [x] Componente: MoneyDisplay (valores formatados em BRL)
- [x] Componente: TrendBadge (variação % com seta)
- [x] Componente: CategoryBadge (badge colorido por categoria)
- [x] Animações: framer-motion para transições de página e cards

## Frontend - Layout Global
- [x] DashboardLayout com sidebar de navegação
- [x] Sidebar: links para todas as seções agrupadas (Visão Geral, Receitas, Gastos, Gestão)
- [x] Header: mês/ano selecionado + avatar do usuário
- [x] Month/Year selector global (persiste entre páginas via MonthContext)

## Frontend - Dashboard (/)
- [x] Card: Receita Total do Mês
- [x] Card: Gastos Fixos (valor + % do orçamento)
- [x] Card: Qualidade de Vida (valor + breakdown por categoria)
- [x] Card: Saldo Projetado
- [x] Card: FCP Score com fórmula visualizada
- [x] Gráfico: Donut de distribuição de gastos
- [x] Gráfico: Barras de receita vs gastos (últimos 6 meses)
- [x] Seção: Últimas transações Pluggy (se conectado)

## Frontend - Receitas (/receitas)
- [x] Tabela: Receita Líquida Fixa (Salários, Aluguéis)
- [x] Tabela: Receita Líquida Variável (Distribuição de Lucros)
- [x] Tabela: Receita Extra (Proventos, Resgates, 13º, Ressarcimentos)
- [x] Breakdown mensal em visualização de grade
- [x] Formulário: adicionar/editar fonte de receita
- [x] Total consolidado por mês

## Frontend - Gastos Fixos (/gastos-fixos)
- [x] Lista de categorias de gastos fixos com valor mensal
- [x] Comparativo orçado vs realizado
- [x] Formulário: adicionar/editar gasto fixo
- [x] Indicador visual: % do orçamento base consumido

## Frontend - Qualidade de Vida (/qualidade-de-vida)
- [x] Tabs: Lazer | Alimentação | Transporte | Saúde | Outros
- [x] Dentro de cada tab: sub-tabs Cartão de Crédito | À Vista
- [x] Tabela de lançamentos com data, descrição, valor, cartão
- [x] Formulário: adicionar lançamento
- [x] Totais por categoria e por forma de pagamento

## Frontend - Gastos a Prazo (/gastos-a-prazo)
- [x] Formulário: item, data, valor, nº parcelas, cartão
- [x] Preview automático de propagação nos meses futuros
- [x] Lista de parcelamentos ativos com progresso (parcela X de Y)
- [x] Visão mensal: quais parcelamentos vencem este mês

## Frontend - Gastos Programados (/gastos-programados)
- [x] Formulário: item, data, valor, tipo (cartão/à vista), categoria
- [x] Lista separada: Cartão de Crédito | À Vista
- [x] Breakdown mensal (Jan-Dez)

## Frontend - Cartões (/cartoes)
- [x] Lista de cartões com nome, total mensal, status pago
- [x] Formulário: adicionar/editar cartão
- [x] Toggle: marcar como pago
- [x] Histórico mensal por cartão

## Frontend - Metas Financeiras (/metas)
- [x] Lista de metas com período, data realização, patrimônio líquido
- [x] Barra de progresso visual
- [x] Formulário: adicionar/editar meta
- [x] Cálculo automático do FCP projetado

## Frontend - Visão Anual (/anual)
- [x] Tabela: Mês | Lazer | Alimentação | Transporte | Saúde | OG | TOTAL
- [x] Linha de MÉDIA ao final
- [x] Gráfico de barras empilhadas (stacked) por mês
- [x] Gráfico de linha: evolução do saldo ao longo do ano

## Frontend - FCP (/fcp)
- [x] Score visual com gauge/anel
- [x] Composição do mês (receita, gastos, poupança)
- [x] Marcos de poupança (5%, 15%, 20%, 30%)
- [x] Classificação: Atenção | Regular | Bom | Excelente

## Frontend - Integração Pluggy (/open-finance)
- [x] Formulário: inserir CLIENT_ID e CLIENT_SECRET
- [x] Botão: Conectar banco (abre Pluggy Connect Widget)
- [x] Lista de conexões ativas (banco, status, última sync)
- [x] Botão: Sincronizar agora
- [x] Lista de transações importadas com status de categorização
- [x] Interface para corrigir categoria de transação importada

## Tests
- [x] Teste: cálculo de propagação de parcelas
- [x] Teste: cálculo do FCP
- [x] Teste: router de dashboard (saldo mensal)
- [x] Teste: router de receitas
- [x] Teste: router de income (CRUD)
- [x] Teste: router de qol (CRUD)
- [x] Teste: router de installments (CRUD)
- [x] Teste: router de planned (CRUD)
- [x] Teste: router de creditCards (CRUD)
- [x] Teste: router de goals (CRUD)
- [x] Teste: router de pluggy (status, connections, transactions)
- [x] Teste: router de annual (history)
- [x] Teste: auth (me, logout)
- [x] Total: 36 testes passando

## GitHub & Deploy
- [x] Criar repositório privado no GitHub (bundle gerado para push manual)
- [x] Configurar README com instruções de deploy no Railway
- [x] Adicionar variáveis de ambiente necessárias ao README

## Autenticação Independente (sem Manus OAuth)
- [x] Remover dependência do Manus OAuth do servidor
- [x] Criar autenticação por PIN via JWT simples (variável APP_PIN no Railway)
- [x] Criar tela de login com PIN no frontend
- [x] Remover useAuth/getLoginUrl do Manus do frontend
- [x] Proteger todas as rotas tRPC com o novo sistema de auth
- [x] Atualizar variáveis de ambiente necessárias (apenas APP_PIN, JWT_SECRET e DATABASE_URL)
- [x] Push para GitHub e redeploy no Railway

## Categorização com IA (LLM integrado)
- [x] Backend: procedure pluggy.suggestCategory (LLM sugere categoria para uma transação)
- [x] Backend: procedure pluggy.bulkSuggestCategories (LLM sugere categorias para múltiplas transações)
- [x] Backend: procedure pluggy.applyCategory (salva categoria revisada pelo usuário)
- [x] Frontend: Botão "Categorizar com IA" na tela Open Finance
- [x] Frontend: Modal de revisão de categorias com sugestões da IA
- [x] Frontend: Indicador visual de progresso da categorização em lote
- [x] Frontend: Filtro por status (nao_categorizado / categorizado)
- [x] Frontend: Contador de transações pendentes de categorização

## Sistema de Regras Aprendidas para Categorização com IA
- [x] Criar tabela category_rules no schema e aplicar migration no Railway
- [x] Criar helpers no db.ts para salvar/buscar regras
- [x] Criar procedures tRPC para gerenciar regras
- [x] Atualizar prompt do autoCategorize para incluir regras aprendidas como contexto
- [x] Atualizar frontend para salvar correções como regras automaticamente

## ═══ V2 REBUILD: 4-Screen Mobile-First PWA ═══

## V2 Phase 1: Database Schema Updates
- [x] Add "pessoal" and "imprevistos" to all category enums
- [x] Add category_percentages JSON field to budget_settings
- [x] Add monthly_insights table (AI-generated insights)
- [x] Add goalType enum (commitment/optional) to financial_goals
- [x] Add suggestedMonthlyAmount to financial_goals
- [x] Apply all migrations via webdev_execute_sql

## V2 Phase 2: Backend Procedures
- [x] Create getDashboardFunnel helper (new model: renda - fixos - invest - compromissos = disponível)
- [x] Create getMonthlyInsight / generateMonthlyInsight procedures
- [x] Create monthEnd summary procedure (frontend card with surplus/deficit display)
- [x] Create extraIncome handling procedure (income.handleExtra mutation added to routers.ts)
- [x] Add installment auto-detection (X/Y pattern parsing in Pluggy sync)
- [x] Update routers for new 4-screen architecture

## V2 Phase 3: Layout & Design System
- [x] Rewrite AppLayout.tsx → mobile-first bottom nav (4 tabs)
- [x] Update App.tsx → 4 routes only (inicio, transacoes, configuracao, historico)
- [x] Refine index.css: tabular-nums, press feedback, stagger animations, glassmorphism
- [x] Ensure 4.5:1 contrast on muted text
- [x] Add skeleton loading components

## V2 Phase 4: Tela Início
- [x] Compact funnel summary card (renda → fixos → invest → compromissos → disponível)
- [x] AI insight card (1/month, dismissible, generated by LLM)
- [x] 6 category progress bars (spent/budget with %)
- [x] Alert when category >80% consumed
- [x] Empty state for first-time users
- [x] Month-end card (surplus/deficit with options)

## V2 Phase 5: Tela Transações
- [x] Transaction list with month filter
- [x] Category filter chips
- [x] Uncategorized badge count
- [x] "Categorizar com IA" batch button
- [x] Manual category correction (auto-saves rule)
- [x] Compromissos section (installments + planned for month)
- [x] Installment auto-detection from "X/Y" pattern

## V2 Phase 6: Tela Configuração
- [x] Income section (fixed + variable + extra sources)
- [x] Fixed expenses section (therapy as fixed)
- [x] Investment target setting
- [x] Category % distribution (6 categories)
- [x] Planned expenses (future items with category link)
- [x] Goals (wire goalType + suggestedMonthlyAmount through router/form)
- [x] Learned rules management (view/edit/delete patterns)
- [x] Pluggy connection management
- [x] Credit card management (added to Conexão tab in Configuração)

## V2 Phase 7: Tela Histórico
- [x] Month-over-month comparison cards
- [x] >20% variation alerts (highlight in Histórico - already implemented)
- [x] Trend line chart (last 6 months)
- [x] Category breakdown evolution
- [x] Investment tracking

## V2 Phase 8: Insights & Month-End Flow
- [x] AI insight generation on month start (invokeLLM)
- [x] Month-end closure card (surplus: invest/add to next; deficit: informative)
- [x] Extra income prompt (MonthEndCard surplus options in Início)

## V2 Phase 9: Testing & Polish
- [x] Vitest tests for new procedures (55 tests passing)
- [x] Skeleton loading states throughout
- [x] Empty states for all sections
- [x] Micro-interactions (press, stagger, transitions)
- [x] Accessibility audit (contrast, touch targets 44px, aria)
- [x] prefers-reduced-motion support (added to index.css)

## ═══ BUG FIXES (Reported Jul 4, 2026) ═══

- [x] BUG: AI categorization not working (fixed: added pessoal/imprevistos to z.enum, applyCategories returns {applied})
- [x] BUG: Salary added successfully but not displaying in UI (fixed: createIncomeSource returns {id: insertId})
- [x] BUG: Sync resets previously categorized transactions (fixed: upsert preserves reviewed categories, rules applied first)
- [x] BUG: Investment showing R$1000/month incorrectly (fixed: default changed to 0)
- [x] CHANGE: Only consider data from July 2026 forward (fixed: Historico counts from July 2026)
