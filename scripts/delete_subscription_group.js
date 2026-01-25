const fs = require('fs');
const readline = require('readline');
const https = require('https');

// Check for jsonwebtoken
let jwt;
try {
    jwt = require('jsonwebtoken');
} catch (e) {
    console.error('Error: "jsonwebtoken" is required. Please run: npm install jsonwebtoken');
    process.exit(1);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    console.log("--- Remove Subscription Group ---");
    console.log("Group ID: 21904779");
    console.log("URL: https://api.appstoreconnect.apple.com/v1/subscriptionGroups/21904779");
    console.log("---------------------------------");

    const issuerId = await question("Enter Issuer ID: ");
    const keyId = await question("Enter Key ID: ");
    const keyPath = await question("Enter path to Private Key (.p8 file): ");

    rl.close();

    if (!issuerId || !keyId || !keyPath) {
        console.error("Error: All fields are required.");
        process.exit(1);
    }

    let privateKey;
    try {
        privateKey = fs.readFileSync(keyPath.trim());
    } catch (e) {
        console.error(`Error reading private key at ${keyPath}:`, e.message);
        process.exit(1);
    }

    // Generate JWT
    const token = jwt.sign({}, privateKey, {
        algorithm: 'ES256',
        expiresIn: '20m',
        issuer: issuerId.trim(),
        header: {
            alg: 'ES256',
            kid: keyId.trim(),
            typ: 'JWT'
        }
    });

    console.log("\nToken generated. Making API request...");

    const options = {
        hostname: 'api.appstoreconnect.apple.com',
        path: '/v1/subscriptionGroups/21904779',
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log(`\nStatus Code: ${res.statusCode}`);
            if (res.statusCode === 204) {
                console.log("Success! Subscription Group removed.");
            } else {
                console.error("Failed to remove subscription group.");
                console.error("Response:", data);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Request error: ${e.message}`);
    });

    req.end();
}

main();
