FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy the monorepo root config and lockfiles
COPY package.json package-lock.json ./
COPY tsconfig.json ./

# Copy all workspaces
COPY apps ./apps
COPY packages ./packages
COPY services ./services

# Install dependencies (workspaces support)
RUN npm ci

# Generate Prisma client
RUN npm run db:generate

# Build all packages
RUN npm run build

# Start production image
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy built assets and dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages ./packages

# Expose API port
EXPOSE 4000

# Command to run the API server
CMD ["node", "apps/api/dist/server.js"]
