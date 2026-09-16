FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY smart-contract/package.json smart-contract/package.json
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
COPY . .
RUN npm run build

FROM build AS chain
RUN mkdir -p /app/shared && chown -R node:node /app/shared
USER node
ENV HARDHAT_DISABLE_TELEMETRY_PROMPT=true
EXPOSE 8545
CMD ["node", "scripts/local-chain.mjs"]

FROM node:24.21.0-bookworm-slim AS api
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY smart-contract/package.json smart-contract/package.json
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/backend/dist ./backend/dist
COPY scripts/healthcheck.mjs ./scripts/healthcheck.mjs
USER node
EXPOSE 3000
CMD ["node", "backend/dist/main.js"]
