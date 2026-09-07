import nodemailer from 'nodemailer';

let testAccountTransporter = null;

async function getTransporter() {
  // 1. Gmail SMTP option
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      }),
      from: process.env.SMTP_FROM || `ReWear Security <${process.env.GMAIL_USER}>`,
      isRealSmtp: true
    };
  }

  // 2. Custom SMTP options (SendGrid, Mailtrap, AWS SES, custom host)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT) || 587;
    return {
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      }),
      from: process.env.SMTP_FROM || `ReWear Security <${process.env.SMTP_USER}>`,
      isRealSmtp: true
    };
  }

  // 3. Automated Ethereal Test Account (Real test SMTP service with web preview URL)
  if (!testAccountTransporter) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      testAccountTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (err) {
      console.warn('Could not create Ethereal test SMTP account:', err.message);
    }
  }

  return {
    transporter: testAccountTransporter,
    from: 'ReWear Security <security@rewear.org>',
    isRealSmtp: false
  };
}

export async function sendVerificationEmail({ to, name, code }) {
  const { transporter, from, isRealSmtp } = await getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify your ReWear account</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f4; color: #1c2b1e;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f4; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="560px" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e1e8e2;">
              <!-- Header -->
              <tr>
                <td style="background-color: #2d5a27; padding: 32px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                    🌱 ReWear
                  </h1>
                  <p style="margin: 6px 0 0 0; color: #b8e2b5; font-size: 14px;">Wear longer. Waste less.</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px 40px 30px 40px;">
                  <h2 style="margin: 0 0 16px 0; color: #1c2b1e; font-size: 20px; font-weight: 600;">
                    Verify your email address
                  </h2>
                  <p style="margin: 0 0 20px 0; color: #4a5d4d; font-size: 15px; line-height: 1.5;">
                    Hi <strong>${name || 'Member'}</strong>,
                  </p>
                  <p style="margin: 0 0 24px 0; color: #4a5d4d; font-size: 15px; line-height: 1.5;">
                    Thank you for joining the ReWear circular clothing community! To confirm your email address and unlock full member features, please enter the 6-digit verification code below:
                  </p>

                  <!-- Code Box -->
                  <div style="background-color: #f0f7f1; border: 2px dashed #2d5a27; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
                    <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #2d5a27; font-family: monospace;">
                      ${code}
                    </span>
                    <p style="margin: 10px 0 0 0; color: #5a735f; font-size: 12px;">
                      ⏱️ Valid for 10 minutes
                    </p>
                  </div>

                  <p style="margin: 0 0 12px 0; color: #6b7c6d; font-size: 13px; line-height: 1.4;">
                    If you did not request this email verification, please ignore this message or report it if you have security concerns.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f9f9f9; padding: 20px 40px; text-align: center; border-top: 1px solid #eef3ef;">
                  <p style="margin: 0; color: #8c9e8e; font-size: 12px;">
                    © ${new Date().getFullYear()} ReWear Community · Sustainable Garment Exchange
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const textContent = `Hi ${name || 'Member'},\n\nYour ReWear email verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nReWear - Wear longer. Waste less.`;

  if (!transporter) {
    return {
      success: true,
      messageId: 'dev-fallback-' + Date.now(),
      previewUrl: null,
      isRealSmtp: false
    };
  }

  const info = await transporter.sendMail({
    from,
    to,
    subject: `🔐 ${code} is your ReWear verification code`,
    text: textContent,
    html: htmlContent
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  if (previewUrl) {
    console.log('📧 Real Ethereal Email preview available at:', previewUrl);
  } else {
    console.log('📧 Real SMTP Email sent successfully to:', to);
  }

  return {
    success: true,
    messageId: info.messageId,
    previewUrl,
    isRealSmtp
  };
}
