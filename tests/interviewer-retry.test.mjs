import assert from 'node:assert/strict';
import { test, mock, after } from 'node:test';
import { z } from 'zod';
import { withInterviewerRetry, interviewerFailure } from '../lib/interviewer-retry.ts';

const warnings = mock.method(console, 'warn', () => {});
after(() => mock.restoreAll());
const signal = () => new AbortController().signal;

test('daily quotas and long provider retry hints do not repeatedly call Gemini', async () => {
  for (const message of ['Daily quota exceeded', 'Too many requests']) {
    const error = Object.assign(new Error(JSON.stringify({ error: { message, details: [{
      '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '5133s',
    }] } })), { status: 429 });
    assert.equal(interviewerFailure(error).retryAfterSeconds, 5133);
    let calls = 0;
    await assert.rejects(withInterviewerRetry(async () => { calls++; throw error; }, signal()));
    assert.equal(calls, 1);
  }
});

test('temporary provider failures recover within the same turn', async () => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    let calls = 0;
    const result = await withInterviewerRetry(async () => {
      if (++calls === 1) throw Object.assign(new Error('private provider message'), { status });
      return 'reply';
    }, signal(), { delayMs: 0, rateLimitDelayMs: 0 });
    assert.equal(result, 'reply');
    assert.equal(calls, 2);
  }
  assert.doesNotMatch(JSON.stringify(warnings.mock.calls.map(c => c.arguments)), /private provider message/);
});

test('invalid JSON, invalid schema, and network failures can recover', async () => {
  const schemaError = z.object({ reply: z.string() }).safeParse({ reply: 42 }).error;
  for (const error of [new SyntaxError('bad JSON'), schemaError, new TypeError('fetch failed')]) {
    let calls = 0;
    assert.equal(await withInterviewerRetry(async () => {
      if (++calls === 1) throw error;
      return 'valid reply';
    }, signal(), { delayMs: 0 }), 'valid reply');
    assert.equal(calls, 2);
  }
});

test('permanent configuration and request failures are not retried', async () => {
  for (const error of [new Error('unknown bug'), ...[400, 401, 403, 404].map(status => ({ status }))]) {
    let calls = 0;
    await assert.rejects(withInterviewerRetry(async () => { calls++; throw error; }, signal(), { delayMs: 0 }));
    assert.equal(calls, 1);
  }
});

test('persistent transient failures stop after three attempts', async () => {
  let calls = 0;
  await assert.rejects(withInterviewerRetry(async () => {
    calls++; throw Object.assign(new Error('busy'), { status: 503 });
  }, signal(), { delayMs: 0 }));
  assert.equal(calls, 3);
});

test('cancelling during backoff prevents another request', async () => {
  const controller = new AbortController();
  let calls = 0;
  const promise = withInterviewerRetry(async () => {
    calls++;
    setTimeout(() => controller.abort(), 5);
    throw { status: 503 };
  }, controller.signal, { delayMs: 100 });
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('cancelling an in-flight call aborts its signal and does not retry', async () => {
  const controller = new AbortController();
  let calls = 0;
  const promise = withInterviewerRetry(async attemptSignal => {
    calls++;
    return new Promise((resolve, reject) => {
      attemptSignal.addEventListener('abort', () => reject(attemptSignal.reason), { once: true });
    });
  }, controller.signal, { delayMs: 0 });
  controller.abort();
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('a timed-out provider call is aborted before the next attempt', async () => {
  let calls = 0;
  let firstSignal;
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const result = await withInterviewerRetry(async attemptSignal => {
      if (++calls > 1) { assert.equal(firstSignal.aborted, true); return 'recovered'; }
      firstSignal = attemptSignal;
      return new Promise((resolve, reject) => {
        attemptSignal.addEventListener('abort', () => reject(attemptSignal.reason), { once: true });
      });
    }, signal(), { delayMs: 0, attemptTimeoutMs: 5 });
    assert.equal(result, 'recovered');
    assert.equal(calls, 2);
  } finally { clearTimeout(keepAlive); }
});
