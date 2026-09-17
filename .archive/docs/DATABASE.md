# DATABASE.md

## Database Schema & Architecture

RACSEMI Assess relies on PostgreSQL as its primary transactional datastore, managed by Prisma ORM.

### Key Entities
- **User / Organization**: Multi-tenant RBAC foundation.
- **Assessment**: Configures duration, randomizations, and structure.
- **Question / TestCase**: Supports polymorphic questions (MCQ, Coding).
- **CandidateSession**: Core transactional record for a candidate's attempt, storing immutable snapshots.
- **CandidateAnswer / CodingSubmission**: Child records storing candidate outputs.
- **CandidateReport**: Final aggregated report containing integrity scores and recruiter decisions.

### Schema Best Practices
- **Multi-Tenancy**: All root-level resources belong to an `organizationId`.
- **Soft Deletes**: Deletion of critical resources utilizes the `isArchived` flag rather than hard removal.
- **Cascade Rules**: Only non-critical relational links are configured with `onDelete: Cascade`.

### Migrations
Always use `npm run db:migrate` or `prisma migrate deploy` to safely apply database state transitions.
