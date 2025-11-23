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
  iconId: number;
  iconName: string;
  iconUrl: string;
  isDefault?: boolean;
  createdAt?: string;
}

/**
 * Response after uploading an icon
 */
export interface CreateIconResponse {
  iconId: number;
  iconName: string;
  iconUrl: string;
}

// ============================================================================
// Templates
// ============================================================================

/**
 * Position coordinates for template items
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Size dimensions for template items
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
  icon: Icon;
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
  height: number;
  cloned: boolean;
  items: TemplateItem[];
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
  previewUrl?: string;
}

// ============================================================================
// Posted Templates
// ============================================================================

/**
 * Posted (shared) template
 */
export interface PostedTemplate extends BaseEntity {
  postedTemplateId: number;
  template: Template;
  author: {
    userId: number;
    nickname: string;
    profileImage?: string;
  };
  likeCount: number;
  cloneCount: number;
  isLiked?: boolean;
  description?: string;
}

/**
 * Posted template summary (for list views)
 */
export interface PostedTemplateSummary {
  postedTemplateId: number;
  templateId: number;
  name: string;
  author: {
    userId: number;
    nickname: string;
    profileImage?: string;
  };
  likeCount: number;
  cloneCount: number;
  isLiked?: boolean;
  createdAt: string;
  previewUrl?: string;
}

/**
 * Query parameters for posted templates list
 */
export interface PostedTemplateListParams {
  sort?: "latest" | "popular" | "mostLiked" | "mostCloned";
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
 */
export interface SendCodeRequest {
  email: string;
}

/**
 * Send verification code response
 */
export interface SendCodeResponse {
  email: string;
  expiresAt: string;
}

/**
 * Verify code request
 */
export interface VerifyCodeRequest {
  email: string;
  verificationCode: string;
}

/**
 * Verify code response
 */
export interface VerifyCodeResponse {
  email: string;
  verified: boolean;
  verifiedAt: string;
  verificationToken: string;
}

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
