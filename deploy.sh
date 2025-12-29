#!/bin/bash

echo "🚀 Iniciando deploy do Consultant Scheduler..."

# Navegar para o diretório do projeto
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit

# Detectar qual comando docker compose está disponível
if command -v docker &> /dev/null && docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
    echo "📦 Usando: docker compose (v2)"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    echo "📦 Usando: docker-compose (v1)"
else
    echo "❌ Docker Compose não está instalado!"
    echo "💡 Instale Docker Compose ou atualize o Docker para a versão mais recente"
    exit 1
fi

# Atualizar código do Git
echo "📥 Atualizando código do repositório..."
if [ -d ".git" ]; then
    git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || echo "⚠️ Não foi possível fazer pull (continuando mesmo assim...)"
else
    echo "⚠️ Diretório .git não encontrado (continuando mesmo assim...)"
fi

# Verificar se o arquivo .env existe
if [ ! -f ".env" ]; then
    echo "⚠️ Arquivo .env não encontrado!"
    echo "📝 Criando arquivo .env de exemplo..."
    cat > .env << EOF
NODE_ENV=production
PORT=3001
MONGODB_URI=sua_uri_mongodb_aqui
JWT_SECRET=sua_chave_secreta_aqui
CLIENT_URL=http://localhost:3001
MYSQL_HOST=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
EOF
    echo "❌ Por favor, edite o arquivo .env com suas configurações antes de continuar!"
    exit 1
fi

# Parar container existente
echo "🛑 Parando container existente..."
$DOCKER_COMPOSE down 2>/dev/null || true

# Remover imagens antigas (opcional, descomente se quiser limpar)
# echo "🧹 Limpando imagens antigas..."
# docker system prune -f

# Build e start
echo "🔨 Construindo e iniciando container..."
$DOCKER_COMPOSE up -d --build

# Verificar se o build foi bem-sucedido
if [ $? -ne 0 ]; then
    echo "❌ Erro ao construir ou iniciar o container!"
    exit 1
fi

# Aguardar alguns segundos para o container iniciar
echo "⏳ Aguardando container iniciar..."
sleep 5

# Mostrar status
echo ""
echo "📋 Status dos containers:"
$DOCKER_COMPOSE ps

# Mostrar últimas linhas dos logs
echo ""
echo "📋 Últimas linhas dos logs:"
$DOCKER_COMPOSE logs --tail=30

echo ""
echo "✅ Deploy concluído!"
echo "🌐 Aplicação rodando em http://localhost:3001"
echo "📊 Para ver os logs em tempo real: $DOCKER_COMPOSE logs -f"

