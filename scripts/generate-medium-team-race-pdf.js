const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const COLORS = {
    navy: '#122033',
    gold: '#D4AF37',
    white: '#FFFFFF',
    gray: '#6B7280',
    light: '#F5F7FA',
    border: '#D1D5DB',
    accent: '#E5EEF9',
};

const RANGES = [
    { idx: 0, level: '1', range: '0 - 344' },
    { idx: 1, level: '2', range: '345 - 436' },
    { idx: 2, level: '3', range: '437 - 499' },
    { idx: 3, level: '4', range: '500 - 561' },
    { idx: 4, level: '5', range: '562 - 624' },
    { idx: 5, level: '6', range: '625 - 686' },
    { idx: 6, level: '7', range: '687 - 749' },
    { idx: 7, level: '8', range: '750 - 875' },
    { idx: 8, level: '9', range: '876+' },
];

const MATRIX_8BALL = [
    [[3, 3], [3, 3], [3, 4], [3, 4], [2, 5], [2, 5], [2, 6], [2, 6], [2, 5]],
    [[4, 2], [4, 3], [4, 3], [3, 4], [3, 4], [3, 5], [2, 5], [2, 5], [2, 6]],
    [[5, 2], [4, 3], [4, 3], [3, 4], [3, 4], [3, 5], [3, 5], [2, 5], [2, 6]],
    [[5, 2], [4, 3], [4, 3], [4, 4], [4, 4], [3, 5], [3, 5], [3, 5], [2, 6]],
    [[5, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 5], [3, 5], [3, 5], [3, 6]],
    [[5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [4, 4], [4, 5], [4, 5], [3, 6]],
    [[6, 2], [5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [4, 4], [4, 5], [4, 6]],
    [[6, 2], [5, 2], [5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 5], [5, 6]],
    [[5, 2], [6, 2], [6, 2], [6, 2], [6, 3], [6, 3], [6, 4], [6, 5], [6, 6]],
];

const MATRIX_9BALL = [
    [[3, 3], [3, 3], [3, 3], [3, 4], [3, 4], [2, 5], [2, 5], [2, 7], [2, 6]],
    [[4, 2], [4, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [2, 7], [2, 7]],
    [[4, 2], [4, 3], [4, 3], [3, 4], [3, 5], [3, 5], [3, 6], [2, 7], [2, 7]],
    [[5, 2], [4, 3], [4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 7], [3, 7]],
    [[5, 2], [5, 3], [5, 3], [5, 4], [5, 5], [4, 5], [4, 6], [4, 7], [3, 7]],
    [[5, 2], [5, 4], [5, 4], [5, 4], [5, 4], [5, 5], [5, 6], [4, 7], [4, 7]],
    [[5, 2], [6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 7], [4, 7]],
    [[7, 2], [7, 2], [6, 3], [7, 4], [7, 4], [7, 5], [7, 5], [6, 6], [6, 6]],
    [[6, 2], [7, 2], [7, 2], [7, 2], [7, 3], [7, 4], [7, 4], [7, 5], [8, 7]],
];

const outputDir = path.join(__dirname, '..', 'documents');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'Breakpoint_Team_Medium_Race_Charts.pdf');
const doc = new PDFDocument({
    size: 'LETTER',
    layout: 'landscape',
    margins: { top: 36, bottom: 32, left: 32, right: 32 },
});

doc.pipe(fs.createWriteStream(outputPath));

function drawHeader(title, subtitle) {
    doc.rect(0, 0, doc.page.width, 82).fill(COLORS.navy);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(24)
        .text(title, 32, 20, { align: 'center' });
    doc.fillColor(COLORS.gold).font('Helvetica').fontSize(12)
        .text(subtitle, 32, 52, { align: 'center' });
}

function drawRatingTable(y) {
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(14)
        .text('Breakpoint Levels And Rating Ranges', 32, y);
    y += 24;

    const x = 32;
    const rowH = 22;
    const col1 = 80;
    const col2 = 120;
    const col3 = 140;

    doc.fillColor(COLORS.gray).font('Helvetica-Bold').fontSize(10);
    doc.text('Index', x, y);
    doc.text('Level', x + col1, y);
    doc.text('Breakpoint Rating', x + col1 + col2, y);
    y += 16;

    RANGES.forEach((row, idx) => {
        if (idx % 2 === 0) {
            doc.rect(x - 4, y - 3, col1 + col2 + col3 + 16, rowH).fill(COLORS.light);
        }
        doc.fillColor(COLORS.navy).font('Helvetica').fontSize(10);
        doc.text(String(row.idx), x, y);
        doc.text(row.level, x + col1, y);
        doc.text(row.range, x + col1 + col2, y);
        y += rowH;
    });

    return y + 8;
}

function drawMatrix(title, matrix, yStart) {
    let y = yStart;
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(15)
        .text(title, 32, y);
    y += 22;

    const startX = 120;
    const cellW = 58;
    const cellH = 28;

    doc.fillColor(COLORS.gray).font('Helvetica-Bold').fontSize(9);
    doc.text('P1 \\ P2', 36, y + 8);

    for (let c = 0; c < RANGES.length; c += 1) {
        const x = startX + c * cellW;
        doc.rect(x, y, cellW, cellH).fill(COLORS.accent);
        doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(9)
            .text(`L${RANGES[c].level}`, x, y + 4, { width: cellW, align: 'center' });
        doc.font('Helvetica').fontSize(7)
            .text(RANGES[c].range, x + 2, y + 14, { width: cellW - 4, align: 'center' });
    }

    for (let r = 0; r < RANGES.length; r += 1) {
        const rowY = y + cellH + r * cellH;
        doc.rect(32, rowY, 84, cellH).fill(COLORS.accent);
        doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(9)
            .text(`L${RANGES[r].level}`, 32, rowY + 4, { width: 84, align: 'center' });
        doc.font('Helvetica').fontSize(7)
            .text(RANGES[r].range, 34, rowY + 14, { width: 80, align: 'center' });

        for (let c = 0; c < RANGES.length; c += 1) {
            const x = startX + c * cellW;
            const race = matrix[r][c];
            const isEvenCell = r === c;
            doc.rect(x, rowY, cellW, cellH)
                .fill(isEvenCell ? '#FFF6DB' : COLORS.white)
                .stroke(COLORS.border);
            doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11)
                .text(`${race[0]} / ${race[1]}`, x, rowY + 8, { width: cellW, align: 'center' });
        }
    }

    return y + cellH * 10 + 18;
}

drawHeader(
    'Breakpoint Team League Medium-Short Race Charts',
    'Middle-ground proposal: shorter than singles, but closer in feel than the current short matrix'
);

let currentY = 96;
currentY = drawRatingTable(currentY);
currentY = drawMatrix('8-Ball Medium-Short Matrix', MATRIX_8BALL, currentY);
drawMatrix('9-Ball Medium-Short Matrix', MATRIX_9BALL, currentY);

doc.fillColor(COLORS.gray).font('Helvetica').fontSize(9)
    .text(`Generated ${new Date().toLocaleString('en-US')}`, 32, doc.page.height - 24);

doc.end();
console.log(outputPath);
