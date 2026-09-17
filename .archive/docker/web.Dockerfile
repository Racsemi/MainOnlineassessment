FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./

COPY apps ./apps
COPY packages ./packages
COPY services ./services

RUN npm ci
RUN npm run db:generate

# Set production environment for Next.js build
ENV NODE_ENV=production
RUN npm run build --workspace=@racsemi/web

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

EXPOSE 3000

# Start Next.js
CMD ["npm", "start", "--workspace=@racsemi/web"]
