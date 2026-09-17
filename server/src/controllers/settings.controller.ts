import { Request, Response } from 'express';
import prisma from '../utils/db';

export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await prisma.platformSettings.findUnique({
      where: { id: 'GLOBAL' }
    });

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: {
          id: 'GLOBAL',
          instructions: `Welcome to the Online Assessment Platform!
Please read all the questions carefully before answering. 
Ensure you have a stable internet connection and a quiet environment.
Good luck!`,
          rules: `1. Ensure your camera and microphone are working properly.
2. Do not switch tabs or minimize the browser window. Doing so will flag your test.
3. Full-screen mode is mandatory. Escaping full-screen will trigger a warning.
4. Use of mobile phones, external materials, or other devices is strictly prohibited.
5. Plagiarism in coding answers will result in immediate disqualification.`,
          features: {
            calculator: false,
            ide: false,
            copyPaste: false,
            tabTracking: true,
            rightClick: false,
            keyboardShortcuts: false,
            isProctored: true
          },
          registrationForm: [
            { id: '1', name: 'phone', label: 'Phone Number', type: 'text', required: true }
          ]
        }
      });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { instructions, rules, registrationForm, features } = req.body;

    const settings = await prisma.platformSettings.upsert({
      where: { id: 'GLOBAL' },
      update: { instructions, rules, registrationForm, features },
      create: { id: 'GLOBAL', instructions, rules, registrationForm, features }
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};
