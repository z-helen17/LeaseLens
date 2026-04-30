import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { system, messages, maxTokens, model } = req.body;

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
    res.end();

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
}
