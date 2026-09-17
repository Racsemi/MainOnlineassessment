import { prisma } from '@racsemi/database';
import { IntegrityEventType, INTEGRITY_WEIGHTS, calculateRiskLevel, RiskLevel, RecruiterDecision } from '@racsemi/shared';

export async function recordIntegrityEvent(
  sessionId: string,
  eventType: IntegrityEventType,
  eventData?: any,
  clientTimestamp?: string
) {
  const riskWeight = INTEGRITY_WEIGHTS[eventType] || 1;

  // 1. Insert Integrity Event
  const event = await prisma.integrityEvent.create({
    data: {
      sessionId,
      eventType,
      eventDataJson: eventData ? JSON.stringify(eventData) : null,
      riskWeight,
      clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : new Date()
    }
  });

  // 2. Fetch all events for session to compute cumulative risk
  const allEvents = await prisma.integrityEvent.findMany({
    where: { sessionId }
  });

  const totalRiskWeight = allEvents.reduce((sum, e) => sum + e.riskWeight, 0);
  const overallRiskLevel = calculateRiskLevel(totalRiskWeight);
  const integrityScore = Math.max(0, Math.round(100 - (totalRiskWeight * 3.5)));

  // 3. Upsert CandidateReport
  await prisma.candidateReport.upsert({
    where: { sessionId },
    update: {
      overallRiskLevel,
      integrityScore,
      summary: `Logged ${allEvents.length} integrity telemetry events (Total weight: ${totalRiskWeight}). Risk: ${overallRiskLevel}.`
    },
    create: {
      sessionId,
      overallRiskLevel,
      integrityScore,
      recruiterDecision: RecruiterDecision.PENDING,
      summary: `Logged ${allEvents.length} integrity telemetry events. Risk: ${overallRiskLevel}.`
    }
  });

  return { event, overallRiskLevel, integrityScore };
}
