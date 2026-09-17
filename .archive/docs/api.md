# API.md

## RESTful API Documentation

RACSEMI Assess exposes a RESTful JSON API.

### Endpoints

- `POST /api/auth/login`: Authenticates an admin and returns JWTs. Rate-limited to 5 attempts per 15 minutes.
- `GET /api/assessments`: Lists assessments for the authenticated organization.
- `GET /api/candidate/assessment/:token`: Fetches public assessment metadata using a cryptographically secure token.
- `POST /api/candidate/session/start`: Initializes a session. Takes a device fingerprint. Checks if the assessment window is open.
- `POST /api/candidate/session/:sessionId/autosave`: Idempotent endpoint for autosaving answers.
- `POST /api/candidate/code/run`: Submits code to BullMQ for sandboxed test-case evaluation (Run mode).
- `POST /api/candidate/code/submit`: Submits code for formal scoring (Submit mode).
- `POST /api/candidate/session/:sessionId/submit`: Finalizes the assessment session.
- `GET /api/reports/candidate/:sessionId`: Retrieves detailed candidate performance and integrity reports.

### Authentication
Admins authenticate via HTTP-Only cookies holding a JWT (`token`).
Candidates authenticate via URL tokens injected into `req.body` or URL Params.
