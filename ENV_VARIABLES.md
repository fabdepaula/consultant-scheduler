# Variáveis de Ambiente

Este documento lista todas as variáveis de ambiente necessárias para o projeto.

## Backend (server/.env)

### Obrigatórias

```bash
# MongoDB - String de conexão do MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/consultant-scheduler?retryWrites=true&w=majority

# JWT - Chave secreta para tokens (gere uma chave forte)
JWT_SECRET=sua_chave_secreta_aqui

# Client URL - URL do frontend (para CORS)
CLIENT_URL=http://localhost:5173
# Em produção: https://consultant-scheduler-web.onrender.com
```

### Opcionais

```bash
# Server
PORT=3001
NODE_ENV=development

# MySQL (opcional - para integração com Artia)
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=sua_senha
MYSQL_DATABASE=nome_do_banco
```

## Frontend (client)

### Obrigatórias

```bash
# API URL - URL do backend
VITE_API_URL=http://localhost:3001
# Em produção: https://consultant-scheduler-api.onrender.com
```

## Como gerar JWT_SECRET

Você pode gerar uma chave secreta segura usando:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Ou online
# https://generate-secret.vercel.app/64
```

## Configuração no Render

### Backend (Web Service)

Adicione estas variáveis de ambiente no Render:

- `NODE_ENV` = `production`
- `PORT` = `10000` (ou deixe o Render definir automaticamente)
- `MONGODB_URI` = sua Connection String do MongoDB Atlas
- `JWT_SECRET` = sua chave secreta gerada
- `CLIENT_URL` = URL do frontend (atualize depois de criar o frontend)

### Frontend (Static Site)

Adicione esta variável de ambiente no Render:

- `VITE_API_URL` = URL do backend (ex: `https://consultant-scheduler-api.onrender.com`)



