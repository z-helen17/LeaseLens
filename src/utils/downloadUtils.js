import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
} from 'docx';
import PizZip from 'pizzip';
import { BIAS_LABELS, computeOverallScore } from './scoring.js';

const OPTION_LABELS = {
  1: 'Full Report',
  2: 'Landlord-Friendly View',
  3: 'Tenant-Friendly View',
  4: 'Lender-Friendly View',
};

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function baseName(fileName) {
  return fileName.replace(/\.[^.]+$/, '');
}

function isDocxFile(file) {
  return file.name.split('.').pop().toLowerCase() === 'docx';
}

// ── Clause name → paragraph matching ────────────────────────────────────────

function normalizeForMatch(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[—–\-]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns the matching strategy name if matched, null if not.
// Keeping the reason lets callers log exactly why a match succeeded or failed.
function whyClauseMatchesPara(clauseName, paraText) {
  if (!clauseName || !paraText) return null;
  const nc = normalizeForMatch(clauseName);
  const nb = normalizeForMatch(paraText);
  if (!nc || !nb) return null;

  // 1. Exact normalized
  if (nb === nc) return 'exact';

  // 2. Containment (handles "6.3 — Rent Review" ↔ "Rent Review" and number-only paras)
  if (nb.includes(nc)) return 'para⊃clause';
  if (nc.includes(nb)) return 'clause⊃para';

  // 3. Number-prefix: pull leading digits+dots/spaces from clause name
  //    e.g. nc = "6 3 delay penalties"  →  numDot = "6.3", numSpc = "6 3"
  const numMatch = nc.match(/^(\d[\d .]*\d|\d)([\s.]+(.+))?$/);
  if (numMatch) {
    const rawNum  = numMatch[1].trim();
    const namePart = (numMatch[3] || '').trim();
    const numDot  = rawNum.replace(/[\s.]+/g, '.');
    const numSpc  = rawNum.replace(/[\s.]+/g, ' ');

    const startsWithNum =
      nb.startsWith(numDot + ' ') || nb.startsWith(numDot + '.') ||
      nb.startsWith(numSpc + ' ') || nb === numDot || nb === numSpc;

    if (startsWithNum) {
      if (!namePart) return 'number-only';
      const nameWords = namePart.split(' ').filter(w => w.length > 3);
      if (nameWords.length === 0) return 'number-prefix';
      const bSet = new Set(nb.split(' '));
      const hit  = nameWords.filter(w => bSet.has(w)).length;
      if (hit >= Math.ceil(nameWords.length * 0.5)) return 'number-prefix+words';
    }
  }

  // 4. First 3–4 significant words of clause name present in paragraph
  const clauseWords = nc.split(' ').filter(w => w.length > 2 && !/^\d+$/.test(w));
  const leadWords   = clauseWords.slice(0, 4);
  if (leadWords.length >= 2) {
    const bSet  = new Set(nb.split(' '));
    const hits  = leadWords.filter(w => bSet.has(w)).length;
    if (hits >= Math.ceil(leadWords.length * 0.75)) return 'lead-words';
  }

  // 5. General word-overlap across all significant words (75 %)
  if (clauseWords.length >= 2) {
    const bSet = new Set(nb.split(' '));
    const hits = clauseWords.filter(w => bSet.has(w)).length;
    if (hits >= Math.ceil(clauseWords.length * 0.75)) return 'word-overlap';
  }

  return null;
}

function clauseMatchesBlock(clauseName, blockText) {
  return whyClauseMatchesPara(clauseName, blockText) !== null;
}

// ── XML helpers ──────────────────────────────────────────────────────────────

function xmlEscape(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Decode XML character entities in a text string.
function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x[\dA-Fa-f]+;/g, ' ')
    .replace(/&#\d+;/g, ' ');
}

// Build a map of every <w:p> in the document XML.
// Each entry: { cleanText, originalXml, start, end, paraIdx }
// cleanText is built by concatenating all <w:t> text nodes within the paragraph,
// which correctly handles text split across multiple runs without losing spaces.
// paraIdx is the 0-based position among all non-empty paragraphs in document order.
function buildParaMap(xml) {
  const paras = [];
  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let m;
  while ((m = paraRegex.exec(xml)) !== null) {
    const paraXml = m[0];
    const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let tm;
    const parts = [];
    while ((tm = tRegex.exec(paraXml)) !== null) {
      parts.push(decodeXmlEntities(tm[1]));
    }
    const cleanText = parts.join('').replace(/\s+/g, ' ').trim();
    if (!cleanText) continue;
    paras.push({ cleanText, originalXml: paraXml, start: m.index, end: m.index + paraXml.length, paraIdx: paras.length });
  }
  return paras;
}

// Returns true only for paragraphs long enough to be clause body text.
// Paragraphs shorter than 50 chars or fewer than 20 words are likely headings,
// TOC entries, or cover-page lines and must not receive comment anchors.
function isBodyParagraph(cleanText) {
  return cleanText.length >= 50 && cleanText.split(/\s+/).length >= 20;
}

// Returns true if the paragraph at `paraStart` (global position in `xml`) is nested
// inside an unclosed <w:tc> table cell — i.e. the most recent <w:tc open tag appears
// after the most recent </w:tc> close tag in the text that precedes the paragraph.
function isParaInTableCell(xml, paraStart) {
  const before = xml.slice(0, paraStart);
  const lastTcOpen = before.lastIndexOf('<w:tc');
  if (lastTcOpen === -1) return false;
  const lastTcClose = before.lastIndexOf('</w:tc>');
  return lastTcClose < lastTcOpen;
}

// Inject comment markers into the paragraph described by `para` (a buildParaMap entry)
// and return the updated full document XML. Returns null if the paragraph has no runs.
function injectIntoParaEntry(xml, para, startTag, endTag, refRun) {
  const p = para.originalXml;
  const pPrEnd     = p.indexOf('</w:pPr>');
  const searchFrom = pPrEnd !== -1 ? pPrEnd + 8 : 0;
  const runMatch   = /<w:r[\s>\/]/.exec(p.slice(searchFrom));
  if (!runMatch) return null;
  const firstRunStart = searchFrom + runMatch.index;
  const lastRunEnd    = p.lastIndexOf('</w:r>');
  if (lastRunEnd === -1) return null;
  const afterLastRun  = lastRunEnd + 6;
  const newPara =
    p.slice(0, firstRunStart) + startTag +
    p.slice(firstRunStart, afterLastRun) + endTag + refRun +
    p.slice(afterLastRun);
  return xml.slice(0, para.start) + newPara + xml.slice(para.end);
}

// Scans upward from the matched cell to find the nearest clause-number reference in a
// dedicated number column. DIAGNOSTIC ONLY — output goes to console.log, never to any
// return value, display field, or data structure.
// Returns a clause-number string (e.g. "6.1", "Article 3") or null if none is found.
function findClauseNumberNearCell(tableRows, matchRowIndex, matchColIndex) {
  const numberPattern = /^(?:art(?:icle)?|clause|section|pct|alin)\.?\s+[\d.]+$|^[\d][\d.]*[a-z]?$/i;
  const isNumberCell = (text) => {
    const t = (text || '').trim();
    return t.length > 0 && t.length < 20 && numberPattern.test(t);
  };
  // Check colIndex 0 first (leftmost), then colIndex matchColIndex-1 (immediately left)
  const candidateCols = matchColIndex > 0 ? [...new Set([0, matchColIndex - 1])] : [0];
  let numberCol = null;
  for (const col of candidateCols) {
    if (tableRows.some(row => row[col] && isNumberCell(row[col].text))) {
      numberCol = col;
      break;
    }
  }
  if (numberCol === null) return null;
  // Same row first, then search upward
  for (let r = matchRowIndex; r >= 0; r--) {
    const cell = tableRows[r]?.[numberCol];
    if (cell && isNumberCell(cell.text)) return cell.text.trim();
  }
  return null;
}

// Anchor a comment to a specific table cell using its grid coordinate (e.g. "t0r5c1").
// Returns the updated document XML string, or null if the cell cannot be located.
function anchorByCellRef(docXml, cellRef, commentId) {
  const match = cellRef.match(/^t(\d+)r(\d+)c(\d+)$/);
  if (!match) return null;
  const [, tIdx, rIdx, cIdx] = match.map(Number);

  const startTag = `<w:commentRangeStart w:id="${commentId}"/>`;
  const endTag   = `<w:commentRangeEnd w:id="${commentId}"/>`;
  const refRun   =
    `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr>` +
    `<w:commentReference w:id="${commentId}"/></w:r>`;

  // Find the tIdx-th <w:tbl>
  let tableCount = 0;
  let tableStart = -1;
  let tableEnd   = -1;
  const tableRe  = /<w:tbl[\s>]/g;
  let tm;
  while ((tm = tableRe.exec(docXml)) !== null) {
    if (tableCount === tIdx) {
      tableStart = tm.index;
      let depth = 1;
      let pos = tm.index + tm[0].length;
      while (pos < docXml.length && depth > 0) {
        const next = docXml.indexOf('<', pos);
        if (next === -1) break;
        if (docXml.startsWith('<w:tbl', next) && !docXml.startsWith('</w:tbl', next)) depth++;
        else if (docXml.startsWith('</w:tbl>', next)) depth--;
        pos = next + 1;
      }
      tableEnd = pos + 7; // length of '</w:tbl>'
      break;
    }
    tableCount++;
  }
  if (tableStart === -1) return null;
  const tableXml = docXml.slice(tableStart, tableEnd);

  // Find the rIdx-th <w:tr>
  const rowMatches = [...tableXml.matchAll(/<w:tr[\s>]/gs)];
  if (rIdx >= rowMatches.length) return null;
  const rowStart = rowMatches[rIdx].index;
  const rowEnd   = tableXml.indexOf('</w:tr>', rowStart) + 7;
  const rowXml   = tableXml.slice(rowStart, rowEnd);

  // Find the cIdx-th <w:tc>, shifting right if it looks like a clause number cell
  const cellMatches = [...rowXml.matchAll(/<w:tc[\s>]/gs)];
  if (cIdx >= cellMatches.length) return null;

  const extractCellText = (cx) => {
    const parts = [];
    const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let m;
    while ((m = re.exec(cx)) !== null) { if (m[1]) parts.push(m[1]); }
    return parts.join('').replace(/\s+/g, ' ').trim();
  };
  const isNumberCell = (text) =>
    text.length < 20 && /^[\d\.\s\(\)Article Section Clause]+$/i.test(text);

  const origCellStart = cellMatches[cIdx].index;
  const origCellEnd   = rowXml.indexOf('</w:tc>', origCellStart) + 7;
  const origCellXml   = rowXml.slice(origCellStart, origCellEnd);

  let cellStart = origCellStart;
  let cellEnd   = origCellEnd;
  let cellXml   = origCellXml;

  if (isNumberCell(extractCellText(origCellXml))) {
    for (let shift = 1; shift <= 2; shift++) {
      const nc = cIdx + shift;
      if (nc >= cellMatches.length) break;
      const cs = cellMatches[nc].index;
      const ce = rowXml.indexOf('</w:tc>', cs) + 7;
      const cx = rowXml.slice(cs, ce);
      if (!isNumberCell(extractCellText(cx))) {
        cellStart = cs; cellEnd = ce; cellXml = cx;
        break;
      }
    }
    // if no non-number cell found within 2 shifts, original cell is used (already set)
  }

  // First <w:p> in the cell that contains at least one run
  const parasInCell = [...cellXml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/gs)];
  let targetPara    = null;
  let targetParaXml = null;
  for (const pm of parasInCell) {
    if (/<w:r[\s>\/]/.test(pm[0])) {
      targetPara    = pm;
      targetParaXml = pm[0];
      break;
    }
  }
  if (!targetPara) return null;

  // Compute absolute position of this paragraph within docXml.
  // Each offset is relative to the slice it was matched against, so they sum correctly.
  const cellAbsStart = tableStart + rowStart + cellStart;
  const paraAbsStart = cellAbsStart + targetPara.index;
  const paraAbsEnd   = paraAbsStart + targetParaXml.length;

  const paraEntry = { start: paraAbsStart, end: paraAbsEnd, originalXml: targetParaXml };
  return injectIntoParaEntry(docXml, paraEntry, startTag, endTag, refRun);
}

