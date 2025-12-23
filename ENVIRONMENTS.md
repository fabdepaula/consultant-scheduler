# Guia de Ambientes

Este documento descreve a estrutura de ambientes do projeto e como gerenciá-los.

## 📋 Ambientes

### 🛠️ Development (Desenvolvimento)
- **Localização**: Máquina local do desenvolvedor
- **Branch Git**: `develop` ou `dev`
- **Banco de Dados**: MongoDB local
- **URL**: `http://localhost:5173` (frontend) e `http://localhost:3001` (backend)
- **Configuração**: `.env.development`

### 🧪 QA (Quality Assurance)
- **Localização**: VPS (servidor de testes)
- **Branch Git**: `qa`
- **Banco de Dados**: MongoDB Atlas (cluster separado)
- **URL**: `https://qa.consultant-scheduler.com.br`
- **Configuração**: `.env.qa`
- **Propósito**: Testes antes de produção

### 🚀 Production (Produção)
- **Localização**: VPS (servidor de produção)
- **Branch Git**: `main` ou `master`
- **Banco de Dados**: MongoDB Atlas (cluster de produção)
- **URL**: `https://consultant-scheduler.com.br`
- **Configuração**: `.env.production`
- **Propósito**: Ambiente final para usuários

---

## 🌳 Estrutura de Branches Git

```
main/master (produção)
  └── qa (ambiente de testes)
      └── develop (desenvolvimento)
```

### Fluxo de trabalho:

1. **Desenvolvimento**: Trabalhe na branch `develop`
2. **QA**: Merge `develop` → `qa` para testes
3. **Produção**: Merge `qa` → `main` após aprovação

---

## 📁 Arquivos de Configuração

### Por Ambiente:

- `.env.development` - Desenvolvimento local
- `.env.qa` - Ambiente QA
- `.env.production` - Ambiente de produção

### Docker Compose:

- `docker-compose.yml` - Desenvolvimento local
- `docker-compose.qa.yml` - Ambiente QA
- `docker-compose.prod.yml` - Ambiente produção

---

## 🔧 Setup de Cada Ambiente

### Development (Local)

```bash
# 1. Clone o repositório
git clone <repo-url>
cd consultant-scheduler

# 2. Crie o arquivo .env.development
cp .env.development.example .env.development
# Edite com suas configurações locais

# 3. Inicie MongoDB local
mongod

# 4. Execute o seed
cd server
npm run seed

# 5. Inicie o projeto
npm run dev
```

### QA (VPS)

```bash
# 1. No servidor VPS, clone o repositório
git clone <repo-url>
cd consultant-scheduler
git checkout qa

# 2. Crie o arquivo .env.qa
cp .env.qa.example .env.qa
# Edite com configurações do ambiente QA

# 3. Build e inicie com Docker
docker-compose -f docker-compose.qa.yml up -d --build

# 4. Execute o seed (se necessário)
docker-compose -f docker-compose.qa.yml exec app npm run seed
```

### Production (VPS)

```bash
# 1. No servidor VPS, clone o repositório
git clone <repo-url>
cd consultant-scheduler
git checkout main

# 2. Crie o arquivo .env.production
cp .env.production.example .env.production
# Edite com configurações de produção

# 3. Build e inicie com Docker
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Execute o seed (apenas na primeira vez)
docker-compose -f docker-compose.prod.yml exec app npm run seed
```

---

## 🔐 Segurança

### Variáveis de Ambiente

- **NUNCA** commite arquivos `.env` no Git
- Use `.env.example` como template
- Cada ambiente deve ter seu próprio arquivo `.env`
- Use chaves JWT diferentes para cada ambiente
- MongoDB deve ter clusters separados por ambiente

### Secrets no GitHub

Configure secrets no GitHub Actions:
- `QA_HOST` - IP do servidor QA
- `QA_USER` - Usuário SSH do servidor QA
- `QA_SSH_KEY` - Chave SSH privada para QA
- `PROD_HOST` - IP do servidor produção
- `PROD_USER` - Usuário SSH do servidor produção
- `PROD_SSH_KEY` - Chave SSH privada para produção

---

## 🚀 Deploy

### Deploy Manual

#### QA:
```bash
ssh usuario@servidor-qa
cd /opt/consultant-scheduler
git pull origin qa
docker-compose -f docker-compose.qa.yml up -d --build
```

#### Produção:
```bash
ssh usuario@servidor-prod
cd /opt/consultant-scheduler
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --build
```

### Deploy Automático (CI/CD)

O deploy automático é feito via GitHub Actions quando você faz push:
- Push em `qa` → Deploy automático para QA
- Push em `main` → Deploy automático para Produção

---

## 📊 Monitoramento

### Logs

#### QA:
```bash
docker-compose -f docker-compose.qa.yml logs -f
```

#### Produção:
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Health Check

O ambiente de produção tem health check configurado. Verifique:
```bash
curl http://localhost:3001/api/health
```

---

## 🔄 Backup

### MongoDB

Configure backups automáticos no MongoDB Atlas para cada cluster.

### Uploads

Os uploads são salvos em volumes Docker:
- QA: `./uploads-qa`
- Produção: `./uploads-prod`

Configure backup periódico desses diretórios.

---

## 📝 Checklist de Deploy

### Antes de fazer deploy para QA:
- [ ] Testes locais passando
- [ ] Código revisado
- [ ] Variáveis de ambiente QA configuradas
- [ ] Banco de dados QA preparado

### Antes de fazer deploy para Produção:
- [ ] Testes em QA aprovados
- [ ] Backup do banco de produção feito
- [ ] Variáveis de ambiente produção configuradas
- [ ] Notificar equipe sobre manutenção (se necessário)

---

## 🆘 Troubleshooting

### Container não inicia:
```bash
# Ver logs
docker-compose -f docker-compose.prod.yml logs

# Verificar variáveis de ambiente
docker-compose -f docker-compose.prod.yml config
```

### Problemas de conexão com MongoDB:
- Verifique a string de conexão no `.env`
- Verifique Network Access no MongoDB Atlas
- Verifique se o IP do servidor está liberado

### Problemas de build:
```bash
# Limpar cache do Docker
docker system prune -a

# Rebuild forçado
docker-compose -f docker-compose.prod.yml build --no-cache
```


