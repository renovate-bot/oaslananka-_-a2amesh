import assert from 'node:assert/strict';
import test from 'node:test';
import { runExample } from '../src/index.js';

void test('registry tenancy example filters visible agents by tenant', async () => {
  const result = await runExample();

  assert.equal(result.mode, 'registry-tenancy');
  assert.deepEqual(result.alphaVisible, ['Alpha Agent']);
  assert.deepEqual(result.betaVisible, ['Beta Agent']);
});
