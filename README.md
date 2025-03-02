# LinKU :: 건국대학교 학생들을 위한 교내외 관련 페이지 모음 크롬 확장 프로그램
> [!note]
> 자주 접속하는 학교 관련 여러 사이트들을 검색하기도 힘들고, 일일이 찾기도 힘들어 한 번에 모아주는 확장 프로그램을 만들어 봤어요.
> 
> 부족한 점이나 이런 기능 추가되면 좋겠다는 의견이 있다면 Issue에 남겨주세요!  
  시간 날 때마다 추가해볼게요.

> [!tip]
> Link + KU 라는 이름에 알맞게 건국대 공식 사이트들 뿐만 아니라, 건대 학생들이 직접 만들거나 창업한 서비스도 연결해보려 생각 중이에요.  
> 추가로 아시는 정보가 있다면 언제든 기여 부탁드려요!

### Unofficial services of Konkuk University
- **[ku-ring :: 건국대학교 공지 알리미, 쿠링]** [링크](https://github.com/ku-ring)
  - Android, IOS 앱 제공
- **[PlayKUround :: 캠퍼스 안의 작은 놀이터, 플레이쿠라운드]** [링크](https://github.com/playkuround)
  - Android, IOS 앱 제공
- **[KUstaurant :: 건대 맛집 탐색 쿠스토랑]** [링크](https://kustaurant.com/)
  - Web, App 제공

## Preview
![image](https://github.com/user-attachments/assets/75e0d47d-e8bf-4473-8b2d-83cbc1505077)

## Skills

- Chrome extension
- Vite + React + TypeScript
- tailwindcss + shad/cn

## How to Contribute

```shell
pnpm install
pnpm run dev
```
- react 환경으로 구성되어 있어 dev로 실행되는 화면이 그대로 적용됩니다.
- 로컬에서 extension에 적용하려면, build 후 dist 폴더를 chrome extension에서 불러오면 확인할 수 있습니다.

- 현재 dist 폴더는 extension 배포 용도로 배너 이미지를 제외하고 빌드합니다.
  - gh-pages는 extension에서 배너 이미지를 불러오기 위해 /banners 경로에 배너 이미지들과 정보가 담긴 banners.json을 함께 빌드합니다.
  - 코드 수정 시 auto rebuild를 원한다면, --watch 옵션을 붙이거나 `pnpm run watch` 를 사용하면 됩니다.

```js
//dist 폴더에 배너 이미지 제외하고 빌드
"build": "node scripts/updateVersion.js && tsc -b && vite build --mode production",

//지속 재빌드
"watch": "node scripts/updateVersion.js && tsc -b && vite build --watch --mode production",

//gh-pages 폴더에 배너 이미지 포함하여 빌드
"build:gh-pages": "tsc -b && vite build --mode gh-pages",
```

## Special Thanks

- Logos designed by [pm_doyoo](https://www.instagram.com/pm_doyoo/)
- Cozy coding zone provided by [makers farm](https://www.instagram.com/makersfarm_konkuk) aka [lion](https://www.instagram.com/00_minwooky)

[![Hits](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2FTurtle-Hwan%2FLinKU&count_bg=%2379C83D&title_bg=%230A2F01&icon=&icon_color=%23E7E7E7&title=hits&edge_flat=false)](https://hits.seeyoufarm.com)
