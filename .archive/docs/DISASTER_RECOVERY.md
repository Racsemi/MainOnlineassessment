# DISASTER_RECOVERY.md

## Disaster Recovery & High Availability

### Failure Scenarios

#### 1. Code Runner Container Exhaustion
If Docker containers fail to spawn or consume all host resources, the BullMQ worker will fail the job after a timeout. The API will report the failure safely without crashing the main application thread.

#### 2. Database Connection Loss
The API relies on PostgreSQL. In the event of an outage, Prisma will throw connectivity errors, resulting in `500` HTTP responses. Reconnection is handled automatically by the Prisma connection pool once the database is restored.

#### 3. Redis / Queue Failure
If Redis goes down, asynchronous code execution and email delivery will be temporarily unavailable. The application degrades safely.

### Backup Strategy
- **PostgreSQL**: Daily snapshots and continuous WAL archiving are recommended.
- **Redis**: Periodic snapshots (RDB) can be configured, though state in Redis is primarily ephemeral queue data.
