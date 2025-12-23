#!/bin/bash

# Script de deploy para ambiente de Produção
# Uso: ./scripts/deploy-prod.sh

set -e  # Para na primeira erro

echo "🚀 Iniciando deploy para PRODUÇÃO..."

# Verificar se está na branch correta
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo "⚠️  Você não está na branch 'main' ou 'master'. Deseja continuar? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        echo "❌ Deploy cancelado"
        exit 1
    fi
fi

# Confirmação adicional para produção
echo "⚠️  ATENÇÃO: Você está fazendo deploy para PRODUÇÃO!"
echo "   Certifique-se de que:"
echo "   - Todos os testes passaram em QA"
echo "   - Backup do banco de dados foi feito"
echo "   - Variáveis de ambiente estão corretas"
echo ""
echo "   Deseja continuar? (digite 'SIM' para confirmar)"
read -r confirmation
if [ "$confirmation" != "SIM" ]; then
    echo "❌ Deploy cancelado"
    exit 1
fi

# Verificar se o arquivo .env.production existe
if [ ! -f ".env.production" ]; then
    echo "❌ Arquivo .env.production não encontrado!"
    echo "   Crie o arquivo baseado em .env.production.example"
    exit 1
fi

# Pull das últimas mudanças
echo "📥 Atualizando código..."
git pull origin main || git pull origin master

# Backup antes do deploy (opcional)
echo "💾 Fazendo backup..."
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
# Adicione aqui comandos de backup se necessário

# Build e deploy com Docker
echo "🔨 Fazendo build e iniciando containers..."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Verificar health check
echo "🏥 Verificando saúde da aplicação..."
sleep 10
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ Aplicação está respondendo corretamente"
else
    echo "⚠️  Aplicação pode não estar respondendo. Verifique os logs:"
    echo "   docker-compose -f docker-compose.prod.yml logs"
fi

# Limpar imagens não utilizadas
echo "🧹 Limpando imagens não utilizadas..."
docker system prune -f

echo "✅ Deploy para PRODUÇÃO concluído!"
echo "📊 Verifique os logs: docker-compose -f docker-compose.prod.yml logs -f"


