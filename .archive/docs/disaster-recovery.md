# RACSEMI Assess — Disaster Recovery & Backup Plan

## Automated Backup Strategy
PostgreSQL database dumps should be executed daily via cron:

```bash
pg_dump -U postgres -d racsemi_assess -F c -b -v -f /backups/racsemi_backup_$(date +%Y%m%d_%H%M%S).dump
```

## Restore Procedure
To restore the platform to a new cluster:

```bash
pg_restore -U postgres -d racsemi_assess -v /backups/target_backup.dump
```

## Recovery SLAs
- **RPO (Recovery Point Objective)**: 1 hour (via WAL archiving).
- **RTO (Recovery Time Objective)**: 15 minutes (via automated container redeployment).
