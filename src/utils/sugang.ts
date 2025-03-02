export function sugangRefreshBtn() {
  const refreshBtn = document.querySelectorAll<HTMLButtonElement>(
    "#btnRefresh.btn-sm.btn-sub.btn-mode"
  );
  refreshBtn.forEach((btn) => {
    btn.click();
  });
}
