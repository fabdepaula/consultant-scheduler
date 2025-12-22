# Stage 1: Build do cliente
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build do servidor
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Imagem de produção
FROM node:20-alpine AS production
WORKDIR /app

# Instalar apenas dependências de produção do servidor
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# Copiar build do servidor
COPY --from=server-builder /app/server/dist ./dist

# Copiar build do cliente para o servidor servir
COPY --from=client-builder /app/client/dist ./client/dist

# Criar diretório para uploads
RUN mkdir -p /app/server/uploads

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3001

# Expor porta
EXPOSE 3001

# Comando para iniciar o servidor
WORKDIR /app/server
CMD ["node", "dist/index.js"]

