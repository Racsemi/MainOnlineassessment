import { Response } from 'express';
import { prisma } from '@racsemi/database';
import { AuthenticatedRequest } from '../middlewares/auth';
import { QuestionType, DifficultyLevel } from '@racsemi/shared';
import { logAuditAction } from '../services/auditService';

export async function listQuestions(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.user!.organizationId;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    const category = req.query.category as string;
    const difficulty = req.query.difficulty as DifficultyLevel;
    const questionType = req.query.questionType as QuestionType;
    const search = req.query.search as string;

    const where: any = { organizationId: orgId, isArchived: false };
    if (category && category !== 'All') where.category = category;
    if (difficulty) where.difficulty = difficulty;
    if (questionType && questionType !== ('ALL' as any)) where.questionType = questionType;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { problemStatement: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, questions] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          options: {
            orderBy: { orderIndex: 'asc' }
          },
          codingDetails: {
            include: {
              testCases: {
                orderBy: { orderIndex: 'asc' }
              }
            }
          }
        }
      })
    ]);

    return res.json({
      success: true,
      data: questions,
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

export async function getQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.user!.organizationId;

    const question = await prisma.question.findFirst({
      where: { id, organizationId: orgId, isArchived: false },
      include: {
        options: { orderBy: { orderIndex: 'asc' } },
        codingDetails: {
          include: {
            testCases: { orderBy: { orderIndex: 'asc' } }
          }
        }
      }
    });

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    return res.json({ success: true, data: question });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;
    const {
      title,
      problemStatement,
      questionType,
      difficulty,
      category,
      tags,
      score,
      negativeScore,
      explanation,
      options,
      codingDetails
    } = req.body;

    if (!title || !problemStatement) {
      return res.status(400).json({ success: false, message: 'Title and problem statement are required' });
    }

    const type = questionType || QuestionType.MCQ_SINGLE;

    // Strict validation
    if (type === QuestionType.MCQ_SINGLE || type === QuestionType.MCQ_MULTIPLE) {
      if (!Array.isArray(options) || options.length < 2) {
        return res.status(400).json({ success: false, message: 'MCQ questions require at least 2 options' });
      }
      const correctCount = options.filter(o => o.isCorrect).length;
      if (type === QuestionType.MCQ_SINGLE && correctCount !== 1) {
        return res.status(400).json({ success: false, message: 'MCQ_SINGLE requires exactly one correct answer' });
      }
      if (type === QuestionType.MCQ_MULTIPLE && correctCount < 1) {
        return res.status(400).json({ success: false, message: 'MCQ_MULTIPLE requires at least one correct answer' });
      }
    } else if (type === QuestionType.CODING) {
      if (!codingDetails) {
        return res.status(400).json({ success: false, message: 'Coding details are required for coding questions' });
      }
      if (!codingDetails.inputFormat || !codingDetails.outputFormat) {
        return res.status(400).json({ success: false, message: 'Input and output formats are required' });
      }
      if (!Array.isArray(codingDetails.testCases) || codingDetails.testCases.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one test case is required' });
      }
    }

    const question = await prisma.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: {
          organizationId: orgId,
          title,
          problemStatement,
          questionType: type,
          difficulty: difficulty || DifficultyLevel.EASY,
          category: category || 'General',
          tags: Array.isArray(tags) ? tags.join(',') : tags || null,
          score: Number(score) || 2,
          negativeScore: Number(negativeScore) || 0,
          explanation,
          createdById: userId
        }
      });

      if ((type === QuestionType.MCQ_SINGLE || type === QuestionType.MCQ_MULTIPLE) && Array.isArray(options)) {
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          await tx.questionOption.create({
            data: {
              questionId: q.id,
              optionKey: opt.optionKey || String.fromCharCode(65 + i),
              content: opt.content || opt.text,
              isCorrect: !!opt.isCorrect,
              explanation: opt.explanation,
              orderIndex: i
            }
          });
        }
      }

      if (type === QuestionType.CODING && codingDetails) {
        const cd = await tx.codingQuestion.create({
          data: {
            questionId: q.id,
            inputFormat: codingDetails.inputFormat,
            outputFormat: codingDetails.outputFormat,
            constraints: codingDetails.constraints,
            sampleCasesJson: codingDetails.sampleCases ? JSON.stringify(codingDetails.sampleCases) : null,
            starterCodeJson: codingDetails.starterCode ? JSON.stringify(codingDetails.starterCode) : null,
            memoryLimitMb: Number(codingDetails.memoryLimitMb) || 256,
            timeLimitMs: Number(codingDetails.timeLimitMs) || 5000,
            allowedLanguages: codingDetails.allowedLanguages ? JSON.stringify(codingDetails.allowedLanguages) : JSON.stringify(['python', 'javascript', 'cpp', 'java'])
          }
        });

        if (Array.isArray(codingDetails.testCases)) {
          for (let i = 0; i < codingDetails.testCases.length; i++) {
            const tc = codingDetails.testCases[i];
            await tx.testCase.create({
              data: {
                codingQuestionId: cd.id,
                input: tc.input || '',
                expectedOutput: tc.expectedOutput || '',
                isHidden: tc.isHidden !== false,
                scoreWeight: tc.scoreWeight || 1.0,
                explanation: tc.explanation,
                orderIndex: i
              }
            });
          }
        }
      }

      return q;
    });

    await logAuditAction({
      organizationId: orgId,
      userId,
      action: 'QUESTION_CREATED',
      entityType: 'Question',
      entityId: question.id,
      metadata: { title, questionType: type }
    });

    return res.status(201).json({ success: true, message: 'Question created successfully', data: question });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.user!.organizationId;
    const {
      title, problemStatement, difficulty, category, tags, score, negativeScore, explanation, options, codingDetails
    } = req.body;

    const existing = await prisma.question.findFirst({
      where: { id, organizationId: orgId, isArchived: false },
      include: { codingDetails: true }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const activeAssessmentsCount = await prisma.assessmentQuestion.count({
      where: {
        questionId: id,
        assessment: {
          status: { in: ['ACTIVE', 'PUBLISHED'] }
        }
      }
    });

    if (activeAssessmentsCount > 0) {
      return res.status(400).json({ success: false, message: 'Cannot edit a question currently used in published assessments.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.question.update({
        where: { id },
        data: {
          title,
          problemStatement,
          difficulty,
          category,
          tags: Array.isArray(tags) ? tags.join(',') : tags || null,
          score: Number(score),
          negativeScore: Number(negativeScore),
          explanation
        }
      });

      if ((existing.questionType === QuestionType.MCQ_SINGLE || existing.questionType === QuestionType.MCQ_MULTIPLE) && Array.isArray(options)) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          await tx.questionOption.create({
            data: {
              questionId: id,
              optionKey: opt.optionKey || String.fromCharCode(65 + i),
              content: opt.content || opt.text,
              isCorrect: !!opt.isCorrect,
              explanation: opt.explanation,
              orderIndex: i
            }
          });
        }
      } else if (existing.questionType === QuestionType.CODING && codingDetails) {
        if (existing.codingDetails) {
          await tx.codingQuestion.update({
            where: { questionId: id },
            data: {
              inputFormat: codingDetails.inputFormat,
              outputFormat: codingDetails.outputFormat,
              constraints: codingDetails.constraints,
              sampleCasesJson: codingDetails.sampleCases ? JSON.stringify(codingDetails.sampleCases) : null,
              starterCodeJson: codingDetails.starterCode ? JSON.stringify(codingDetails.starterCode) : null,
              memoryLimitMb: Number(codingDetails.memoryLimitMb),
              timeLimitMs: Number(codingDetails.timeLimitMs),
              allowedLanguages: codingDetails.allowedLanguages ? JSON.stringify(codingDetails.allowedLanguages) : null
            }
          });
          await tx.testCase.deleteMany({ where: { codingQuestionId: existing.codingDetails.id } });
          if (Array.isArray(codingDetails.testCases)) {
            for (let i = 0; i < codingDetails.testCases.length; i++) {
              const tc = codingDetails.testCases[i];
              await tx.testCase.create({
                data: {
                  codingQuestionId: existing.codingDetails.id,
                  input: tc.input || '',
                  expectedOutput: tc.expectedOutput || '',
                  isHidden: tc.isHidden !== false,
                  scoreWeight: tc.scoreWeight || 1.0,
                  explanation: tc.explanation,
                  orderIndex: i
                }
              });
            }
          }
        }
      }
      return q;
    });

    await logAuditAction({
      organizationId: orgId,
      userId: req.user!.id,
      action: 'QUESTION_UPDATED',
      entityType: 'Question',
      entityId: id
    });

    return res.json({ success: true, message: 'Question updated successfully', data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteQuestion(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.user!.organizationId;

    const existing = await prisma.question.findFirst({
      where: { id, organizationId: orgId, isArchived: false }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const activeAssessmentsCount = await prisma.assessmentQuestion.count({
      where: {
        questionId: id,
        assessment: {
          status: { in: ['ACTIVE', 'PUBLISHED'] }
        }
      }
    });

    if (activeAssessmentsCount > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete a question currently used in published assessments.' });
    }

    await prisma.question.update({
      where: { id },
      data: { isArchived: true }
    });

    await logAuditAction({
      organizationId: orgId,
      userId: req.user!.id,
      action: 'QUESTION_DELETED',
      entityType: 'Question',
      entityId: id
    });

    return res.json({ success: true, message: 'Question deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function importQuestionsCsv(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.user!.organizationId;
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or empty questions list' });
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.question || !q.type) {
          throw new Error(`Row ${i + 1}: Missing question or type`);
        }

        const qType = q.type === 'MCQ_MULTIPLE' ? QuestionType.MCQ_MULTIPLE : QuestionType.MCQ_SINGLE;
        
        if (!q.correctAnswer) {
          throw new Error(`Row ${i + 1}: Missing correctAnswer`);
        }

        const createdQ = await tx.question.create({
          data: {
            organizationId: orgId,
            title: q.question.substring(0, 50) + (q.question.length > 50 ? '...' : ''),
            problemStatement: q.question,
            questionType: qType,
            difficulty: q.difficulty || DifficultyLevel.MEDIUM,
            category: q.category || 'General',
            tags: q.tags || '',
            score: Number(q.marks) || 2,
            negativeScore: Number(q.negativeMarks) || 0,
            explanation: q.explanation || null,
            createdById: req.user!.id
          }
        });

        const options = [
          { key: 'A', content: q.optionA },
          { key: 'B', content: q.optionB },
          { key: 'C', content: q.optionC },
          { key: 'D', content: q.optionD },
          { key: 'E', content: q.optionE }
        ].filter(o => o.content);

        if (options.length < 2) {
          throw new Error(`Row ${i + 1}: MCQ requires at least 2 options`);
        }

        const sep = q.correctAnswer.includes('|') ? '|' : ',';
        const correctAnswers = q.correctAnswer.split(sep).map((s: string) => s.trim().toUpperCase());

        if (qType === QuestionType.MCQ_SINGLE && correctAnswers.length > 1) {
          throw new Error(`Row ${i + 1}: MCQ_SINGLE requires exactly one correct option`);
        }

        for (let j = 0; j < options.length; j++) {
          const opt = options[j];
          await tx.questionOption.create({
            data: {
              questionId: createdQ.id,
              optionKey: opt.key,
              content: opt.content,
              isCorrect: correctAnswers.includes(opt.key),
              orderIndex: j
            }
          });
        }
      }
    });

    await logAuditAction({
      organizationId: orgId,
      userId: req.user!.id,
      action: 'QUESTIONS_IMPORTED',
      entityType: 'Question',
      metadata: { importedCount: questions.length, total: questions.length }
    });

    return res.json({
      success: true,
      message: `Successfully imported ${questions.length} questions.`,
      importedCount: questions.length,
      failedCount: 0,
      errors: []
    });
  } catch (err: any) {
    return res.status(400).json({ 
      success: false, 
      message: 'Import failed. No questions were imported.', 
      errors: [err.message]
    });
  }
}

