#!/bin/bash

# Script de deploy para ambiente QA
# Uso: ./scripts/deploy-qa.sh

set -e  # Para na primeira erro

echo "🚀 Iniciando deploy para QA..."

# Verificar se está na branch correta
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "qa" ]; then
    echo "⚠️  Você não está na branch 'qa'. Deseja continuar? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        echo "❌ Deploy cancelado"
        exit 1
    fi
fi

# Verificar se o arquivo .env.qa existe
if [ ! -f ".env.qa" ]; then
    echo "❌ Arquivo .env.qa não encontrado!"
    echo "   Crie o arquivo baseado em .env.qa.example"
    exit 1
fi

# Pull das últimas mudanças
echo "📥 Atualizando código..."
git pull origin qa

# Build e deploy com Docker
echo "🔨 Fazendo build e iniciando containers..."
docker-compose -f docker-compose.qa.yml down
docker-compose -f docker-compose.qa.yml build --no-cache
docker-compose -f docker-compose.qa.yml up -d

# Limpar imagens não utilizadas
echo "🧹 Limpando imagens não utilizadas..."
docker system prune -f

echo "✅ Deploy para QA concluído!"
echo "📊 Verifique os logs: docker-compose -f docker-compose.qa.yml logs -f"



