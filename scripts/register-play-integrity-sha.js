#!/usr/bin/env node

/**
 * Register Google Play App Signing Certificate (SHA-1 / SHA-256) with Firebase.
 *
 * Usage:
 *   node scripts/register-play-integrity-sha.js <SHA-1> [SHA-256]
 *
 * Example:
 *   node scripts/register-play-integrity-sha.js 12:34:56:78:...
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');

const PROJECT_ID = 'money-manager-b394e';
const ANDROID_APP_ID = '1:844099376199:android:0f0f7379794900ccb48d62';

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Usage:
  node scripts/register-play-integrity-sha.js <SHA-1> [SHA-256]

Where to find your Google Play App Signing SHA-1:
  1. Open Google Play Console: https://play.google.com/console
  2. Select Splitwiser
  3. Go to Release > Setup > App integrity
  4. Under "App signing key certificate", copy the SHA-1 certificate fingerprint
  5. Run: node scripts/register-play-integrity-sha.js <PASTED_SHA_1>
`);
  process.exit(1);
}

const rawSha1 = args[0].trim();
const rawSha256 = args[1]?.trim();

function getFirebaseAccessToken() {
  const configPath = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('Firebase CLI credentials not found at ' + configPath + '. Please run: firebase login');
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const token = config.tokens?.access_token;
  if (!token) {
    throw new Error('No access_token found in Firebase CLI config. Run: firebase login --reauth');
  }
  return token;
}

function postJson(url, data, token) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getJson(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔑 Authenticating with Firebase Management API...');
  const token = getFirebaseAccessToken();

  const shaApiUrl = `https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/androidApps/${ANDROID_APP_ID}/sha`;

  console.log(`📡 Adding SHA-1 (${rawSha1}) to Android app (${ANDROID_APP_ID})...`);
  const res1 = await postJson(
    shaApiUrl,
    {
      shaHash: rawSha1,
      certType: 'SHA_1',
    },
    token
  );

  if (res1.status === 200) {
    console.log('✅ Successfully added SHA-1 certificate to Firebase!');
  } else if (res1.status === 409 || res1.data?.error?.message?.includes('already exists')) {
    console.log('ℹ️  SHA-1 certificate already exists in Firebase.');
  } else {
    console.error('❌ Failed to add SHA-1:', res1.status, res1.data || res1.raw);
    process.exit(1);
  }

  if (rawSha256) {
    console.log(`📡 Adding SHA-256 (${rawSha256})...`);
    const res2 = await postJson(
      shaApiUrl,
      {
        shaHash: rawSha256,
        certType: 'SHA_256',
      },
      token
    );
    if (res2.status === 200) {
      console.log('✅ Successfully added SHA-256 certificate to Firebase!');
    } else if (res2.status === 409 || res2.data?.error?.message?.includes('already exists')) {
      console.log('ℹ️  SHA-256 certificate already exists in Firebase.');
    } else {
      console.warn('⚠️  Could not add SHA-256:', res2.data || res2.raw);
    }
  }

  console.log('\n📋 Fetching current list of registered SHA fingerprints:');
  const currentList = await getJson(shaApiUrl, token);
  const certs = currentList.data?.certificates || [];
  certs.forEach((c, idx) => {
    console.log(`   ${idx + 1}. [${c.certType}] ${c.shaHash}`);
  });

  console.log('\n📥 Refreshing google-services.json from Firebase...');
  try {
    execSync(
      `firebase apps:sdkconfig ANDROID ${ANDROID_APP_ID} --project ${PROJECT_ID} -o google-services.json`,
      { stdio: 'inherit' }
    );
    console.log('✅ Updated google-services.json successfully.');
  } catch (err) {
    console.warn('⚠️  Could not automatically refresh google-services.json:', err.message);
  }

  console.log('\n🎉 Finished! Google Play Services will now authorize this certificate.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

