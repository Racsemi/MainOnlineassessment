FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./

COPY apps ./apps
COPY packages ./packages
COPY services ./services

RUN npm ci
RUN npm run db:generate
RUN npm run build --workspace=@racsemi/worker

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/services/worker ./services/worker
COPY --from=builder /app/packages ./packages

# Start Worker
CMD ["node", "services/worker/dist/index.js"]
