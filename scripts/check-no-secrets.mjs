import { isTextFile, listFiles, readText, fail } from './check-utils.mjs';

const secretFilePatterns = [
  /(^|\/)\.env(\..*)?$/,
  /\.pem$/,
  /\.key$/,
  /id_rsa$/,
  /id_ed25519$/,
  /auth\.json$/,
  /credentials\.json$/,
  /storage_state\.json$/,
  /notebooklm_auth\.json$/,
  /cookies\.json$/,
  /secrets\./,
  /\.p12$/,
  /\.pfx$/,
  /kubeconfig$/,
];
const valuePatterns = [
  /Authorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /(access_token|refresh_token|client_secret|password|npm_token|github_token)\s*[:=]\s*(?!\[REDACTED\]|your_|placeholder|example|changeme|$)[^\s'\"]{8,}/i,
  /-----BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY-----/i,
];
const failures = [];
for (const file of listFiles()) {
  if (
    file === '.env.example' ||
    file.endsWith('/.env.example') ||
    file === 'scripts/check-no-secrets.mjs'
  )
    continue;
  if (secretFilePatterns.some((pattern) => pattern.test(file)))
    failures.push(`${file}: secret-like filename`);
  if (!isTextFile(file)) continue;
  const text = readText(file);
  for (const pattern of valuePatterns) {
    const match = pattern.exec(text);
    if (match) failures.push(`${file}: secret-like value ${match[1] ?? match[0].slice(0, 20)}`);
  }
}
if (failures.length > 0) fail('Secret scan failed.', failures.slice(0, 120));
