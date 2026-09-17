import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import prisma from '../utils/db';

export const getQuestions = async (req: Request, res: Response) => {
  try {
    const questions = await prisma.question.findMany({
      include: { options: true }
    });
    
    const codingQuestions = await prisma.codingQuestion.findMany({
      include: { testCases: true }
    });
    
    const mappedCoding = codingQuestions.map(cq => ({
      ...cq,
      type: 'CODING',
      text: cq.title
    }));

    res.json([...questions, ...mappedCoding]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
};

export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { sectionId, text, type, category, difficulty, marks, negativeMarks, expectedAnswer, tolerance, options } = req.body;
    
    const question = await prisma.question.create({
      data: {
        sectionId,
        text,
        type,
        category: category || 'General',
        difficulty: difficulty || 'Medium',
        marks,
        negativeMarks: negativeMarks || null,
        expectedAnswer: expectedAnswer || null,
        tolerance: tolerance || null,
        options: options && options.length > 0 ? {
          create: options 
        } : undefined
      },
      include: { options: true }
    });
    
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create question' });
  }
};

export const createCodingQuestion = async (req: Request, res: Response) => {
  try {
    const { sectionId, title, description, inputFormat, outputFormat, constraints, marks, timeLimit, memoryLimit, allowedLanguages, testCases } = req.body;
    
    const codingQuestion = await prisma.codingQuestion.create({
      data: {
        sectionId,
        title,
        description,
        inputFormat,
        outputFormat,
        constraints,
        marks,
        timeLimit,
        memoryLimit,
        allowedLanguages,
        testCases: {
          create: testCases // expects array of { input, expectedOutput, isHidden }
        }
      },
      include: { testCases: true }
    });
    
    res.status(201).json(codingQuestion);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create coding question' });
  }
};

export const validateCsv = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const content = req.file.buffer.toString('utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    
    let validRows: any[] = [];
    let invalidRows: any[] = [];
    
    records.forEach((row: any, index: number) => {
      const rowNum = index + 2; // header is 1
      const type = row.type?.toUpperCase();
      
      if (!['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(type)) {
        invalidRows.push({ row: rowNum, field: 'type', error: 'Invalid question type' });
        return;
      }
      
      if (!row.question?.trim()) {
        invalidRows.push({ row: rowNum, field: 'question', error: 'Question text is empty' });
        return;
      }
      
      if (!row.option_a || !row.option_b || !row.option_c || !row.option_d) {
        invalidRows.push({ row: rowNum, field: 'options', error: 'All 4 options must be provided' });
        return;
      }
      
      if (!row.correct_answer?.trim()) {
        invalidRows.push({ row: rowNum, field: 'correct_answer', error: 'Correct answer required' });
        return;
      }
      
      validRows.push({
        text: row.question.trim(),
        type,
        category: row.category?.trim() || 'General',
        difficulty: row.difficulty?.trim() || 'Medium',
        marks: parseInt(row.marks) || 1,
        options: [
          { text: row.option_a.trim(), isCorrect: row.correct_answer.includes('A') },
          { text: row.option_b.trim(), isCorrect: row.correct_answer.includes('B') },
          { text: row.option_c.trim(), isCorrect: row.correct_answer.includes('C') },
          { text: row.option_d.trim(), isCorrect: row.correct_answer.includes('D') },
        ]
      });
    });
    
    res.json({
      total: records.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      validRows, // send back parsed data for preview
      invalidRows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse CSV' });
  }
};

export const importCsv = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const content = req.file.buffer.toString('utf-8');
    const records: any[] = parse(content, { columns: true, skip_empty_lines: true });
    
    const questionsToCreate = [];
    
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const type = (row.type?.toUpperCase() === 'SINGLE_CHOICE') ? 'SINGLE_CHOICE' : 'MULTIPLE_CHOICE';
      
      if (!row.text?.trim() || !row.option_A || !row.correct_answer?.trim()) continue;
      
      questionsToCreate.push({
        text: row.text.trim(),
        type,
        category: row.category?.trim() || 'General',
        difficulty: row.difficulty?.trim() || 'Medium',
        marks: parseInt(row.marks) || 1,
        options: [
          { text: row.option_A.trim(), isCorrect: row.correct_answer.includes('A') },
          { text: row.option_B.trim(), isCorrect: row.correct_answer.includes('B') },
          { text: row.option_C.trim(), isCorrect: row.correct_answer.includes('C') },
          { text: row.option_D.trim(), isCorrect: row.correct_answer.includes('D') },
        ]
      });
    }

    const created = await Promise.all(
      questionsToCreate.map(async (q) => {
        return prisma.question.create({
          data: {
            text: q.text,
            type: q.type as any,
            category: q.category,
            difficulty: q.difficulty,
            marks: q.marks,
            options: {
              create: q.options
            }
          },
          include: { options: true }
        });
      })
    );
    
    res.json({ imported: created.length, questions: created });
  } catch (error) {
    console.error('CSV Import Error:', error);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
};

export const deleteQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    
    if (type === 'CODING') {
      await prisma.codingQuestion.delete({ where: { id } });
    } else {
      await prisma.question.delete({ where: { id } });
    }
    
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

export const updateQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { text, type, category, difficulty, marks, negativeMarks, expectedAnswer, tolerance, options } = req.body;
    
    // For MCQ, we need to replace options. Best way is delete all existing and create new ones.
    if (options) {
      await prisma.questionOption.deleteMany({ where: { questionId: id } });
    }

    const question = await prisma.question.update({
      where: { id },
      data: {
        text,
        type,
        category,
        difficulty,
        marks,
        negativeMarks,
        expectedAnswer,
        tolerance,
        options: options ? { create: options } : undefined
      },
      include: { options: true }
    });
    
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update question' });
  }
};

export const updateCodingQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, inputFormat, outputFormat, constraints, marks, timeLimit, memoryLimit, allowedLanguages, testCases } = req.body;
    
    if (testCases) {
      await prisma.testCase.deleteMany({ where: { codingQuestionId: id } });
    }

    const codingQuestion = await prisma.codingQuestion.update({
      where: { id },
      data: {
        title,
        description,
        inputFormat,
        outputFormat,
        constraints,
        marks,
        timeLimit,
        memoryLimit,
        allowedLanguages,
        testCases: testCases ? { create: testCases } : undefined
      },
      include: { testCases: true }
    });
    
    res.json(codingQuestion);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update coding question' });
  }
};
