// Read-only leave linkage. This module has no database or business-data storage.
(() => {
  const staffNames = ['宋佳臻', '鄭晴心', '郭澄希', '熊茗雅'];
  const aliases = { '佳臻': '宋佳臻', '晴心': '鄭晴心', '澄希': '郭澄希', '茗雅': '熊茗雅' };
  const defaultProxy = 'https://omniplay-leave-sync.omniplaycsr168168.workers.dev/';
  const key = 'csrLeaveProxyUrl';
  const inflight = new Map();
  const endpoint = () => localStorage.getItem(key) || defaultProxy;
  const validateEndpoint = value => {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password) {
      throw new Error('請填寫 HTTPS 假表轉接網址。');
    }
    return url.href;
  };
  const normalize = (payload, month) => {
    if (payload?.success === false || payload?.month !== month || !payload.people || typeof payload.people !== 'object' || Array.isArray(payload.people)) {
      throw new Error('假表來源未提供指定月份的資料。');
    }
    const people = {};
    for (const [name, person] of Object.entries(payload.people)) {
      const fullName = aliases[name] || name;
      if (!staffNames.includes(fullName)) continue;
      const shift = person?.shift === '早班' ? '早' : person?.shift === '晚班' ? '晚' : person?.shift;
      if (!['早', '晚'].includes(shift) || !person.days || typeof person.days !== 'object' || Array.isArray(person.days)) continue;
      if (Object.values(person.days).some(day => !day || typeof day !== 'object' || Array.isArray(day))) throw new Error('假表日期資料格式不完整。');
      people[fullName] = { ...person, fullName, shift };
    }
    if (staffNames.some(name => !people[name])) throw new Error('假表來源缺少客服人員或班別，暫停顯示出勤安排。');
    const maxDays = typeof payload.maxDays === 'number' && Number.isFinite(payload.maxDays) ? payload.maxDays : null;
    const total = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
    const payMakeupDays = Array.isArray(payload.payMakeupDays) && payload.payMakeupDays.every(day => Number.isInteger(Number(day)) && Number(day) >= 1 && Number(day) <= total)
      ? [...new Set(payload.payMakeupDays.map(Number))] : null;
    return { month, people, maxDays, payMakeupDays, syncedAt: payload.syncedAt || null };
  };
  const read = month => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return Promise.reject(new Error('月份格式不正確。'));
    const requestKey = `${endpoint()}|${month}`;
    if (inflight.has(requestKey)) return inflight.get(requestKey);
    const task = (async () => {
      const url = new URL(validateEndpoint(endpoint()));
      url.searchParams.set('month', month);
      url.searchParams.set('_', Date.now());
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url.href, { cache: 'no-store', credentials: 'omit', signal: controller.signal });
        if (!response.ok) throw new Error(`假表連線失敗（HTTP ${response.status}），請確認假表連線設定。`);
        return normalize(await response.json(), month);
      } finally { clearTimeout(timer); }
    })();
    inflight.set(requestKey, task);
    task.then(() => inflight.delete(requestKey), () => inflight.delete(requestKey));
    return task;
  };
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-leave-connection]')) return;
    const value = window.prompt('輸入假表轉接服務網址（只讀取假表，不儲存紀錄）', endpoint());
    if (value === null) return;
    try { localStorage.setItem(key, validateEndpoint(value.trim())); window.dispatchEvent(new Event('csr-leave-source-changed')); }
    catch (error) { window.alert(error.message); }
  });
  window.csrLeaveSource = { read, normalize, staffNames };
})();