// Search the pre-built paragraph map for verbatimExtract (strategy 1) then
// clauseName heuristics (strategy 2). Both strategies skip paragraphs that fail
// the isBodyParagraph check — headings, TOC lines, and cover-page text are excluded.
// If neither strategy finds a qualifying paragraph, returns matched:false with no anchor.
// debugIdx: 0-based clause index; pass for first 5 clauses to enable diagnostic output.
// Returns { xml: string, matched: boolean, via: 'cellRef'|'string'|null }.
function injectCommentMarkers(xml, clauseName, commentId, verbatimExtract, debugIdx, cellRef, numberRef) {
  const startTag = `<w:commentRangeStart w:id="${commentId}"/>`;
  const endTag   = `<w:commentRangeEnd w:id="${commentId}"/>`;
  const refRun   =
    `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr>` +
    `<w:commentReference w:id="${commentId}"/></w:r>`;

  // Strategy 0 — cellRef coordinate anchor (most reliable; used when model returns grid coordinates)
  if (cellRef) {
    const anchored = anchorByCellRef(xml, cellRef, commentId);
    if (anchored !== null) {
      console.log(`[LeaseLens] ✓ #${commentId} via cellRef "${cellRef}"`);
      return { xml: anchored, matched: true, via: 'cellRef' };
    }
    console.warn(`[LeaseLens] cellRef "${cellRef}" failed — falling back`);
  }

  // Strategy 0b — numberRef cell coordinate anchor (fallback when text cell anchor fails)
  if (typeof numberRef === 'string') {
    const anchored = anchorByCellRef(xml, numberRef, commentId);
    if (anchored !== null) {
      console.log(`[LeaseLens] ✓ #${commentId} via numberRef cell "${numberRef}"`);
      return { xml: anchored, matched: true, via: 'cellRef' };
    }
    console.warn(`[LeaseLens] numberRef cell "${numberRef}" failed — falling back to string search`);
  }

  // Strategy 0c — numberRef paragraph anchor (for paragraph-scoped numberRef objects)
  if (numberRef?.type === 'paragraph') {
    const paras = buildParaMap(xml);
    const bodyParas = paras.filter(p => !isParaInTableCell(xml, p.start));
    const target = typeof numberRef.index === 'number' ? bodyParas[numberRef.index] : null;
    if (target) {
      const newXml = injectIntoParaEntry(xml, target, startTag, endTag, refRun);
      if (newXml !== null) {
        console.log(`[LeaseLens] ✓ #${commentId} via numberRef paragraph[${numberRef.index}]`);
        return { xml: newXml, matched: true, via: 'cellRef' };
      }
    }
  }

  const paras = buildParaMap(xml);

  // ── Diagnostic: para map snapshot (first clause only) ──────────────────────
  if (debugIdx === 0) {
    console.log(`[LeaseLens] Para map: ${paras.length} non-empty paragraphs. First 5:`);
    paras.slice(0, 5).forEach((p) =>
      console.log(`  [para ${p.paraIdx}] ${p.cleanText.length}ch ${p.cleanText.split(/\s+/).length}w | "${p.cleanText.slice(0, 120)}"`)
    );
  }

  // ── Diagnostic: per-clause pre-match info (first 5 clauses) ────────────────
  if (debugIdx !== undefined && debugIdx < 5) {
    const normExtract = verbatimExtract
      ? verbatimExtract.replace(/\s+/g, ' ').trim().toLowerCase()
      : null;
    const extractHitAll  = normExtract ? paras.find(p => p.cleanText.toLowerCase().includes(normExtract)) : null;
    const extractHitBody = normExtract ? paras.find(p => isBodyParagraph(p.cleanText) && p.cleanText.toLowerCase().includes(normExtract)) : null;
    const nameHitBody    = paras.find(p => isBodyParagraph(p.cleanText) && whyClauseMatchesPara(clauseName, p.cleanText) !== null);
    console.group(`[LeaseLens] Clause #${debugIdx} pre-match`);
    console.log('  name           :', clauseName);
    console.log('  verbatimExtract:', verbatimExtract || '(none)');
    console.log('  extract (any)  :', extractHitAll  ? `para[${extractHitAll.paraIdx}]  "${extractHitAll.cleanText.slice(0, 80)}"` : 'NO MATCH');
    console.log('  extract (body) :', extractHitBody ? `para[${extractHitBody.paraIdx}] "${extractHitBody.cleanText.slice(0, 80)}"` : 'NO MATCH — all hits were too short');
    console.log('  name (body)    :', nameHitBody    ? `para[${nameHitBody.paraIdx}] (${whyClauseMatchesPara(clauseName, nameHitBody.cleanText)}) "${nameHitBody.cleanText.slice(0, 80)}"` : 'NO MATCH');
    console.groupEnd();
  }
  // ───────────────────────────────────────────────────────────────────────────

  // Strategy 1: verbatim extract.
  // Accepts body paragraphs (isBodyParagraph) OR paragraphs inside a <w:tc> table cell
  // regardless of length — short cell paragraphs are valid anchors for bilingual tables.
  if (verbatimExtract) {
    const normExtract = verbatimExtract.replace(/\s+/g, ' ').trim().toLowerCase();
    for (const para of paras) {
      if (!para.cleanText.toLowerCase().includes(normExtract)) continue;
      const inTableCell = isParaInTableCell(xml, para.start);
      if (!isBodyParagraph(para.cleanText) && !inTableCell) {
        console.log(`[LeaseLens] skip para[${para.paraIdx}] for "${clauseName}" — verbatim match but too short (${para.cleanText.split(/\s+/).length}w, ${para.cleanText.length}ch)`);
        continue;
      }
      const newXml = injectIntoParaEntry(xml, para, startTag, endTag, refRun);
      if (newXml !== null) {
        console.log(`[LeaseLens] ✓ #${commentId} para[${para.paraIdx}] via verbatimExtract | "${para.cleanText.slice(0, 100)}"`);
        return { xml: newXml, matched: true, via: 'string' };
      }
    }
  }

  // Strategy 2: clause name heuristics.
  // Only body paragraphs are considered — same isBodyParagraph gate applies.
  for (const para of paras) {
    if (!isBodyParagraph(para.cleanText)) continue;
    const reason = whyClauseMatchesPara(clauseName, para.cleanText);
    if (reason === null) continue;
    const newXml = injectIntoParaEntry(xml, para, startTag, endTag, refRun);
    if (newXml !== null) {
      console.log(`[LeaseLens] ✓ #${commentId} para[${para.paraIdx}] via name (${reason}) | "${para.cleanText.slice(0, 100)}"`);
      return { xml: newXml, matched: true, via: 'string' };
    }
  }

  // Strategy 3: table cell search — final fallback for table-heavy or bilingual documents.
  // Only reached when Strategies 1 and 2 both failed. Iterates every <w:tbl> in the
  // document, extracts rows and cells with their global positions, then does a
  // case-insensitive substring match of verbatimExtract against each cell's text.
  if (verbatimExtract) {
    const normExtract = verbatimExtract.replace(/\s+/g, ' ').trim().toLowerCase();
    const tableRegex = /<w:tbl[\s>][\s\S]*?<\/w:tbl>/gs;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(xml)) !== null) {
      const tableXml = tableMatch[0];
      const tableOffset = tableMatch.index;

      // Build row/cell structure; compute every offset relative to the full document XML
      const tableRows = [];
      const rowRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/gs;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(tableXml)) !== null) {
        const rowXml = rowMatch[0];
        const rowOffset = tableOffset + rowMatch.index;
        const rowCells = [];
        const cellRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/gs;
        let cellMatch;
        let colIndex = 0;
        while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
          const cellXml = cellMatch[0];
          const cellOffset = rowOffset + cellMatch.index;
          const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
          let tm;
          const parts = [];
          while ((tm = tRegex.exec(cellXml)) !== null) {
            parts.push(decodeXmlEntities(tm[1]));
          }
          const cellText = parts.join('').replace(/\s+/g, ' ').trim();
          rowCells.push({ rowIndex: tableRows.length, colIndex, text: cellText, cellXml, cellOffset });
          colIndex++;
        }
        tableRows.push(rowCells);
      }

      // Search for verbatimExtract; inject into the first viable <w:p> in the matching cell
      for (const row of tableRows) {
        for (const cell of row) {
          if (!cell.text.toLowerCase().includes(normExtract)) continue;
          const cellParaRegex = /<w:p[\s>][\s\S]*?<\/w:p>/gs;
          let pm;
          while ((pm = cellParaRegex.exec(cell.cellXml)) !== null) {
            if (!/<w:r[\s>\/]/.test(pm[0])) continue; // paragraph must have at least one run
            const para = {
              originalXml: pm[0],
              start: cell.cellOffset + pm.index,
              end: cell.cellOffset + pm.index + pm[0].length,
            };
            const newXml = injectIntoParaEntry(xml, para, startTag, endTag, refRun);
            if (newXml !== null) {
              const foundNumber = findClauseNumberNearCell(tableRows, cell.rowIndex, cell.colIndex);
              console.log('[anchor] Strategy 3 match — cell [row ' + cell.rowIndex + ', col ' + cell.colIndex + '], nearest clause ref:', foundNumber ?? 'not found');
              return { xml: newXml, matched: true, via: 'string' };
            }
          }
        }
      }
    }
  }

  // No qualifying match — do NOT anchor to any paragraph.
  console.warn(`[LeaseLens] NO MATCH "${clauseName}" | extract="${verbatimExtract || '(none)'}" | body paras=${paras.filter(p => isBodyParagraph(p.cleanText)).length}/${paras.length}`);
  return { xml, matched: false, via: null };
}

