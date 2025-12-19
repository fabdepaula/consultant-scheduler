# Configuração MySQL Externa

Este documento descreve como configurar a conexão com o banco de dados MySQL externo.

## Variáveis de Ambiente

Adicione as seguintes variáveis ao arquivo `.env` na raiz do servidor:

```env
# MySQL External Database Configuration
MYSQL_HOST=ngrglobal.db.artia.com
MYSQL_DATABASE=artia
MYSQL_USER=cliente-ngrglobal
MYSQL_PASSWORD=b4j5WDsUgjgdKTyK
```

**Nota:** As credenciais também estão configuradas como valores padrão no código, mas é recomendado usar variáveis de ambiente para maior segurança.

## Endpoints da API

Todas as rotas requerem autenticação de administrador e estão disponíveis em `/api/external-data`:

### 1. Listar Views Disponíveis
```
GET /api/external-data/views
```

Retorna uma lista de todas as views disponíveis no banco de dados.

### 2. Buscar Estrutura de uma View
```
GET /api/external-data/views/:viewName/structure
```

Retorna informações sobre as colunas de uma view específica (nome, tipo, nullable, etc.).

### 3. Buscar Dados de uma View
```
GET /api/external-data/views/:viewName?limit=100&offset=0
```

Retorna os dados de uma view específica com paginação.

**Parâmetros de Query:**
- `limit` (opcional): Número de registros por página (padrão: 100)
- `offset` (opcional): Número de registros a pular (padrão: 0)

### 4. Executar Query Customizada
```
POST /api/external-data/query
Content-Type: application/json

{
  "query": "SELECT * FROM view_name WHERE condition = 'value'"
}
```

Permite executar queries SELECT customizadas. Por segurança, apenas queries SELECT são permitidas.

## Exemplos de Uso

### Listar todas as views:
```bash
curl -X GET http://localhost:3001/api/external-data/views \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Buscar dados de uma view específica:
```bash
curl -X GET "http://localhost:3001/api/external-data/views/nome_da_view?limit=50&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Ver estrutura de uma view:
```bash
curl -X GET http://localhost:3001/api/external-data/views/nome_da_view/structure \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Segurança

- Todas as rotas requerem autenticação de administrador
- Apenas queries SELECT são permitidas na rota de query customizada
- Validação de nomes de views para prevenir SQL injection
- Pool de conexões para melhor performance e gerenciamento de recursos

