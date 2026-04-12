const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const COLORS = {
    ink: '#1F2937',
    muted: '#6B7280',
    line: '#D1D5DB',
    panel: '#F9FAFB',
    header: '#0F172A',
    gold: '#D4AF37',
    even: '#FEF3C7',
    white: '#FFFFFF',
};

const LEVELS = [
    { idx: 0, level: '1', rating: '0-344' },
    { idx: 1, level: '2', rating: '345-436' },
    { idx: 2, level: '3', rating: '437-499' },
    { idx: 3, level: '4', rating: '500-561' },
    { idx: 4, level: '5', rating: '562-624' },
    { idx: 5, level: '6', rating: '625-686' },
    { idx: 6, level: '7', rating: '687-749' },
    { idx: 7, level: '8', rating: '750-875' },
    { idx: 8, level: '9', rating: '876+' },
];

const MATRIX_8 = [
    [[3, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5], [2, 6], [2, 6], [2, 6]],
    [[3, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 5], [2, 5], [2, 5], [2, 6]],
    [[4, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [2, 5], [2, 6]],
    [[4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [3, 5], [3, 5], [3, 5], [2, 6]],
    [[5, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 5], [3, 5], [3, 5], [3, 6]],
    [[5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [4, 4], [4, 5], [4, 5], [3, 6]],
    [[6, 2], [5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [4, 4], [4, 5], [4, 6]],
    [[6, 2], [5, 2], [5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 5], [5, 6]],
    [[6, 2], [6, 2], [6, 2], [6, 2], [6, 3], [6, 3], [6, 4], [6, 5], [6, 6]],
];

const MATRIX_9 = [
    [[3, 3], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5], [2, 7], [2, 7]],
    [[3, 2], [3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [2, 7], [2, 7]],
    [[3, 2], [4, 3], [3, 3], [3, 4], [3, 5], [3, 5], [3, 6], [2, 7], [2, 7]],
    [[4, 2], [4, 3], [4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 7], [3, 7]],
    [[4, 2], [5, 3], [5, 3], [5, 4], [5, 5], [4, 5], [4, 6], [4, 7], [3, 7]],
    [[5, 2], [5, 4], [5, 4], [5, 4], [5, 4], [5, 5], [5, 6], [4, 7], [4, 7]],
    [[5, 2], [6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 7], [4, 7]],
    [[7, 2], [7, 2], [6, 3], [7, 4], [7, 4], [7, 5], [7, 5], [6, 6], [6, 7]],
    [[7, 2], [7, 2], [7, 2], [7, 2], [7, 3], [7, 4], [7, 4], [7, 6], [8, 8]],
];

const outputDir = path.join(__dirname, '..', 'documents');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'Breakpoint_Team_Medium_Short_Race_Charts_v2.pdf');

const doc = new PDFDocument({
    size: 'LETTER',
    layout: 'landscape',
    margins: { top: 28, bottom: 28, left: 28, right: 28 },
});

doc.pipe(fs.createWriteStream(outputPath));

function pageHeader(title, subtitle) {
    doc.rect(0, 0, doc.page.width, 66).fill(COLORS.header);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(24)
        .text(title, 28, 16, { align: 'center' });
    doc.fillColor(COLORS.gold).font('Helvetica').fontSize(11)
        .text(subtitle, 28, 44, { align: 'center' });
}

function legendPage() {
    pageHeader(
        'Breakpoint Team League Medium-Short Races',
        'Second-pass proposal: keep singles feel, shorten team races moderately'
    );

    let y = 88;
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(15)
        .text('Breakpoint Levels', 28, y);
    y += 24;

    const x = 40;
    const colW = [70, 80, 120];
    const rowH = 24;

    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(11);
    doc.text('Index', x, y);
    doc.text('Level', x + colW[0], y);
    doc.text('Rating Range', x + colW[0] + colW[1], y);
    y += 18;

    LEVELS.forEach((row, idx) => {
        if (idx % 2 === 0) {
            doc.rect(x - 6, y - 4, 290, rowH).fill(COLORS.panel);
        }
        doc.fillColor(COLORS.ink).font('Helvetica').fontSize(11);
        doc.text(String(row.idx), x, y);
        doc.text(row.level, x + colW[0], y);
        doc.text(row.rating, x + colW[0] + colW[1], y);
        y += rowH;
    });

    y += 16;
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(15)
        .text('How To Read', 28, y);
    y += 22;
    doc.fillColor(COLORS.ink).font('Helvetica').fontSize(12)
        .text('Rows are Player 1 level. Columns are Player 2 level. Each cell is shown as "P1 race / P2 race".', 28, y);
    y += 24;
    doc.text('This version is intentionally more conservative than the current short matrix.', 28, y);
    y += 18;
    doc.text('Idea: make team sets noticeably shorter without turning too many matchups into sprint races.', 28, y);
}

function drawMatrixPage(title, matrix) {
    doc.addPage();
    pageHeader(title, 'Highlighted diagonal cells are even matchups');

    const startX = 140;
    const startY = 100;
    const leftLabelW = 90;
    const cellW = 62;
    const cellH = 34;

    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(11);
    doc.text('P1 \\ P2', 38, startY + 10);

    for (let c = 0; c < LEVELS.length; c += 1) {
        const x = startX + c * cellW;
        doc.rect(x, startY, cellW, cellH).fill(COLORS.panel).stroke(COLORS.line);
        doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10)
            .text(`L${LEVELS[c].level}`, x, startY + 6, { width: cellW, align: 'center' });
        doc.font('Helvetica').fontSize(8)
            .text(LEVELS[c].rating, x, startY + 18, { width: cellW, align: 'center' });
    }

    for (let r = 0; r < LEVELS.length; r += 1) {
        const y = startY + cellH + r * cellH;
        doc.rect(38, y, leftLabelW, cellH).fill(COLORS.panel).stroke(COLORS.line);
        doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10)
            .text(`L${LEVELS[r].level}`, 38, y + 6, { width: leftLabelW, align: 'center' });
        doc.font('Helvetica').fontSize(8)
            .text(LEVELS[r].rating, 38, y + 18, { width: leftLabelW, align: 'center' });

        for (let c = 0; c < LEVELS.length; c += 1) {
            const x = startX + c * cellW;
            doc.rect(x, y, cellW, cellH)
                .fill(r === c ? COLORS.even : COLORS.white)
                .stroke(COLORS.line);
            doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(12)
                .text(`${matrix[r][c][0]} / ${matrix[r][c][1]}`, x, y + 10, { width: cellW, align: 'center' });
        }
    }
}

legendPage();
drawMatrixPage('8-Ball Medium-Short Matrix', MATRIX_8);
drawMatrixPage('9-Ball Medium-Short Matrix', MATRIX_9);

doc.end();
console.log(outputPath);
