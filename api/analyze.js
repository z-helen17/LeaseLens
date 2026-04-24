import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server' });
  }

  const { model, max_tokens, system, messages } = req.body;

  try {
    const response = await client.messages.create({ model, max_tokens, system, messages });
    return res.json(response);
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
