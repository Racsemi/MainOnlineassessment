import nodemailer from 'nodemailer';

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // Must be false for port 587
      requireTLS: true,
      connectionTimeout: 10000, // Fail after 10 seconds instead of hanging forever
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      },
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Racsemi Assess" <noreply@racsemi.com>',
      replyTo: process.env.SMTP_REPLY_TO || 'info@racsemi.com',
      to,
      subject,
      html,
    });

    console.log(`[EMAIL SENT] MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error);
    return false;
  }
};
