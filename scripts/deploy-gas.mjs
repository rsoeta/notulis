import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const GAS_DIR = path.join(ROOT_DIR, 'backend-gas');
const CLASP_JSON_PATH = path.join(GAS_DIR, '.clasp.json');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const CLASP_BIN = path.join(ROOT_DIR, 'node_modules', '@google', 'clasp', 'build', 'src', 'index.js');

function runClasp(args) {
  if (!fs.existsSync(CLASP_BIN)) {
    console.error('[Error] @google/clasp belum terpasang. Jalankan: npm install');
    process.exit(1);
  }
  const res = spawnSync(process.execPath, [CLASP_BIN, ...args], {
    cwd: GAS_DIR,
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

function readDeploymentIdFromEnv() {
  if (!fs.existsSync(ENV_PATH)) return '';
  const envText = fs.readFileSync(ENV_PATH, 'utf8');
  const match = envText.match(/^VITE_GAS_WEBAPP_URL\s*=\s*(.+)$/m);
  if (!match) return '';
  const url = match[1].trim();
  const idMatch = url.match(/\/macros\/s\/([^/]+)\/exec/);
  return idMatch ? idMatch[1] : '';
}

function ensureClaspConfigured() {
  if (fs.existsSync(CLASP_JSON_PATH)) return;
  console.error('\n[!] File backend-gas/.clasp.json belum ada.');
  console.error('Langkah setup satu kali:');
  console.error('  1. Aktifkan Google Apps Script API di: https://script.google.com/home/usersettings');
  console.error('  2. Login clasp:  npm run gas:login');
  console.error('  3. Ambil Script ID dari Editor Apps Script (Project Settings > IDs > Script ID)');
  console.error('  4. Inisialisasi: npm run gas:init -- <SCRIPT_ID_ANDA>\n');
  process.exit(1);
}

const args = process.argv.slice(2);

// --init <SCRIPT_ID>
if (args[0] === '--init') {
  const scriptId = (args[1] || '').trim();
  if (!scriptId) {
    console.error('Penggunaan: npm run gas:init -- <SCRIPT_ID_APPS_SCRIPT>');
    process.exit(1);
  }
  fs.writeFileSync(
    CLASP_JSON_PATH,
    JSON.stringify({ scriptId, rootDir: '.' }, null, 2) + '\n',
    'utf8'
  );
  console.log(`Berhasil membuat ${path.relative(ROOT_DIR, CLASP_JSON_PATH)} (scriptId: ${scriptId})`);
  process.exit(0);
}

// --list
if (args[0] === '--list') {
  ensureClaspConfigured();
  runClasp(['deployments']);
  process.exit(0);
}

// --push-only
if (args[0] === '--push-only') {
  ensureClaspConfigured();
  console.log('Mengunggah Code.gs, turnstile.gs, & appsscript.json ke Google Apps Script...');
  runClasp(['push', '--force']);
  console.log('Push selesai.');
  process.exit(0);
}

// Default: push + redeploy new version on existing deployment ID
let deploymentId = '';
const positional = [];
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--deployment-id' || args[i] === '-i') && args[i + 1]) {
    deploymentId = args[++i].trim();
  } else {
    positional.push(args[i]);
  }
}

ensureClaspConfigured();

if (!deploymentId) {
  deploymentId = readDeploymentIdFromEnv();
}

const description =
  positional.join(' ').trim() ||
  `Update Notulis GAS (${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`;

console.log('1/2 Mengunggah file terbaru ke Google Apps Script (clasp push --force)...');
runClasp(['push', '--force']);

if (!deploymentId) {
  console.log('\n[!] Deployment ID tidak ditemukan di .env (VITE_GAS_WEBAPP_URL).');
  console.log('Daftar deployment saat ini:');
  runClasp(['deployments']);
  console.log('\nJalankan ulang dengan: npm run gas:deploy -- -i <DEPLOYMENT_ID> "Deskripsi"');
  process.exit(0);
}

console.log(`\n2/2 Membuat versi baru & deploy ke Deployment ID: ${deploymentId}...`);
runClasp(['deploy', '-i', deploymentId, '-d', description]);
console.log('\nSelesai! Web App GAS sudah diperbarui ke versi terbaru tanpa mengubah URL /exec.');
