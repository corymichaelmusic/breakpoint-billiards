const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const posterUrl = 'http://localhost:3000/poster';
    const outputPath = path.join(process.cwd(), 'docs', 'Breakpoint_Poster.pdf');

    console.log(`Generating PDF from ${posterUrl}...`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setViewport({ width: 2400, height: 3600, deviceScaleFactor: 2 });

        try {
            await page.goto(posterUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        } catch (e) {
            console.error("Error loading page. Ensure your development server is running at http://localhost:3000");
            process.exit(1);
        }

        await page.pdf({
            path: outputPath,
            width: '24in',
            height: '36in',
            printBackground: true,
            pageRanges: '1'
        });

        console.log(`PDF created successfully at: ${outputPath}`);

    } catch (error) {
        console.error('Error generating PDF:', error);
    } finally {
        if (browser) await browser.close();
    }
})();
