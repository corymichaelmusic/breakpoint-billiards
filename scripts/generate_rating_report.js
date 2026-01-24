const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('Rating_Analysis_Report.pdf'));

// Styles
const titleSize = 24;
const headerSize = 18;
const bodySize = 12;

// Data
const matches = [
    {
        title: "Match 1: James Grant vs Faithe Newcomb",
        segments: [
            {
                type: "8-Ball Set",
                p1: "James Grant", p2: "Faithe Newcomb",
                startRatingP1: 500, startRatingP2: 500,
                scoreP1: 3, scoreP2: 3,
                winner: "Faithe Newcomb",
                deltaP1: -14.00, deltaP2: +14.00,
                explanation: "This game ended in a 3-3 tie, but Faithe won the tiebreaker (likely a coin flip). Since both players had the exact same rating (500), the system acted as if it was a standard win. Faithe received the standard points for a win (+14) and James lost the standard amount (-14)."
            },
            {
                type: "9-Ball Set",
                p1: "James Grant", p2: "Faithe Newcomb",
                startRatingP1: 486, startRatingP2: 514,
                scoreP1: 7, scoreP2: 1,
                winner: "James Grant",
                deltaP1: "+17.10", deltaP2: "-13.23",
                explanation: "James played an amazing set here. Not only did he beat a higher-rated player (Faithe was 514, James was 486), but he also won by a huge margin (7-1). The system rewarded him with extra points for the 'upset' victory and a 'performance bonus' for dominating the score. Faithe lost points, but slightly less than expected because the system protects higher-rated players when they lose."
            }
        ]
    },
    {
        title: "Match 2: Cory Michael vs Jacob Gatewood",
        segments: [
            {
                type: "8-Ball Set",
                p1: "Cory Michael", p2: "Jacob Gatewood",
                startRatingP1: 500, startRatingP2: 500,
                scoreP1: 3, scoreP2: 6,
                winner: "Jacob Gatewood",
                deltaP1: -12.60, deltaP2: "+15.40",
                explanation: "Both players started even at 500. Jacob won decisively (6-3). He got the standard win points (+14) plus a small bonus (+1.4) for winning by a solid margin. Cory lost points, but because he managed to win 3 racks and keep the score somewhat close, the system was lenient and didn't deduct the full amount, so he only lost 12.6 points."
            },
            {
                type: "9-Ball Set",
                p1: "Cory Michael", p2: "Jacob Gatewood",
                startRatingP1: 487, startRatingP2: 515,
                scoreP1: 4, scoreP2: 6,
                winner: "Jacob Gatewood",
                deltaP1: -12.44, deltaP2: "+13.26",
                explanation: "Jacob was the favorite going into this set (Rating 515 vs 487). He won 6-4, which is exactly what the system expected him to do. Because the result matched the prediction, the rating changes were very standard: Jacob gained a normal amount for a win (+13.26) and Cory lost a normal amount (-12.44)."
            }
        ]
    }
];

// Content Generation
doc.fontSize(titleSize).text('Simplified Rating Analysis - Test Group 2', { align: 'center' });
doc.moveDown();
doc.fontSize(bodySize).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
doc.moveDown(2);

matches.forEach((match, index) => {
    doc.fontSize(headerSize).text(match.title);
    doc.moveDown(0.5);

    match.segments.forEach(seg => {
        doc.fontSize(14).text(`• ${seg.type}`, { underline: true });
        doc.fontSize(bodySize);
        doc.text(`  Players: ${seg.p1} (${parseInt(seg.startRatingP1)}) vs ${seg.p2} (${parseInt(seg.startRatingP2)})`);
        doc.text(`  Final Score: ${seg.scoreP1} - ${seg.scoreP2} (Winner: ${seg.winner})`);
        doc.text(`  Rating Change: ${seg.p1}: ${seg.deltaP1 > 0 ? '' : ''}${seg.deltaP1}  |  ${seg.p2}: ${seg.deltaP2 > 0 ? '' : ''}${seg.deltaP2}`);
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('  Why did this happen?');
        doc.font('Helvetica').text(`  ${seg.explanation}`, { width: 450, align: 'left', indent: 10 });
        doc.moveDown(1);
    });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);
});

doc.end();
console.log("PDF Created.");
