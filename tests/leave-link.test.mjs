import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import worker, { convertLeavePayload } from '../leave-proxy/worker.mjs';

const employees = ['宋佳臻', '鄭晴心', '郭澄希', '熊茗雅', '非目標人員'].map((name, id) => ({ name, id, shift: id === 1 || id === 2 ? '晚班' : '早班', account: 'excluded' }));
const leave = { month: '2026-10', data: { 0: { 1: { shift: 'black', leave: [] }, 2: { shift: '', leave: ['病2'] } }, 4: { 9: { shift: 'red' } } }, stars: [{ employee_id: 1, day: 3 }], maxDays: 10, payMakeupDays: [10, 25] };
const normalized = () => convertLeavePayload(employees, leave, '2026-10');

test('only the four target staff are returned, preserving shifts, leave text and stars', () => {
  const result = normalized();
  assert.equal(Object.keys(result.people).length, 4);
  assert.equal(result.people['宋佳臻'].days[1].type, 'leave');
  assert.equal(result.people['宋佳臻'].days[2].label, '病2');
  assert.equal(result.people['鄭晴心'].shift, '晚');
  assert.deepEqual(result.people['鄭晴心'].days[3].specials, ['event']);
  assert(!JSON.stringify(result).includes('excluded'));
});
test('missing quota and makeup-day data remains unknown; mismatched month and incomplete staff fail', () => {
  const payload = convertLeavePayload(employees, { data: {} }, '2026-10');
  assert.equal(payload.maxDays, null); assert.equal(payload.payMakeupDays, null);
  assert.throws(() => convertLeavePayload(employees.slice(0, 3), leave, '2026-10'));
  assert.throws(() => convertLeavePayload(employees, leave, '2026-11'));
});
test('proxy is unconfigured until explicitly deployed; it rejects writes, foreign origins and malformed months', async () => {
  const env = { ALLOWED_ORIGIN: 'https://example.test', LEAVE_SOURCE_BASE: 'http://source.test' };
  assert.equal((await worker.fetch(new Request('https://proxy.test/?month=2026-10'), {})).status, 503);
  assert.equal((await worker.fetch(new Request('https://proxy.test/?month=2026-10', { method: 'POST' }), env)).status, 405);
  assert.equal((await worker.fetch(new Request('https://proxy.test/?month=2026-10', { headers: { Origin: 'https://other.test' } }), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://proxy.test/?month=2026-99'), env)).status, 400);
});
test('proxy reads both endpoints without saving or caching their contents', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push([String(url), options]); return Response.json(String(url).includes('/employees') ? employees : leave); };
  try {
    const response = await worker.fetch(new Request('https://proxy.test/?month=2026-10', { headers: { Origin: 'https://example.test' } }), { ALLOWED_ORIGIN: 'https://example.test', LEAVE_SOURCE_BASE: 'http://source.test' });
    assert.equal(response.status, 200); assert.equal(requests.length, 2);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://example.test');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert(requests.every(([, options]) => options.cache === 'no-store'));
    assert.equal(Object.keys((await response.json()).people).length, 4);
  } finally { globalThis.fetch = originalFetch; }
});
test('browser source coalesces reads, rejects malformed data and reports HTTP failures', async () => {
  const listeners = {}, storage = new Map(); let requests = 0, status = 200;
  const window = {};
  const context = vm.createContext({ window, document: { addEventListener: (type, handler) => { listeners[type] = handler; } }, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }, URL, AbortController, setTimeout, clearTimeout, Event, fetch: async () => { requests++; return { ok: status === 200, status, json: async () => normalized() }; } });
  vm.runInContext(readFileSync(new URL('../assets/leave-source.js', import.meta.url), 'utf8'), context);
  await Promise.all([window.csrLeaveSource.read('2026-10'), window.csrLeaveSource.read('2026-10')]);
  assert.equal(requests, 1); assert.equal(storage.size, 0);
  assert.throws(() => window.csrLeaveSource.normalize({ ...normalized(), people: {} }, '2026-10'));
  status = 403;
  await assert.rejects(window.csrLeaveSource.read('2026-10'), /HTTP 403/);
});
