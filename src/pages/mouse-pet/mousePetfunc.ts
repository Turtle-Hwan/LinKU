export function mousePet() {
  // 이미 펫이 존재하는지 확인
  if (document.querySelector(".mouse-pet")) {
    return;
  }

  // 스타일 추가
  const style = document.createElement("style");
  style.textContent = `
      .mouse-pet {
        position: absolute;
        z-index: 9999;
        pointer-events: none; /* 펫이 마우스 이벤트를 방해하지 않도록 함 */
        transform-origin: center;
        user-select: none; /* 텍스트 선택 방지 */
        filter: drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.3));
        transition: transform 0.1s;
      }
      
      .mouse-pet:hover {
        transform: scale(1.2);
      }
      
      .mouse-pet img {
        width: 50px;
        height: 50px;
      }
    `;
  document.head.appendChild(style);

  // 펫 요소 생성
  const pet = document.createElement("div");
  pet.className = "mouse-pet";

  // 펫 이미지 설정
  const petImage = document.createElement("img");
  petImage.src =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23FFD700"/><circle cx="35" cy="40" r="5" fill="%23000"/><circle cx="65" cy="40" r="5" fill="%23000"/><path d="M35,70 Q50,85 65,70" stroke="%23000" stroke-width="3" fill="none"/></svg>';
  petImage.style.width = "50px";
  petImage.style.height = "50px";
  pet.appendChild(petImage);

  document.body.appendChild(pet);

  // 애니메이션 상태
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  // 마우스 움직임 감지
  document.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    console.log(`Mouse position: (${targetX}, ${targetY})`);
  });

  // 부드러운 애니메이션 효과
  function animatePet() {
    // 현재 위치를 목표 위치로 부드럽게 이동
    currentX += (targetX - currentX) * 0.1;
    currentY += (targetY - currentY) * 0.1;

    // 약간의 움직임 효과 추가
    const bounce = Math.sin(Date.now() / 300) * 5;

    pet.style.left = currentX + 20 + "px"; // 마우스 커서에서 약간 오른쪽
    pet.style.top = currentY + 20 + bounce + "px"; // 위아래 움직임 추가

    requestAnimationFrame(animatePet);
  }

  // 애니메이션 시작
  animatePet();
}
