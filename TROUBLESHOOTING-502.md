# Troubleshooting: Erro 502 Bad Gateway

## Diagnóstico do erro 502

O erro 502 significa que o Nginx não consegue conectar ao backend. Siga estes passos:

### 1. Verificar se o container está rodando

```bash
# Ver status dos containers
docker compose ps

# Ou
docker ps | grep consultant-scheduler
```

**Deve mostrar o container rodando.** Se não estiver, inicie:
```bash
docker compose up -d
```

### 2. Verificar se o backend está respondendo

```bash
# Testar se a aplicação responde na porta 3001
curl http://localhost:3001/agenda

# Ou testar a API
curl http://localhost:3001/agenda/api/health
```

**Deve retornar HTML ou JSON, não erro de conexão.**

### 3. Verificar logs do container

```bash
# Ver logs do container
docker compose logs app

# Ver logs em tempo real
docker compose logs -f app
```

**Procure por erros de inicialização ou conexão MongoDB.**

### 4. Verificar configuração do Nginx

```bash
# Ver configuração atual
sudo cat /etc/nginx/sites-available/fpsoftware.cloud

# Testar configuração
sudo nginx -t
```

**Deve mostrar "syntax is ok" e "test is successful".**

### 5. Verificar se Nginx consegue acessar o backend

```bash
# Testar conexão do Nginx para o backend
curl -H "Host: fpsoftware.cloud" http://localhost:3001/agenda
```

## Soluções comuns

### Solução 1: Container não está rodando

```bash
# Iniciar container
docker compose up -d

# Verificar logs
docker compose logs -f app
```

### Solução 2: Backend não está servindo na rota /agenda

Verifique se o código foi atualizado e rebuild foi feito:

```bash
# Verificar se o código está atualizado
cd ~/consultant-scheduler
git pull

# Rebuild
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Solução 3: Nginx não está configurado corretamente

A configuração correta deve ter:

```nginx
location /agenda {
    proxy_pass http://localhost:3001/agenda;  # ← Note o /agenda no final
    ...
}
```

**Importante:** O `proxy_pass` deve terminar com `/agenda` para manter o path.

### Solução 4: Porta 3001 não está acessível

```bash
# Verificar se a porta está aberta
netstat -tulpn | grep 3001

# Ou
ss -tulpn | grep 3001
```

**Deve mostrar que a porta 3001 está em LISTEN.**

### Solução 5: Firewall bloqueando

```bash
# Verificar firewall
sudo ufw status

# Se necessário, permitir porta 3001 (apenas localhost)
sudo ufw allow from 127.0.0.1 to any port 3001
```

## Comandos de diagnóstico completo

Execute estes comandos no VPS e compartilhe os resultados:

```bash
# 1. Status do container
docker compose ps

# 2. Logs do container
docker compose logs --tail=50 app

# 3. Teste do backend
curl -v http://localhost:3001/agenda

# 4. Configuração do Nginx
sudo nginx -t
sudo cat /etc/nginx/sites-available/fpsoftware.cloud

# 5. Status do Nginx
sudo systemctl status nginx
```

## Configuração correta do Nginx

```nginx
server {
    listen 80;
    server_name fpsoftware.cloud;

    location /agenda {
        proxy_pass http://localhost:3001/agenda;
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

**Após atualizar, sempre execute:**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

