import { JURISDICTION_CONTEXT } from './jurisdictionContext.js';

const SYSTEM_PROMPT_FULL = `You are a commercial real estate lawyer analysing a lease agreement for clause bias. You will be given the full text of a lease. Do the following in order:

PASS 1: Scan the entire document for any explicit jurisdiction or governing law clause. Note the jurisdiction found, or use the location provided by the user if none found.
PASS 2: Go through every clause in the document and review it against market standards for that jurisdiction.
PASS 3: Assign each clause an internal score from 1-100 (1=most landlord friendly, 100=most tenant friendly) and a display bias of 1-5 (1=very landlord friendly, 2=leans landlord, 3=neutral, 4=leans tenant, 5=very tenant friendly). Also use 'x' for clauses that are unclear or contain likely drafting errors.
For scoring, use this mapping: 1-20=bias 1, 21-40=bias 2, 41-60=bias 3, 61-80=bias 4, 81-100=bias 5. Emit each clause object immediately as you score it. Do not wait until you have reviewed the whole document before outputting.
Be concise: keep each "note" field to a maximum of 2 sentences, and each "change" field to a maximum of 1 sentence.
If the document is bilingual or contains text in multiple languages, analyse the English text only and propose changes in English only. Do not propose rewrites in other languages. The only exception is where there is a direct inconsistency between the two language versions (e.g. different numbers, names or defined terms) — in that case flag it as an 'x' drafting error and note the inconsistency clearly.
Your entire response must be valid JSON only. Do not include markdown backticks, code fences, or any text outside the JSON array. All string values must use only standard ASCII apostrophes and quotation marks. Do not use curly quotes, special dashes, or non-ASCII punctuation inside JSON strings. If you need to include a quote inside a string value, escape it with a backslash.
The document has been pre-processed into a grid. Table cells are identified by coordinates in the format t{tableIndex}r{rowIndex}c{colIndex}. When you identify a clause in a table cell, record its exact grid coordinate as cellRef. This coordinate will be used to anchor comments in the Word document — it must be precise. For clauses in free-flowing body text outside tables, set cellRef to null. When identifying cellRef, always choose the cell with the substantive clause text. Number cells (short, containing only digits or clause references) and translation cells (containing non-English text) must never be used as cellRef.
Return ONLY a valid JSON array with no other text, markdown or backticks. Each element must have these exact fields:

name: string — CRITICAL RULE: You MUST prefix every clause name with its clause number exactly as it appears in the document. Format: "6.3 — Clause Name" or "6.3.1 — Clause Name". If a provision is in a schedule, prefix with the schedule reference e.g. "Schedule 2 — Clause Name". Never return a clause name without its document reference number. If a clause genuinely has no number or schedule reference, use the section heading as-is.
score: number 1-100, or null for 'x' clauses
bias: number 1-5, or the string 'x'
note: string (explanation of why this clause leans this way, referencing jurisdiction standards. No style comments.)
change: string or null (precise word-level change needed — what to replace with what. No style suggestions. Null for neutral clauses.)
genClause: string or null (full drafted replacement clause text using the agreement's own definitions and language, only when the change requires a new mechanism. Null otherwise.)
lenderFlag: boolean (true if this clause is relevant to a landlord's lender)
verbatimExtract: string — exactly 10-15 consecutive words copied verbatim from the body text of this clause (not the heading, not paraphrased — exact words as they appear in the document, used to locate the clause in the source file)
cellRef: the grid coordinate of the cell containing the CLAUSE TEXT — not the clause number cell. In bilingual documents with a number column and a text column, cellRef must point to the English text cell (the cell with the longest English text content in that row), never the number cell or the Romanian translation cell. Format: 't{n}r{n}c{n}'. Output null for body paragraphs.`;

