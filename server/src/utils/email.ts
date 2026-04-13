import nodemailer from 'nodemailer';
import logger from './logger';

const transporter =
  process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null;

const FROM = process.env.EMAIL_FROM || 'noreply@pizzaboxco.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Email (dev)', { to, subject });
  }

  if (!transporter) {
    logger.warn('SMTP not configured — email not sent', { to, subject });
    return;
  }

  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    logger.info('Email sent', { to, subject });
  } catch (err) {
    logger.error('Failed to send email', { to, subject, error: (err as Error).message });
  }
}

function emailWrapper(title: string, body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #dc2626; margin: 0;">Pizza Box Manager</h2>
      </div>
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
        <h3 style="margin: 0 0 16px; color: #111827;">${title}</h3>
        ${body}
      </div>
      <div style="text-align: center; margin-top: 24px;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">Pizza Box Manager</p>
      </div>
    </div>
  `;
}

// ─── Password Reset ──────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  firstName: string
): Promise<void> {
  const html = emailWrapper('Reset Your Password', `
    <p style="color: #374151;">Hi ${firstName},</p>
    <p style="color: #374151;">We received a request to reset your password. Click the button below to set a new one:</p>
    <p style="text-align: center; margin: 32px 0;">
      <a href="${resetLink}"
         style="background: #dc2626; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
        Reset Password
      </a>
    </p>
    <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `);

  if (process.env.NODE_ENV !== 'production') {
    logger.info('Password reset link (dev)', { to, resetLink });
  }

  await sendMail(to, 'Reset your password – Pizza Box Manager', html);
}

// ─── Invoice Sent ────────────────────────────────────────────────────────────

interface InvoiceEmailData {
  invoiceNumber: string;
  invoiceId: string;
  storeName: string;
  contactName: string;
  total: string;
  currency: string;
  dueDate: string;
  issueDate: string;
  lineItemCount: number;
  notes?: string | null;
}

export async function sendInvoiceEmail(to: string, data: InvoiceEmailData): Promise<void> {
  const html = emailWrapper(`Invoice ${data.invoiceNumber}`, `
    <p style="color: #374151;">Hi ${data.contactName || data.storeName},</p>
    <p style="color: #374151;">A new invoice has been issued for your account.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Invoice Number</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #111827;">${data.invoiceNumber}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Issue Date</td>
        <td style="padding: 8px 0; text-align: right; color: #111827; border-top: 1px solid #f3f4f6;">${data.issueDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Due Date</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626; border-top: 1px solid #f3f4f6;">${data.dueDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Items</td>
        <td style="padding: 8px 0; text-align: right; color: #111827; border-top: 1px solid #f3f4f6;">${data.lineItemCount} line item(s)</td>
      </tr>
      <tr>
        <td style="padding: 12px 0; color: #111827; font-size: 16px; font-weight: 700; border-top: 2px solid #e5e7eb;">Total Due</td>
        <td style="padding: 12px 0; text-align: right; font-size: 18px; font-weight: 700; color: #dc2626; border-top: 2px solid #e5e7eb;">$${data.total}</td>
      </tr>
    </table>
    ${data.notes ? `<p style="color: #6b7280; font-size: 13px; background: #f9fafb; padding: 12px; border-radius: 8px; margin-top: 16px;"><strong>Note:</strong> ${data.notes}</p>` : ''}
    <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">Please process payment by the due date. If you have questions, contact us.</p>
  `);

  await sendMail(to, `Invoice ${data.invoiceNumber} – Payment Due ${data.dueDate}`, html);
}

// ─── Invoice Paid ────────────────────────────────────────────────────────────

export async function sendInvoicePaidEmail(
  to: string,
  data: { invoiceNumber: string; storeName: string; contactName: string; total: string; paidDate: string }
): Promise<void> {
  const html = emailWrapper('Payment Received', `
    <p style="color: #374151;">Hi ${data.contactName || data.storeName},</p>
    <div style="text-align: center; margin: 24px 0;">
      <div style="display: inline-block; background: #dcfce7; border-radius: 50%; padding: 12px;">
        <span style="font-size: 32px;">&#10003;</span>
      </div>
    </div>
    <p style="color: #374151; text-align: center;">We've received your payment for invoice <strong>${data.invoiceNumber}</strong>.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount Paid</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #16a34a;">$${data.total}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Payment Date</td>
        <td style="padding: 8px 0; text-align: right; color: #111827; border-top: 1px solid #f3f4f6;">${data.paidDate}</td>
      </tr>
    </table>
    <p style="color: #6b7280; font-size: 14px;">Thank you for your prompt payment!</p>
  `);

  await sendMail(to, `Payment Received – Invoice ${data.invoiceNumber}`, html);
}

// ─── Overdue Reminder ────────────────────────────────────────────────────────

export async function sendOverdueReminderEmail(
  to: string,
  data: { invoiceNumber: string; storeName: string; contactName: string; total: string; dueDate: string; daysOverdue: number }
): Promise<void> {
  const html = emailWrapper('Payment Overdue', `
    <p style="color: #374151;">Hi ${data.contactName || data.storeName},</p>
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="color: #dc2626; margin: 0; font-weight: 600;">Invoice ${data.invoiceNumber} is ${data.daysOverdue} day(s) overdue</p>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount Due</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">$${data.total}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Original Due Date</td>
        <td style="padding: 8px 0; text-align: right; color: #111827; border-top: 1px solid #f3f4f6;">${data.dueDate}</td>
      </tr>
    </table>
    <p style="color: #374151;">Please process payment at your earliest convenience. If you've already sent payment, please disregard this notice.</p>
  `);

  await sendMail(to, `OVERDUE: Invoice ${data.invoiceNumber} – $${data.total}`, html);
}