// ── Unmatched clauses DOCX ────────────────────────────────────────────────────

async function downloadUnmatchedDocx(unmatchedClauses) {
  const children = [
    new Paragraph({
      children: [new TextRun({ text: 'LeaseLens — Unmatched Comments', bold: true, size: 36, color: '1B2E4B' })],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({
        text: 'The following clauses could not be automatically placed in the annotated document. Please review them alongside the annotated lease.',
        size: 20,
        color: '6B7280',
      })],
      spacing: { after: 400 },
    }),
  ];

  for (const clause of unmatchedClauses) {
    const biasLabel = clause.bias === 'x'
      ? 'Unclear / Drafting Error'
      : `Bias ${clause.bias} — ${BIAS_LABELS[clause.bias]}`;
    const scoreStr = clause.score != null ? `  |  Score: ${clause.score}/100` : '';

    children.push(
      new Paragraph({
        children: [new TextRun({ text: clause.name || '', bold: true, size: 24, color: '1B2E4B' })],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 80 },
        border: {
          left: { style: BorderStyle.THICK, size: 6, color: biasHexNoHash(clause.bias) },
        },
      }),
      new Paragraph({
        children: [new TextRun({ text: biasLabel + scoreStr, size: 18, color: biasHexNoHash(clause.bias) })],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: clause.note || '', size: 20, color: '374151' })],
        spacing: { after: 160 },
      }),
    );

    if (clause.change) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Suggested Change: ', bold: true, size: 20, color: '92400E' }),
            new TextRun({ text: clause.change, size: 20, color: '78350F' }),
          ],
          spacing: { after: 200 },
          shading: { fill: 'FEF3C7' },
        }),
      );
    }
  }

  const docFile = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(docFile);
  saveBlob(blob, 'LeaseLens-Unmatched-Comments.docx');
}

