import assert from 'node:assert/strict';
import test from 'node:test';
import { runExample } from '../src/index.js';

void test('authenticated server example completes with the local API key', async () => {
  const result = await runExample();

  assert.equal(result.mode, 'authenticated-server');
  assert.equal(result.state, 'COMPLETED');
  assert.match(result.text, /authenticated:local authenticated request/u);
  assert.ok(result.taskId);
});
