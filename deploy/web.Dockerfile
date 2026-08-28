FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter @zun-db/web... --no-frozen-lockfile
COPY apps/web apps/web
RUN pnpm --filter @zun-db/web build
CMD ["pnpm", "--filter", "@zun-db/web", "start"]