const SYSTEM_PROMPT_CHUNK = `You are a commercial real estate lawyer analysing lease agreement clauses for bias. You will be given a portion of a lease. Analyse ONLY the clauses present in this portion and return your results immediately — do NOT wait for additional parts, do NOT ask for more context, do NOT say the document is incomplete.

For each clause you find: review it against market standards for the jurisdiction provided (or infer from any governing law clause visible in this portion). Assign an internal score from 1-100 (1=most landlord friendly, 100=most tenant friendly) and a display bias of 1-5 (1=very landlord friendly, 2=leans landlord, 3=neutral, 4=leans tenant, 5=very tenant friendly). Use 'x' for clauses that are unclear or contain likely drafting errors.
Score mapping: 1-20=bias 1, 21-40=bias 2, 41-60=bias 3, 61-80=bias 4, 81-100=bias 5. Emit each clause object immediately as you score it. Do not wait until you have reviewed the whole document before outputting.
Be concise: keep each "note" field to a maximum of 2 sentences, and each "change" field to a maximum of 1 sentence.
If the document is bilingual or contains text in multiple languages, analyse the English text only and propose changes in English only. Do not propose rewrites in other languages. The only exception is where there is a direct inconsistency between the two language versions (e.g. different numbers, names or defined terms) — in that case flag it as an 'x' drafting error and note the inconsistency clearly.
Your entire response must be valid JSON only. Do not include markdown backticks, code fences, or any text outside the JSON array. All string values must use only standard ASCII apostrophes and quotation marks. Do not use curly quotes, special dashes, or non-ASCII punctuation inside JSON strings. If you need to include a quote inside a string value, escape it with a backslash.
The document has been pre-processed into a grid. Table cells are identified by coordinates in the format t{tableIndex}r{rowIndex}c{colIndex}. When you identify a clause in a table cell, record its exact grid coordinate as cellRef. This coordinate will be used to anchor comments in the Word document — it must be precise. For clauses in free-flowing body text outside tables, set cellRef to null. When identifying cellRef, always choose the cell with the substantive clause text. Number cells (short, containing only digits or clause references) and translation cells (containing non-English text) must never be used as cellRef.
Return ONLY a valid JSON array with no other text, markdown or backticks. Each element must have these exact fields:

name: string — CRITICAL RULE: You MUST prefix every clause name with its clause number exactly as it appears in the document. Format: "6.3 — Clause Name" or "6.3.1 — Clause Name". If a provision is in a schedule, prefix with the schedule reference e.g. "Schedule 2 — Clause Name". Never return a clause name without its document reference number. If a clause genuinely has no number or schedule reference, use the section heading as-is.
score: number 1-100, or null for 'x' clauses
bias: number 1-5, or the string 'x'
note: string (explanation of why this clause leans this way, referencing jurisdiction standards. No style comments.)
change: string or null (precise word-level change needed — what to replace with what. No style suggestions. Null for neutral clauses.)
genClause: string or null (full drafted replacement clause text using the agreement's own definitions and language, only when the change requires a new mechanism. Null otherwise.)
lenderFlag: boolean (true if this clause is relevant to a landlord's lender)
verbatimExtract: string — exactly 10-15 consecutive words copied verbatim from the body text of this clause (not the heading, not paraphrased — exact words as they appear in the document, used to locate the clause in the source file)
cellRef: the grid coordinate of the cell containing the CLAUSE TEXT — not the clause number cell. In bilingual documents with a number column and a text column, cellRef must point to the English text cell (the cell with the longest English text content in that row), never the number cell or the Romanian translation cell. Format: 't{n}r{n}c{n}'. Output null for body paragraphs.`;

function getJurisdictionContext(location) {
  if (!location) return '';
  const l = location.toLowerCase();
  if (l.includes('england') || l.includes('wales') || l.includes('english')) return JURISDICTION_CONTEXT.ENGLISH_LAW;
  if (l.includes('romani') || l.includes('bucharest') || l.includes('cluj')) return JURISDICTION_CONTEXT.ROMANIAN_LAW;
  if (l.includes('new york') || l.includes('manhattan') || l.includes('brooklyn')) return JURISDICTION_CONTEXT.NEW_YORK;
  if (l.includes('california') || l.includes('los angeles') || l.includes('san francisco') || l.includes('san jose')) return JURISDICTION_CONTEXT.CALIFORNIA;
  return '';
}

// Short first-pass jurisdiction check — uses only the first 5 000 chars of the
// document so it completes in 5-10 seconds before the full analysis starts.
// Returns the detected jurisdiction string, or '' if nothing is found.
export async function detectJurisdiction(text) {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        messages: [{
          role: 'user',
          content:
            'Read this document extract and identify the governing law or jurisdiction clause if present. ' +
            'Return JSON only: { "detected": "jurisdiction name or null" }\n\n' +
            text.slice(0, 5000),
        }],
        maxTokens: 80,
      }),
    });
    if (!response.ok) return '';

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let raw = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) raw += parsed.text;
          } catch (_) {}
        }
      }
    }

    // Strip markdown fences the model might add despite being told not to
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const detected = parsed.detected;
    if (!detected || detected === 'null' || String(detected).toLowerCase() === 'null') return '';
    return String(detected).trim();
  } catch {
    return '';
  }
}

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

// Additional JSON hardening applied after sanitizeJsonString, before JSON.parse.
// Catches issues that survive the initial normalization: stray control characters,
// unescaped backslashes from Romanian/special-character documents, residual smart punctuation.
function hardSanitizeJson(str) {
  return str
    .replace(/['']/g, "'")          // curly single quotes (belt-and-suspenders)
    .replace(/[""]/g, '"')           // curly double quotes
    .replace(/[–—]/g, '-')           // en/em dashes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')  // control chars except \t \n \r
    .replace(/\\(?!["\\/bfnrtu])/g, '\\\\');          // fix unescaped backslashes
}

function parseResponse(raw) {
  // Normalise curly quotes, smart dashes, and strip any code fences before extraction.
  const cleaned = raw
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error('No JSON array found in response:', cleaned);
    throw new Error('The AI returned an unexpected format. Please try again.');
  }

  const sanitized = hardSanitizeJson(sanitizeJsonString(match[0]));

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

// djb2-based hash of the first 200 + last 200 chars and total length
function hashText(text) {
  const key = text.slice(0, 200) + text.slice(-200) + text.length;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return 'll_cache_' + hash;
}

async function streamAnalyzeAPI(system, messages, onToken) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, maxTokens: 32000 })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) {
            fullText += parsed.text;
            onToken(parsed.text);
          }
        } catch (_) {}
      }
    }
  }

  return fullText;
}

