export function sugangRefreshBtn() {
  const refreshBtn = document.querySelectorAll<HTMLButtonElement>(
    "#btnRefresh.btn-sm.btn-sub.btn-mode"
  );
  console.log("sugangRefresh Btn func : ", refreshBtn);

  refreshBtn.forEach((btn) => {
    btn.click();
  });
}
