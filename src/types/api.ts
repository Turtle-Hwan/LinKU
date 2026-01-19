/**
 * LinKU API Types
 * All API-related type definitions in one place
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  status?: number;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

/**
 * Pagination metadata in responses
 */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Common timestamp fields
 */
export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

/**
 * Base entity with ID and timestamps
 */
export interface BaseEntity extends Timestamps {
  id: string;
}

/**
 * HTTP methods
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * Request configuration
 */
export interface RequestConfig {
  headers?: Record<string, string>;
  params?: unknown;
  timeout?: number;
}

// ============================================================================
// Icons
// ============================================================================

/**
 * Icon entity
 */
export interface Icon {
  id: number;
  name: string;
  imageUrl: string;
  isDefault?: boolean;
  createdAt?: string;
}

/**
 * Response after uploading an icon
 */
export interface CreateIconResponse {
  id: number;
  name: string;
  imageUrl: string;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Icon in template item response (different from Icons API response)
 */
export interface TemplateIcon {
  iconId: number;
  iconName: string;
  iconUrl: string;
}

/**
 * Position coordinates for template items (grid units)
 * x: column index (0-5 for 6-column grid)
 * y: row index (0-5 for 6-row grid)
 * Example: { x: 0, y: 1 } = first column, second row
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Size dimensions for template items (grid units)
 * width: number of columns (1-6, typically 2 or 3)
 * height: number of rows (typically 1)
 * Example: { width: 2, height: 1 } = spans 2 columns, 1 row
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Template item in a template
 */
export interface TemplateItem {
  templateItemId: number;
  name: string;
  siteUrl: string;
  position: Position;
  size: Size;
  icon: TemplateIcon;
}

/**
 * Template item for request (without ID and icon details)
 */
export interface TemplateItemRequest {
  name: string;
  siteUrl: string;
  iconId: number;
  position: Position;
  size: Size;
}

/**
 * Template entity
 */
export interface Template extends BaseEntity {
  templateId: number;
  name: string;
  height: number; // Template height in rows (e.g., 6 for 6-row grid)
  cloned: boolean;
  items: TemplateItem[];
  syncStatus?: 'local' | 'synced'; // Local-only or synced with server
}

/**
 * Request to create a template
 */
export interface CreateTemplateRequest {
  templateId: number;
  name: string;
  height: number;
  items: TemplateItemRequest[];
}

/**
 * Request to update a template
 */
export interface UpdateTemplateRequest {
  name?: string;
  height?: number;
  items?: TemplateItemRequest[];
}

/**
 * Template list query parameters
 */
export interface TemplateListParams {
  sort?: string;
  query?: string;
}

/**
 * Template summary (for list views)
 */
export interface TemplateSummary {
  templateId: number;
  name: string;
  height: number;
  cloned: boolean;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
  syncStatus?: 'local' | 'synced'; // Local-only or synced with server
  previewUrl?: string;
  items?: TemplateItem[]; // For preview rendering
}

// ============================================================================
// Posted Templates
// ============================================================================

/**
 * Common item interface for preview rendering
 * Supports both TemplateItem and PostedTemplateItem
 */
export interface PreviewableItem {
  name: string;
  siteUrl: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  icon: {
    iconUrl: string;
    iconName: string;
  };
}

/**
 * Posted template item (from detail API response)
 */
export interface PostedTemplateItem {
  postedTemplateItemId: number;
  name: string;
  siteUrl: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  icon: {
    iconName: string;
    iconUrl: string;
  };
}

/**
 * Posted (shared) template detail
 * Matches actual API response from /posted-templates/{id}
 */
export interface PostedTemplate {
  postedTemplateId: number;
  name: string;
  ownerId: number;
  ownerName: string;
  height: number;
  likesCount: number;
  usageCount: number;
  items: PostedTemplateItem[];
}

/**
 * Posted template summary (for list views)
 * Matches actual API response from /posted-templates/public
 */
export interface PostedTemplateSummary {
  postedTemplateId: number;
  name: string;
  ownerId: number;
  ownerName: string;
  height: number;
  likesCount: number;
  usageCount: number;
  items: number;
  previewUrl?: string;
  isLiked?: boolean;
  detailItems?: PostedTemplateItem[]; // 미리보기용 상세 items (클라이언트에서 추가)
}

/**
 * Query parameters for posted templates list
 */
export interface PostedTemplateListParams {
  sort?: "most-liked" | "most-used" | "newest" | "oldest";
  query?: string;
  page?: number;
  limit?: number;
}

/**
 * Response after cloning a template
 */
export interface CloneTemplateResponse {
  templateId: number;
  message: string;
}

/**
 * Response after liking a template
 */
export interface LikeTemplateResponse {
  isLiked: boolean;
  likeCount: number;
}

// ============================================================================
// Auth
// ============================================================================

/**
 * Google OAuth authorization request
 */
export interface GoogleOAuthRequest {
  authorizationCode: string;
  redirectUri: string;
}

/**
 * Google OAuth authorization response
 */
export interface GoogleOAuthResponse {
  guestToken: string;
  requiresSignup: boolean;
  expiresAt: string;
  profile: {
    email: string;
    name: string;
    picture: string;
  };
}

/**
 * Send verification code request
 * POST /auth/send-code
 */
export interface SendCodeRequest {
  kuMail: string; // 건국대 이메일 (@konkuk.ac.kr)
}

/**
 * Send verification code response
 * 성공 시 result: null
 */
export type SendCodeResponse = null;

/**
 * Verify code request
 * POST /auth/verify-code
 */
export interface VerifyCodeRequest {
  kuMail: string; // 건국대 이메일 (@konkuk.ac.kr)
  authCode: string; // 6자리 인증 코드
}

/**
 * Verify code response
 * 성공 시 result: null
 */
export type VerifyCodeResponse = null;

/**
 * Auth error codes
 */
export const AUTH_ERROR_CODES = {
  INVALID_INPUT: 1005, // 입력 값이 유효하지 않습니다
  DUPLICATE_EMAIL: 5014, // 이미 존재하는 건국대학교 이메일입니다
  INVALID_CODE: 5015, // 인증 코드가 올바르지 않습니다
} as const;

// ============================================================================
// Alerts
// ============================================================================

/**
 * General notice category types (departmentConfigId: 1-7)
 * Based on backend departmentConfig
 */
export type GeneralNoticeCategory =
  | "학사"
  | "장학"
  | "국제"
  | "학생"
  | "일반"
  | "채용"
  | "에너지 절약";

/**
 * RSS-based alert categories
 * Categories that have RSS feeds
 */
export type RSSAlertCategory = "학사" | "장학" | "국제" | "학생" | "일반";

/**
 * Alert category type for external sources
 * Includes both RSS and HTML-based categories
 */
export type AlertCategory = RSSAlertCategory | "취창업";

/**
 * Department category types (departmentConfigId: 8-34)
 * Based on backend departmentConfig
 */
export type DepartmentCategory =
  | "국어국문학과"
  | "영어영문학과"
  | "중어중문학과"
  | "철학과"
  | "사학과"
  | "미디어커뮤니케이션학과"
  | "문화콘텐츠학과"
  | "정치외교학과"
  | "경제학과"
  | "행정학과"
  | "국제무역학과"
  | "응용통계학과"
  | "융합인재학과"
  | "수학과"
  | "물리학과"
  | "화학과"
  | "전기전자공학부"
  | "화학공학부"
  | "컴퓨터공학부"
  | "사회환경공학부"
  | "기계항공공학부"
  | "생물공학과"
  | "산업공학과"
  | "경영학과"
  | "기술경영학과"
  | "건축학부"
  | "수의학과";

/**
 * Department configuration from backend
 */
export interface DepartmentConfig {
  departmentConfigId: number;
  departmentConfigName: string;
}

/**
 * Department entity
 */
export interface Department {
  id: number;
  name: DepartmentCategory;
}

/**
 * Alert entity (with general notice category)
 */
export interface GeneralAlert {
  alertId: number;
  title: string;
  content: string;
  category: GeneralNoticeCategory | AlertCategory;
  url?: string;
  publishedAt: string;
  isRead?: boolean;
}

/**
 * Alert entity (with department)
 */
export interface DepartmentAlert {
  alertId: number;
  title: string;
  content: string;
  department: Department;
  url?: string;
  publishedAt: string;
  isRead?: boolean;
}

/**
 * Alert entity (union type for exclusive relationship)
 */
export type Alert = GeneralAlert | DepartmentAlert;

/**
 * Subscription entity
 */
export interface Subscription {
  subscriptionId: number;
  department: Department;
  createdAt: string;
}

/**
 * Alert filter parameters (external alert categories can be filtered)
 */
export interface AlertFilterParams {
  category?: AlertCategory;
}

// ============================================================================
// Common Response Types
// ============================================================================

/**
 * Delete response (generic)
 */
export interface DeleteResponse {
  message: string;
}

/**
 * Post template response
 */
export interface PostTemplateResponse {
  postedTemplateId: number;
  message: string;
}

// ============================================================================
// Library
// ============================================================================

/**
 * 도서관 로그인 요청
 */
export interface LibraryLoginRequest {
  loginId: string;
  password: string;
  isFamilyLogin?: boolean;
  isMobile?: boolean;
}

/**
 * 도서관 분관 정보
 */
export interface LibraryBranch {
  id: number;
  name: string;
  alias: string;
  libraryCode: string;
  sortOrder: number;
}

/**
 * 도서관 로그인 응답 데이터
 */
export interface LibraryLoginData {
  id: number;
  accessToken: string;
  name: string;
  memberNo: string;
  printMemberNo: string;
  alternativeId: string;
  branch: LibraryBranch;
  dept: {
    id: number;
    code: string;
    name: string;
  };
  patronType: {
    id: number;
    name: string;
  };
  patronState: {
    id: number;
    name: string;
  };
  isPortalLogin: boolean;
  isFamilyLogin: boolean;
  isExpired: boolean;
  isPrivacyPolicyAgree: boolean;
  availableHomepages: number[];
  disableServices: string[];
}

/**
 * 도서관 API 공통 응답 형식
 */
export interface LibraryApiResponse<T = unknown> {
  success: boolean;
  code: string;
  message: string;
  data: T;
}

/**
 * 열람실 타입 정보
 */
export interface LibraryRoomType {
  id: number;
  name: string;
  sortOrder: number;
}

/**
 * 좌석 현황 정보
 */
export interface LibrarySeatStatus {
  total: number;
  occupied: number;
  waiting: number;
  available: number;
}

/**
 * 열람실 정보
 */
export interface LibrarySeatRoom {
  id: number;
  name: string;
  roomType: LibraryRoomType;
  branch: LibraryBranch;
  seats: LibrarySeatStatus;
  isChargeable: boolean;
  unableMessage: string | null;
  waitRoomGroup: unknown | null;
}

/**
 * 열람실 목록 응답 데이터
 */
export interface LibrarySeatRoomsData {
  totalCount: number;
  list: LibrarySeatRoom[];
}
