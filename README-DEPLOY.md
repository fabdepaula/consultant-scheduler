# Deploy na VPS Hostinger com Docker

Este guia explica como fazer o deploy do Consultant Scheduler em uma VPS da Hostinger usando Docker.

## Pré-requisitos

1. **Docker instalado na VPS**
2. **Docker Compose instalado**
3. **Acesso SSH à VPS**
4. **Repositório Git configurado**

## Instalação do Docker na VPS

Se o Docker ainda não estiver instalado na sua VPS, execute:

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install docker-compose -y

# Verificar instalação
docker --version
docker-compose --version

# Fazer logout e login novamente para aplicar as mudanças do grupo docker
```

## Primeira vez - Deploy Inicial

### 1. Conectar na VPS

```bash
ssh usuario@seu-ip-hostinger
```

### 2. Clonar repositório

```bash
cd ~
git clone seu-repositorio.git consultant-scheduler
cd consultant-scheduler
```

### 3. Criar arquivo .env

```bash
cp .env.example .env
nano .env
```

Edite o arquivo `.env` com suas configurações:

```bash
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/database
JWT_SECRET=sua_chave_secreta_forte_aqui
CLIENT_URL=https://seu-dominio.com
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=senha_mysql
MYSQL_DATABASE=consultant_scheduler
```

**Importante:**
- `MONGODB_URI`: Sua string de conexão do MongoDB Atlas
- `JWT_SECRET`: Gere uma chave secreta forte (pode usar: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- `CLIENT_URL`: URL do seu domínio (ex: `https://consultant.example.com`)
- Variáveis MySQL são opcionais

### 4. Dar permissão ao script de deploy

```bash
chmod +x deploy.sh
```

### 5. Executar deploy

```bash
./deploy.sh
```

O script irá:
- Fazer pull do código do Git
- Verificar se o arquivo `.env` existe
- Parar containers existentes
- Fazer build da imagem Docker
- Iniciar o container
- Mostrar logs e status

## Atualizações Futuras

Para atualizar a aplicação após fazer push no Git:

```bash
cd ~/consultant-scheduler
./deploy.sh
```

O script automaticamente fará `git pull` antes de fazer o rebuild.

## Comandos Úteis

### Ver logs em tempo real
```bash
docker-compose logs -f
```

### Ver logs das últimas 100 linhas
```bash
docker-compose logs --tail=100
```

### Parar aplicação
```bash
docker-compose down
```

### Reiniciar aplicação
```bash
docker-compose restart
```

### Ver status dos containers
```bash
docker-compose ps
```

### Entrar no container
```bash
docker exec -it consultant-scheduler sh
```

### Rebuild completo (limpar cache)
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Configurar Nginx como Proxy Reverso (Recomendado)

Para usar um domínio e HTTPS, configure o Nginx:

### 1. Instalar Nginx

```bash
sudo apt install nginx -y
```

### 2. Criar configuração do site

```bash
sudo nano /etc/nginx/sites-available/consultant-scheduler
```

Cole o seguinte conteúdo (ajuste o `server_name`):

```nginx
server {
    listen 80;
    server_name seu-dominio.com www.seu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Ativar o site

```bash
sudo ln -s /etc/nginx/sites-available/consultant-scheduler /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Configurar SSL com Let's Encrypt (HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d seu-dominio.com -d www.seu-dominio.com
```

O Certbot irá:
- Instalar o certificado SSL
- Configurar renovação automática
- Redirecionar HTTP para HTTPS

## Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker-compose logs

# Verificar se a porta está em uso
sudo netstat -tulpn | grep 3001

# Verificar espaço em disco
df -h
```

### Erro de permissão no Docker

```bash
# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
# Fazer logout e login novamente
```

### Erro ao fazer pull do Git

Verifique se:
- O repositório está configurado corretamente
- Você tem acesso ao repositório
- A branch está correta (main ou master)

### Frontend não carrega

Verifique se:
- O build do frontend foi gerado (`client/dist` existe)
- O `CLIENT_URL` no `.env` está correto
- O Nginx está configurado corretamente (se estiver usando)

## Estrutura de Arquivos

```
consultant-scheduler/
├── Dockerfile              # Configuração do build Docker
├── .dockerignore           # Arquivos ignorados no build
├── docker-compose.yml      # Orquestração dos containers
├── deploy.sh               # Script de deploy automatizado
├── .env                    # Variáveis de ambiente (não commitado)
├── .env.example            # Template de variáveis de ambiente
├── client/                 # Frontend React
├── server/                 # Backend Node.js
└── uploads/                # Arquivos enviados (volume Docker)
```

## Segurança

- **Nunca commite o arquivo `.env`** no Git
- Use senhas fortes para `JWT_SECRET`
- Mantenha o Docker e o sistema operacional atualizados
- Configure firewall na VPS (se necessário)
- Use HTTPS em produção (Let's Encrypt)

## Suporte

Em caso de problemas, verifique:
1. Logs do container: `docker-compose logs -f`
2. Status do container: `docker-compose ps`
3. Espaço em disco: `df -h`
4. Memória disponível: `free -h`

