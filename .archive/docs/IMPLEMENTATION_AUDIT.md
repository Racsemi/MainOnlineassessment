# RACSEMI Assess — Implementation Audit & Gap Analysis

**Date**: August 2026
**Status**: Pre-Hardening Audit

## 1. Authentication & Security
- **Implemented**: JWT auth, HTTP-only cookies, Helmet, basic CORS, basic rate limiting.
- **Missing / Incomplete**:
  - Account lockout after repeated failed logins (CRITICAL).
  - Robust CSRF protection for cookie-based auth (HIGH).
  - Explicit password strength policy (MEDIUM).
  - Comprehensive API input validation using Zod across all controllers (HIGH).

## 2. Organization Isolation & RBAC
- **Implemented**: `organizationId` tied to resources, basic `requireRoles` middleware.
- **Missing / Incomplete**:
  - Full IDOR prevention validation in all sub-controllers (e.g. updating questions/candidates) to ensure strict cross-tenant isolation (HIGH).

## 3. Code Execution Architecture & Sandbox Isolation
- **Implemented**: Ephemeral temporary directories, basic `child_process.spawn` limits.
- **Missing / Insecure**:
  - **CRITICAL**: Code currently runs natively on the API host OS via `child_process`. This poses massive security risks (fork bombs, host filesystem access).
  - Must implement an asynchronous `BullMQ` + `Redis` queue architecture.
  - Must isolate execution inside secure Docker containers (or true sandbox) per request.

## 4. Assessment Timers & State
- **Implemented**: Server-authoritative timer (`expiresAt`), autosave, crash recovery, idempotent auto-submission.
- **Missing / Incomplete**:
  - Section-level strict timing (`timingMode: SECTION_TIMER`) is in schema but not enforced (MEDIUM).
  - Question and Option Randomization is configured but not actively shuffling the snapshot (MEDIUM).
  - Scheduled assessment enforcement (preventing start outside `startWindow` / `endWindow`) (HIGH).

## 5. Candidate Integrity & Proctoring
- **Implemented**: Tab switch, fullscreen exits logged. Risk engine scoring.
- **Missing / Incomplete**:
  - Detection of concurrent multiple tabs/devices (MULTIPLE_SESSION) (HIGH).
  - Explicit tracking of consent timestamp (LOW).

## 6. Background Jobs & Email
- **Implemented**: Direct synchronous email dispatch.
- **Missing / Incomplete**:
  - Background worker system (BullMQ) for reliable email delivery, reminders, and retries (HIGH).
  - Assessment reminders (24h, 2h before deadline) (MEDIUM).
  - Data retention cleanup job (MEDIUM).

## 7. Operational & DevOps
- **Implemented**: Basic Dockerfiles, basic Nginx.
- **Missing / Incomplete**:
  - Complete `docker-compose` orchestration for the new BullMQ Worker and isolated Docker sandbox (HIGH).
  - Full Observability (Metrics, tracing) (LOW).

---

## Action Plan Priority Summary

### CRITICAL
1. Migrate Code Runner from direct `child_process` execution to a decoupled BullMQ Worker that executes inside isolated Docker containers with strict resource limits.
2. Implement Account Lockout / Brute Force protection for Admin logins.

### HIGH
3. Enforce strict Zod API validation for all incoming payloads.
4. Implement scheduled assessment deadline enforcement.
5. Setup BullMQ for asynchronous Email Delivery, Reminders, and automated Cleanup tasks.
6. Verify and tighten all Cross-Tenant IDOR checks.

### MEDIUM
7. Implement Section-Level timers in the assessment logic.
8. Add snapshot randomization (Question & Option shuffling).
9. Add multiple-tab detection on the candidate UI.
10. Refine Docker & Deployment documentation.
