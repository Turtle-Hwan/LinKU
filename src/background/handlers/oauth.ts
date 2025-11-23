/**
 * OAuth Handler for Background Script
 * Handles Google OAuth authentication using chrome.identity API
 * This MUST run in background context as chrome.identity is not available in popup
 */

import type { GoogleLoginResponse } from '../types';

// Backend URL from environment
const BACKEND_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || '';
const OAUTH_STATE_KEY = 'oauth_state';

/**
 * User profile type
 */
interface UserProfile {
  email: string;
  name: string;
  picture: string;
}

/**
 * Generate random state string for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Save state to chrome.storage.session
 */
async function saveState(state: string): Promise<void> {
  await chrome.storage.session.set({ [OAUTH_STATE_KEY]: state });
}

/**
 * Save tokens to chrome.storage.local
 */
async function saveTokens(accessToken: string, refreshToken?: string): Promise<void> {
  const data: Record<string, string> = { accessToken };
  if (refreshToken) {
    data.refreshToken = refreshToken;
  }
  await chrome.storage.local.set(data);
}

/**
 * Save user profile to chrome.storage.local
 */
async function saveUserProfile(profile: UserProfile): Promise<void> {
  await chrome.storage.local.set({ userProfile: profile });
}

/**
 * Handle Google OAuth Login
 * This function runs in background context where chrome.identity is available
 */
export async function handleGoogleLogin(): Promise<GoogleLoginResponse> {
  try {
    console.log('[Background] Starting Google OAuth flow');

    // 1. Generate and save state
    const state = generateState();
    await saveState(state);

    // 2. Construct Redirect URI
    // Chrome Extension에서 OAuth를 사용할 때는 특별한 형식의 redirect URI를 사용합니다.
    // 형식: https://<extension-id>.chromiumapp.org/
    //
    // 이 redirect URI는:
    // - OAuth 인증 완료 후 Google이 사용자를 리다이렉트할 엔드포인트
    // - Authorization code가 쿼리 파라미터로 추가됨 (예: ?code=4/0AbC...)
    // - Chrome이 이 패턴(*.chromiumapp.org)을 감지하면 자동으로 OAuth 창을 닫음
    //
    // 요구사항 (RFC 6749 & Google OAuth):
    // ✅ 절대 URI여야 함 (상대 경로 불가)
    // ✅ 프로토콜 필수 (https://)
    // ✅ Fragment 포함 불가 (#이후 부분)
    // ✅ 공개 IP 주소 사용 불가
    // ✅ 와일드카드 사용 불가
    //
    // 중요: 이 URI를 Google Cloud Console의 "Authorized redirect URIs"에 등록해야 함!
    const extensionId = chrome.runtime.id;
    const redirectUri = `https://${extensionId}.chromiumapp.org/`;

    console.log('[Background] Extension ID:', extensionId);
    console.log('[Background] Redirect URI:', redirectUri);

    // 3. Build OAuth Authorization URL
    if (!BACKEND_URL) {
      return {
        success: false,
        error: 'Backend URL이 설정되지 않았습니다. 환경 변수를 확인해주세요.',
      };
    }

    const authUrl = new URL(`${BACKEND_URL}/api/oauth2/authorization/google`);

    // redirect_uri 파라미터 명시적 지정
    // Google Cloud Console에 여러 redirect URI를 등록했더라도,
    // authorization request에 사용할 URI를 명시적으로 지정해야 합니다.
    // Google은 자동으로 선택하지 않습니다!
    //
    // Google이 검증하는 방법:
    // 1. 요청의 redirect_uri 파라미터 값을 확인
    // 2. Google Cloud Console에 등록된 URI 목록과 정확히 일치하는지 검증
    // 3. 일치하면 인증 진행, 불일치하면 redirect_uri_mismatch 오류 발생
    authUrl.searchParams.set('redirect_uri', redirectUri);

    console.log('[Background] Auth URL:', authUrl.toString());

    // 4. Launch OAuth flow using chrome.identity API
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });

    console.log('[Background] OAuth response URL received');

    // 5. Parse response URL
    if (!responseUrl) {
      return { success: false, error: '인증이 취소되었습니다.' };
    }

    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      return {
        success: false,
        error: `OAuth 오류: ${error}`,
      };
    }

    if (!code) {
      return {
        success: false,
        error: '인증 코드를 받지 못했습니다.',
      };
    }

    console.log('[Background] Authorization code received');

    // 6. Exchange code for token via backend
    const tokenResponse = await fetch(`${BACKEND_URL}/api/oauth2/google/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorizationCode: code,
        redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Background] Token exchange failed:', errorText);
      return {
        success: false,
        error: `토큰 교환 실패: ${tokenResponse.status} ${tokenResponse.statusText}`,
      };
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.success || !tokenData.data) {
      return {
        success: false,
        error: tokenData.error?.message || '토큰 교환에 실패했습니다.',
      };
    }

    console.log('[Background] Token exchange successful');

    // 7. Save tokens and user profile
    // The backend returns guestToken - save it as accessToken
    await saveTokens(tokenData.data.guestToken);

    // Save user profile for later use
    await saveUserProfile({
      email: tokenData.data.profile.email,
      name: tokenData.data.profile.name,
      picture: tokenData.data.profile.picture,
    });

    console.log('[Background] OAuth flow completed successfully');

    return {
      success: true,
      response: tokenData.data,
    };
  } catch (error) {
    console.error('[Background] OAuth error:', error);

    // User closed the popup
    if (error instanceof Error && error.message.includes('closed')) {
      return { success: false, error: '로그인 창이 닫혔습니다.' };
    }

    // Interrupted
    if (error instanceof Error && error.message.includes('interrupted')) {
      return { success: false, error: '로그인이 중단되었습니다.' };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
    };
  }
}
