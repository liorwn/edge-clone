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
RUN npm ci --omit=dev

# Copy core source and build TypeScript
COPY src/ ./src/
COPY tsconfig.json ./
RUN npx tsc

# Install web app dependencies
COPY web/package*.json ./web/
RUN cd web && npm ci

# Copy web source and build
COPY web/ ./web/
RUN cd web && npm run build

# Copy standalone output static files
RUN cp -r /app/web/public /app/web/.next/standalone/web/public 2>/dev/null || true
RUN cp -r /app/web/.next/static /app/web/.next/standalone/web/.next/static 2>/dev/null || true

# Copy core dist into standalone for runtime imports
RUN cp -r /app/dist /app/web/.next/standalone/dist 2>/dev/null || true
RUN cp -r /app/node_modules /app/web/.next/standalone/node_modules 2>/dev/null || true

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app/web/.next/standalone/web
CMD ["node", "server.js"]
