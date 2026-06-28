FROM node:24-alpine@sha256:9e04e3f9c9164cb2c913593ba0733fbd0caf4e9bea474d743ca8a32aa36d98c9

WORKDIR /app
ENV CI=true
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig*.json ./
COPY packages/runtime/package.json ./packages/runtime/
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/transport-grpc/package.json ./packages/transport-grpc/
COPY packages/registry/package.json ./packages/registry/
COPY packages/cli/package.json ./cli/
COPY apps/demo/package.json ./apps/demo/

RUN pnpm install --frozen-lockfile --filter a2amesh-demo...

COPY . .
RUN pnpm --filter a2amesh-demo... run build

WORKDIR /app/apps/demo
USER node
CMD ["node", "dist/main.js"]
