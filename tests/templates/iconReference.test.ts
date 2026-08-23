import assert from "node:assert/strict";
import test from "node:test";
import {
  isRemoteHttpIconUrl,
  resolveBundledIconReference,
} from "../../src/storage/iconReference.ts";

const bundledIcons = [
  {
    id: 4,
    name: "BellRing",
    imageUrl: "data:image/svg+xml,current",
    isDefault: true,
  },
];

test("번들 배열 위치가 바뀌어도 같은 로컬 아이콘 이름으로 복구한다", () => {
  const resolved = resolveBundledIconReference(
    {
      iconId: 2,
      iconName: "BellRing",
      iconUrl: "data:image/svg+xml,previous",
    },
    bundledIcons,
  );

  assert.equal(resolved?.id, 4);
});

test("빌드마다 달라질 수 있는 로컬 asset 경로도 이름으로 복구한다", () => {
  const resolved = resolveBundledIconReference(
    {
      iconId: 2,
      iconName: "BellRing",
      iconUrl: "/assets/bell-old.svg",
    },
    bundledIcons,
  );

  assert.equal(resolved?.imageUrl, bundledIcons[0].imageUrl);
});

test("같은 id와 이름을 가진 원격 사용자 아이콘은 번들 아이콘으로 덮지 않는다", () => {
  const resolved = resolveBundledIconReference(
    {
      iconId: 4,
      iconName: "BellRing",
      iconUrl: "https://cdn.example.com/custom.svg",
    },
    bundledIcons,
  );

  assert.equal(resolved, undefined);
  assert.equal(isRemoteHttpIconUrl("https://cdn.example.com/custom.svg"), true);
});

test("portable 사용자 이미지는 이름이 같아도 번들 아이콘으로 덮지 않는다", () => {
  const resolved = resolveBundledIconReference(
    {
      iconId: 4,
      iconName: "BellRing",
      iconUrl: "data:image/png;base64,AAAA",
    },
    bundledIcons,
  );

  assert.equal(resolved, undefined);
});
