import './_load-env.js';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const { token, secret } = req.query;

  if (!secret || secret !== process.env.ADMIN_APPROVE_SECRET) {
    return res.status(403).send('<p>Forbidden: invalid secret</p>');
  }

  if (!token) {
    return res.status(400).send('<p>Missing token</p>');
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data: row, error: fetchError } = await supabase
    .from('demo_tokens')
    .select('*')
    .eq('token', token)
    .single();

  if (fetchError || !row) {
    return res.status(404).send('<p>Token not found</p>');
  }

  if (row.approved) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send('<p>Already approved</p>');
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabase
    .from('demo_tokens')
    .update({ approved: true, expires_at: expiresAt })
    .eq('token', token);

  if (updateError) {
    console.error('Supabase update error:', updateError);
    return res.status(500).send('<p>Failed to approve token</p>');
  }

  const appUrl = process.env.VITE_APP_URL || 'https://the-lease-lens.vercel.app';
  const magicLink = `${appUrl}?demo_token=${token}`;
  const from = process.env.RESEND_FROM_EMAIL || 'LeaseLens <noreply@the-lease-lens.vercel.app>';

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from,
    to: row.email,
    subject: 'Your LeaseLens access link',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#1B2E4B;margin-bottom:8px">Your LeaseLens demo is ready</h2>
        <p style="color:#374151;margin-bottom:24px">Click the link below to start your lease analysis. Your session is valid for <strong>7 days</strong> and includes one full analysis.</p>
        <a href="${magicLink}" style="display:inline-block;background:#1B2E4B;color:white;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Open LeaseLens</a>
        <p style="color:#6b7280;font-size:13px;margin-top:32px">Want more access? Just reply to this email.<br>LeaseLens is for informational purposes only and does not constitute legal advice.</p>
      </div>
    `,
  });

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(`<p>Access approved and email sent to ${row.email}</p>`);
}
