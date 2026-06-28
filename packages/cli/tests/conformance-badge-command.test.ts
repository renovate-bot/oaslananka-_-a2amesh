import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConformanceBadgeCommand } from '../src/commands/conformance-badge.js';
import { runCli } from '../src/index.js';
import { expectCommandHelp, jsonOptions } from './command-test-helpers.js';

const passingReport = {
  schemaVersion: '1.0',
  generatedAt: '2026-06-02T12:00:00.000Z',
  package: { name: 'a2amesh', version: '1.0.0' },
  protocolVersion: '1.0',
  endpoint: {
    url: 'http://agent.test',
    capabilities: { streaming: false },
    supportedInterfaces: [],
  },
  summary: {
    total: 7,
    passed: 5,
    failed: 0,
    skipped: 2,
    requiredFailed: 0,
    durationMs: 1234,
  },
  cases: [],
  skippedCapabilities: [],
};

const failingReport = {
  ...passingReport,
  summary: {
    ...passingReport.summary,
    passed: 3,
    failed: 2,
    requiredFailed: 1,
  },
};

describe('conformance-badge command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('defines the conformance-badge command with expected options', () => {
    const command = createConformanceBadgeCommand(jsonOptions);

    expect(command.name()).toBe('conformance-badge');
    expectCommandHelp(command, [
      'conformance-badge [options] <report-file>',
      '--output <path>',
      '--markdown',
    ]);
  });

  it('generates an SVG badge file from a valid report', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-badge-'));
    const reportPath = join(tempDir, 'report.json');
    const badgePath = join(tempDir, 'badge.svg');
    await writeFile(reportPath, JSON.stringify(passingReport));

    let stdout = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += String(chunk);
      return true;
    });

    await runCli(['node', 'a2amesh', 'conformance-badge', reportPath, '--output', badgePath]);

    const svg = await readFile(badgePath, 'utf8');
    expect(stdout).toContain('Badge written to');
    expect(svg).toContain('<svg');
    expect(svg).toContain('conformance');
    expect(svg).toContain('#4c1');
  });

  it('generates a red badge when required conformance cases fail', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-badge-'));
    const reportPath = join(tempDir, 'report.json');
    const badgePath = join(tempDir, 'badge-fail.svg');
    await writeFile(reportPath, JSON.stringify(failingReport));

    await runCli(['node', 'a2amesh', 'conformance-badge', reportPath, '--output', badgePath]);

    const svg = await readFile(badgePath, 'utf8');
    expect(svg).toContain('#e05d44');
    expect(svg).toContain('3/7 failing');
  });

  it('outputs a Markdown image reference with --markdown', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-badge-'));
    const reportPath = join(tempDir, 'report.json');
    await writeFile(reportPath, JSON.stringify(passingReport));

    let stdout = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout += String(chunk);
      return true;
    });

    await runCli(['node', 'a2amesh', 'conformance-badge', reportPath, '--markdown']);

    expect(stdout).toContain('![A2A Mesh Conformance](badge.svg)');
  });

  it('fails on missing report file', async () => {
    let stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr += String(chunk);
      return true;
    });

    await runCli(['node', 'a2amesh', 'conformance-badge', '/nonexistent/report.json']);

    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('Cannot read report file');
  });

  it('fails on invalid JSON report', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-badge-'));
    const reportPath = join(tempDir, 'bad.json');
    await writeFile(reportPath, 'not json');

    let stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr += String(chunk);
      return true;
    });

    await runCli(['node', 'a2amesh', 'conformance-badge', reportPath]);

    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('not valid JSON');
  });

  it('fails on report with missing summary fields', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-badge-'));
    const reportPath = join(tempDir, 'bad-report.json');
    await writeFile(reportPath, JSON.stringify({ schemaVersion: '1.0' }));

    let stderr = '';
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr += String(chunk);
      return true;
    });

    await runCli(['node', 'a2amesh', 'conformance-badge', reportPath]);

    expect(process.exitCode).toBe(1);
    expect(stderr).toContain('Invalid conformance report');
  });
});
