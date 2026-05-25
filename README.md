# NGR GLOBAL - Agenda de Consultores

Sistema web para gerenciamento de agenda de consultores de TI da NGR Global.

## 🚀 Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 18 + TypeScript + Vite |
| UI/Estilo | TailwindCSS |
| Backend | Node.js + Express + TypeScript |
| Banco de Dados | MongoDB + Mongoose |
| Autenticação | JWT + Passport.js |

## 📋 Funcionalidades

### Perfis de Usuário

| Perfil | Descrição |
|--------|-----------|
| **Administrador** | Acesso total ao sistema |
| **Usuário** | Acesso à agenda, pode ver agenda de todos os consultores |

### Funções dos Consultores
- Gerente
- Import
- Export
- Câmbio
- Drawback
- Recof
- Suporte

*Um usuário pode ter múltiplas funções.*

### Funcionalidades do Sistema
- ✅ Login com troca obrigatória de senha no primeiro acesso
- ✅ CRUD de Usuários/Consultores
- ✅ CRUD de Projetos
- ✅ CRUD de Funções
- ✅ CRUD de Status de Alocação
- ✅ Visualização da agenda (grid tipo planilha)
- ✅ Criar/editar/excluir alocações
- ✅ Alocação em massa (múltiplos dias/períodos)
- ✅ Filtro de consultores
- ✅ Visualização multi-semana (1-4 semanas)
- ✅ Detecção automática de conflitos
- ✅ Rastreamento de quem criou cada alocação
- ✅ Atualização automática em tempo real (configurável via variável de ambiente)
- ✅ Timeout de inatividade com aviso (logout automático após período sem atividade)
- ✅ Logs de acesso ao sistema (últimas 32 horas, apenas para administradores)

## 🎨 Layout

Interface com identidade visual NGR Global:
- Fundo branco com paleta de cores azul
- Sidebar com logo NGR Global
- Grid de agenda mostrando todos os slots de horário

### Status de Alocação e Cores

| Status | Cor |
|--------|-----|
| Confirmado Presencial | Amarelo |
| Confirmado Remoto | Azul |
| À Confirmar | Verde |
| Livre | Verde Claro |
| Bloqueado | Cinza |
| Conflito | Vermelho |
| Ponte | Cinza Claro |
| Feriado | Cinza Médio |
| Final de Semana | Cinza Bem Claro |

### Períodos do Dia

| Período | Horários |
|---------|----------|
| Manhã | 08:00-10:00, 10:00-12:00 |
| Tarde | 13:00-15:00, 15:00-17:00 |
| Noite | 18:00-20:00, 20:00-22:00 |

## 🛠️ Instalação

### Pré-requisitos
- Node.js 18+
- MongoDB (local ou MongoDB Atlas)
- npm ou yarn

### 1. Configure as variáveis de ambiente
```bash
# Copie o arquivo de exemplo
cp server/.env.example server/.env

# Edite o arquivo .env com suas configurações
# - MONGODB_URI: sua string de conexão MongoDB
# - JWT_SECRET: uma chave secreta segura
# - AGENDA_POLLING_INTERVAL: intervalo de atualização automática da agenda (em milissegundos)
#   Padrão: 30000 (30 segundos)
#   Mínimo: 5000 (5 segundos)
#   Máximo: 300000 (5 minutos)
```

**Variáveis de ambiente disponíveis:**

| Variável | Descrição | Padrão | Obrigatório |
|----------|-----------|--------|-------------|
| `MONGODB_URI` | String de conexão MongoDB | - | ✅ Sim |
| `JWT_SECRET` | Chave secreta para JWT | - | ✅ Sim |
| `AGENDA_POLLING_INTERVAL` | Intervalo de atualização automática da agenda (ms) | 30000 | ❌ Não |
| `PORT` | Porta do servidor backend | 3001 | ❌ Não |
| `CLIENT_URL` | URL do frontend (para CORS) | http://localhost:5173 | ❌ Não |

### 2. Instale as dependências
```bash
npm install
```

### 3. Inicie o MongoDB
**Opção A — Docker (recomendado no Mac):**
```bash
docker compose -f docker-compose.dev.yml up -d
```
Use no `server/.env`: `MONGODB_URI=mongodb://localhost:27017/consultant-scheduler`

**Opção B — MongoDB instalado na máquina** (em outro terminal, deixe rodando):
```bash
npm run mongo:dev
```

**Opção C — MongoDB Atlas:** use a URI do Atlas em `MONGODB_URI` no `server/.env` (não precisa subir Mongo local).

### 4. Execute o seed (dados iniciais)
```bash
cd server
npx tsx src/scripts/seed.ts
```

### 5. Inicie o sistema
```bash
# Na raiz do projeto
npm run dev
```

O sistema estará disponível em:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## 🚀 Deploy em Produção

Para fazer deploy em produção usando Docker e Traefik (proxy reverso), consulte o guia completo:

📖 **[DEPLOY-AGENDA.md](./DEPLOY-AGENDA.md)**

A aplicação está configurada para rodar em:
- **Produção:** `https://agenda.fpsoftware.cloud` (subdomínio)
- **Desenvolvimento:** `http://localhost:5173`

### Deploy Rápido

```bash
# Na VPS
cd ~/consultant-scheduler
git pull
./deploy.sh
```

O script `deploy.sh` automatiza todo o processo de deploy.

## 🔑 Credenciais

Após executar o seed:

| Perfil | Email | Senha |
|--------|-------|-------|
| Administrador | admin@ngrglobal.com.br | Ngr@123 |
| Consultor | [email]@ngrglobal.com.br | Ngr@123 |

