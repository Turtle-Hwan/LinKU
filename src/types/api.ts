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
  error?: {
    code: string;
    message: string;
  };
  status?: number;
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
  // Negative values are valid client-only identifiers for unsaved items.
  templateItemId: number;
  name: string;
  siteUrl: string;
  position: Position;
  size: Size;
  icon: TemplateIcon;
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
  items?: TemplateItem[]; // For preview rendering
}

// ============================================================================
// Template Preview
// ============================================================================

/**
 * Common item interface for preview rendering
 * Keeps preview rendering independent from storage-only item identifiers.
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

// ============================================================================
// Alerts
// ============================================================================

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

export interface GeneralAlert {
  alertId: number;
  title: string;
  content: string;
  category: AlertCategory;
  url?: string;
  publishedAt: string;
  isRead?: boolean;
}

export type Alert = GeneralAlert;

/**
 * Alert filter parameters (external alert categories can be filtered)
 */
export interface AlertFilterParams {
  category?: AlertCategory;
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
