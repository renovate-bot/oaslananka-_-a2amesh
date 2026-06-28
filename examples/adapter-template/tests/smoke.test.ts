import assert from 'node:assert/strict';
import test from 'node:test';
import { runExample } from '../src/index.js';

void test('adapter template example returns a local artifact', async () => {
  const result = await runExample();

  assert.equal(result.mode, 'adapter-template');
  assert.equal(result.agentName, 'Local Adapter Template');
  assert.match(result.text, /adapter template response:hello adapter/u);
});
