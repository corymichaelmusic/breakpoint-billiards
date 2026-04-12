const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const COLORS = {
    header: '#111827',
    text: '#1F2937',
    muted: '#6B7280',
    border: '#D1D5DB',
    panel: '#F3F4F6',
    even: '#FEF3C7',
    white: '#FFFFFF',
    gold: '#D4AF37',
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
    [[3, 3], [2, 4], [2, 4], [2, 4], [2, 5], [2, 5], [2, 5], [2, 5], [2, 5]],
    [[3, 3], [3, 3], [3, 3], [3, 4], [3, 4], [3, 5], [2, 5], [2, 5], [2, 5]],
    [[4, 2], [3, 3], [3, 3], [3, 4], [3, 4], [3, 5], [3, 5], [2, 5], [2, 5]],
    [[4, 2], [4, 3], [4, 3], [4, 4], [4, 4], [3, 5], [3, 5], [3, 5], [2, 5]],
    [[5, 2], [4, 3], [4, 3], [4, 4], [4, 4], [4, 5], [3, 5], [3, 5], [3, 5]],
    [[5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [4, 4], [4, 5], [4, 5], [3, 5]],
    [[5, 2], [5, 2], [5, 3], [5, 3], [5, 3], [5, 4], [4, 4], [4, 5], [4, 5]],
    [[5, 2], [5, 2], [5, 2], [5, 3], [5, 3], [5, 4], [5, 4], [5, 5], [5, 5]],
    [[5, 2], [5, 2], [5, 2], [5, 2], [5, 3], [5, 3], [5, 4], [5, 5], [5, 5]],
];

const MATRIX_9 = [
    [[3, 3], [3, 4], [3, 4], [2, 5], [2, 5], [2, 5], [2, 5], [2, 6], [2, 6]],
    [[4, 3], [3, 4], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [2, 6], [2, 6]],
    [[4, 3], [4, 3], [3, 4], [3, 4], [3, 5], [3, 5], [3, 6], [2, 6], [2, 6]],
    [[4, 3], [4, 3], [4, 3], [4, 4], [4, 5], [4, 5], [4, 6], [4, 6], [3, 6]],
    [[4, 3], [5, 3], [5, 3], [5, 4], [5, 5], [4, 5], [4, 6], [4, 6], [3, 6]],
    [[5, 2], [5, 4], [5, 4], [5, 4], [5, 4], [5, 5], [5, 6], [4, 6], [4, 6]],
    [[5, 2], [6, 3], [6, 4], [6, 4], [6, 4], [6, 5], [5, 5], [5, 6], [4, 6]],
    [[6, 2], [6, 2], [6, 3], [6, 4], [6, 4], [6, 5], [6, 5], [6, 6], [6, 6]],
    [[6, 2], [6, 2], [6, 2], [6, 2], [6, 3], [6, 4], [6, 4], [6, 6], [6, 6]],
];

const outputDir = path.join(__dirname, '..', 'documents');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'Breakpoint_Team_Capped_Race_Charts.pdf');

const doc = new PDFDocument({
    size: 'LETTER',
    layout: 'landscape',
    margins: { top: 28, bottom: 28, left: 28, right: 28 },
});
doc.pipe(fs.createWriteStream(outputPath));

function header(title, subtitle) {
    doc.rect(0, 0, doc.page.width, 64).fill(COLORS.header);
    doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(24)
        .text(title, 28, 16, { align: 'center' });
    doc.fillColor(COLORS.gold).font('Helvetica').fontSize(11)
        .text(subtitle, 28, 44, { align: 'center' });
}

function legendPage() {
    header(
        'Breakpoint Team League Capped Race Charts',
        '8-ball capped at 6, 9-ball capped at 7'
    );

    let y = 92;
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(15)
        .text('Levels And Breakpoint Rating Ranges', 28, y);
    y += 26;

    const x = 38;
    const col1 = 70;
    const col2 = 80;
    const col3 = 120;

    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(11);
    doc.text('Index', x, y);
    doc.text('Level', x + col1, y);
    doc.text('Breakpoint Rating', x + col1 + col2, y);
    y += 18;

    LEVELS.forEach((row, idx) => {
        if (idx % 2 === 0) {
            doc.rect(x - 6, y - 4, 290, 24).fill(COLORS.panel);
        }
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(11);
        doc.text(String(row.idx), x, y);
        doc.text(row.level, x + col1, y);
        doc.text(row.rating, x + col1 + col2, y);
        y += 24;
    });

    y += 18;
    doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(14)
        .text('Notes', 28, y);
    y += 22;
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(12)
        .text('Rows are Player 1 level. Columns are Player 2 level. Cells are shown as "P1 race / P2 race".', 28, y);
    y += 20;
    doc.text('This version uses hard ceilings: no 8-ball race above 6, and no 9-ball race above 7.', 28, y);
}

function matrixPage(title, matrix) {
    doc.addPage();
    header(title, 'Diagonal cells highlighted for even matchups');

    const startX = 140;
    const startY = 100;
    const labelW = 92;
    const cellW = 62;
    const cellH = 34;

    doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(11);
    doc.text('P1 \\ P2', 40, startY + 10);

    for (let c = 0; c < LEVELS.length; c += 1) {
        const x = startX + c * cellW;
        doc.rect(x, startY, cellW, cellH).fill(COLORS.panel).stroke(COLORS.border);
        doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
            .text(`L${LEVELS[c].level}`, x, startY + 6, { width: cellW, align: 'center' });
        doc.font('Helvetica').fontSize(8)
            .text(LEVELS[c].rating, x, startY + 18, { width: cellW, align: 'center' });
    }

    for (let r = 0; r < LEVELS.length; r += 1) {
        const y = startY + cellH + r * cellH;
        doc.rect(40, y, labelW, cellH).fill(COLORS.panel).stroke(COLORS.border);
        doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(10)
            .text(`L${LEVELS[r].level}`, 40, y + 6, { width: labelW, align: 'center' });
        doc.font('Helvetica').fontSize(8)
            .text(LEVELS[r].rating, 40, y + 18, { width: labelW, align: 'center' });

        for (let c = 0; c < LEVELS.length; c += 1) {
            const x = startX + c * cellW;
            doc.rect(x, y, cellW, cellH)
                .fill(r === c ? COLORS.even : COLORS.white)
                .stroke(COLORS.border);
            doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
                .text(`${matrix[r][c][0]} / ${matrix[r][c][1]}`, x, y + 10, { width: cellW, align: 'center' });
        }
    }
}

legendPage();
matrixPage('8-Ball Capped Matrix', MATRIX_8);
matrixPage('9-Ball Capped Matrix', MATRIX_9);

doc.end();
console.log(outputPath);
