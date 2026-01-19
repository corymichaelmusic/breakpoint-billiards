const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '..', 'documents');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 50, right: 50 }
});

const outputPath = path.join(outputDir, 'breakpoint-billiards-expenses.pdf');
doc.pipe(fs.createWriteStream(outputPath));

// Colors
const primaryColor = '#1a1a2e';
const accentColor = '#e94560';
const goldColor = '#d4af37';

// Header
doc.rect(0, 0, doc.page.width, 120).fill(primaryColor);

doc.fillColor('#ffffff')
    .fontSize(32)
    .font('Helvetica-Bold')
    .text('BREAKPOINT BILLIARDS', 50, 40, { align: 'center' });

doc.fillColor(goldColor)
    .fontSize(18)
    .font('Helvetica')
    .text('Monthly Expense Report', 50, 80, { align: 'center' });

// Date
doc.fillColor('#666666')
    .fontSize(12)
    .text(`Generated: January 19, 2026`, 50, 140, { align: 'right' });

// Expenses section
doc.fillColor(primaryColor)
    .fontSize(20)
    .font('Helvetica-Bold')
    .text('Operating Expenses', 50, 180);

doc.moveTo(50, 210).lineTo(562, 210).strokeColor(goldColor).lineWidth(2).stroke();

// Expense items
const expenses = [
    { service: 'Domain Registration', provider: 'breakpointbilliardsleague.com', cost: '$22/year', monthly: '$1.83' },
    { service: 'Web App Hosting', provider: 'Vercel.com', cost: '$20/month', monthly: '$20.00' },
    { service: 'Database Hosting', provider: 'Supabase.com', cost: '$25/month', monthly: '$25.00' },
    { service: 'User Authentication', provider: 'Clerk.com', cost: '$25/month', monthly: '$25.00' }
];

let yPosition = 240;

// Table header
doc.fillColor('#888888')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('SERVICE', 50, yPosition)
    .text('PROVIDER', 200, yPosition)
    .text('COST', 380, yPosition)
    .text('MONTHLY', 480, yPosition);

yPosition += 25;
doc.moveTo(50, yPosition - 5).lineTo(562, yPosition - 5).strokeColor('#cccccc').lineWidth(0.5).stroke();

// Table rows
doc.font('Helvetica');
expenses.forEach((expense, index) => {
    const bgColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
    doc.rect(50, yPosition - 5, 512, 35).fill(bgColor);

    doc.fillColor(primaryColor)
        .fontSize(12)
        .text(expense.service, 55, yPosition + 5)
        .fillColor('#666666')
        .text(expense.provider, 205, yPosition + 5)
        .fillColor(primaryColor)
        .text(expense.cost, 385, yPosition + 5)
        .fillColor(accentColor)
        .font('Helvetica-Bold')
        .text(expense.monthly, 485, yPosition + 5);

    doc.font('Helvetica');
    yPosition += 35;
});

// Totals section
yPosition += 20;
doc.moveTo(50, yPosition).lineTo(562, yPosition).strokeColor(goldColor).lineWidth(2).stroke();

yPosition += 20;

// Monthly total
const monthlyTotal = 1.83 + 20 + 25 + 25; // $71.83
const annualTotal = monthlyTotal * 12;

doc.rect(350, yPosition - 5, 212, 40).fill(primaryColor);
doc.fillColor('#ffffff')
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('MONTHLY TOTAL:', 360, yPosition + 5)
    .fillColor(goldColor)
    .fontSize(18)
    .text(`$${monthlyTotal.toFixed(2)}`, 360, yPosition + 22, { align: 'right', width: 190 });

yPosition += 55;

doc.rect(350, yPosition - 5, 212, 40).fill(accentColor);
doc.fillColor('#ffffff')
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('ANNUAL TOTAL:', 360, yPosition + 5)
    .fillColor('#ffffff')
    .fontSize(18)
    .text(`$${annualTotal.toFixed(2)}`, 360, yPosition + 22, { align: 'right', width: 190 });

// Footer
doc.fillColor('#999999')
    .fontSize(10)
    .font('Helvetica')
    .text('Breakpoint Billiards League', 50, 700, { align: 'center' })
    .text('www.breakpointbilliardsleague.com', 50, 715, { align: 'center' });

doc.end();

console.log(`✅ PDF generated successfully: ${outputPath}`);
