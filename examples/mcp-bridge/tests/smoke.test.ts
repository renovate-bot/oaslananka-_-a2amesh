import assert from 'node:assert/strict';
import test from 'node:test';
import { runExample } from '../src/index.js';

void test('mcp bridge example maps tools and returns mocked A2A output', async () => {
  const result = await runExample();

  assert.equal(result.mode, 'mcp-bridge');
  assert.equal(result.mcpToolName, 'research-agent');
  assert.equal(result.a2aSkillId, 'mcp-calculator');
  assert.equal(result.output, 'mcp bridge response');
});