// Sanitise cell text before injecting into the grid summary prompt.
// Applied per-cell (before the c0:[...] format wrapper is added) so that the
// [REDACTED] step only fires on embedded bracket content, not format delimiters.
function sanitiseGridText(text) {
  return text
    .replace(/[‘’]/g, "'")        // curly single quotes → straight
    .replace(/[“”]/g, '"')         // curly double quotes → straight
    .replace(/[–—]/g, '-')         // en/em dashes → hyphens
    .replace(/\[[^\[\]]*\]/g, '[REDACTED]')  // embedded square bracket content
    .replace(/[^\x20-\x7E]/g, '');           // strip remaining non-ASCII printable chars
}

function buildGridSummary(grid) {
  const lines = ['DOCUMENT GRID (use these coordinates for cellRef):'];
  for (const table of grid.tables) {
    for (const row of table.rows) {
      const nonEmpty = row.cells.filter(c => c.text.trim());
      if (nonEmpty.length === 0) continue;
      const cellParts = nonEmpty.map(c => `c${c.colIndex}:[${sanitiseGridText(c.text.slice(0, 60))}]`);
      lines.push(`t${table.tableIndex}r${row.rowIndex}: ${cellParts.join(' | ')}`);
    }
  }
  let summary = lines.join('\n');
  if (summary.length > 8000) {
    summary = summary.slice(0, 8000) + '\n... [grid truncated]';
  }
  return summary;
}

// onProgress(currentChunkNumber, totalChunks) — called before each API call (1-indexed)
// onClause(clause) — called each time a complete clause object is parsed mid-stream
export async function analyzeWithClaude(text, location, onProgress = () => {}, onClause = () => {}, grid = null) {
  const cacheKey = hashText(text);
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (_) {}

  const chunks = splitIntoChunks(text);
  const totalChunks = chunks.length;
  const allClauses = [];

  onProgress(0, totalChunks);

  const isChunked = totalChunks > 1;
  const jurisdictionCtx = getJurisdictionContext(location);
  const basePrompt = isChunked ? SYSTEM_PROMPT_CHUNK : SYSTEM_PROMPT_FULL;
  const systemPromptWithContext = jurisdictionCtx
    ? `JURISDICTION CONTEXT FOR THIS ANALYSIS:\n${jurisdictionCtx}\n\n---\n\n${basePrompt}`
    : basePrompt;

  const chunkPromises = chunks.map((chunk, i) => {
    const chunkHeader = isChunked
      ? `IMPORTANT: You are analysing part ${i + 1} of ${totalChunks} of a lease agreement. Analyse ONLY the clauses present in this part. Do NOT wait for other parts. Do NOT ask for more context. Return a JSON array immediately for the clauses in this part only. Other parts will be analysed separately and merged later.\n\n`
      : '';

    let streamBuffer = '';

    const gridSuffix = (grid && i === 0) ? `\n\n${buildGridSummary(grid)}` : '';

    return streamAnalyzeAPI(systemPromptWithContext, [
      {
        role: 'user',
        content: `${chunkHeader}Location / Jurisdiction: ${location || 'Not specified — infer from the governing law clause if present'}\n\nLease Agreement Text:\n\n${chunk}${gridSuffix}`,
      },
    ], (token) => {
      streamBuffer += token;
      // Bracket-depth parser: extract complete JSON objects as they arrive
      let depth = 0;
      let start = -1;
      let consumed = 0;
      for (let j = 0; j < streamBuffer.length; j++) {
        const ch = streamBuffer[j];
        if (ch === '{') {
          if (depth === 0) start = j;
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            const candidate = streamBuffer.slice(start, j + 1);
            try {
              const clause = JSON.parse(candidate);
              if (clause.name && clause.bias !== undefined) {
                onClause(clause);
              }
            } catch (_) {}
            consumed = j + 1;
            start = -1;
          }
        }
      }
      if (consumed > 0) streamBuffer = streamBuffer.slice(consumed);
    });
  });

  const results = await Promise.allSettled(chunkPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      // Safety net: parseResponse catches anything the mid-stream parser missed
      const clauses = parseResponse(result.value);
      allClauses.push(...clauses);
    } else {
      console.error('[chunk] failed:', result.reason);
    }
  }

  // Deduplicate by name (keep first occurrence, case-insensitive)
  const seen = new Set();
  const result = allClauses.filter((clause) => {
    const key = (clause.name || '').trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  try {
    localStorage.setItem(cacheKey, JSON.stringify(result));
  } catch (e) {
    console.warn('LeaseLens: cache write failed', e);
  }

  return result;
}
