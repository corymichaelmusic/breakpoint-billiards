const fs = require('fs');
const path = '.env.local';
const secret = 'polar_whs_wmKCgeVUcaX5HW7u9ESA78MXR4ba7Mp3T8zgO2xs72H';
const key = 'POLAR_WEBHOOK_SECRET';

try {
    let content = '';
    if (fs.existsSync(path)) {
        content = fs.readFileSync(path, 'utf8');
    }

    if (content.includes(key)) {
        console.log(`ℹ️  ${key} already exists. Please verify it matches the provided secret.`);
    } else {
        const newLine = content.endsWith('\n') || content === '' ? '' : '\n';
        fs.appendFileSync(path, `${newLine}${key}=${secret}\n`);
        console.log(`✅ Added ${key} to ${path}`);
    }
} catch (e) {
    console.error(`❌ Failed to update ${path}:`, e.message);
}
