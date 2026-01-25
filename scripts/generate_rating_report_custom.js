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
    border: '#cccccc',
    green: '#4caf50',
    red: '#f44336'
};

// Data
const DATA = [
    {
        player: "Cory Michael",
        currentRating: 478.1,
        opponent: "Jacob Gatewood",
        opponentRating: 528.7,
        result: "Loss",
        kFactor: 15,
        matchDate: "2026-01-24" // Date from DB
    },
    {
        player: "Faithe Newcomb",
        currentRating: 502.2,
        opponent: "James Grant",
        opponentRating: 503.1,
        result: "Loss",
        kFactor: 15,
        matchDate: "2026-01-24" // Date from DB
    }
];

// Helper to calculate change
function calculateChange(playerRating, opponentRating, result) {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = result === "Win" ? 1 : 0;
    const K = result === "Win" ? 30 : 15; // K is 30 for win, 15 for loss in BBRS

    const change = K * (actualScore - expectedScore);
    return {
        change: Math.round(change * 10) / 10, // Round to 1 decimal
        expectedWinRate: (expectedScore * 100).toFixed(1) + '%'
    };
}

// Setup
const outputDir = path.join(__dirname, '..', 'documents');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const doc = new PDFDocument({ size: 'LETTER', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
const outputPath = path.join(outputDir, 'Rating_Change_Report.pdf');
doc.pipe(fs.createWriteStream(outputPath));

// Header
function drawHeader(title) {
    doc.rect(0, 0, doc.page.width, 100).fill(COLS.primary);
    doc.fillColor(COLS.white).fontSize(28).font('Helvetica-Bold')
        .text('BREAKPOINT BILLIARDS', 40, 30, { align: 'center' });
    doc.fillColor(COLS.gold).fontSize(16).font('Helvetica')
        .text(title, 40, 65, { align: 'center' });
    doc.fillColor(COLS.grey).fontSize(10).font('Helvetica-Oblique')
        .text('Generated Report for User Request', 40, 85, { align: 'center' });
}

drawHeader('Rating Change Explanation');

let y = 140;

DATA.forEach(d => {
    // Calculate logic
    // We assume the current rating is the rating AFTER the match.
    // So Pre-Match Rating = Current - Change.
    // Iterative approximation or just use current for estimate.
    // For specific report, let's just show the impact of the last match based on current numbers.

    const calculation = calculateChange(d.currentRating, d.opponentRating, d.result);
    const sign = calculation.change > 0 ? '+' : '';
    const color = calculation.change >= 0 ? COLS.green : COLS.red;

    // Section Header
    doc.rect(40, y, 530, 30).fill(COLS.lightGrey);
    doc.fillColor(COLS.primary).fontSize(14).font('Helvetica-Bold')
        .text(d.player, 50, y + 8);
    y += 45;

    // Match Info
    doc.fillColor(COLS.grey).fontSize(10).font('Helvetica')
        .text(`vs ${d.opponent} (${d.opponentRating})`, 50, y);

    doc.fillColor(d.result === 'Win' ? COLS.green : COLS.red).font('Helvetica-Bold')
        .text(d.result.toUpperCase(), 400, y, { align: 'right', width: 160 });

    y += 20;

    // Explanation
    doc.fillColor(COLS.primary).fontSize(12).font('Helvetica')
        .text(`Rating Change: `, 50, y);
    doc.fillColor(color).font('Helvetica-Bold')
        .text(`${sign}${calculation.change}`, 140, y);

    y += 20;
    doc.fillColor(COLS.grey).fontSize(10).font('Helvetica')
        .text(`Expected Win Probability: ${calculation.expectedWinRate}`, 50, y);

    y += 15;
    doc.text(`Current Rating: ${d.currentRating}`, 50, y);

    // Divider
    y += 40;
    doc.moveTo(40, y).lineTo(570, y).strokeColor(COLS.border).stroke();
    y += 20;
});

// Summary Footer
y += 20;
doc.fillColor(COLS.primary).fontSize(12).font('Helvetica-Bold')
    .text("Summary:", 40, y);
y += 20;
doc.fontSize(10).font('Helvetica')
    .text("Both players suffered a loss in their most recent completed match, resulting in a rating decrease. The decrease amount depends on the rating difference between them and their opponent.", 40, y, { width: 530 });

doc.end();
console.log(`PDF Generated: ${outputPath}`);
