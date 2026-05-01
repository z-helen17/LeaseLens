import PizZip from 'pizzip';

function getTextFromXml(fragment) {
  const texts = [];
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(fragment)) !== null) {
    if (m[1]) texts.push(m[1]);
  }
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}

// ── Numbering XML parsing ────────────────────────────────────────────────────

function parseNumberingXml(xml) {
  const abstractNumMap = new Map(); // abstractNumId → sparse levels[]
  const numMap = new Map();         // numId → abstractNumId
  if (!xml) return { abstractNumMap, numMap };

  const aRe = /<w:abstractNum\b[\s\S]*?<\/w:abstractNum>/g;
  let aM;
  while ((aM = aRe.exec(xml)) !== null) {
    const block = aM[0];
    const idM = /w:abstractNumId="(\d+)"/.exec(block);
    if (!idM) continue;
    const levels = [];
    const lvlRe = /<w:lvl\b[\s\S]*?<\/w:lvl>/g;
    let lvlM;
    while ((lvlM = lvlRe.exec(block)) !== null) {
      const lvl = lvlM[0];
      const ilvlM = /w:ilvl="(\d+)"/.exec(lvl);
      if (!ilvlM) continue;
      const ilvl = +ilvlM[1];
      const fmtM   = /<w:numFmt\b[^>]*w:val="([^"]+)"/.exec(lvl);
      const textM  = /<w:lvlText\b[^>]*w:val="([^"]*)"/.exec(lvl);
      const startM = /<w:start\b[^>]*w:val="(\d+)"/.exec(lvl);
      levels[ilvl] = {
        ilvl,
        numFmt:  fmtM   ? fmtM[1]    : 'decimal',
        lvlText: textM  ? textM[1]   : `%${ilvl + 1}.`,
        start:   startM ? +startM[1] : 1,
      };
    }
    abstractNumMap.set(+idM[1], levels);
  }

  const nRe = /<w:num\b[\s\S]*?<\/w:num>/g;
  let nM;
  while ((nM = nRe.exec(xml)) !== null) {
    const block = nM[0];
    const numIdM = /^<w:num\b[^>]*w:numId="(\d+)"/.exec(block);
    const absM   = /<w:abstractNumId\b[^>]*w:val="(\d+)"/.exec(block);
    if (numIdM && absM) numMap.set(+numIdM[1], +absM[1]);
  }

  return { abstractNumMap, numMap };
}

function fmtNum(n, fmt) {
  if (fmt === 'lowerLetter') return n > 0 ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : '';
  if (fmt === 'upperLetter') return n > 0 ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : '';
  if (fmt === 'lowerRoman')  return toRoman(n).toLowerCase();
  if (fmt === 'upperRoman')  return toRoman(n).toUpperCase();
  return String(n);
}

function toRoman(n) {
  const v = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const s = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let r = '';
  for (let i = 0; i < v.length; i++) while (n >= v[i]) { r += s[i]; n -= v[i]; }
  return r || 'I';
}

function advanceNumState(numId, ilvl, abstractNumMap, numMap, numberingState) {
  const absId = numMap.get(numId);
  if (absId === undefined) return null;
  const levels = abstractNumMap.get(absId);
  if (!levels) return null;
  const level = levels[ilvl];
  if (!level || level.numFmt === 'bullet' || level.numFmt === 'none') return null;

  if (!numberingState.has(numId)) {
    numberingState.set(numId, []); // null = never advanced for that level
  }
  const state = numberingState.get(numId);
  while (state.length <= ilvl) state.push(null);

  // Parent levels that have never been advanced get pre-initialised to their
  // start value so that e.g. ilvl=1 first seen before ilvl=0 produces "1.1"
  // rather than "0.1" (the bug case where a sub-clause style appears before
  // any top-level heading for this numId).
  for (let i = 0; i < ilvl; i++) {
    if (state[i] === null) {
      const l = levels[i];
      state[i] = l ? l.start : 1;
    }
  }

  // Advance the current level (initialise if first time seen)
  if (state[ilvl] === null) {
    const l = levels[ilvl];
    state[ilvl] = l ? l.start - 1 : 0;
  }
  state[ilvl]++;

  // Reset child levels to null so they re-initialise fresh next time
  for (let i = ilvl + 1; i < state.length; i++) {
    state[i] = null;
  }

  const text = level.lvlText.replace(/%(\d+)/g, (_, n) => {
    const idx = +n - 1;
    const l = levels[idx];
    const val = state[idx] ?? (l ? l.start : 1);
    return fmtNum(val, l ? l.numFmt : 'decimal');
  });
  return text || null;
}

