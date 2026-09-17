# RACSEMI Assess Architecture

## Overview
RACSEMI Assess is a scalable, secure, and performant web-based technical assessment platform. It uses a modern Next.js React frontend, a Node.js Express backend, and a robust PostgreSQL database orchestrated with Prisma.

## System Components
1. **Frontend (Web Application)**: `apps/web`
   - Framework: Next.js 14, React 18
   - Styling: Tailwind CSS, Lucide Icons
   - Code Editor: Monaco Editor

2. **Backend API**: `apps/api`
   - Framework: Express.js, TypeScript
   - Auth: JWT (HTTP-Only Secure Cookies)
   - Database ORM: Prisma

3. **Background Worker**: `services/worker`
   - Queue: BullMQ backed by Redis
   - Role: Asynchronously executes candidate code in an isolated environment, and handles long-running tasks like email delivery.

4. **Code Runner Sandbox**: `services/code-runner`
   - Implementation: Docker-based ephemeral containers (`node`, `python`, `gcc`, `java`, `golang`).
   - Security: No network access (`--network none`), strict memory limits (`--memory`), and process isolation.

5. **Database**: `packages/database`
   - Engine: PostgreSQL
   - Schema: Defined in `schema.prisma`. Implements Multi-Tenant architecture using `organizationId`.

## High-Level Data Flow (Code Execution)
1. Candidate writes code in the Monaco Editor and submits.
2. Frontend sends `POST /api/candidate/code/submit`.
3. API validates session, fetches test cases, and enqueues a job into BullMQ (`code-execution` queue).
4. Worker picks up the job and spawns an ephemeral Docker container via Code Runner.
5. Code Runner executes the code, captures stdout/stderr, and returns the result.
6. Worker updates the job result in Redis.
7. API retrieves the result and saves the `CodingSubmission` to PostgreSQL.
