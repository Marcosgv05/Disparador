# Usa Node.js LTS
FROM node:20-alpine

# Instala dependências do sistema necessárias
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Define variáveis de ambiente para Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Cria diretório da aplicação
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências
RUN npm ci --only=production

# Copia código da aplicação
COPY . .

# Cria diretórios necessários
RUN mkdir -p auth_sessions uploads

# Expõe a porta
EXPOSE 3000

# Define variável de ambiente
ENV NODE_ENV=production

# Comando para iniciar
CMD ["npm", "run", "web"]