function parseStylesXml(xml) {
  const styleNumPrMap = new Map(); // styleId → { numId, ilvl }
  if (!xml) return styleNumPrMap;
  const styleRe = /<w:style\b[\s\S]*?<\/w:style>/g;
  let sM;
  while ((sM = styleRe.exec(xml)) !== null) {
    const block = sM[0];
    const styleIdM = /w:styleId="([^"]+)"/.exec(block);
    const numPrM   = /<w:numPr>([\s\S]*?)<\/w:numPr>/.exec(block);
    if (!styleIdM || !numPrM) continue;
    const numIdM = /w:numId\b[^>]*w:val="(\d+)"/.exec(numPrM[1]);
    const ilvlM  = /w:ilvl\b[^>]*w:val="(\d+)"/.exec(numPrM[1]);
    if (!numIdM) continue;
    const numId = +numIdM[1];
    if (numId === 0) continue;
    styleNumPrMap.set(styleIdM[1], { numId, ilvl: ilvlM ? +ilvlM[1] : 0 });
  }
  return styleNumPrMap;
}

function cellComputedNumber(cellXml, abstractNumMap, numMap, numberingState, styleNumPrMap) {
  const pRe = /<w:p\b[\s\S]*?<\/w:p>/g;
  let pM, first = null;
  while ((pM = pRe.exec(cellXml)) !== null) {
    const para = pM[0];

    // Inline numPr takes priority
    let numId = null, ilvl = 0;
    const npr = /<w:numPr>([\s\S]*?)<\/w:numPr>/.exec(para);
    if (npr) {
      const numIdM = /w:numId\b[^>]*w:val="(\d+)"/.exec(npr[1]);
      const ilvlM  = /w:ilvl\b[^>]*w:val="(\d+)"/.exec(npr[1]);
      if (numIdM) { numId = +numIdM[1]; ilvl = ilvlM ? +ilvlM[1] : 0; }
    }

    // Fall back to style-inherited numPr
    if ((numId === null || numId === 0) && styleNumPrMap) {
      const styleM = /w:pStyle\b[^>]*w:val="([^"]+)"/.exec(para);
      if (styleM) {
        const spr = styleNumPrMap.get(styleM[1]);
        if (spr) { numId = spr.numId; ilvl = spr.ilvl; }
      }
    }

    if (!numId || numId === 0) continue;
    const result = advanceNumState(numId, ilvl, abstractNumMap, numMap, numberingState);
    if (result !== null && first === null) first = result;
  }
  return first;
}

export async function buildDocumentGrid(arrayBuffer) {
  const zip = new PizZip(arrayBuffer);
  const xml = zip.files['word/document.xml'].asText();
  const numberingXml = zip.files['word/numbering.xml']?.asText() || '';
  const stylesXml    = zip.files['word/styles.xml']?.asText()    || '';
  const { abstractNumMap, numMap } = parseNumberingXml(numberingXml);
  const styleNumPrMap = parseStylesXml(stylesXml);
  const numberingState = new Map();

  // Parse tables
  const tables = [];
  const tableRe = /<w:tbl\b[^>]*>.*?<\/w:tbl>/gs;
  let tableMatch;
  let tableIndex = 0;

  while ((tableMatch = tableRe.exec(xml)) !== null) {
    const tableXml = tableMatch[0];
    const rows = [];
    const rowRe = /<w:tr\b[^>]*>.*?<\/w:tr>/gs;
    let rowMatch;
    let rowIndex = 0;

    while ((rowMatch = rowRe.exec(tableXml)) !== null) {
      const rowXml = rowMatch[0];
      const cells = [];
      const cellRe = /<w:tc\b[^>]*>.*?<\/w:tc>/gs;
      let cellMatch;
      let colIndex = 0;

      while ((cellMatch = cellRe.exec(rowXml)) !== null) {
        const text = getTextFromXml(cellMatch[0]);
        const computedNumber = cellComputedNumber(cellMatch[0], abstractNumMap, numMap, numberingState, styleNumPrMap);
        cells.push({
          colIndex,
          ref: `t${tableIndex}r${rowIndex}c${colIndex}`,
          text,
          computedNumber,
        });
        colIndex++;
      }

      rows.push({ rowIndex, cells });
      rowIndex++;
    }

    tables.push({ tableIndex, rows });
    tableIndex++;
  }

  // Parse body paragraphs — strip all table blocks first (iteratively to
  // handle nested tables), then match remaining <w:p> blocks.
  let bodyXml = xml;
  while (/<w:tbl\b/.test(bodyXml)) {
    bodyXml = bodyXml.replace(/<w:tbl\b[^>]*>.*?<\/w:tbl>/gs, '');
  }

  const bodyParagraphs = [];
  const paraRe = /<w:p\b[^>]*>.*?<\/w:p>/gs;
  let paraMatch;
  let paraIndex = 0;

  while ((paraMatch = paraRe.exec(bodyXml)) !== null) {
    const text = getTextFromXml(paraMatch[0]);
    if (text) {
      bodyParagraphs.push({ paraIndex, text });
      paraIndex++;
    }
  }

  return { tables, bodyParagraphs };
}

