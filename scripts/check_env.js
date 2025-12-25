require('dotenv').config({ path: '.env.local' });

const required = [
    'POLAR_ACCESS_TOKEN',
    'POLAR_MATCH_FEE_PRODUCT_ID',
    'POLAR_WEBHOOK_SECRET',
    'NEXT_PUBLIC_APP_URL'
];

let missing = [];

console.log("Checking environment variables in .env.local...");

required.forEach(key => {
    if (!process.env[key]) {
        console.log(`❌ Missing: ${key}`);
        missing.push(key);
    } else {
        const val = process.env[key];
        const display = val.length > 5 ? `${val.substring(0, 4)}... (Set)` : '(Set)';
        console.log(`✅ ${key}: ${display}`);
    }
});

if (missing.length === 0) {
    console.log("\nAll required environment variables are set! 🚀");
} else {
    console.log(`\n⚠️ Missing ${missing.length} variables. Please set them in .env.local`);
    process.exit(1);
}
