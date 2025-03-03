// 수강신청
export const sugangRefreshBtn = () => {
  const refreshBtn = document.querySelectorAll<HTMLButtonElement>(
    "#btnRefresh.btn-sm.btn-sub.btn-mode"
  );
  refreshBtn.forEach((btn) => {
    btn.click();
  });
};

// 학정시
export const 취득학점확인원Btn = () => {
  document
    .querySelector<HTMLDivElement>(
      '.cl-leaf[aria-label="취득학점확인원(학생용)"]'
    )
    ?.click();
};

export const 수강시뮬Btn = () => {
  document
    .querySelector<HTMLDivElement>('.cl-leaf[aria-label="수강시뮬레이션"]')
    ?.click();
};
