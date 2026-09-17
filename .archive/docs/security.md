# SECURITY.md

## Threat Model & Mitigations

### 1. Cross-Tenant Data Leakage (IDOR)
**Threat**: A user from Organization A attempts to access Organization B's data.
**Mitigation**: The API strictly enforces `organizationId` matching on all queries. For example, `prisma.candidate.findFirst({ where: { id, organizationId: req.user.organizationId } })`.

### 2. Remote Code Execution (RCE)
**Threat**: A candidate submits malicious code to execute on the server host.
**Mitigation**: All untrusted candidate code is executed within isolated Docker containers. Containers have network access completely disabled (`--network none`) to prevent exfiltration or internal scanning.

### 3. Denial of Service (Resource Exhaustion)
**Threat**: A candidate writes an infinite loop or allocates excessive memory.
**Mitigation**:
- Strict time limits enforced by Code Runner execution processes.
- Memory constraints passed to Docker via `--memory`.
- Application level Rate Limiting (15 minutes lockout after 5 failed login attempts) via Redis.

### 4. Authentication and Session Management
**Threat**: Session hijacking or token brute-forcing.
**Mitigation**:
- JWTs are stored in HTTP-Only, Secure, Lax SameSite cookies.
- Candidate assessment tokens are 64-byte cryptographically secure UUIDs.
- Candidate assessment sessions perform device fingerprinting and lock to the first browser that starts the assessment.

### 5. Integrity & Proctoring
**Threat**: A candidate copies code from an external source or asks a friend.
**Mitigation**:
- Telemetry events capture Tab Blurs, Window Resizes, and Clipboard Paste operations.
- The UI restricts copying and pasting.
- Candidate code submissions are preserved immutably to prevent retroactive alteration.
