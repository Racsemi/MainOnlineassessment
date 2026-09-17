export const generateInvitationEmail = (
  candidateName: string,
  assessmentTitle: string,
  assessmentLink: string
) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f7f6;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #1e293b;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .content {
      padding: 40px 30px;
      color: #334155;
      line-height: 1.6;
    }
    .content h2 {
      color: #0f172a;
      margin-top: 0;
      font-size: 20px;
    }
    .button-container {
      text-align: center;
      margin: 35px 0;
    }
    .btn {
      display: inline-block;
      background-color: #3b82f6;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      transition: background-color 0.3s;
    }
    .btn:hover {
      background-color: #2563eb;
    }
    .link-fallback {
      font-size: 13px;
      color: #64748b;
      word-break: break-all;
      margin-top: 20px;
      background: #f1f5f9;
      padding: 12px;
      border-radius: 4px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px;
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RACSEMI Assess</h1>
    </div>
    <div class="content">
      <h2>Hello ${candidateName || 'Candidate'},</h2>
      <p>You have been invited to take the <strong>${assessmentTitle}</strong> assessment on the RACSEMI platform.</p>
      <p>This assessment is designed to evaluate your skills and qualifications. Please ensure you are in a quiet environment with a stable internet connection before beginning.</p>
      
      <div class="button-container">
        <a href="${assessmentLink}" class="btn">Start Assessment</a>
      </div>
      
      <p>If you encounter any technical issues, please contact our support team at <a href="mailto:info@racsemi.com" style="color: #3b82f6;">info@racsemi.com</a> or simply reply to this email.</p>
      
      <div class="link-fallback">
        If the button above does not work, copy and paste this URL into your browser:<br>
        <a href="${assessmentLink}" style="color: #3b82f6;">${assessmentLink}</a>
      </div>
    </div>
    <div class="footer">
      <p>This is an automated message from RACSEMI Assess. Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} RACSEMI. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
};
