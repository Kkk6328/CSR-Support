// Inbox layout is kept without reading saved connection settings or contacting a service.
(() => {
  const body = document.querySelector('#inboxBody');
  if (body) body.innerHTML = '<tr><td colspan="7">尚未設定收件匣資料來源，目前僅供介面預覽。</td></tr>';
  const modal = document.querySelector('#inboxSetupModal');
  if (modal) modal.hidden = true;
  document.querySelector('#refreshInbox')?.addEventListener('click', window.showPreviewNotice);
})();
