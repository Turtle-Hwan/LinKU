let refreshBtn;
try {
  refreshBtn = document.querySelectorAll("#btnRefresh.btn-sm.btn-sub.btn-mode");
} catch {
  console.log("err");
} finally {
  console.log("sugangRefresh Btn func : ", refreshBtn);

  refreshBtn.forEach((btn) => {
    btn.click();
  });
}
