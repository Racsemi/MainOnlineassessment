# DEPLOYMENT.md

## Deployment Architecture

### Infrastructure Requirements
- **Node.js**: v18+
- **Database**: PostgreSQL 14+
- **Cache / Message Queue**: Redis 6+
- **Container Runtime**: Docker (required for isolated code execution)

### Build Steps
1. Install dependencies: `npm install`
2. Generate Prisma client: `npm run db:generate`
3. Migrate DB schema: `npm run db:migrate`
4. Build API and Web bundles: `npm run build`

### Running the Services
The application requires three long-running processes:
1. **API Server**: Handles incoming HTTP traffic (`apps/api`)
2. **Web Server**: Serves the Next.js frontend application (`apps/web`)
3. **Queue Worker**: Processes BullMQ asynchronous tasks and executes candidate code inside Docker (`services/worker`)
