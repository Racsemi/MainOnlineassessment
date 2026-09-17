import { prisma } from '@racsemi/database';

export interface AuditParams {
  organizationId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditAction(params: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent
      }
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
