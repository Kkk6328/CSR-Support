// Stateless read-only proxy: filter before responding; never persist upstream data.
const STAFF = new Set(['宋佳臻', '鄭晴心', '郭澄希', '熊茗雅']);

export function convertLeavePayload(employeesPayload, leavePayload, month) {
  const employees = Array.isArray(employeesPayload) ? employeesPayload : employeesPayload?.data;
  if (!Array.isArray(employees) || !leavePayload?.data || typeof leavePayload.data !== 'object') throw new Error('Invalid upstream payload');
  if (leavePayload.month && leavePayload.month !== month) throw new Error('Wrong source month');
  const total = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const people = {};
  for (const employee of employees) {
    const name = String(employee?.name || '').trim();
    if (!STAFF.has(name)) continue;
    const shift = employee.shift === '早班' ? '早' : employee.shift === '晚班' ? '晚' : employee.shift;
    if (!['早', '晚'].includes(shift)) throw new Error('Missing shift');
    const sourceDays = leavePayload.data[String(employee.id)] || {};
    const days = {};
    for (const [day, value] of Object.entries(sourceDays)) {
      if (!/^\d{1,2}$/.test(day) || Number(day) < 1 || Number(day) > total || !value || typeof value !== 'object') continue;
      const label = Array.isArray(value.leave) ? value.leave.filter(Boolean).map(String).join('、') : '';
      days[String(Number(day))] = { type: value.shift === 'red' ? 'required' : value.shift === 'black' ? 'leave' : '', label };
    }
    for (const star of Array.isArray(leavePayload.stars) ? leavePayload.stars : []) {
      if (String(star.employee_id) !== String(employee.id)) continue;
      const day = Number(star.day);
      if (!Number.isInteger(day) || day < 1 || day > total) continue;
      days[String(day)] = { ...(days[String(day)] || { type: '', label: '' }), specials: ['event'] };
    }
    people[name] = { shift, days };
  }
  if ([...STAFF].some(name => !people[name])) throw new Error('Incomplete staff data');
  // Missing announcement/quota fields remain unknown; never invent zero or empty days.
  const maxDays = typeof leavePayload.maxDays === 'number' && Number.isFinite(leavePayload.maxDays) ? leavePayload.maxDays : null;
  const payMakeupDays = Array.isArray(leavePayload.payMakeupDays) && leavePayload.payMakeupDays.every(day => Number.isInteger(Number(day)) && Number(day) >= 1 && Number(day) <= total)
    ? [...new Set(leavePayload.payMakeupDays.map(Number))] : null;
  return { month, people, maxDays, payMakeupDays, syncedAt: new Date().toISOString() };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers });
    if (!env.ALLOWED_ORIGIN || !env.LEAVE_SOURCE_BASE) return reply(503, { success: false, error: 'Leave proxy is not configured' });
    if (origin && origin !== env.ALLOWED_ORIGIN) return reply(403, { success: false, error: 'Origin not allowed' });
    headers['Access-Control-Allow-Origin'] = env.ALLOWED_ORIGIN;
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return reply(405, { success: false, error: 'Method not allowed' });
    const month = new URL(request.url).searchParams.get('month') || '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return reply(400, { success: false, error: 'Invalid month' });
    try {
      const base = new URL(env.LEAVE_SOURCE_BASE);
      if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) return reply(503, { success: false, error: 'Invalid source configuration' });
      const read = async path => {
        const response = await fetch(new URL(path, base), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error('Source unavailable');
        return response.json();
      };
      const [employees, leave] = await Promise.all([read(`/api/employees?month=${month}`), read(`/api/leave/${month}`)]);
      return reply(200, convertLeavePayload(employees, leave, month));
    } catch { return reply(502, { success: false, error: 'Leave source unavailable or incomplete' }); }
  }
};
