# RACSEMI Assess

RACSEMI Assess is a professional, enterprise-grade online software development assessment platform designed for recruiting software developer interns and full-stack engineers.

## Overview
This platform allows RACSEMI recruiters and administrators to create, distribute, and automatically evaluate technical assessments encompassing MCQs, Aptitude, and sandboxed Coding execution.

## Repository Structure
```
racsemi-assess/
├── apps/
│   ├── web/                # Next.js 14 Frontend UI
│   └── api/                # Express.js Backend API
├── services/
│   ├── code-runner/        # Ephemeral Docker Sandbox Execution
│   └── worker/             # BullMQ Background Job Processor (Code/Emails)
├── packages/
│   ├── database/           # Prisma PostgreSQL Schema & Client
│   ├── shared/             # Shared TypeScript Types & Constants
│   └── ui/                 # Centralized React UI Component System
├── docs/                   # System Architecture & Documentation
├── scripts/                # E2E Testing & DB Seeding
└── package.json            # Monorepo Workspace Configuration
```

## Getting Started (Development)
1. Initialize the monorepo: `npm install`
2. Generate Database Client: `npm run db:generate`
3. Push Database Migrations: `npm run db:migrate`
4. Start Development Servers: `npm run dev:all`
   - UI: `http://localhost:3000`
   - API: `http://localhost:4000`

See `docs/DEPLOYMENT.md` for production deployment strategies.

## Documentation
Please refer to the `docs/` directory for detailed documentation covering Architecture, API, Security, Database, Bulk Upload protocols, Privacy, and Disaster Recovery.
