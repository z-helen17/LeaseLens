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

// Extract visible text from a <w:p> XML node, decoding entities.
function paraTextFromXml(paraXml) {
  return paraXml
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x[\dA-Fa-f]+;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Finds the <w:p> in xml whose concatenated text matches clauseName, then
// wraps all its runs with commentRangeStart/End and a commentReference run.
// Returns modified xml on success, original xml on no match (and logs a warning).
function injectCommentMarkers(xml, clauseName, commentId) {
  const startTag = `<w:commentRangeStart w:id="${commentId}"/>`;
  const endTag   = `<w:commentRangeEnd w:id="${commentId}"/>`;
  const refRun   =
    `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr>` +
    `<w:commentReference w:id="${commentId}"/></w:r>`;

  const paraRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let m;
  let parasChecked = 0;

  while ((m = paraRegex.exec(xml)) !== null) {
    const paraText = paraTextFromXml(m[0]);
    if (!paraText) continue;
    parasChecked++;

    const reason = whyClauseMatchesPara(clauseName, paraText);
    if (!reason) continue;

    console.log(`[LeaseLens] ✓ comment #${commentId} matched "${clauseName}" → "${paraText.slice(0, 100)}" (${reason})`);

    const para = m[0];

    // Start search for runs after </w:pPr> if present
    const pPrEnd      = para.indexOf('</w:pPr>');
    const searchFrom  = pPrEnd !== -1 ? pPrEnd + 8 : 0;

    // Match first real run (<w:r> or <w:r >) — excludes <w:rPr>, <w:rStyle> etc.
    const runMatch = /<w:r[\s>\/]/.exec(para.slice(searchFrom));
    if (!runMatch) {
      console.warn(`[LeaseLens] ✗ "${clauseName}": matched para has no runs, skipping`);
      continue;
    }
    const firstRunStart = searchFrom + runMatch.index;

    const lastRunEnd = para.lastIndexOf('</w:r>');
    if (lastRunEnd === -1) {
      console.warn(`[LeaseLens] ✗ "${clauseName}": matched para has no closing </w:r>, skipping`);
      continue;
    }
    const afterLastRun = lastRunEnd + 6; // '</w:r>'.length === 6

    const newPara =
      para.slice(0, firstRunStart) +
      startTag +
      para.slice(firstRunStart, afterLastRun) +
      endTag +
      refRun +
      para.slice(afterLastRun);

    return xml.slice(0, m.index) + newPara + xml.slice(m.index + m[0].length);
  }

  console.warn(`[LeaseLens] ✗ "${clauseName}": no matching paragraph found (checked ${parasChecked} non-empty paras)`);
  return xml;
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
    let injected = 0;

    clausesWithChanges.forEach((clause, idx) => {
      const commentId = idBase + idx;
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

      const before = docXml;
      docXml = injectCommentMarkers(docXml, clause.name, commentId);
      if (docXml !== before) injected++;
    });

    console.log(`[LeaseLens] comment injection: ${injected}/${clausesWithChanges.length} clauses matched`);

    // Build or append to comments.xml
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
    console.log('[LeaseLens] download triggered, matched', commentElements.length, 'of', clausesWithChanges.length, 'clauses');
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
