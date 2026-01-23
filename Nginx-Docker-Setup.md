# Configuração do Nginx em Container Separado

> **⚠️ Legado:** Este documento refere-se ao Nginx. O proxy reverso em produção passou a usar **Traefik**. Mantido apenas como referência.

Quando o Nginx está rodando em um container separado, ele não consegue acessar `localhost:3001` porque cada container tem seu próprio `localhost`.

## Soluções

### Opção 1: Usar nome do serviço Docker (mesma rede)

Se os containers estão na mesma rede Docker, use o nome do container:

```nginx
location /agenda {
    proxy_pass http://consultant-scheduler:3001;
    # ... resto da configuração
}
```

### Opção 2: Usar IP do host Docker

Descubra o IP do host Docker:

```bash
# No container do Nginx ou no host
ip addr show docker0 | grep inet
# Ou
hostname -I | awk '{print $1}'
```

Use o IP na configuração:

```nginx
location /agenda {
    proxy_pass http://172.17.0.1:3001;  # Substitua pelo IP real
    # ... resto da configuração
}
```

### Opção 3: Usar host.docker.internal

Se você tem Docker 20.10+ ou Docker Desktop:

```nginx
location /agenda {
    proxy_pass http://host.docker.internal:3001;
    # ... resto da configuração
}
```

### Opção 4: Usar network_mode: host (não recomendado)

No docker-compose do Nginx:

```yaml
services:
  nginx:
    network_mode: host
    # Agora pode usar localhost:3001
```

## Como descobrir qual usar

### 1. Verificar se containers estão na mesma rede

```bash
# Ver redes Docker
docker network ls

# Ver detalhes da rede
docker network inspect bridge
# ou
docker network inspect app-network
```

### 2. Ver IP do container da aplicação

```bash
# Ver IP do container
docker inspect consultant-scheduler | grep IPAddress

# Ou
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' consultant-scheduler
```

### 3. Testar conectividade do container Nginx

```bash
# Entrar no container do Nginx
docker exec -it nginx-proxy sh

# Dentro do container, testar conexão
# Opção 1: Nome do serviço
wget -O- http://consultant-scheduler:3001/agenda

# Opção 2: IP do host
wget -O- http://172.17.0.1:3001/agenda

# Opção 3: host.docker.internal
wget -O- http://host.docker.internal:3001/agenda
```

## Configuração recomendada

### Se Nginx está em container separado (não no docker-compose da app):

```nginx
server {
    listen 80;
    server_name fpsoftware.cloud;

    location /agenda {
        # Tente estas opções na ordem:
        # 1. Nome do container (se mesma rede)
        proxy_pass http://consultant-scheduler:3001;
        
        # 2. Ou IP do host Docker
        # proxy_pass http://172.17.0.1:3001;
        
        # 3. Ou host.docker.internal
        # proxy_pass http://host.docker.internal:3001;
        
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
    }
}
```

### Se quiser colocar tudo no mesmo docker-compose:

Use o arquivo `docker-compose.nginx.yml` que criei. Ele coloca Nginx e App na mesma rede.

## Passos para resolver

1. **Descobrir como o Nginx acessa a aplicação:**
   ```bash
   # Ver IP do container da aplicação
   docker inspect consultant-scheduler | grep IPAddress
   ```

2. **Testar conectividade:**
   ```bash
   # Do container do Nginx, testar
   docker exec nginx-proxy wget -O- http://IP_DO_CONTAINER:3001/agenda
   ```

3. **Atualizar configuração do Nginx** com o método que funcionar

4. **Reiniciar Nginx:**
   ```bash
   # Se Nginx está em container
   docker restart nginx-proxy
   
   # Ou se está no sistema
   sudo systemctl restart nginx
   ```

## Diagnóstico rápido

Execute no VPS:

```bash
# 1. Ver IP do container da aplicação
docker inspect consultant-scheduler | grep -A 5 "Networks"

# 2. Ver se Nginx consegue acessar
docker exec nginx-proxy ping -c 2 consultant-scheduler
# ou
docker exec nginx-proxy ping -c 2 172.17.0.1
```

Compartilhe os resultados para eu ajudar a configurar corretamente!