function isClauseNumber(text) {
  const t = text.trim();
  if (!t || t.length >= 30) return false;
  if (t.split(' ').filter(w => w).length > 3) return false;
  if (/['"']/.test(t)) return false;
  if (!/^(\d|article|section|clause|schedule|annex|exhibit|appendix)/i.test(t)) return false;
  if (/\.\s/.test(t)) return false;
  if (/\b(shall|will|must|may|is|are|was|were|be|been|being|have|has|had|do|does|did)\b/i.test(t)) return false;
  return true;
}

const LEADING_CLAUSE_RE = /^(\d[\d\.\-]*\.?\s|article\s+\d|section\s+\d|clause\s+\d|schedule\s+\d|annex\s+\d|exhibit\s+\d|appendix\s+\d)/i;

export function extractLeadingClauseNumber(text) {
  const match = LEADING_CLAUSE_RE.exec(text);
  if (!match) return null;
  return match[0].trimEnd().slice(0, 20);
}

function getCell(grid, tableIndex, rowIndex, colIndex) {
  const table = grid.tables[tableIndex];
  if (!table) return null;
  const row = table.rows[rowIndex];
  if (!row) return null;
  return row.cells.find(c => c.colIndex === colIndex) || null;
}

export function findClauseNumber(grid, ref) {
  const m = /^t(\d+)r(\d+)c(\d+)$/.exec(ref);
  if (!m) return null;
  const tableIndex = parseInt(m[1], 10);
  const startRow = parseInt(m[2], 10);
  const startCol = parseInt(m[3], 10);

  for (let r = startRow; r >= 0; r--) {
    for (let c = startCol; c >= 0; c--) {
      const cell = getCell(grid, tableIndex, r, c);
      if (cell) {
        if (cell.computedNumber != null) return cell.computedNumber;
        if (cell.text.trim()) {
          const leading = extractLeadingClauseNumber(cell.text);
          if (leading !== null) return leading;
          if (isClauseNumber(cell.text)) return cell.text.trim();
        }
      }
    }
  }
  return null;
}

function findClauseNumberWithRef(grid, ref) {
  const m = /^t(\d+)r(\d+)c(\d+)$/.exec(ref);
  if (!m) return { number: null, numberRef: null };
  const tableIndex = parseInt(m[1], 10);
  const startRow = parseInt(m[2], 10);
  const startCol = parseInt(m[3], 10);

  for (let r = startRow; r >= 0; r--) {
    for (let c = startCol; c >= 0; c--) {
      const cell = getCell(grid, tableIndex, r, c);
      if (cell) {
        if (cell.computedNumber != null) return { number: cell.computedNumber, numberRef: cell.ref };
        if (cell.text.trim()) {
          const leading = extractLeadingClauseNumber(cell.text);
          if (leading !== null) return { number: leading, numberRef: cell.ref };
          if (isClauseNumber(cell.text)) return { number: cell.text.trim(), numberRef: cell.ref };
        }
      }
    }
  }
  return { number: null, numberRef: null };
}

const BODY_CLAUSE_RE = /^(\d[\d\.\s]*\.?\s|article\s|section\s|clause\s|schedule\s|annex\s|exhibit\s|appendix\s)/i;

function logPacketSample(packets) {
  for (const packet of packets.slice(0, 10)) {
    console.log('[packet]', packet.number, '|', packet.textRef, '|', packet.text.slice(0, 60));
  }
  console.log('Total packets:', packets.length);
}

