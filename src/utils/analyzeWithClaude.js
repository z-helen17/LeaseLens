import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT_FULL = `You are a commercial real estate lawyer analysing a lease agreement for clause bias. You will be given the full text of a lease. Do the following in order:

PASS 1: Scan the entire document for any explicit jurisdiction or governing law clause. Note the jurisdiction found, or use the location provided by the user if none found.
PASS 2: Go through every clause in the document and review it against market standards for that jurisdiction.
PASS 3: Assign each clause an internal score from 1-100 (1=most landlord friendly, 100=most tenant friendly) and a display bias of 1-5 (1=very landlord friendly, 2=leans landlord, 3=neutral, 4=leans tenant, 5=very tenant friendly). Also use 'x' for clauses that are unclear or contain likely drafting errors.
For scoring, use this mapping: 1-20=bias 1, 21-40=bias 2, 41-60=bias 3, 61-80=bias 4, 81-100=bias 5. Score all clauses first across the whole document before finalising, so scores are internally consistent.
Be concise: keep each "note" field to a maximum of 2 sentences, and each "change" field to a maximum of 1 sentence.
Return ONLY a valid JSON array with no other text, markdown or backticks. Each element must have these exact fields:

name: string — CRITICAL RULE: You MUST prefix every clause name with its clause number exactly as it appears in the document. Format: "6.3 — Clause Name" or "6.3.1 — Clause Name". If a provision is in a schedule, prefix with the schedule reference e.g. "Schedule 2 — Clause Name". Never return a clause name without its document reference number. If a clause genuinely has no number or schedule reference, use the section heading as-is.
score: number 1-100, or null for 'x' clauses
bias: number 1-5, or the string 'x'
note: string (explanation of why this clause leans this way, referencing jurisdiction standards. No style comments.)
change: string or null (precise word-level change needed — what to replace with what. No style suggestions. Null for neutral clauses.)
genClause: string or null (full drafted replacement clause text using the agreement's own definitions and language, only when the change requires a new mechanism. Null otherwise.)
lenderFlag: boolean (true if this clause is relevant to a landlord's lender)
verbatimExtract: string — exactly 10-15 consecutive words copied verbatim from the body text of this clause (not the heading, not paraphrased — exact words as they appear in the document, used to locate the clause in the source file)`;

const SYSTEM_PROMPT_CHUNK = `You are a commercial real estate lawyer analysing lease agreement clauses for bias. You will be given a portion of a lease. Analyse ONLY the clauses present in this portion and return your results immediately — do NOT wait for additional parts, do NOT ask for more context, do NOT say the document is incomplete.

For each clause you find: review it against market standards for the jurisdiction provided (or infer from any governing law clause visible in this portion). Assign an internal score from 1-100 (1=most landlord friendly, 100=most tenant friendly) and a display bias of 1-5 (1=very landlord friendly, 2=leans landlord, 3=neutral, 4=leans tenant, 5=very tenant friendly). Use 'x' for clauses that are unclear or contain likely drafting errors.
Score mapping: 1-20=bias 1, 21-40=bias 2, 41-60=bias 3, 61-80=bias 4, 81-100=bias 5.
Be concise: keep each "note" field to a maximum of 2 sentences, and each "change" field to a maximum of 1 sentence.
Return ONLY a valid JSON array with no other text, markdown or backticks. Each element must have these exact fields:

name: string — CRITICAL RULE: You MUST prefix every clause name with its clause number exactly as it appears in the document. Format: "6.3 — Clause Name" or "6.3.1 — Clause Name". If a provision is in a schedule, prefix with the schedule reference e.g. "Schedule 2 — Clause Name". Never return a clause name without its document reference number. If a clause genuinely has no number or schedule reference, use the section heading as-is.
score: number 1-100, or null for 'x' clauses
bias: number 1-5, or the string 'x'
note: string (explanation of why this clause leans this way, referencing jurisdiction standards. No style comments.)
change: string or null (precise word-level change needed — what to replace with what. No style suggestions. Null for neutral clauses.)
genClause: string or null (full drafted replacement clause text using the agreement's own definitions and language, only when the change requires a new mechanism. Null otherwise.)
lenderFlag: boolean (true if this clause is relevant to a landlord's lender)
verbatimExtract: string — exactly 10-15 consecutive words copied verbatim from the body text of this clause (not the heading, not paraphrased — exact words as they appear in the document, used to locate the clause in the source file)`;