// ── Annotated DOCX (DOCX upload, options 2 / 3 / 4) ─────────────────────────
// Preserves the original document byte-for-byte; only adds comment XML nodes.

async function downloadAnnotatedDocx(filteredClauses, file) {
  try {
    console.log('[LeaseLens] downloadAnnotatedDocx: start', { fileName: file.name, clauses: filteredClauses.length });

    const arrayBuffer = await file.arrayBuffer();
    const zip = new PizZip(arrayBuffer);

    let docXml = zip.file('word/document.xml').asText();

    // Pick IDs that don't collide with any existing w:id in the document
    const existingIds = [...docXml.matchAll(/w:id="(\d+)"/g)].map(m => parseInt(m[1], 10));
    const idBase = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

    const clausesWithChanges = filteredClauses.filter(c => c.change);
    console.log('[LeaseLens] clauses with changes:', clausesWithChanges.length);

    const commentElements = [];
    const unmatchedClauses = [];
    let injected = 0;
    let cellRefCount = 0;
    let stringCount = 0;

    clausesWithChanges.forEach((clause, idx) => {
      const commentId = idBase + idx;
      const result = injectCommentMarkers(docXml, clause.name, commentId, clause.verbatimExtract, idx < 5 ? idx : undefined, clause.cellRef, clause.numberRef);

      if (result.matched) {
        docXml = result.xml;
        injected++;
        if (result.via === 'cellRef') cellRefCount++;
        else stringCount++;
        const biasLabel = clause.bias === 'x'
          ? 'Unclear/Error'
          : `Bias ${clause.bias} — ${BIAS_LABELS[clause.bias]}`;
        const scoreStr = clause.score != null ? ` | Score: ${clause.score}/100` : '';
        commentElements.push(
          `<w:comment w:id="${commentId}" w:author="LeaseLens" w:date="${new Date().toISOString()}" w:initials="LL">` +
          `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(clause.name)}</w:t></w:r></w:p>` +
          `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(biasLabel + scoreStr)}</w:t></w:r></w:p>` +
          `<w:p><w:r><w:t xml:space="preserve">Analysis: ${xmlEscape(clause.note)}</w:t></w:r></w:p>` +
          `<w:p><w:r><w:t xml:space="preserve">Suggested Change: ${xmlEscape(clause.change)}</w:t></w:r></w:p>` +
          `</w:comment>`
        );
      } else {
        unmatchedClauses.push(clause);
      }
    });

    console.log(`[LeaseLens] comment injection: ${cellRefCount} by coordinate, ${stringCount} by text match, ${clausesWithChanges.length - injected} unmatched`);

    // Build or append to comments.xml (only if at least one comment was injected)
    const existingCommentsFile = zip.file('word/comments.xml');
    if (existingCommentsFile) {
      const existing = existingCommentsFile.asText();
      zip.file('word/comments.xml',
        existing.replace('</w:comments>', commentElements.join('') + '</w:comments>')
      );
    } else {
      zip.file('word/comments.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        commentElements.join('') +
        `</w:comments>`
      );

      // Register content type
      const ctFile = zip.file('[Content_Types].xml');
      if (ctFile) {
        const ct = ctFile.asText();
        if (!ct.includes('comments+xml')) {
          zip.file('[Content_Types].xml', ct.replace(
            '</Types>',
            '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'
          ));
        }
      }

      // Register relationship in document.xml.rels
      const relsPath = 'word/_rels/document.xml.rels';
      const relsFile = zip.file(relsPath);
      if (relsFile) {
        const rels = relsFile.asText();
        if (!rels.includes('/comments')) {
          zip.file(relsPath, rels.replace(
            '</Relationships>',
            '<Relationship Id="rIdLLComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>'
          ));
        }
      }
    }

    zip.file('word/document.xml', docXml);

    const blob = zip.generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    saveBlob(blob, `${baseName(file.name)}_leaselens_annotated.docx`);
    console.log(`[LeaseLens] download triggered — ${cellRefCount} by coordinate, ${stringCount} by text match, ${unmatchedClauses.length} unmatched of ${clausesWithChanges.length}`);

    if (unmatchedClauses.length > 0) {
      await downloadUnmatchedDocx(unmatchedClauses);
      alert(
        `${cellRefCount} clause(s) anchored by coordinate, ${stringCount} by text match. ` +
        `${unmatchedClauses.length} clause(s) could not be anchored — ` +
        `saved in LeaseLens-Unmatched-Comments.docx.`
      );
    }
  } catch (err) {
    console.error('[LeaseLens] downloadAnnotatedDocx ERROR:', err);
    throw err;
  }
}

