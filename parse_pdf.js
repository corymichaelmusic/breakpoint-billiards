const fs = require('fs');
const pdf = require('pdf-parse');

async function main() {
  const file1 = 'documents/OFFICIAL BY LAWS_ BREAKPOINT BILLIARDS LEAGUE.pdf';
  const file2 = 'documents/Breakpoint International Standard (BIS).pdf';

  try {
    let data1 = await pdf(fs.readFileSync(file1));
    console.log("BYLAWS PAGES:", data1.numpages);
    console.log("BYLAWS PREVIEW:", data1.text.substring(0, 500));

    let data2 = await pdf(fs.readFileSync(file2));
    console.log("BIS PAGES:", data2.numpages);
    console.log("BIS PREVIEW:", data2.text.substring(0, 500));
  } catch (e) {
    console.error("Error reading pdfs:", e);
  }
}

main();
