# Deploy com Subdomínio

Este guia explica como fazer deploy da aplicação para funcionar em `https://agenda.fpsoftware.cloud` (subdomínio).

## Alterações realizadas

1. ✅ `client/vite.config.ts` - Configurado base path `/` (subdomínio sem path)
2. ✅ `server/src/index.ts` - Servidor serve frontend na raiz
3. ✅ `client/src/services/api.ts` - API usa `/api` (sem path /agenda)
4. ✅ `client/src/App.tsx` - Removido basename `/agenda`

## Passos para deploy no VPS

### 1. Atualizar código no VPS

```bash
# Conectar no VPS
ssh root@srv1213080

# Ir para o diretório do projeto
cd ~/consultant-scheduler

# Atualizar código
git pull
```

### 2. Rebuild do Docker

```bash
# Parar containers
docker compose down

# Rebuild completo (sem cache)
docker compose build --no-cache

# Iniciar containers
docker compose up -d

# Ver logs
docker compose logs -f app
```

### 3. Proxy reverso (Traefik)

O proxy reverso na VPS é configurado pela equipe de infraestrutura usando **Traefik**. A aplicação expõe a porta 3001 e está preparada para receber os headers `X-Forwarded-*` (o Express usa `trust proxy` em produção).

A aplicação estará disponível em:
- `https://agenda.fpsoftware.cloud`

### 4. Verificar se está funcionando

1. Acesse: `https://agenda.fpsoftware.cloud`
2. Abra DevTools (F12) → Network
3. Verifique se os arquivos CSS e JS carregam (não devem dar 404)
4. Verifique se as requisições para `/api` estão funcionando
5. Tente fazer login

## Troubleshooting

### Arquivos estáticos não carregam (404)

1. Verificar se o build do frontend foi gerado:
   ```bash
   docker exec consultant-scheduler ls -la /app/server/client/dist
   ```

2. Verificar se o container está servindo na rota correta:
   ```bash
   docker compose logs app | grep -i "frontend\|subdomínio"
   ```

3. Verificar se o proxy reverso (Traefik) está roteando corretamente para o container (contate a equipe de infraestrutura se necessário).

### API não funciona (401 Unauthorized)

1. Verificar se a API responde:
   ```bash
   curl http://localhost:3001/api/auth/login
   ```

2. Verificar logs do container:
   ```bash
   docker compose logs app
   ```

3. Verificar se o frontend está fazendo requisições para `/api` (não `/agenda/api`):
   - Abra DevTools → Network
   - Verifique a URL das requisições

### Página em branco

1. Verificar console do navegador (F12)
2. Verificar se há erros de CORS
3. Verificar se `CLIENT_URL` está configurado no `.env`:
   ```bash
   # No .env
   CLIENT_URL=https://agenda.fpsoftware.cloud
   ```

### Erro 404 nas requisições da API

Se as requisições estão indo para `/agenda/api` em vez de `/api`:

1. Verificar se o build foi feito após as alterações:
   ```bash
   docker compose build --no-cache
   ```

2. Limpar cache do navegador (Ctrl+Shift+R ou Cmd+Shift+R)

3. Verificar se o `vite.config.ts` está com `base: '/'`

## Estrutura de URLs

- Frontend: `https://agenda.fpsoftware.cloud`
- API: `https://agenda.fpsoftware.cloud/api`
- Uploads: `https://agenda.fpsoftware.cloud/api/uploads`

## Variáveis de Ambiente

Certifique-se de que o arquivo `.env` na VPS contém:

```env
NODE_ENV=production
PORT=3001
MONGODB_URI=sua_uri_mongodb
JWT_SECRET=sua_chave_secreta
CLIENT_URL=https://agenda.fpsoftware.cloud
MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
```

## Script de Deploy Automatizado

Use o script `deploy.sh` para automatizar o processo:

```bash
cd ~/consultant-scheduler
./deploy.sh
```

O script irá:
- Atualizar código do Git
- Parar containers existentes
- Fazer rebuild
- Iniciar containers
- Verificar status
