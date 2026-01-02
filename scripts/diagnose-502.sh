#!/bin/bash

echo "🔍 Diagnóstico do erro 502 Bad Gateway"
echo "========================================"
echo ""

# 1. Verificar container
echo "1️⃣ Verificando container Docker..."
docker compose ps
echo ""

# 2. Verificar se porta 3001 está em uso
echo "2️⃣ Verificando porta 3001..."
netstat -tulpn | grep 3001 || ss -tulpn | grep 3001
echo ""

# 3. Testar backend diretamente
echo "3️⃣ Testando backend em localhost:3001..."
echo "Teste 1: Rota raiz"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3001/ || echo "❌ Não responde"
echo ""

echo "Teste 2: Rota /agenda"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3001/agenda || echo "❌ Não responde"
echo ""

echo "Teste 3: API /agenda/api"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3001/agenda/api/health || echo "❌ Não responde"
echo ""

# 4. Verificar logs do container
echo "4️⃣ Últimas 20 linhas dos logs do container:"
docker compose logs --tail=20 app
echo ""

# 5. Verificar configuração do Nginx
echo "5️⃣ Verificando configuração do Nginx..."
sudo nginx -t 2>&1
echo ""

echo "6️⃣ Configuração atual do Nginx para fpsoftware.cloud:"
sudo cat /etc/nginx/sites-available/fpsoftware.cloud 2>/dev/null || echo "❌ Arquivo não encontrado"
echo ""

# 6. Verificar se Nginx está rodando
echo "7️⃣ Status do Nginx:"
sudo systemctl status nginx --no-pager -l | head -10
echo ""

# 7. Verificar variáveis de ambiente do container
echo "8️⃣ Variáveis de ambiente do container:"
docker exec consultant-scheduler env | grep -E "NODE_ENV|PORT|MONGODB" || echo "❌ Container não está rodando"
echo ""

echo "✅ Diagnóstico concluído!"
echo ""
echo "📋 Próximos passos:"
echo "   - Se container não está rodando: docker compose up -d"
echo "   - Se backend não responde: verificar logs com docker compose logs app"
echo "   - Se Nginx está com erro: sudo nginx -t e corrigir"

