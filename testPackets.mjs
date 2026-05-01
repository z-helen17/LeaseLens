import { readFile } from 'fs/promises';
import PizZip from 'pizzip';
import { buildDocumentGrid, buildClausePackets, extractLeadingClauseNumber } from './src/utils/buildDocumentGrid.js';

const filePath = 'C:\\Users\\zoita\\leaselens\\Template_Arc Development_LA_LL FOW (003).docx';

const nodeBuffer = await readFile(filePath);
const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);

const grid = await buildDocumentGrid(arrayBuffer);
const packets = buildClausePackets(grid);

console.log('Total packet count:', packets.length);
console.log('\nFirst 15 packets:');
for (const p of packets.slice(0, 15)) {
  console.log({
    number: p.number,
    numberRef: p.numberRef,
    textRef: p.textRef,
    text: p.text.slice(0, 80),
  });
}

const withNumber = packets.filter(p => p.number !== null).length;
const withoutNumber = packets.filter(p => p.number === null).length;
console.log('\nPackets with non-null number:', withNumber);
console.log('Packets with null number:', withoutNumber);

// ── DIAG A: computedNumber coverage across all cells ─────────────────────────

console.log('\n── DIAG A: computedNumber coverage ──');
let totalCells = 0, computedCells = 0;
for (const table of grid.tables) {
  for (const row of table.rows) {
    for (const cell of row.cells) {
      totalCells++;
      if (cell.computedNumber != null) computedCells++;
    }
  }
}
console.log(`  Total cells: ${totalCells}`);
console.log(`  Cells with computedNumber: ${computedCells}`);
console.log(`  Cells without computedNumber: ${totalCells - computedCells}`);

// ── DIAG B: first 20 cells (any table) that have a computedNumber ─────────────

console.log('\n── DIAG B: first 20 cells with computedNumber ──');
let shown = 0;
outer: for (const table of grid.tables) {
  for (const row of table.rows) {
    for (const cell of row.cells) {
      if (cell.computedNumber != null) {
        console.log(`  ${cell.ref}: computedNumber=${JSON.stringify(cell.computedNumber)} | text="${cell.text.slice(0, 60)}"`);
        if (++shown >= 20) break outer;
      }
    }
  }
}

// ── DIAG C: numbering sequence — rows 90-130 of largest table, col 0 ─────────

const largestTable = grid.tables.reduce((a, b) => b.rows.length > a.rows.length ? b : a);
console.log(`\n── DIAG C: numbering sequence — t${largestTable.tableIndex} rows 90-130 col 0 ──`);
for (let ri = 90; ri <= 130; ri++) {
  const row = largestTable.rows[ri];
  if (!row) continue;
  const c0 = row.cells.find(c => c.colIndex === 0);
  if (!c0) continue;
  console.log(`  r${ri}c0: computedNumber=${JSON.stringify(c0.computedNumber)} | text="${c0.text.slice(0, 60)}"`);
}

// ── DIAG D: 10 packets from middle showing number progression ─────────────────

console.log('\n── DIAG D: 10 packets from middle showing number progression ──');
const mid = Math.floor(packets.length / 2);
for (const p of packets.slice(mid - 5, mid + 5)) {
  console.log({
    number: p.number,
    numberRef: p.numberRef,
    textRef: p.textRef,
    text: p.text.slice(0, 80),
  });
}

// ── DIAG E: first 5 packets with non-null number ──────────────────────────────

console.log('\n── DIAG E: first 5 packets with non-null number ──');
const numbered = packets.filter(p => p.number !== null);
for (const p of numbered.slice(0, 5)) {
  console.log({ number: p.number, numberRef: p.numberRef, textRef: p.textRef, text: p.text.slice(0, 80) });
}
