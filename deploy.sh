#!/bin/bash

echo "🚀 Iniciando deploy do Consultant Scheduler..."

# Navegar para o diretório do projeto
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit

# Detectar qual comando docker compose está disponível
DOCKER_COMPOSE=""

# Tentar docker compose (v2) primeiro
if command -v docker &> /dev/null; then
    if docker compose version &> /dev/null 2>&1; then
        DOCKER_COMPOSE="docker compose"
        echo "📦 Usando: docker compose (v2)"
    fi
fi

# Se docker compose v2 não funcionou, tentar docker-compose v1
if [ -z "$DOCKER_COMPOSE" ]; then
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
        echo "📦 Usando: docker-compose (v1)"
    fi
fi

# Se nenhum funcionou, tentar instalar ou dar erro
if [ -z "$DOCKER_COMPOSE" ]; then
    echo "❌ Docker Compose não está instalado!"
    echo "💡 Tentando instalar docker-compose..."
    
    # Tentar instalar docker-compose standalone
    if command -v curl &> /dev/null; then
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose 2>/dev/null
        if [ $? -eq 0 ]; then
            sudo chmod +x /usr/local/bin/docker-compose
            
            if command -v docker-compose &> /dev/null; then
                DOCKER_COMPOSE="docker-compose"
                echo "✅ docker-compose instalado com sucesso!"
            else
                echo "❌ Falha ao instalar docker-compose"
                echo "💡 Instale manualmente: https://docs.docker.com/compose/install/"
                exit 1
            fi
        else
            echo "❌ Falha ao baixar docker-compose"
            echo "💡 Instale manualmente: https://docs.docker.com/compose/install/"
            exit 1
        fi
    else
        echo "❌ curl não está instalado. Instale docker-compose manualmente."
        exit 1
    fi
fi

# Verificação final - garantir que o comando funciona
if ! eval "$DOCKER_COMPOSE version" &> /dev/null; then
    echo "❌ O comando $DOCKER_COMPOSE não está funcionando corretamente!"
    echo "💡 Verifique a instalação do Docker Compose"
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

# Função helper para executar docker compose (suporta espaços no comando)
run_docker_compose() {
    eval "$DOCKER_COMPOSE $*"
}

# Parar container existente
echo "🛑 Parando container existente..."
run_docker_compose down 2>/dev/null || true

# Remover imagens antigas (opcional, descomente se quiser limpar)
# echo "🧹 Limpando imagens antigas..."
# docker system prune -f

# Build e start
echo "🔨 Construindo e iniciando container..."
run_docker_compose up -d --build

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
run_docker_compose ps

# Mostrar últimas linhas dos logs
echo ""
echo "📋 Últimas linhas dos logs:"
run_docker_compose logs --tail=30

echo ""
echo "✅ Deploy concluído!"
echo "🌐 Aplicação rodando em http://localhost:3001"
echo "📊 Para ver os logs em tempo real: $DOCKER_COMPOSE logs -f"

