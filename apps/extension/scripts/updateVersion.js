import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const manifestPath = join(process.cwd(), "public", "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// 버전 문자열을 숫자 배열로 변환 (예: "1.0.0" -> [1, 0, 0])
const version = manifest.version.split(".").map(Number);
version[2]++; // 마지막 숫자를 1 증가

manifest.version = version.join(".");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Version updated to ${manifest.version}`);
