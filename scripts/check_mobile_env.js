require('dotenv').config({ path: 'mobile/.env' });

const required = ['EXPO_PUBLIC_APP_URL'];
let missing = [];

console.log("Checking mobile environment variables in mobile/.env...");

required.forEach(key => {
    if (!process.env[key]) {
        console.log(`❌ Missing: ${key}`);
        missing.push(key);
    } else {
        console.log(`✅ ${key}: ${process.env[key]}`);
    }
});
