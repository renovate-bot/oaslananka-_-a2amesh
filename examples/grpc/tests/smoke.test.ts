import assert from 'node:assert/strict';
import test from 'node:test';
import { runExample } from '../src/index.js';

void test('grpc example completes a local task through the grpc transport', async () => {
  const result = await runExample();

  assert.equal(result.mode, 'grpc');
  assert.equal(result.state, 'COMPLETED');
  assert.match(result.text, /grpc:hello grpc/u);
  assert.ok(result.taskId);
});
