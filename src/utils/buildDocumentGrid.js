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

export async function buildDocumentGrid(arrayBuffer) {
  const zip = new PizZip(arrayBuffer);
  const xml = zip.files['word/document.xml'].asText();

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
        cells.push({
          colIndex,
          ref: `t${tableIndex}r${rowIndex}c${colIndex}`,
          text,
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
  if (!t || t.length >= 40) return false;
  if (!/^(\d|article|section|clause|schedule|annex|exhibit|appendix)/i.test(t)) return false;
  if (/\.\s/.test(t)) return false; // full stop mid-text = sentence, not a clause number
  if (/\b(shall|will|must|may|is|are|was|were|be|been|being|have|has|had|do|does|did)\b/i.test(t)) return false;
  return true;
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

  let lastNonEmpty = null;

  for (let r = startRow; r >= 0; r--) {
    // Current row: search leftward only (skip the cell itself)
    // Rows above: check same col first, then leftward
    const maxCol = r === startRow ? startCol - 1 : startCol;
    for (let c = maxCol; c >= 0; c--) {
      const cell = getCell(grid, tableIndex, r, c);
      if (cell && cell.text.trim()) {
        if (isClauseNumber(cell.text)) return cell.text.trim();
        lastNonEmpty = cell.text.trim();
      }
    }
  }
  return lastNonEmpty;
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
