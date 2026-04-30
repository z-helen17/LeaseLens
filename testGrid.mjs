import { readFile } from 'fs/promises';
import { buildDocumentGrid } from './src/utils/buildDocumentGrid.js';

const filePath = 'C:\\Users\\zoita\\OneDrive\\Documents\\LeaseLens Demo\\Template_Arc Development_LA_LL FOW (003).docx';

const buffer = await readFile(filePath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const grid = await buildDocumentGrid(arrayBuffer);

const totalRows = grid.tables.reduce((sum, t) => sum + t.rows.length, 0);
const totalCells = grid.tables.reduce((sum, t) => t.rows.reduce((rs, r) => rs + r.cells.length, sum), 0);

console.log('=== TABLES ===');
console.log('Total tables:', grid.tables.length);
console.log('Total rows (all tables):', totalRows);
console.log('Total cells (all tables):', totalCells);

console.log('\n=== FIRST 3 ROWS OF TABLE 0 ===');
if (grid.tables.length > 0) {
  const t0 = grid.tables[0];
  const preview = t0.rows.slice(0, 3);
  for (const row of preview) {
    console.log(`  Row ${row.rowIndex}:`);
    for (const cell of row.cells) {
      console.log(`    [${cell.ref}] "${cell.text}"`);
    }
  }
} else {
  console.log('  (no tables found)');
}

console.log('\n=== BODY PARAGRAPHS ===');
console.log('Total body paragraphs:', grid.bodyParagraphs.length);
console.log('\nFirst 5:');
for (const para of grid.bodyParagraphs.slice(0, 5)) {
  console.log(`  [${para.paraIndex}] "${para.text}"`);
}

// Show first-column content of table 1, first 60 rows — to understand numbering pattern
const t1 = grid.tables[1];
if (t1) {
  console.log('\n=== TABLE 1, ALL COLUMNS, ROWS 0-30 ===');
  for (let r = 0; r < 30 && r < t1.rows.length; r++) {
    const nonEmpty = t1.rows[r].cells.filter(c => c.text.trim());
    if (nonEmpty.length) {
      console.log(`Row ${r}: ` + nonEmpty.map(c => `[${c.ref}] "${c.text.trim().slice(0, 60)}"`).join(' | '));
    }
  }
}
