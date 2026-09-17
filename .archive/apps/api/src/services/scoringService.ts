import { prisma } from '@racsemi/database';
import { QuestionType } from '@racsemi/shared';

export interface FinalEvaluationResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  mcqScore: number;
  codingScore: number;
  timeTakenSeconds: number;
  sectionBreakdown: Array<{
    sectionId: string;
    title: string;
    score: number;
    maxScore: number;
    attempted: number;
    correct: number;
  }>;
}

export async function evaluateAssessmentSession(sessionId: string): Promise<FinalEvaluationResult> {
  const session = await prisma.candidateSession.findUnique({
    where: { id: sessionId },
    include: {
      assessment: {
        include: {
          sections: {
            orderBy: { orderIndex: 'asc' },
            include: {
              assessmentQuestions: {
                include: {
                  question: {
                    include: {
                      options: true,
                      codingDetails: {
                        include: {
                          testCases: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      candidateAnswers: true,
      codingSubmissions: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!session) {
    throw new Error(`Candidate session ${sessionId} not found`);
  }

  const assessment = session.assessment;
  let totalScore = 0;
  let maxScore = assessment.totalMarks || 100;
  let mcqScore = 0;
  let codingScore = 0;

  const sectionBreakdown: FinalEvaluationResult['sectionBreakdown'] = [];

  for (const section of assessment.sections) {
    let secScore = 0;
    let secMaxScore = section.marks;
    let secAttempted = 0;
    let secCorrect = 0;

    for (const aq of section.assessmentQuestions) {
      const q = aq.question;
      const questionScore = aq.customScore ?? q.score ?? 2;
      const negativeScore = q.negativeScore ?? 0;

      if (q.questionType === QuestionType.MCQ_SINGLE || q.questionType === QuestionType.TRUE_FALSE) {
        const answer = session.candidateAnswers.find(a => a.questionId === q.id);
        const correctOpt = q.options.find(o => o.isCorrect);

        if (answer && answer.selectedOptionsJson) {
          try {
            const selected = JSON.parse(answer.selectedOptionsJson);
            if (Array.isArray(selected) && selected.length > 0) {
              secAttempted++;
              const candidateChoice = selected[0];
              const isCorrect = correctOpt && correctOpt.optionKey === candidateChoice;

              if (isCorrect) {
                secCorrect++;
                secScore += questionScore;
                mcqScore += questionScore;
                await prisma.candidateAnswer.update({
                  where: { id: answer.id },
                  data: { isCorrect: true, scoreObtained: questionScore }
                });
              } else {
                secScore -= negativeScore;
                mcqScore -= negativeScore;
                await prisma.candidateAnswer.update({
                  where: { id: answer.id },
                  data: { isCorrect: false, scoreObtained: -negativeScore }
                });
              }
            }
          } catch {
            // Invalid answer format
          }
        }
      } else if (q.questionType === QuestionType.MCQ_MULTIPLE) {
        const answer = session.candidateAnswers.find(a => a.questionId === q.id);
        const correctKeys = q.options.filter(o => o.isCorrect).map(o => o.optionKey).sort();

        if (answer && answer.selectedOptionsJson) {
          try {
            const selected = (JSON.parse(answer.selectedOptionsJson) as string[]).sort();
            if (selected.length > 0) {
              secAttempted++;
              const isExact = selected.length === correctKeys.length && selected.every((v, i) => v === correctKeys[i]);

              if (isExact) {
                secCorrect++;
                secScore += questionScore;
                mcqScore += questionScore;
                await prisma.candidateAnswer.update({
                  where: { id: answer.id },
                  data: { isCorrect: true, scoreObtained: questionScore }
                });
              } else {
                secScore -= negativeScore;
                mcqScore -= negativeScore;
                await prisma.candidateAnswer.update({
                  where: { id: answer.id },
                  data: { isCorrect: false, scoreObtained: -negativeScore }
                });
              }
            }
          } catch {}
        }
      } else if (q.questionType === QuestionType.CODING) {
        // Find candidate's latest non-draft submission for this question
        const submission = session.codingSubmissions.find(s => s.questionId === q.id && !s.isDraft);
        if (submission) {
          secAttempted++;
          const score = submission.scoreObtained || 0;
          if (submission.passedTestCases === submission.totalTestCases && submission.totalTestCases > 0) {
            secCorrect++;
          }
          secScore += score;
          codingScore += score;
        }
      }
    }

    // Clamp section score to min 0
    secScore = Math.max(0, secScore);
    totalScore += secScore;

    sectionBreakdown.push({
      sectionId: section.id,
      title: section.title,
      score: Math.round(secScore * 100) / 100,
      maxScore: secMaxScore,
      attempted: secAttempted,
      correct: secCorrect
    });
  }

  // Ensure overall total does not go below 0
  totalScore = Math.max(0, totalScore);
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0;
  const passed = percentage >= (assessment.passingPercentage || 60);

  const startTime = session.startedAt ? session.startedAt.getTime() : Date.now();
  const endTime = session.submittedAt ? session.submittedAt.getTime() : Date.now();
  const timeTakenSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));

  // Persist AssessmentResult and SectionResults
  const result = await prisma.assessmentResult.upsert({
    where: { sessionId: session.id },
    update: {
      totalScore,
      maxScore,
      percentage,
      passed,
      mcqScore,
      codingScore,
      timeTakenSeconds,
      evaluationSummaryJson: JSON.stringify(sectionBreakdown)
    },
    create: {
      sessionId: session.id,
      totalScore,
      maxScore,
      percentage,
      passed,
      mcqScore,
      codingScore,
      timeTakenSeconds,
      evaluationSummaryJson: JSON.stringify(sectionBreakdown)
    }
  });

  // Persist Section Results
  for (const sb of sectionBreakdown) {
    await prisma.sectionResult.create({
      data: {
        assessmentResultId: result.id,
        sectionId: sb.sectionId,
        score: sb.score,
        maxScore: sb.maxScore,
        questionsAttempted: sb.attempted,
        questionsCorrect: sb.correct
      }
    });
  }

  // Link CandidateReport to AssessmentResult
  await prisma.candidateReport.upsert({
    where: { sessionId: session.id },
    update: {
      assessmentResultId: result.id
    },
    create: {
      sessionId: session.id,
      assessmentResultId: result.id,
      overallRiskLevel: 'LOW',
      integrityScore: 100,
      recruiterDecision: 'PENDING',
      summary: 'Assessment completed and scored.'
    }
  });

  return {
    totalScore,
    maxScore,
    percentage,
    passed,
    mcqScore,
    codingScore,
    timeTakenSeconds,
    sectionBreakdown
  };
}
