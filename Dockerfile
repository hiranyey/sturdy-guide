FROM node:26-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:26-bookworm-slim

WORKDIR /app

# Vibeship does not inject PORT. Caddy and the health check use this port.
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/dist ./dist
COPY scripts/serve.mjs ./scripts/serve.mjs

EXPOSE 3000

# Official Node image user: uid 1000, gid 1000. The app does not write /data.
USER node

CMD ["node", "scripts/serve.mjs"]