const CHUNK_SIZE = 30000;

function splitIntoChunks(text) {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks = [];
  let remaining = text.trim();

  while (remaining.length > CHUNK_SIZE) {
    const slice = remaining.slice(0, CHUNK_SIZE);
    const splitAt = slice.lastIndexOf('\n\n');
    const cutAt = splitAt > 100 ? splitAt : CHUNK_SIZE;
    chunks.push(remaining.slice(0, cutAt).trim());
    remaining = remaining.slice(cutAt).trim();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

function sanitizeJsonString(raw) {
  // Replace literal control characters only inside JSON string values.
  // Matches quoted strings (honouring \" escapes) and replaces bare \n \r \t within them.
  return raw.replace(/"(?:[^"\\]|\\.)*"/g, (match) =>
    match.replace(/[\n\r\t]/g, (c) => {
      if (c === '\n') return '\\n';
      if (c === '\r') return '\\r';
      return '\\t';
    })
  );
}

function parseResponse(raw) {
  console.log('Raw API response:', raw);

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error('No JSON array found in response:', raw);
    throw new Error('The AI returned an unexpected format. Please try again.');
  }

  const sanitized = sanitizeJsonString(match[0]);

  try {
    const parsed = JSON.parse(sanitized);
    if (!Array.isArray(parsed)) throw new Error('Not an array');
    return parsed;
  } catch (e) {
    console.error('JSON parse error (attempting salvage):', e, '\nExtracted text:', sanitized);
    const objectMatches = sanitized.match(/\{(?:[^{}]|"(?:[^"\\]|\\.)*")*\}/g);
    if (objectMatches && objectMatches.length > 0) {
      const salvaged = [];
      for (const obj of objectMatches) {
        try {
          const clause = JSON.parse(obj);
          if (clause.name && clause.bias !== undefined) salvaged.push(clause);
        } catch (_) {
          // skip malformed objects
        }
      }
      if (salvaged.length > 0) {
        console.warn(`Salvaged ${salvaged.length} clause(s) from truncated response.`);
        return salvaged;
      }
    }
    throw new Error('The AI returned an unexpected format. Please try again.');
  }
}

async function callAnalyzeAPI(system, messages) {
  return client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system,
    messages,
  });
}

// onProgress(currentChunkNumber, totalChunks) — called before each API call (1-indexed)
export async function analyzeWithClaude(text, location, onProgress = () => {}) {
  const chunks = splitIntoChunks(text);
  const totalChunks = chunks.length;
  const allClauses = [];

  for (let i = 0; i < totalChunks; i++) {
    onProgress(i + 1, totalChunks);

    const isChunked = totalChunks > 1;
    const systemPrompt = isChunked ? SYSTEM_PROMPT_CHUNK : SYSTEM_PROMPT_FULL;

    const chunkHeader = isChunked
      ? `IMPORTANT: You are analysing part ${i + 1} of ${totalChunks} of a lease agreement. Analyse ONLY the clauses present in this part. Do NOT wait for other parts. Do NOT ask for more context. Return a JSON array immediately for the clauses in this part only. Other parts will be analysed separately and merged later.\n\n`
      : '';

    const message = await callAnalyzeAPI(systemPrompt, [
      {
        role: 'user',
        content: `${chunkHeader}Location / Jurisdiction: ${location || 'Not specified — infer from the governing law clause if present'}\n\nLease Agreement Text:\n\n${chunks[i]}`,
      },
    ]);

    const clauses = parseResponse(message.content[0].text.trim());
    allClauses.push(...clauses);
  }

  // Deduplicate by name (keep first occurrence, case-insensitive)
  const seen = new Set();
  return allClauses.filter((clause) => {
    const key = (clause.name || '').trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
