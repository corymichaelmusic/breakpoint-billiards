const fs = require('fs');
const path = '.env.local';
const productId = 'b1c5140d-69e0-46e0-a99c-2ab939867293';
const key = 'POLAR_MATCH_FEE_PRODUCT_ID';

try {
    let content = '';
    if (fs.existsSync(path)) {
        content = fs.readFileSync(path, 'utf8');
    }

    if (content.includes(key)) {
        console.log(`ℹ️  ${key} already exists in ${path}. Please verify it matches: ${productId}`);
    } else {
        const newLine = content.endsWith('\n') || content === '' ? '' : '\n';
        fs.appendFileSync(path, `${newLine}${key}=${productId}\n`);
        console.log(`✅ Added ${key} to ${path}`);
    }
} catch (e) {
    console.error(`❌ Failed to update ${path}:`, e.message);
}
