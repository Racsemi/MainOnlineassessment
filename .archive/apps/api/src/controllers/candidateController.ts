import { Response } from 'express';
import { prisma } from '@racsemi/database';
import { AuthenticatedRequest } from '../middlewares/auth';
import { sanitizeCsvField } from '@racsemi/shared';
import { logAuditAction } from '../services/auditService';

export async function listCandidates(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.user!.organizationId;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;

    const where: any = { organizationId: orgId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { candidateIdentifier: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, candidates] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          invitations: {
            include: {
              assessment: {
                select: { id: true, title: true, status: true }
              },
              candidateSession: {
                select: {
                  id: true,
                  status: true,
                  startedAt: true,
                  submittedAt: true,
                  assessmentResult: {
                    select: {
                      totalScore: true,
                      maxScore: true,
                      percentage: true,
                      passed: true
                    }
                  },
                  candidateReport: {
                    select: {
                      overallRiskLevel: true,
                      integrityScore: true,
                      recruiterDecision: true
                    }
                  }
                }
              }
            }
          }
        }
      })
    ]);

    return res.json({
      success: true,
      data: candidates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function importCandidatesCsv(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.user!.organizationId;
    const { candidates } = req.body; // Array of { name, email, phone, candidateIdentifier }

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or empty candidate list' });
    }

    let importedCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const c of candidates) {
      const email = c.email ? c.email.trim().toLowerCase() : '';
      const name = c.name ? c.name.trim() : '';

      if (!email || !emailRegex.test(email)) {
        errors.push(`Invalid email for record: "${name || 'Unnamed'}"`);
        continue;
      }

      try {
        const existing = await prisma.candidate.findUnique({
          where: {
            organizationId_email: {
              organizationId: orgId,
              email
            }
          }
        });

        if (existing) {
          duplicateCount++;
          continue;
        }

        await prisma.candidate.create({
          data: {
            organizationId: orgId,
            name: name || 'Candidate',
            email,
            phone: c.phone ? String(c.phone).trim() : null,
            candidateIdentifier: c.candidateIdentifier ? String(c.candidateIdentifier).trim() : null,
            tags: c.tags ? String(c.tags).trim() : 'imported-csv'
          }
        });
        importedCount++;
      } catch (e: any) {
        errors.push(`Failed to import ${email}: ${e.message}`);
      }
    }

    await logAuditAction({
      organizationId: orgId,
      userId: req.user!.id,
      action: 'CANDIDATES_IMPORTED',
      entityType: 'Candidate',
      metadata: { importedCount, duplicateCount, total: candidates.length }
    });

    return res.json({
      success: true,
      message: `Successfully imported ${importedCount} candidates. ${duplicateCount} duplicates skipped.`,
      importedCount,
      duplicateCount,
      errors
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
