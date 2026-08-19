/**
 * eCampus 로그인 요청 본문 생성
 *
 * `application/x-www-form-urlencoded` 본문을 문자열 결합으로 만들면 `&`나 `+`가
 * 들어간 비밀번호가 그대로 구분자로 해석된다. `a&campus_div=2`는 비밀번호가
 * `a`로 잘리면서 `campus_div`까지 덮어쓰고, `pa+ss`는 서버에서 `pa ss`로 읽힌다.
 * 두 경우 모두 올바른 비밀번호인데도 로그인이 반드시 실패한다.
 *
 * 순수 함수로 분리해 두어 인코딩 회귀를 테스트로 잡는다.
 */
export function buildECampusLoginBody(userId: string, userPw: string): string {
  return new URLSearchParams({
    usr_id: userId,
    usr_pwd: userPw,
    campus_div: "1",
    encoding: "utf-8",
  }).toString();
}
