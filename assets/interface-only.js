// Personal preview has no database or storage service; leave linkage is read-only.
(() => {
  const message = '尚未設定資料庫，業務紀錄不會儲存；員工假表可另外連動。';
  window.CSR_PREVIEW_MESSAGE = message;
  window.omniplayDb = null;
  window.omniplayStorage = null;
  window.requireDatabase = () => { throw new Error(message); };
  window.showPreviewNotice = () => window.alert(message);

  // Forms can be opened and edited for preview, but cannot report a successful save.
  document.addEventListener('submit', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.showPreviewNotice();
  }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest('button, input[type="submit"]');
    if (!button) return;
    const label = button.textContent || button.value || '';
    if (button.type === 'submit' || /儲存|同步|匯入|永久刪除|AI.?分析|重新分析|連線設定/.test(label)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.showPreviewNotice();
    }
  }, true);

  const banner = document.createElement('p');
  banner.className = 'interface-preview-notice';
  banner.setAttribute('role', 'status');
  banner.textContent = message;
  const main = document.querySelector('main');
  if (main) main.querySelector('.topbar')?.insertAdjacentElement('afterend', banner) || main.prepend(banner);
})();
