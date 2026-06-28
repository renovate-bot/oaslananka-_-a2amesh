import { listFiles, readText, fail } from './check-utils.mjs';

const failures = [];
for (const file of listFiles().filter((file) => /\.(ya?ml)$/.test(file))) {
  const lines = readText(file).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/^\t+/.test(line)) failures.push(`${file}:${index + 1}: tab indentation`);
  });
}
if (failures.length > 0) fail('YAML validation failed.', failures);
