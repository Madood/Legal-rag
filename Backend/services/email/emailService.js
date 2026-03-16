const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendPasswordResetCode(email, code) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from:    `"LegalRAG" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: 'Ihr Passwort-Reset-Code – LegalRAG',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                  max-width: 480px; margin: 0 auto; padding: 32px 24px;
                  background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
        <div style="display: flex; align-items: center; margin-bottom: 28px;">
          <div style="width: 40px; height: 40px; border-radius: 6px;
                      background: linear-gradient(135deg, #3498DB, #2C3E50);
                      display: flex; align-items: center; justify-content: center;
                      font-weight: 700; color: white; font-size: 14px; margin-right: 10px;">
            LR
          </div>
          <span style="font-size: 18px; font-weight: 600; color: #2C3E50;">LegalRAG</span>
        </div>

        <h2 style="margin: 0 0 8px; font-size: 22px; color: #111827;">
          Passwort zurücksetzen
        </h2>
        <p style="margin: 0 0 24px; color: #6b7280; font-size: 15px;">
          Ihr Bestätigungscode lautet:
        </p>

        <div style="background: #f3f4f6; border-radius: 8px; padding: 24px;
                    text-align: center; margin-bottom: 24px;">
          <span style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #2C3E50;">
            ${code}
          </span>
        </div>

        <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">
          Dieser Code ist <strong>15 Minuten</strong> gültig.
        </p>
        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
          Falls Sie kein Passwort-Reset angefordert haben, ignorieren Sie bitte diese E-Mail.
        </p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetCode };
