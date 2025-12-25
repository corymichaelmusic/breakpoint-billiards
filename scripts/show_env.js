const fs = require('fs');
const path = '.env.local';

try {
    if (fs.existsSync(path)) {
        console.log("Here are your Environment Variables (Copy this block for Vercel):");
        console.log("---------------------------------------------------------------");
        const content = fs.readFileSync(path, 'utf8');
        console.log(content);

        // Append missing ones if not present
        if (!content.includes('NEXT_PUBLIC_APP_URL')) {
            console.log("# Add your production URL below once you know it");
            console.log("NEXT_PUBLIC_APP_URL=https://your-project.vercel.app");
        }
        console.log("---------------------------------------------------------------");
    } else {
        console.log("❌ .env.local not found!");
    }
} catch (e) {
    console.error("Error reading file:", e.message);
}
