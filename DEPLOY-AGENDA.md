# Deploy com rota /agenda

Este guia explica como fazer deploy da aplicação para funcionar em `http://fpsoftware.cloud/agenda`.

## Alterações realizadas

1. ✅ `client/vite.config.ts` - Configurado base path `/agenda/` em produção
2. ✅ `server/src/index.ts` - Servidor serve frontend na rota `/agenda`
3. ✅ `client/src/services/api.ts` - API usa `/agenda/api` em produção
4. ✅ `nginx.conf.example` - Configuração exemplo do Nginx

## Passos para deploy no VPS

### 1. Atualizar código no VPS

```bash
# Conectar no VPS
ssh root@147.79.106.20

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

### 3. Configurar Nginx

```bash
# Copiar configuração exemplo
sudo cp nginx.conf.example /etc/nginx/sites-available/fpsoftware.cloud

# Ou editar diretamente
sudo nano /etc/nginx/sites-available/fpsoftware.cloud
```

Cole a configuração:

```nginx
server {
    listen 80;
    server_name fpsoftware.cloud;

    location /agenda {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location = /agenda/ {
        return 301 /agenda;
    }
}
```

### 4. Ativar e reiniciar Nginx

```bash
# Criar link simbólico (se não existir)
sudo ln -s /etc/nginx/sites-available/fpsoftware.cloud /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### 5. Verificar se está funcionando

1. Acesse: `http://fpsoftware.cloud/agenda`
2. Abra DevTools (F12) → Network
3. Verifique se os arquivos CSS e JS carregam (não devem dar 404)
4. Tente fazer login

## Troubleshooting

### Arquivos estáticos não carregam (404)

1. Verificar se o build do frontend foi gerado:
   ```bash
   docker exec consultant-scheduler ls -la /app/server/client/dist
   ```

2. Verificar se o container está servindo na rota correta:
   ```bash
   docker compose logs app | grep -i "agenda\|frontend"
   ```

3. Verificar configuração do Nginx:
   ```bash
   sudo nginx -t
   ```

### API não funciona

1. Verificar se a API responde:
   ```bash
   curl http://localhost:3001/agenda/api/health
   ```

2. Verificar logs do container:
   ```bash
   docker compose logs app
   ```

### Página em branco

1. Verificar console do navegador (F12)
2. Verificar se há erros de CORS
3. Verificar se `CLIENT_URL` está configurado no `.env`

## Estrutura de URLs

- Frontend: `http://fpsoftware.cloud/agenda`
- API: `http://fpsoftware.cloud/agenda/api`
- Uploads: `http://fpsoftware.cloud/agenda/api/uploads`

## Próximos passos (opcional)

### Adicionar HTTPS

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obter certificado SSL
sudo certbot --nginx -d fpsoftware.cloud

# O Certbot vai atualizar automaticamente o Nginx
```

Depois disso, a aplicação estará disponível em:
- `https://fpsoftware.cloud/agenda`

