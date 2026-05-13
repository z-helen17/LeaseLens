import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { system, messages, maxTokens, model, demo_token } = req.body;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const streamParams = {
      model: model || 'claude-sonnet-4-6',
      max_tokens: maxTokens || 32000,
      messages,
    };
    if (system) streamParams.system = system;

    const stream = await client.messages.stream(streamParams);

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    await stream.finalMessage();
    res.write('data: [DONE]\n\n');

    if (demo_token) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );
        await supabase.from('demo_tokens').update({ used: true }).eq('token', demo_token);
      } catch (e) {
        console.error('Failed to mark demo token used:', e);
      }
    }

    res.end();

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
}