// ── Clean Report DOCX (PDF upload or option 1) ───────────────────────────────

async function downloadCleanReportDocx(filteredClauses, option, allClauses, fileName) {
  console.log('[LeaseLens] downloadCleanReportDocx: start', { fileName, clauses: filteredClauses.length, option });
  try {
  const { display, mean } = computeOverallScore(allClauses);
  const showChanges = option !== 1;

  const children = [
    new Paragraph({
      children: [new TextRun({ text: 'LeaseLens Report', bold: true, size: 36, color: '1B2E4B' })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `File: ${fileName}`, color: '6B7280', size: 18 }),
        new TextRun({ text: `   |   Generated: ${new Date().toLocaleDateString()}`, color: '6B7280', size: 18 }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Option: ${OPTION_LABELS[option]}`, color: '6B7280', size: 18 }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Overall Score: ${display}/5`, bold: true, size: 24, color: '1B2E4B' }),
        new TextRun({
          text: `  (mean ${Math.round(mean)}/100 — ${BIAS_LABELS[display] || ''})`,
          size: 20,
          color: '6B7280',
        }),
      ],
      spacing: { after: 400 },
    }),
  ];

  for (const clause of filteredClauses) {
    const biasLabel =
      clause.bias === 'x'
        ? 'Unclear / Drafting Error'
        : `Bias ${clause.bias} — ${BIAS_LABELS[clause.bias]}`;
    const scoreStr = clause.score !== null ? `  |  Score: ${clause.score}/100` : '';

    children.push(
      new Paragraph({
        children: [new TextRun({ text: clause.name || '', bold: true, size: 24, color: '1B2E4B' })],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 400, after: 80 },
        border: {
          left: { style: BorderStyle.THICK, size: 6, color: biasHexNoHash(clause.bias) },
        },
      }),
      new Paragraph({
        children: [new TextRun({ text: biasLabel + scoreStr, size: 18, color: biasHexNoHash(clause.bias) })],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: clause.note || '', size: 20, color: '374151' })],
        spacing: { after: 160 },
      }),
    );

    if (showChanges && clause.change) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Suggested Change: ', bold: true, size: 20, color: '92400E' }),
            new TextRun({ text: clause.change || '', size: 20, color: '78350F' }),
          ],
          spacing: { after: 120 },
          shading: { fill: 'FEF3C7' },
        }),
      );
    }

    if (showChanges && clause.genClause) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Drafted Replacement Clause:', bold: true, size: 20, color: '1E40AF' })],
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [new TextRun({ text: clause.genClause || '', size: 18, color: '1E3A8A' })],
          spacing: { after: 200 },
          shading: { fill: 'EFF6FF' },
        }),
      );
    }
  }

  console.log('[LeaseLens] creating Document with', children.length, 'children...');
  const docFile = new Document({
    sections: [{ properties: {}, children }],
  });
  console.log('[LeaseLens] Document created, calling Packer.toBlob...');

  const blob = await Packer.toBlob(docFile);
  console.log('[LeaseLens] blob created, size:', blob.size, 'type:', blob.type);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName(fileName)}_leaselens.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('[LeaseLens] download triggered:', a.download);
  } catch (err) {
    console.error('[LeaseLens] downloadCleanReportDocx ERROR:', err);
    throw err;
  }
}

