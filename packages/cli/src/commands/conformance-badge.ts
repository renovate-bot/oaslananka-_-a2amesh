import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Command } from 'commander';
import { emitResult, writeError, type RootOptionsProvider } from '../io.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';

export const conformanceBadgeCommandDoc = {
  path: ['conformance-badge'],
  summary: 'Generate a conformance badge from a report JSON file.',
  description:
    'Reads a conformance report JSON file and generates a Shields.io-style SVG badge showing pass/fail status. Optionally outputs a Markdown image reference.',
  examples: [
    {
      title: 'Generate an SVG badge file.',
      bash: ['a2amesh conformance-badge report.json --output badge.svg'],
      powershell: ['a2amesh conformance-badge report.json --output badge.svg'],
    },
    {
      title: 'Print a Markdown image reference to stdout.',
      bash: ['a2amesh conformance-badge report.json --markdown'],
      powershell: ['a2amesh conformance-badge report.json --markdown'],
    },
  ],
} satisfies CliCommandDoc;

interface ConformanceBadgeCommandOptions {
  output?: string;
  markdown?: boolean;
}

function hexEncode(s: string): string {
  let result = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code > 127) {
      result += `&#${code};`;
    } else {
      result += s[i];
    }
  }
  return result;
}

function renderBadgeSvg(
  passed: number,
  failed: number,
  skipped: number,
  requiredFailed: number,
): string {
  const total = passed + failed + skipped;
  const leftLabel = 'conformance';
  const rightText =
    requiredFailed > 0
      ? `${passed}/${total} failing`
      : failed > 0
        ? `${passed} passed \u00B7 ${failed} failed`
        : `\u2713 ${total} passed`;
  const rightColor = requiredFailed > 0 ? '#e05d44' : failed > 0 ? '#dfb317' : '#4c1';
  const leftWidth = 98;
  const rightWidth = Math.max(70, rightText.length * 8 + 20);
  const totalWidth = leftWidth + rightWidth;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="conformance: ${rightText}">`,
    '  <linearGradient id="s" x2="0" y2="100%">',
    '    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>',
    '    <stop offset="1" stop-opacity=".1"/>',
    '  </linearGradient>',
    `  <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></clipPath>`,
    '  <g clip-path="url(#r)">',
    `    <rect width="${leftWidth}" height="20" fill="#555"/>`,
    `    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${rightColor}"/>`,
    `    <rect width="${totalWidth}" height="20" fill="url(#s)"/>`,
    '  </g>',
    `  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">`,
    `    <text x="${Math.round(leftWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${hexEncode(leftLabel)}</text>`,
    `    <text x="${Math.round(leftWidth / 2)}" y="14">${hexEncode(leftLabel)}</text>`,
    `    <text x="${leftWidth + Math.round(rightWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${hexEncode(rightText)}</text>`,
    `    <text x="${leftWidth + Math.round(rightWidth / 2)}" y="14">${hexEncode(rightText)}</text>`,
    '  </g>',
    '</svg>',
    '',
  ].join('\n');
}

function validateReport(data: unknown): {
  passed: number;
  failed: number;
  skipped: number;
  requiredFailed: number;
} {
  if (!data || typeof data !== 'object') {
    throw new Error('Report must be a JSON object');
  }
  const report = data as Record<string, unknown>;
  if (report['schemaVersion'] !== '1.0') {
    throw new Error(`Unsupported schema version: ${String(report['schemaVersion'])}`);
  }
  const summary = report['summary'];
  if (!summary || typeof summary !== 'object') {
    throw new Error('Report must contain a summary object');
  }
  const s = summary as Record<string, unknown>;
  for (const key of ['total', 'passed', 'failed', 'skipped', 'requiredFailed']) {
    if (typeof s[key] !== 'number' || !Number.isInteger(s[key]) || (s[key] as number) < 0) {
      throw new Error(`summary.${key} must be a non-negative integer`);
    }
  }
  return {
    passed: s['passed'] as number,
    failed: s['failed'] as number,
    skipped: s['skipped'] as number,
    requiredFailed: s['requiredFailed'] as number,
  };
}

export function createConformanceBadgeCommand(getOptions: RootOptionsProvider): Command {
  const command = applyCommandDoc(new Command('conformance-badge'), conformanceBadgeCommandDoc)
    .argument('<report-file>', 'Path to a conformance report JSON file')
    .option('--output <path>', 'Write SVG badge to a file')
    .option('--markdown', 'Print a Markdown image reference to stdout');

  return command.action(
    async (reportFile: string, commandOptions: ConformanceBadgeCommandOptions) => {
      const options = getOptions();
      const filePath = resolve(reportFile);
      let raw: string;
      try {
        raw = readFileSync(filePath, 'utf8');
      } catch {
        writeError(`Cannot read report file: ${reportFile}`);
        process.exitCode = 1;
        return;
      }
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        writeError(`Report file is not valid JSON: ${reportFile}`);
        process.exitCode = 1;
        return;
      }
      let summary: { passed: number; failed: number; skipped: number; requiredFailed: number };
      try {
        summary = validateReport(data);
      } catch (error) {
        writeError(
          `Invalid conformance report: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exitCode = 1;
        return;
      }
      const svg = renderBadgeSvg(
        summary.passed,
        summary.failed,
        summary.skipped,
        summary.requiredFailed,
      );

      if (commandOptions.markdown) {
        emitResult(`![A2A Mesh Conformance](badge.svg)`, options);
        return;
      }

      if (commandOptions.output) {
        const outPath = resolve(commandOptions.output);
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, svg, 'utf8');
        emitResult(`Badge written to ${outPath}`, options);
        return;
      }

      emitResult(svg, options);
    },
  );
}
