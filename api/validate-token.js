import './_load-env.js';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;
  if (!token) {
    return res.status(200).json({ valid: false, reason: 'not_found' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data: row, error } = await supabase
    .from('demo_tokens')
    .select('approved, used, expires_at')
    .eq('token', token)
    .single();

  if (error || !row) {
    return res.status(200).json({ valid: false, reason: 'not_found' });
  }

  if (!row.approved) {
    return res.status(200).json({ valid: false, reason: 'not_approved' });
  }

  if (row.used) {
    return res.status(200).json({ valid: false, reason: 'used' });
  }

  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return res.status(200).json({ valid: false, reason: 'expired' });
  }

  return res.status(200).json({ valid: true, reason: 'ok' });
}
