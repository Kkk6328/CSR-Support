(() => {
  const list = document.querySelector('#personalNotificationList');
  const modal = document.querySelector('#personalNotificationModal');
  const form = document.querySelector('#personalNotificationForm');
  if (!list || !modal || !form) return;

  let items = readItems();

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const formatDateTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('zh-TW', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
  };
  const toLocalInputValue = (value) => {
    const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };
  const repeatLabel = (item) => {
    const repeat = item.repeat || { mode: 'none' };
    if (repeat.mode === 'daily') return '每天';
    if (repeat.mode === 'weekly') return '每週';
    if (repeat.mode === 'monthly') return '每月';
    if (repeat.mode !== 'custom') return '';
    return `每 ${repeat.interval || 1} ${{ day: '天', week: '週', month: '月' }[repeat.unit] || '天'}`;
  };
  const nextOccurrence = (value, repeat) => {
    const next = new Date(value);
    const interval = Math.max(1, Number(repeat?.interval) || 1);
    const unit = repeat?.mode === 'custom' ? repeat.unit : ({ daily: 'day', weekly: 'week', monthly: 'month' }[repeat?.mode]);
    if (unit === 'day') next.setDate(next.getDate() + interval);
    else if (unit === 'week') next.setDate(next.getDate() + interval * 7);
    else if (unit === 'month') next.setMonth(next.getMonth() + interval);
    else return null;
    if (repeat.end === 'date' && repeat.endDate && next > new Date(`${repeat.endDate}T23:59:59`)) return null;
    if (repeat.end === 'count' && (Number(repeat.firedCount) || 0) >= (Number(repeat.endCount) || 1)) return null;
    return next;
  };
  function readItems() { return []; }
  function saveItems() { window.requireDatabase(); }
  function render() {
    const ordered = [...items].sort((a, b) => {
      if (Boolean(a.completed) !== Boolean(b.completed)) return a.completed ? 1 : -1;
      const aTime = a.completed ? a.completedAt : a.createdAt;
      const bTime = b.completed ? b.completedAt : b.createdAt;
      return new Date(bTime || 0).getTime() - new Date(aTime || 0).getTime();
    });
    const active = ordered.filter((item) => !item.completed);
    const count = document.querySelector('#personalNotificationCount');
    if (count) {
      count.textContent = String(active.length);
      count.hidden = active.length === 0;
    }
    list.innerHTML = ordered.length ? ordered.map((item) => `
      <article class="personal-note color-${escapeHtml(item.color || 'yellow')} ${item.completed ? 'is-completed' : ''}" data-id="${escapeHtml(item.id)}">
        <div class="personal-note-topline">
          <span class="personal-note-kind">${item.type === 'alarm' ? '鬧鐘' : '便利貼'}</span>
          ${item.type === 'alarm' && item.remindAt ? `<time datetime="${escapeHtml(item.remindAt)}">${escapeHtml(formatDateTime(item.remindAt))}</time>` : ''}
        </div>
        ${item.type === 'alarm' && repeatLabel(item) ? `<small class="personal-note-repeat">↻ ${escapeHtml(repeatLabel(item))}</small>` : ''}
        <h3>${escapeHtml(item.title)}</h3>
        ${item.content ? `<p>${escapeHtml(item.content).replace(/\n/g, '<br>')}</p>` : ''}
        <div class="personal-note-actions">
          <button type="button" data-action="toggle">${item.completed ? '↩ 恢復' : '✓ 完成'}</button>
          <button type="button" data-action="edit">編輯</button>
          <button type="button" data-action="delete">刪除</button>
        </div>
      </article>
    `).join('') : '<p class="personal-notification-empty">尚未設定資料庫，個人通知僅供介面預覽。</p>';
    scheduleAlarms();
  }

  function openForm(item = null) {
    form.reset();
    document.querySelector('#personalNotificationId').value = item?.id || '';
    document.querySelector('#personalNotificationType').value = item?.type || 'note';
    document.querySelector('#personalNotificationTitleInput').value = item?.title || '';
    document.querySelector('#personalNotificationContent').value = item?.content || '';
    document.querySelector('#personalNotificationTime').value = toLocalInputValue(item?.remindAt);
    const repeat = item?.repeat || { mode: 'none' };
    document.querySelector('#personalNotificationRepeat').value = repeat.mode || 'none';
    document.querySelector('#personalNotificationRepeatInterval').value = repeat.interval || 1;
    document.querySelector('#personalNotificationRepeatUnit').value = repeat.unit || 'day';
    const repeatEnd = form.querySelector(`[name="personalNotificationRepeatEnd"][value="${repeat.end || 'never'}"]`);
    if (repeatEnd) repeatEnd.checked = true;
    document.querySelector('#personalNotificationRepeatEndDate').value = repeat.endDate || '';
    document.querySelector('#personalNotificationRepeatEndCount').value = repeat.endCount || 1;
    const color = form.querySelector(`[name="personalNotificationColor"][value="${item?.color || 'yellow'}"]`);
    if (color) color.checked = true;
    document.querySelector('#personalNotificationDialogTitle').textContent = item ? '編輯個人化通知' : '新增個人化通知';
    document.querySelector('#personalNotificationFormError').textContent = '';
    updateTypeFields();
    modal.hidden = false;
    requestAnimationFrame(() => document.querySelector('#personalNotificationTitleInput').focus());
  }
  const closeForm = () => { modal.hidden = true; };
  function updateTypeFields() {
    const alarm = document.querySelector('#personalNotificationType').value === 'alarm';
    document.querySelector('#personalNotificationTimeField').hidden = !alarm;
    document.querySelector('#personalNotificationRepeatField').hidden = !alarm;
    document.querySelector('#personalNotificationTime').required = alarm;
    updateRepeatFields();
  }
  function updateRepeatFields() {
    const custom = document.querySelector('#personalNotificationRepeat').value === 'custom';
    document.querySelector('#personalNotificationCustomRepeat').hidden = !custom;
    const end = form.querySelector('[name="personalNotificationRepeatEnd"]:checked')?.value || 'never';
    document.querySelector('#personalNotificationRepeatEndDate').disabled = !custom || end !== 'date';
    document.querySelector('#personalNotificationRepeatEndCount').disabled = !custom || end !== 'count';
  }

  function scheduleAlarms() {}

  form.addEventListener('submit', event => { event.preventDefault(); window.showPreviewNotice(); });
  document.querySelector('#personalNotificationAdd').addEventListener('click', () => openForm());
  document.querySelector('#personalNotificationOpen').addEventListener('click', () => openForm());
  document.querySelector('#personalNotificationClose').addEventListener('click', closeForm);
  document.querySelector('#personalNotificationCancel').addEventListener('click', closeForm);
  document.querySelector('#personalNotificationType').addEventListener('change', updateTypeFields);
  document.querySelector('#personalNotificationRepeat').addEventListener('change', updateRepeatFields);
  form.querySelectorAll('[name="personalNotificationRepeatEnd"]').forEach((radio) => radio.addEventListener('change', updateRepeatFields));
  // 日期／時間選擇器在部分瀏覽器會把互動判定為點擊背景或 Escape，
  // 表單僅允許透過「×」或「取消」關閉，避免選擇時間途中視窗跳掉。
  render();
})();

