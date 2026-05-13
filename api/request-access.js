import './_load-env.js';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const token = crypto.randomUUID();
  const appUrl = process.env.VITE_APP_URL || 'https://the-lease-lens.vercel.app';
  const from = process.env.RESEND_FROM_EMAIL || 'LeaseLens <noreply@the-lease-lens.vercel.app>';

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { error: dbError } = await supabase
    .from('demo_tokens')
    .insert({ token, email, approved: false, used: false, expires_at: null });

  if (dbError) {
    console.error('Supabase insert error:', dbError);
    return res.status(500).json({ error: 'Failed to create access request' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const approveUrl = `${appUrl}/api/approve-access?token=${token}&secret=${encodeURIComponent(process.env.ADMIN_APPROVE_SECRET)}`;

  await resend.emails.send({
    from,
    to: process.env.ADMIN_EMAIL,
    subject: `LeaseLens demo access request: ${email}`,
    text: `${email} has requested demo access.\n\nClick to approve: ${approveUrl}`,
  });

  await resend.emails.send({
    from,
    to: email,
    subject: 'Your LeaseLens demo request',
    text: 'Thanks for your interest in LeaseLens. Your access link will arrive within a few hours once approved.',
  });

  return res.status(200).json({ ok: true });
}
