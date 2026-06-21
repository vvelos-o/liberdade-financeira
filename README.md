# Finance Master — Gestão Financeira Pessoal

Um webapp completo de gestão financeira pessoal inspirado na metodologia "Investidor Mestre", com integração ao Open Finance via Pluggy e sincronização automática de transações bancárias.

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | Visão mensal com receitas, gastos, saldo e FCP score |
| **Receitas** | Receitas fixas, variáveis e extras com breakdown mensal |
| **Gastos Fixos** | Orçado vs realizado por categoria |
| **Qualidade de Vida** | Lazer, Alimentação, Transporte, Saúde, OG — cartão e à vista |
| **Gastos a Prazo** | Parcelamentos com propagação automática entre meses |
| **Gastos Programados** | Despesas pontuais planejadas |
| **Cartões** | Gestão de múltiplos cartões com status de pagamento |
| **Metas Financeiras** | Objetivos com progresso e projeção |
| **Visão Anual** | Tabela histórica `Mês | Lazer | Alimentação | Transporte | Saúde | OG | TOTAL` |
| **FCP** | Fator de Crescimento de Patrimônio com marcos de poupança |
| **Open Finance** | Integração Pluggy para sync automático de transações |

## Stack Tecnológica

- **Frontend:** React 19 + TypeScript + Tailwind CSS 4 + Framer Motion
- **Backend:** Node.js + Express + tRPC 11
- **Banco de dados:** MySQL (TiDB compatível)
- **ORM:** Drizzle ORM
- **Auth:** Manus OAuth
- **Open Finance:** Pluggy API (meu.pluggy.ai)

## Deploy no Railway

### 1. Pré-requisitos

- Conta no [Railway](https://railway.app)
- Conta no [Manus](https://manus.im) para OAuth
- Conta no [meu.pluggy.ai](https://meu.pluggy.ai) para Open Finance (opcional)

### 2. Criar projeto no Railway

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Criar novo projeto
railway init
```

### 3. Adicionar banco de dados MySQL

No painel do Railway, adicione um plugin MySQL ao seu projeto. Copie a `DATABASE_URL` gerada.

### 4. Variáveis de ambiente obrigatórias

Configure as seguintes variáveis no painel do Railway (Settings → Variables):

```env
# Banco de dados (gerado pelo Railway MySQL plugin)
DATABASE_URL=mysql://user:password@host:port/database

# Autenticação (gerado pelo Manus)
JWT_SECRET=seu_jwt_secret_aqui
VITE_APP_ID=seu_app_id_manus
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im
OWNER_OPEN_ID=seu_open_id_manus
OWNER_NAME=Seu Nome

# Open Finance — Pluggy (opcional, para sync automático)
PLUGGY_CLIENT_ID=seu_client_id_pluggy
PLUGGY_CLIENT_SECRET=seu_client_secret_pluggy
```

### 5. Deploy

```bash
# Na raiz do projeto
railway up
```

### 6. Configurar webhook Pluggy (opcional)

Após o deploy, configure o webhook no painel do Pluggy:

- URL: `https://seu-app.railway.app/api/webhooks/pluggy`
- Eventos: `item/updated`, `transactions/updated`

## Desenvolvimento Local

```bash
# Instalar dependências
pnpm install

# Iniciar servidor de desenvolvimento
pnpm dev

# Rodar testes
pnpm test

# Gerar migrations do banco
pnpm drizzle-kit generate

# Aplicar migrations
pnpm drizzle-kit migrate
```

## Estrutura do Projeto

```
finance-master/
├── client/src/
│   ├── pages/          # Todas as páginas do app
│   ├── components/     # Componentes reutilizáveis
│   └── contexts/       # MonthContext (mês/ano global)
├── server/
│   ├── routers.ts      # tRPC routers principais
│   ├── routers/pluggy.ts  # Integração Pluggy
│   ├── db.ts           # Query helpers
│   └── finance.test.ts # 36 testes unitários
└── drizzle/
    └── schema.ts       # Schema do banco de dados
```

## Integração Open Finance (Pluggy)

1. Crie uma conta em [meu.pluggy.ai](https://meu.pluggy.ai)
2. Obtenha seu `CLIENT_ID` e `CLIENT_SECRET` no painel de desenvolvedor
3. Configure as variáveis de ambiente `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`
4. No app, acesse **Open Finance** → **Conectar Banco**
5. O sistema abrirá o Pluggy Connect para você autorizar o acesso aos seus dados bancários
6. As transações serão sincronizadas automaticamente via webhook

## Licença

MIT