// ── PDF export (unchanged) ────────────────────────────────────────────────────

export function downloadPDF(filteredClauses, option, allClauses, fileName) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { display, mean } = computeOverallScore(allClauses);
  const showChanges = option !== 1;
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed = 10) => {
    if (y + needed > 277) {
      doc.addPage();
      y = margin;
    }
  };

  const addText = (text, size, colorHex, bold = false, indent = 0) => {
    doc.setFontSize(size);
    const [r, g, b] = hexToRgb(colorHex);
    doc.setTextColor(r, g, b);
    if (bold) doc.setFont('helvetica', 'bold');
    else doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, maxW - indent);
    checkPage(lines.length * (size * 0.35) + 2);
    doc.text(lines, margin + indent, y);
    y += lines.length * (size * 0.35) + 1;
  };

  // Header
  doc.setFillColor(27, 46, 75);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('LeaseLens', margin, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(OPTION_LABELS[option], pageW - margin, 11, { align: 'right' });
  y = 26;

  addText(`File: ${fileName}`, 9, '#6b7280');
  addText(`Generated: ${new Date().toLocaleDateString()}`, 9, '#6b7280');
  // Italic disclaimer beneath the date
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  const disclaimerText = 'This report is generated by LeaseLens for informational purposes only and does not constitute legal advice.';
  const disclaimerLines = doc.splitTextToSize(disclaimerText, maxW);
  checkPage(disclaimerLines.length * 3 + 2);
  doc.text(disclaimerLines, margin, y);
  y += disclaimerLines.length * 3 + 2;
  doc.setFont('helvetica', 'normal');
  y += 4;

  addText(`Overall Score: ${display}/5  (mean ${Math.round(mean)}/100)`, 12, '#1B2E4B', true);
  addText(BIAS_LABELS[display] || '', 10, '#6b7280');
  y += 6;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  for (const clause of filteredClauses) {
    checkPage(24);
    const biasColor = biasHex(clause.bias);

    const [br, bg, bb] = hexToRgb(biasColor);
    doc.setFillColor(br, bg, bb);
    const blockStart = y - 1;

    addText(clause.name, 13, '#1B2E4B', true);

    const biasLabel =
      clause.bias === 'x' ? 'Unclear/Error' : `Bias ${clause.bias} — ${BIAS_LABELS[clause.bias]}`;
    const scoreStr = clause.score !== null ? `  |  Score: ${clause.score}/100` : '';
    addText(biasLabel + scoreStr, 9, biasColor);
    y += 1;

    addText(clause.note, 9, '#374151', false, 0);
    y += 2;

    if (showChanges && clause.change) {
      checkPage(12);
      addText('Suggested Change:', 9, '#92400e', true);
      addText(clause.change, 9, '#78350f', false, 4);
      y += 1;
    }

    if (showChanges && clause.genClause) {
      checkPage(12);
      addText('Drafted Replacement Clause:', 9, '#1e40af', true);
      addText(clause.genClause, 9, '#1e3a8a', false, 4);
      y += 1;
    }

    doc.setFillColor(br, bg, bb);
    doc.rect(margin - 4, blockStart, 2, y - blockStart, 'F');

    y += 5;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y - 3, pageW - margin, y - 3);
  }

  doc.save(`${baseName(fileName)}_leaselens.pdf`);
}

// ── Word export (router) ──────────────────────────────────────────────────────

export async function downloadWord(filteredClauses, option, allClauses, file) {
  console.log('[LeaseLens] downloadWord called', {
    fileName: file?.name,
    isDocx: isDocxFile(file),
    option,
    filteredClauses: filteredClauses.length,
  });
  try {
    if (isDocxFile(file) && option !== 1) {
      await downloadAnnotatedDocx(filteredClauses, file);
    } else {
      await downloadCleanReportDocx(filteredClauses, option, allClauses, file.name);
    }
    console.log('[LeaseLens] downloadWord complete');
  } catch (err) {
    console.error('[LeaseLens] downloadWord TOP-LEVEL ERROR:', err);
    alert(`Word download failed: ${err.message}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function biasHex(bias) {
  const map = { 1: '#4c1d95', 2: '#7c3aed', 3: '#eab308', 4: '#f97316', 5: '#c2410c', x: '#ef4444' };
  return map[bias] || '#6b7280';
}

function biasHexNoHash(bias) {
  return biasHex(bias).replace('#', '');
}