export function buildClausePackets(grid) {
  const packets = [];

  for (const table of grid.tables) {
    for (const row of table.rows) {
      // Track the best number seen so far in this row so that later cells
      // (e.g. Romanian c2) can inherit it without a cross-row backward search.
      let rowNumber = null;
      let rowNumberRef = null;

      for (const cell of row.cells) {
        const text = cell.text.trim();
        if (text.length < 20) continue;

        if (cell.computedNumber != null) {
          rowNumber = cell.computedNumber;
          rowNumberRef = cell.ref;
          packets.push({ number: cell.computedNumber, numberRef: cell.ref, textRef: cell.ref, text });
        } else {
          const leading = extractLeadingClauseNumber(cell.text);
          if (leading !== null) {
            rowNumber = leading;
            rowNumberRef = cell.ref;
            packets.push({ number: leading, numberRef: cell.ref, textRef: cell.ref, text });
          } else {
            packets.push({ number: rowNumber, numberRef: rowNumberRef, textRef: cell.ref, text });
          }
        }
      }
    }
  }

  let lastNumberedPara = null;

  for (const para of grid.bodyParagraphs) {
    const text = para.text.trim();
    if (text.length < 20) continue;

    const textRef = { type: 'paragraph', paraIndex: para.paraIndex };
    const match = BODY_CLAUSE_RE.exec(text);

    if (match) {
      const number = match[0].trimEnd().slice(0, 20);
      lastNumberedPara = { number, paraIndex: para.paraIndex };
      packets.push({
        number,
        numberRef: { type: 'paragraph', paraIndex: para.paraIndex },
        textRef,
        text,
      });
    } else {
      packets.push({
        number: lastNumberedPara ? lastNumberedPara.number : null,
        numberRef: lastNumberedPara ? { type: 'paragraph', paraIndex: lastNumberedPara.paraIndex } : null,
        textRef,
        text,
      });
    }
  }

  return packets;
}

export function findRowByText(grid, searchText) {
  if (!grid || !searchText || searchText.length < 10) return null;

  const normalise = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const needle = normalise(searchText.slice(0, 60));

  for (const table of grid.tables) {
    for (const row of table.rows) {
      for (const cell of row.cells) {
        if (normalise(cell.text).includes(needle)) {
          return { tableIndex: table.tableIndex, rowIndex: row.rowIndex, colIndex: cell.colIndex, ref: cell.ref };
        }
      }
    }
  }
  return null;
}

/*
  Example output shape for a 3-table document:

  buildDocumentGrid(arrayBuffer) =>
  {
    tables: [
      {
        tableIndex: 0,
        rows: [
          {
            rowIndex: 0,
            cells: [
              { colIndex: 0, ref: 't0r0c0', text: 'Item' },
              { colIndex: 1, ref: 't0r0c1', text: 'Description' },
              { colIndex: 2, ref: 't0r0c2', text: 'Amount' },
            ]
          },
          {
            rowIndex: 1,
            cells: [
              { colIndex: 0, ref: 't0r1c0', text: 'Base Rent' },
              { colIndex: 1, ref: 't0r1c1', text: 'Annual rent payable quarterly in advance' },
              { colIndex: 2, ref: 't0r1c2', text: '£120,000' },
            ]
          }
        ]
      },
      {
        tableIndex: 1,
        rows: [
          {
            rowIndex: 0,
            cells: [
              { colIndex: 0, ref: 't1r0c0', text: 'Party' },
              { colIndex: 1, ref: 't1r0c1', text: 'Name' },
              { colIndex: 2, ref: 't1r0c2', text: 'Address' },
            ]
          },
          {
            rowIndex: 1,
            cells: [
              { colIndex: 0, ref: 't1r1c0', text: 'Landlord' },
              { colIndex: 1, ref: 't1r1c1', text: 'Acme Property Ltd' },
              { colIndex: 2, ref: 't1r1c2', text: '1 High Street, London EC1A 1AA' },
            ]
          },
          {
            rowIndex: 2,
            cells: [
              { colIndex: 0, ref: 't1r2c0', text: 'Tenant' },
              { colIndex: 1, ref: 't1r2c1', text: 'Beta Corp Ltd' },
              { colIndex: 2, ref: 't1r2c2', text: '2 Low Road, Manchester M1 1AB' },
            ]
          }
        ]
      },
      {
        tableIndex: 2,
        rows: [
          {
            rowIndex: 0,
            cells: [
              { colIndex: 0, ref: 't2r0c0', text: 'Schedule 3 — Permitted Use' },
              { colIndex: 1, ref: 't2r0c1', text: 'Use as offices within Class E(g)(i) of the Use Classes Order 1987' },
            ]
          },
          {
            rowIndex: 1,
            cells: [
              { colIndex: 0, ref: 't2r1c0', text: '' },
              { colIndex: 1, ref: 't2r1c1', text: '' },
            ]
          }
        ]
      }
    ],
    bodyParagraphs: [
      { paraIndex: 0, text: 'THIS LEASE is made on the 1st day of January 2024' },
      { paraIndex: 1, text: 'BETWEEN (1) Acme Property Ltd (the Landlord) and (2) Beta Corp Ltd (the Tenant)' },
      { paraIndex: 2, text: '1. DEFINITIONS In this Lease the following words shall have the following meanings:' },
      { paraIndex: 3, text: '2. DEMISE The Landlord demises to the Tenant the Property together with the rights...' },
    ]
  }
*/