**⚠️ Importante:** Consultores precisarão trocar a senha no primeiro login.

## 📁 Estrutura do Projeto

```
consultant-scheduler/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   │   ├── Grid/       # Componentes da agenda
│   │   │   └── Layout/     # Layout principal
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── services/       # Chamadas à API
│   │   ├── store/          # Estado global (Zustand)
│   │   └── types/          # Tipos TypeScript
│   └── ...
├── server/                 # Backend Node.js
│   ├── src/
│   │   ├── config/         # Configurações (DB, Passport)
│   │   ├── controllers/    # Controladores
│   │   ├── middleware/     # Middlewares
│   │   ├── models/         # Modelos MongoDB
│   │   ├── routes/         # Rotas da API
│   │   ├── scripts/        # Scripts (seed)
│   │   └── types/          # Tipos TypeScript
│   └── ...
└── package.json            # Workspace root
```

## 🔌 API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `GET /api/auth/profile` - Perfil do usuário
- `PUT /api/auth/password` - Alterar senha
- `PUT /api/auth/force-change-password` - Troca obrigatória de senha

### Usuários
- `GET /api/users` - Listar todos
- `GET /api/users/:id` - Buscar por ID
- `POST /api/users` - Criar (admin)
- `PUT /api/users/:id` - Atualizar (admin)
- `DELETE /api/users/:id` - Desativar (admin)

### Projetos
- `GET /api/projects` - Listar todos
- `GET /api/projects/:id` - Buscar por ID
- `POST /api/projects` - Criar (admin)
- `PUT /api/projects/:id` - Atualizar (admin)
- `DELETE /api/projects/:id` - Desativar (admin)

### Alocações
- `GET /api/allocations` - Listar com filtros
- `GET /api/allocations/agenda` - Dados para a agenda
- `POST /api/allocations` - Criar (admin)
- `POST /api/allocations/bulk` - Criar em massa (admin)
- `PUT /api/allocations/:id` - Atualizar (admin)
- `DELETE /api/allocations/:id` - Remover (admin)

### Configurações de Status
- `GET /api/status-config` - Listar status
- `POST /api/status-config` - Criar (admin)
- `PUT /api/status-config/:id` - Atualizar (admin)
- `DELETE /api/status-config/:id` - Remover (admin)

### Configurações de Funções
- `GET /api/function-config` - Listar funções
- `POST /api/function-config` - Criar (admin)
- `PUT /api/function-config/:id` - Atualizar (admin)
- `DELETE /api/function-config/:id` - Remover (admin)

### Sistema
- `GET /api/system/config` - Obter configurações públicas do sistema (intervalo de polling, etc.)

## ⚙️ Configurações do Sistema

### Intervalo de Atualização Automática da Agenda

O sistema possui atualização automática em tempo real da agenda. O intervalo pode ser configurado através da variável de ambiente `AGENDA_POLLING_INTERVAL`.

**Como configurar:**

1. Edite o arquivo `.env` na pasta `server/`
2. Adicione ou modifique a linha:
   ```env
   AGENDA_POLLING_INTERVAL=30000
   ```
3. Reinicie o servidor para aplicar as mudanças

**Valores recomendados:**
- **Desenvolvimento:** 10000-15000 (10-15 segundos)
- **Produção:** 30000-60000 (30-60 segundos)
- **Mínimo:** 5000 (5 segundos)
- **Máximo:** 300000 (5 minutos)

**Nota:** Se a variável não for definida, o sistema usa o valor padrão de 30 segundos (30000ms).

### Timeout de Inatividade

O sistema possui um mecanismo de timeout de inatividade que desconecta automaticamente o usuário após um período sem atividade, melhorando a segurança do sistema.

**Como funciona:**
- Após **30 minutos** de inatividade, o sistema mostra um aviso
- O usuário tem **5 minutos** para clicar em "Continuar" e manter a sessão ativa
- Se não houver interação, o logout é realizado automaticamente
- Qualquer atividade do usuário (mouse, teclado, scroll) reinicia o timer

**Como configurar:**

1. Edite o arquivo `client/src/hooks/useInactivityTimeout.tsx`
2. Modifique as constantes no início do arquivo:

```typescript
// Configurações (em milissegundos)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos - tempo total de inatividade
const WARNING_TIME = 5 * 60 * 1000; // 5 minutos - quando mostrar o aviso (antes do timeout)
const WARNING_DURATION = 5 * 60 * 1000; // 5 minutos - tempo do aviso até logout
```

**Exemplos de configuração:**

| Cenário | INACTIVITY_TIMEOUT | WARNING_TIME | WARNING_DURATION |
|---------|-------------------|--------------|------------------|
| Padrão (30 min) | 30 * 60 * 1000 | 5 * 60 * 1000 | 5 * 60 * 1000 |
| Mais restritivo (15 min) | 15 * 60 * 1000 | 3 * 60 * 1000 | 3 * 60 * 1000 |
| Menos restritivo (60 min) | 60 * 60 * 1000 | 10 * 60 * 1000 | 10 * 60 * 1000 |

**Eventos que resetam o timer:**
- Movimento do mouse
- Cliques
- Digitação no teclado
- Scroll na página
- Toque na tela (mobile)
- Foco na janela do navegador

**Nota:** Após modificar as configurações, é necessário recompilar o frontend (`npm run build` em produção ou reiniciar o servidor de desenvolvimento).

## 📄 Licença

Este projeto é propriedade da NGR Global.
