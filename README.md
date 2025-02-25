# LinKU

> 건국대학교 학생들을 위한 교내외 관련 페이지 모음 크롬 확장 프로그램 LinKU

- 자주 접속하는 학교 관련 여러 사이트들을 검색하기도 힘들고, 일일이 찾기도 힘들어 한 번에 모아주는 확장 프로그램을 만들어 봤어요.

- 부족한 점이나 이런 기능 추가되면 좋겠다는 의견이 있다면 Issue에 남겨주세요!  
  시간 날 때마다 추가해볼게요.

## Skills

- Chrome extension
- Vite + React + TypeScript
- tailwindcss + shad/cn

### How to Contribute

```shell
pnpm install
pnpm run dev
```

- build 후 dist 폴더를 chrome extension에서 불러오면 확인 가능합니다.

- "build": "node scripts/updateVersion.js && tsc -b && vite build --mode production",
  - dist 폴더에 배너 이미지 제외하고 빌드
- "watch": "node scripts/updateVersion.js && tsc -b && vite build --watch --mode production",
  - 지속 재빌드
- "build:gh-pages": "tsc -b && vite build --mode gh-pages",
  - gh-pages 폴더에 배너 이미지 포함하여 빌드

### Special Thanks

- Logos designed by [pm_doyoo](https://www.instagram.com/pm_doyoo/)
