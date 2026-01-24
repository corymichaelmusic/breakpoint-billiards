const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Colors
const COLS = {
    primary: '#1a1a2e',
    accent: '#e94560',
    gold: '#d4af37',
    white: '#ffffff',
    grey: '#666666',
    lightGrey: '#f8f9fa',
    border: '#cccccc'
};

// Data
const RANGES = [
    { idx: 0, range: '0 - 344', desc: 'Beginner' },
    { idx: 1, range: '345 - 436', desc: 'Intermediate' },
    { idx: 2, range: '437 - 499', desc: 'Intermediate+' },
    { idx: 3, range: '500 - 561', desc: 'Good League Player' },
    { idx: 4, range: '562 - 624', desc: 'Advanced' },
    { idx: 5, range: '625 - 686', desc: 'Advanced+' },
    { idx: 6, range: '687 - 749', desc: 'Semi-Pro' },
    { idx: 7, range: '750 - 875', desc: 'Top Regional' },
    { idx: 8, range: '876 - 1000+', desc: 'World Class' }
];

// Matrix Data (Row = P1, Col = P2) -> [P1 Race, P2 Race]
const MATRIX_8BALL = [
    [[3, 3], [3, 4], [3, 5], [3, 5], [3, 6], [3, 6], [3, 7], [3, 7], [2, 7]],
    [[4, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 6], [3, 6], [3, 6], [3, 7]],
    [[5, 3], [4, 4], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [3, 6], [3, 7]],
    [[5, 3], [5, 4], [5, 4], [5, 5], [5, 5], [4, 6], [4, 6], [4, 6], [3, 7]],
    [[6, 3], [5, 4], [5, 4], [5, 5], [5, 5], [5, 6], [4, 6], [4, 6], [4, 7]],
    [[6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [5, 6], [4, 7]],
    [[7, 3], [6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [5, 7]],
    [[7, 3], [6, 3], [6, 3], [6, 4], [6, 4], [6, 5], [6, 5], [6, 6], [6, 7]],
    [[7, 2], [7, 3], [7, 3], [7, 3], [7, 4], [7, 4], [7, 5], [7, 6], [7, 7]]
];

const MATRIX_9BALL = [
    [[3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [3, 6], [3, 8], [2, 8]],
    [[4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [4, 7], [3, 8], [3, 8]],
    [[4, 3], [5, 4], [4, 4], [4, 5], [4, 6], [4, 6], [4, 7], [3, 8], [3, 8]],
    [[5, 3], [5, 4], [5, 4], [5, 5], [5, 6], [5, 6], [5, 7], [5, 8], [4, 8]],
    [[5, 3], [6, 4], [6, 4], [6, 5], [6, 6], [5, 6], [5, 7], [5, 8], [4, 8]],
    [[6, 3], [6, 5], [6, 5], [6, 5], [6, 5], [6, 6], [6, 7], [5, 8], [5, 8]],
    [[6, 3], [7, 4], [7, 5], [7, 5], [7, 5], [7, 6], [6, 6], [6, 8], [5, 8]],
    [[8, 3], [8, 3], [7, 4], [8, 5], [8, 5], [8, 6], [8, 6], [7, 7], [7, 8]],
    [[8, 2], [8, 3], [8, 3], [8, 3], [8, 4], [8, 5], [8, 5], [8, 7], [9, 9]]
];

// Setup
const outputDir = path.join(__dirname, '..', 'documents');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const doc = new PDFDocument({ size: 'LETTER', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
const outputPath = path.join(outputDir, 'Breakpoint_Race_Charts.pdf');
doc.pipe(fs.createWriteStream(outputPath));

// --- Helpers ---
function drawHeader(title) {
    doc.rect(0, 0, doc.page.width, 100).fill(COLS.primary);
    doc.fillColor(COLS.white).fontSize(28).font('Helvetica-Bold')
        .text('BREAKPOINT BILLIARDS', 40, 30, { align: 'center' });
    doc.fillColor(COLS.gold).fontSize(16).font('Helvetica')
        .text(title, 40, 65, { align: 'center' });
    doc.fillColor(COLS.grey).fontSize(10).font('Helvetica-Oblique')
        .text('Based on the Breakpoint Billiards Rating System (BBRS)', 40, 85, { align: 'center' });
}

function drawRangeTable(yStart) {
    let y = yStart;

    // Header
    doc.fillColor(COLS.primary).fontSize(14).font('Helvetica-Bold').text('Rating Ranges', 40, y);
    y += 20;

    // Table Header
    doc.fillColor(COLS.grey).fontSize(10).font('Helvetica-Bold');
    doc.text('INDEX', 40, y);
    doc.text('RATING RANGE', 100, y);
    doc.text('DESCRIPTION', 250, y);

    y += 15;
    doc.moveTo(40, y).lineTo(570, y).strokeColor(COLS.border).lineWidth(1).stroke();
    y += 5;

    // Rows
    RANGES.forEach((r, i) => {
        const bg = i % 2 === 0 ? COLS.lightGrey : COLS.white;
        doc.rect(40, y - 5, 530, 20).fill(bg);

        doc.fillColor(COLS.primary).fontSize(10).font('Helvetica');
        doc.text(r.idx.toString(), 40, y);
        doc.text(r.range, 100, y);
        doc.text(r.desc, 250, y); // Removed Fargo ref
        y += 20;
    });

    return y + 20;
}

function drawMatrix(title, matrix, yStart) {
    let y = yStart;

    // Check page break
    if (y + 300 > doc.page.height) {
        doc.addPage();
        drawHeader('Official Race Charts');
        y = 120;
    }

    doc.fillColor(COLS.primary).fontSize(16).font('Helvetica-Bold').text(title, 40, y);
    y += 30;

    const cellSize = 50;
    const startX = 80;

    // Column Headers (P2 Index)
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLS.primary);
    doc.text('P1 \\ P2', 40, y + 10);

    for (let c = 0; c < 9; c++) {
        doc.text(c.toString(), startX + (c * cellSize) + 20, y, { width: cellSize, align: 'center' });
        doc.fontSize(8).fillColor(COLS.grey).text(RANGES[c].range, startX + (c * cellSize), y + 12, { width: cellSize, align: 'center' });
    }
    y += 30;
    doc.moveTo(40, y).lineTo(startX + (9 * cellSize), y).strokeColor(COLS.border).stroke();

    // Rows
    for (let r = 0; r < 9; r++) {
        const rowY = y + (r * 30);

        // Row Header (P1 Index)
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COLS.primary);
        doc.text(r.toString(), 50, rowY + 10);

        // Cells
        for (let c = 0; c < 9; c++) {
            const race = matrix[r][c]; // [p1, p2]
            const text = `${race[0]} / ${race[1]}`;

            // Highlight diagonal (even race usually, but broadly diagonal)
            if (r === c) doc.rect(startX + (c * cellSize), rowY, cellSize, 30).fill('#f0f0f0');

            doc.fillColor(COLS.primary).fontSize(10).font('Helvetica');
            doc.text(text, startX + (c * cellSize), rowY + 10, { width: cellSize, align: 'center' });
        }

        doc.moveTo(40, rowY + 30).lineTo(startX + (9 * cellSize), rowY + 30).strokeColor('#eeeeee').stroke();
    }

    return y + (9 * 30) + 40;
}


// --- Execute ---
drawHeader('Official Race Charts');
let currentY = 120; // Start below header

currentY = drawRangeTable(currentY);
currentY = drawMatrix('8-Ball Race Matrix', MATRIX_8BALL, currentY);
drawMatrix('9-Ball Race Matrix', MATRIX_9BALL, currentY);

// Footer
doc.fillColor(COLS.grey).fontSize(9).text('Generated by Breakpoint Billiards System', 40, 750, { align: 'center' });

doc.end();
console.log(`PDF Generated: ${outputPath}`);
