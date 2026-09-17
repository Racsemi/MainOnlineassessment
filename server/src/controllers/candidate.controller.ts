import { Request, Response } from 'express';
import crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import prisma from '../utils/db';
import { sendEmail } from '../utils/email';
import { generateInvitationEmail } from '../utils/emailTemplates';

export const inviteCandidate = async (req: Request, res: Response) => {
  try {
    const { assessmentId, name, email } = req.body;
    
    // Ensure assessment exists
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    
    // Create candidate
    const candidate = await prisma.candidate.upsert({
      where: { email_assessmentId: { email, assessmentId } },
      update: { name },
      create: { assessmentId, name, email }
    });
    
    const token = crypto.randomBytes(32).toString('hex');
    
    const invitation = await prisma.invitation.create({
      data: {
        candidateId: candidate.id,
        assessmentId,
        token,
        status: 'SENT'
      }
    });
    
    const assessmentLink = `${process.env.CLIENT_URL}/test/${token}`;
    
    console.log(`Sending invite to ${email} for ${assessment.title}: ${assessmentLink}`);
    
    const emailHtml = generateInvitationEmail(name, assessment.title, assessmentLink);
    const emailSent = await sendEmail(
      email, 
      `Invitation to Assessment: ${assessment.title}`, 
      emailHtml
    );
    
    res.status(200).json({ 
      message: 'Invitation processed', 
      candidate,
      emailSent
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to invite candidate' });
  }
};

export const getAllCandidates = async (req: Request, res: Response) => {
  try {
    const candidates = await prisma.candidate.findMany({
      include: {
        assessment: true,
        invitations: true,
        results: true,
        files: {
          select: { id: true, fieldName: true, fileName: true, createdAt: true }
        }
      }
    });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all candidates' });
  }
};

export const getCandidates = async (req: Request, res: Response) => {
  try {
    const { assessmentId } = req.params;
    const candidates = await prisma.candidate.findMany({
      where: { assessmentId },
      include: {
        invitations: true,
        results: true,
        files: {
          select: { id: true, fieldName: true, fileName: true, createdAt: true }
        }
      }
    });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
};

export const validateCandidatesCsv = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const content = req.file.buffer.toString('utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    
    let validRows: any[] = [];
    let invalidRows: any[] = [];
    
    // basic email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    records.forEach((row: any, index: number) => {
      const rowNum = index + 2; 
      
      const name = row.name?.trim();
      const email = row.email?.trim();
      
      if (!name) {
        invalidRows.push({ row: rowNum, field: 'name', error: 'Name is required' });
        return;
      }
      
      if (!email || !emailRegex.test(email)) {
        invalidRows.push({ row: rowNum, field: 'email', error: 'Valid email is required' });
        return;
      }
      
      validRows.push({ name, email });
    });
    
    res.json({
      total: records.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      validRows,
      invalidRows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse CSV' });
  }
};

export const importCandidatesCsv = async (req: Request, res: Response) => {
  try {
    const { assessmentId, candidates } = req.body;
    
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

    const created = await Promise.all(
      candidates.map(async (c: any) => {
        const candidate = await prisma.candidate.upsert({
          where: { email_assessmentId: { email: c.email, assessmentId } },
          update: { name: c.name },
          create: { assessmentId, name: c.name, email: c.email }
        });
        
        const token = crypto.randomBytes(32).toString('hex');
        
        await prisma.invitation.create({
          data: {
            candidateId: candidate.id,
            assessmentId,
            token,
            status: 'SENT'
          }
        });
        
        const assessmentLink = `${process.env.CLIENT_URL}/test/${token}`;
        const emailHtml = generateInvitationEmail(c.name, assessment.title, assessmentLink);
        
        await sendEmail(
          c.email, 
          `Invitation to Assessment: ${assessment.title}`, 
          emailHtml
        );
        
        return candidate;
      })
    );
    
    res.json({ imported: created.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import candidates CSV' });
  }
};

export const registerPublicCandidate = async (req: Request, res: Response) => {
  try {
    const { assessmentId, name, email, phone, college, branch, cgpa, photo, customFields, files } = req.body;
    
    const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    
    if (assessment.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'This assessment is currently not accepting registrations.' });
    }
    
    const now = new Date();
    if (assessment.startDate && now < assessment.startDate) {
      return res.status(403).json({ error: 'This assessment has not started yet.' });
    }
    if (assessment.endDate && now > assessment.endDate) {
      return res.status(403).json({ error: 'This assessment has already ended.' });
    }
    
    const parsedCgpa = cgpa ? parseFloat(cgpa) : null;

    const candidate = await prisma.candidate.upsert({
      where: { email_assessmentId: { email, assessmentId } },
      update: { name, phone, college, branch, cgpa: parsedCgpa, photo, customFields: customFields || {} },
      create: { assessmentId, name, email, phone, college, branch, cgpa: parsedCgpa, photo, customFields: customFields || {} }
    });
    
    // Process files if any
    if (files && Object.keys(files).length > 0) {
      for (const [fieldName, fileObj] of Object.entries(files)) {
        const { fileName, fileData } = fileObj as any;
        
        // delete existing file for this field if any (to replace)
        await prisma.candidateFile.deleteMany({
          where: { candidateId: candidate.id, fieldName }
        });
        
        await prisma.candidateFile.create({
          data: {
            candidateId: candidate.id,
            fieldName,
            fileName,
            fileData
          }
        });
      }
    }
    
    const token = crypto.randomBytes(32).toString('hex');
    
    await prisma.invitation.create({
      data: {
        candidateId: candidate.id,
        assessmentId,
        token,
        status: 'USED'
      }
    });
    
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register candidate' });
  }
};

export const resetTest = async (req: Request, res: Response) => {
  try {
    const { assessmentId, candidateId } = req.params;
    
    // Hard delete session and results for this candidate in this assessment
    // (Cascade delete automatically handles CandidateAnswer, CodingSubmission, and IntegrityEvent)
    await prisma.candidateSession.deleteMany({
      where: { candidateId }
    });
    
    await prisma.assessmentResult.deleteMany({
      where: { candidateId, assessmentId }
    });
    
    res.status(200).json({ message: 'Test reset successfully. Candidate can retake.' });
  } catch (error) {
    console.error('Reset test error:', error);
    res.status(500).json({ error: 'Failed to reset test' });
  }
};

export const getCandidateFile = async (req: Request, res: Response) => {
  try {
    const { id, fileId } = req.params;
    const file = await prisma.candidateFile.findFirst({
      where: { id: fileId, candidateId: id }
    });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // fileData is Base64 (data:application/pdf;base64,...)
    const matches = file.fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid file format' });
    }
    
    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to download file' });
  }
};

export const deleteCandidate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.candidate.delete({ where: { id } });
    res.json({ message: 'Candidate deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete candidate' });
  }
};
