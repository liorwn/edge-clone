FROM node:22-slim

RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

# Install core library dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy core source
COPY src/ ./src/
COPY tsconfig.json ./

# Install web app dependencies
COPY web/package*.json ./web/
RUN cd web && npm ci

# Copy web source and build
COPY web/ ./web/
RUN cd web && npm run build

EXPOSE 3000

WORKDIR /app/web
CMD ["npm", "start"]
