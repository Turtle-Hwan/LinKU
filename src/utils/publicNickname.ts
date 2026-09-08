const ADJECTIVES = [
  "따뜻한", "차가운", "포근한", "시원한", "다정한", "용감한",
  "느긋한", "활기찬", "호기심 많은", "즐거운", "반가운", "씩씩한",
] as const;
const MASCOTS = ["건구스", "건덕이"] as const;

export function generatePublicNickname(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const mascot = MASCOTS[Math.floor(Math.random() * MASCOTS.length)];
  return `${adjective} ${mascot}`;
}
