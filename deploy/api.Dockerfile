FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --filter @zun-db/api... --no-frozen-lockfile
COPY apps/api apps/api
RUN pnpm --filter @zun-db/api build

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends mongodb-database-tools ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
USER node
CMD ["node", "apps/api/dist/main.js"]
