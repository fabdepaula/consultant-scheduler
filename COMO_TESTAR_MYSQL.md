# Como Testar a Conexão MySQL

Existem 3 formas simples de testar a conexão MySQL:

## 🚀 Método 1: Script de Teste (Mais Fácil)

Execute o script de teste que criamos:

```bash
cd server
npm run test-mysql
```

Este script vai:
- ✅ Testar a conexão básica
- ✅ Listar as views disponíveis
- ✅ Testar o acesso a uma view

## 🌐 Método 2: Via Navegador (Mais Rápido)

1. Certifique-se de que o servidor está rodando:
```bash
cd server
npm run dev
```

2. Abra seu navegador e acesse:
```
http://localhost:3001/api/external-data/test-connection
```

Você deve ver uma resposta JSON:
```json
{
  "success": true,
  "message": "Conexão MySQL estabelecida com sucesso!"
}
```

## 📡 Método 3: Via cURL (Terminal)

Se você tem o `curl` instalado, pode testar diretamente no terminal:

```bash
# Testar conexão
curl http://localhost:3001/api/external-data/test-connection

# Listar views (requer autenticação de admin)
curl -X GET http://localhost:3001/api/external-data/views \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

## 🔐 Testando Rotas que Requerem Autenticação

Para testar as rotas que listam views e dados, você precisa:

1. **Fazer login como administrador** na aplicação
2. **Copiar o token JWT** do localStorage do navegador (F12 > Application > Local Storage)
3. **Usar o token** nas requisições:

```bash
# Exemplo com token
curl -X GET http://localhost:3001/api/external-data/views \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## 🐛 Solução de Problemas

### Erro: "ECONNREFUSED" ou "ETIMEDOUT"
- Verifique se o servidor MySQL está acessível
- Verifique se o firewall permite conexões
- Confirme as credenciais

### Erro: "Access denied"
- Verifique usuário e senha
- Verifique se o usuário tem permissão para acessar o banco

### Erro: "Unknown database"
- Verifique se o nome do banco está correto: `artia`

## 📋 Próximos Passos

Depois de confirmar que a conexão funciona:

1. **Liste as views disponíveis**:
   ```
   GET /api/external-data/views
   ```

2. **Veja a estrutura de uma view**:
   ```
   GET /api/external-data/views/NOME_DA_VIEW/structure
   ```

3. **Busque dados de uma view**:
   ```
   GET /api/external-data/views/NOME_DA_VIEW?limit=10&offset=0
   ```

