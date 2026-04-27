# GA4 Data Taxonomy

이 문서는 LinKU의 Chrome Extension 환경에서 `GA4 Measurement Protocol`만 사용해
기본적인 제품 분석과 retention 분석을 가능하게 하기 위한 이벤트 taxonomy다.

모든 이벤트는 `src/utils/analytics.ts`의 도메인 헬퍼를 통해 전송된다.
이 문서는 "무엇을 왜 측정할 것인가"와 **현재 구현 상태**를 함께 정의한다.

## Goals

| 목표 | 분석 질문 | 핵심 지표 |
| --- | --- | --- |
| Retention 파악 | 사용자가 설치/첫 사용 후 다시 돌아오는가 | first-open cohort retention, weekly returning users |
| 핵심 가치 행동 파악 | 어떤 행동이 LinKU의 핵심 가치를 보여주는가 | link click rate, template apply rate, alert/todo usage |
| 기능 채택 파악 | 사용자가 어떤 기능을 실제로 쓰는가 | feature adoption by domain |
| 템플릿 기능 성과 파악 | 템플릿 생성/저장/동기화/게시 흐름이 잘 작동하는가 | editor conversion funnel |
| 계정 연동 파악 | 로그인/이메일 인증이 사용성에 어떤 영향을 주는가 | login start -> success, guest -> verified |

## Principles

| 원칙 | 설명 |
| --- | --- |
| MP-only | `gtag.js` 없이 Measurement Protocol만 유지한다 |
| 제품 중심 naming | GA4 자동 이벤트 흉내보다 LinKU 제품 행위를 이름으로 정의한다 |
| Low-cardinality first | 리포트와 Explore에서 바로 쓰기 쉽도록 고정된 enum 파라미터를 우선 사용한다 |
| One action, one event | 버튼 클릭 자체보다 제품 의미가 있는 행동을 우선 이벤트로 올린다 |
| Outcome + context | 이벤트 이름은 행동, 파라미터는 맥락으로 설계한다 |
| Single module | 모든 이벤트 정의는 `analytics.ts` 안에서만 이루어진다. 호출 지점은 도메인 헬퍼만 import한다 |

## Identity Model

| 항목 | 정책 |
| --- | --- |
| User key | `client_id`를 기기/브라우저 단위 식별자로 사용 |
| Session key | 30분 inactivity 기준 `session_id` 사용 |
| Logged-in identity | 당장은 별도 `user_id` 없이 유지, 필요 시 추후 회원 ID 해시 검토 |
| Environment | `VITE_ENVIRONMENT=development` 일 때 `debug_mode: 1` 파라미터 포함, production endpoint로 전송해 GA4 DebugView에서 확인 |

## Recommended Event Naming

| Prefix | 용도 | 예시 |
| --- | --- | --- |
| `extension_` | 확장 프로그램 lifecycle | `extension_first_open` |
| `navigation_` | 화면/탭/진입 | `navigation_tab_select` |
| `link_` | 핵심 링크 사용 | `link_open` |
| `template_` | 템플릿 생성/편집/배포 | `template_publish_success` |
| `auth_` | 로그인/인증 | `auth_login_success` |
| `alerts_` | 공지 기능 | `alerts_item_open` |
| `todo_` | Todo 기능 | `todo_item_create` |
| `labs_` | Labs 기능 | `labs_feature_use` |
| `settings_` | 설정 변경 | `settings_credentials_saved` |
| `system_` | 오류/상태 | `system_error` |

## Global Parameters

아래 파라미터는 가능한 한 여러 이벤트에서 공통적으로 재사용한다.

| Param | 타입 | 설명 | 예시 |
| --- | --- | --- | --- |
| `screen_name` | string | 현재 화면/페이지 | `popup_home`, `template_editor` |
| `entry_point` | string | 진입 경로 | `popup`, `settings_dialog`, `gallery_page` |
| `feature_area` | string | 상위 기능 영역 | `links`, `templates`, `alerts`, `todo`, `labs`, `auth` |
| `ui_location` | string | UI 내 위치 | `header`, `tab_bar`, `card_action`, `dialog` |
| `template_id` | number | 템플릿 식별자 | `12345` |
| `template_origin` | string | 템플릿 출처 | `default`, `owned`, `cloned`, `posted`, `local_only` |
| `result` | string | 성공/실패/취소 | `success`, `fail`, `cancel` |
| `error_code` | string | 실패 코드 | `network_error`, `auth_required` |
| `error_message` | string | 사람이 읽는 에러 설명 | `sync_failed` |
| `is_logged_in` | boolean | 로그인 상태 | `true` |
| `is_guest` | boolean | 게스트 회원 여부 | `false` |

> **구현 상태 표기**
> - `구현됨` — `analytics.ts`에 헬퍼 함수가 존재하고 call site에 연결됨
> - `미구현` — taxonomy에 정의됐으나 아직 헬퍼/call site 없음

## Lifecycle Events

Retention과 기본 활성 사용자 분석을 위해 가장 먼저 도입해야 할 이벤트군이다.
`sendExtensionOpen(screenName, entryPoint)` 한 번 호출로 아래 세 이벤트를 자동 처리한다.

| Event Name | 상태 | 목적 | Trigger | 주요 Params | 우선순위 |
| --- | --- | --- | --- | --- | --- |
| `extension_first_open` | 구현됨 | 첫 사용 cohort 정의 | `firstOpenSent` 플래그 없을 때 1회 | `screen_name`, `entry_point` | P0 |
| `extension_session_start` | 구현됨 | 재방문/세션 기준 정의 | 30분 초과로 새 `session_id` 생성 시 | `screen_name`, `entry_point` | P0 |
| `extension_open` | 구현됨 | 실제 사용 시작 기록 | popup mount 시 매번 | `screen_name`, `entry_point` | P0 |

## Core Product Events

LinKU의 가장 기본 가치인 "교내외 링크를 빠르게 연다"를 측정하기 위한 이벤트다.

| Event Name | 상태 | 목적 | 주요 Params | 비고 |
| --- | --- | --- | --- | --- |
| `navigation_tab_select` | 구현됨 | 어떤 탭이 실제로 사용되는지 | `tab_name`, `feature_area?` | `ui_location`은 미전송 |
| `search_submit` | 구현됨 | 검색 기능 사용률 측정 | `search_term`, `search_location?` | |
| `link_open` | 구현됨 | LinKU 핵심 가치 행동 | `link_name`, `link_url`, `link_group?`, `same_host_variant?` | same-host 버튼은 `samehost_primary` / `samehost_secondary`로 구분 |
| `banner_open` | 구현됨 | 배너 클릭 효율 측정 | `banner_id`, `banner_title`, `banner_position` | |
| `button_click` | 구현됨 | 범용 버튼 클릭 (header 등) | `button_name`, `button_location?` | 제품 의미가 큰 버튼은 개별 이벤트로 승격, header 잡버튼에만 사용 |

## Account / Auth Events

| Event Name | 상태 | 목적 | 주요 Params | 우선순위 |
| --- | --- | --- | --- | --- |
| `auth_login_start` | 구현됨 | 로그인 의도 파악 | `provider`, `ui_location` | P1 |
| `auth_login_success` | 구현됨 | 실제 로그인 성공률 측정 | `provider`, `is_guest` | P1 |
| `auth_login_fail` | 구현됨 | 로그인 장애 파악 | `provider`, `error_code`, `error_message` | P1 |
| `auth_logout` | 구현됨 | 로그아웃 행동 파악 | `ui_location` | P2 |
| `auth_email_verification_start` | 구현됨 | 게스트 → 회원 전환 시작점 | `ui_location` | P1 |
| `auth_email_verification_success` | 구현됨 | 회원 전환 완료 | `domain_type` | P1 |

## Template Events

템플릿 기능은 LinKU의 차별화 기능이라 별도 도메인으로 관리한다.

| Event Name | 상태 | 목적 | 주요 Params | 우선순위 |
| --- | --- | --- | --- | --- |
| `template_editor_open` | 구현됨 | 에디터 진입률 측정 | `template_origin`, `template_id?` | P1 |
| `template_create_start` | 구현됨 | 새 템플릿 생성 진입 | `template_origin`=`default\|empty` | P1 |
| `template_name_edit` | 구현됨 | 에디터 사용성 파악 | `template_id` | P3 |
| `template_item_add` | 구현됨 | 에디터 내 핵심 편집 행위 | `add_method`(`drag`\|`button`), `template_id?` | P1 |
| `template_item_update` | 구현됨 | 링크/아이콘/속성 수정 | `update_type`, `template_id` | P2 |
| `template_item_delete` | 구현됨 | 아이템 삭제 행위 | `delete_source`, `template_id` | P2 |
| `template_save_success` | 구현됨 | 로컬 저장 완료 | `template_id`, `template_origin`, `item_count` | P0 |
| `template_save_fail` | 구현됨 | 저장 실패 원인 파악 | `template_id`, `error_code`, `error_message` | P1 |
| `template_sync_success` | 구현됨 | 서버 동기화 성공 | `template_id`, `item_count` | P0 |
| `template_sync_fail` | 구현됨 | 동기화 실패 | `template_id`, `error_code`, `error_message` | P1 |
| `template_publish_success` | 구현됨 | 갤러리 게시 성공 | `template_id`, `item_count` | P0 |
| `template_publish_fail` | 구현됨 | 게시 실패 | `template_id`, `error_code`, `error_message` | P1 |
| `template_apply` | 구현됨 | 실제 메인 화면 적용 행동 | `template_id`, `template_origin`, `is_default` | P0 |
| `template_delete` | 구현됨 | 템플릿 삭제 | `template_id`, `template_origin`, `sync_status` | P2 |
| `template_gallery_open` | 구현됨 | 갤러리 진입 | `entry_point` | P1 |
| `template_gallery_search` | 구현됨 | 갤러리 검색 사용 | `query_length`, `sort_option` | P2 |
| `template_gallery_sort_change` | 구현됨 | 정렬 변경 | `sort_option` | P3 |
| `template_clone_success` | 구현됨 | 공개 템플릿 복제 성공 | `posted_template_id`, `author_id_present` | P1 |
| `template_clone_fail` | 구현됨 | 복제 실패 | `posted_template_id`, `error_code`, `error_message?` | P2 |
| `template_like_toggle` | 구현됨 | 좋아요 사용 | `posted_template_id`, `liked` | P2 |

## Alerts / Todo / Labs Events

기본 수준의 크롬 확장 프로그램 분석을 위해 보조 기능도 최소한의 adoption 이벤트는 남겨야 한다.

| Event Name | 상태 | 목적 | 주요 Params | 우선순위 |
| --- | --- | --- | --- | --- |
| `alerts_view_open` | 구현됨 | 공지 탭 사용 여부 | `view_mode`(`all`\|`my`), `category` | P2 |
| `alerts_item_open` | 구현됨 | 공지 클릭률 | `alert_id`, `category`, `source`(`general`\|`department`) | P2 |
| `alerts_subscription_change` | 구현됨 | 개인화 기능 사용 | `category`, `result` | P3 |
| `todo_view_open` | 구현됨 | Todo 기능 사용 여부 | `todo_count` | P2 |
| `todo_item_create` | 구현됨 | Todo 입력 | `source`, `has_due_date` | P2 |
| `todo_item_complete` | 구현됨 | Todo 완료율 | `item_type`(`custom`\|`ecampus`) | P2 |
| `todo_item_delete` | 구현됨 | Todo 삭제 | `item_type`(`custom`\|`ecampus`) | P3 |
| `labs_view_open` | 구현됨 | Labs 진입 | `feature_name` | P3 |
| `labs_feature_use` | 구현됨 | Labs 세부 기능 사용 | `feature_name`, `result` | P3 |

## Settings / System Events

| Event Name | 상태 | 목적 | 주요 Params | 우선순위 |
| --- | --- | --- | --- | --- |
| `settings_open` | 구현됨 | 설정 진입 측정 | `entry_point` | P2 |
| `settings_credentials_saved` | 구현됨 | eCampus 계정 저장 | `result`=`success` | P1 |
| `settings_credentials_deleted` | 구현됨 | eCampus 계정 삭제 | `result`=`success` | P2 |
| `system_error` | 구현됨 | runtime 오류 집계 | `error_code`, `error_message`, `screen_name?` | P1 |

## Migration History

구 이벤트에서 현재 taxonomy로의 전환 이력이다. 구 이벤트는 모두 제거됐다.

| 구 이벤트 | 대체된 이벤트 |
| --- | --- |
| `page_view` | `extension_open` (+ `extension_first_open`, `extension_session_start` 자동 처리) |
| `search` | `search_submit` |
| `tab_change` | `navigation_tab_select` |
| `link_click` | `link_open` |
| `setting_change` | `settings_credentials_saved`, `settings_credentials_deleted` |
| `error` | `system_error` |
| `button_click("google_login")` | `auth_login_start` + `auth_login_success` / `auth_login_fail` |
| `button_click("google_logout")` | `auth_logout` |

## MVP Recommendation

가장 먼저 붙일 이벤트 묶음이다. 이 정도면 GA4 Explore에서 기본 retention과 핵심 사용 흐름을 볼 수 있다.

| 순위 | 이벤트 | 상태 |
| --- | --- | --- |
| P0 | `extension_first_open` | 구현됨 |
| P0 | `extension_session_start` | 구현됨 |
| P0 | `extension_open` | 구현됨 |
| P0 | `link_open` | 구현됨 |
| P0 | `template_save_success` | 구현됨 |
| P0 | `template_sync_success` | 구현됨 |
| P0 | `template_publish_success` | 구현됨 |
| P0 | `template_apply` | 구현됨 |
| P1 | `auth_login_start` | 구현됨 |
| P1 | `auth_login_success` | 구현됨 |
| P1 | `auth_email_verification_success` | 구현됨 |
| P1 | `template_editor_open` | 구현됨 |
| P1 | `template_item_add` | 구현됨 |
| P1 | `system_error` | 구현됨 |

## Suggested Explore Reports

| 리포트 | 포함 이벤트 |
| --- | --- |
| First-open retention cohort | `extension_first_open` → `extension_open` |
| Session-based return cohort | `extension_session_start` |
| Core action retention | `extension_first_open` cohort + `link_open` return condition |
| Template funnel | `template_editor_open` → `template_item_add` → `template_save_success` → `template_sync_success` → `template_publish_success` |
| Auth funnel | `auth_login_start` → `auth_login_success` → `auth_email_verification_success` |

## Non-Goals

| 항목 | 이유 |
| --- | --- |
| 모든 버튼을 다 추적 | 분석 가치보다 cardinality와 유지보수 비용이 큼 |
| GA4 자동 이벤트 완전 복제 | MP-only에서는 비용 대비 효과가 낮음 |
| 처음부터 모든 기능 100% 추적 | retention과 핵심 가치 행동부터 붙이는 편이 낫다 |

---

## 구현된 이벤트 전체 레퍼런스

`src/utils/analytics.ts`에 정의된 헬퍼 기준 알파벳 순 정리.
모든 헬퍼는 `sendGAEvent` (internal) → GA4 MP `/mp/collect`로 전송된다.

| 이벤트명 | 수집 목적 | 수집 속성 | 사용 코드 | 비고 / 잔존이슈 |
| --- | --- | --- | --- | --- |
| `alerts_item_open` | 공지 클릭률 측정 | `alert_id`, `category`, `source` | `AlertItem.tsx · handleClick` | - |
| `alerts_subscription_change` | 학과 구독 변경 파악 | `category`, `result`(`subscribe`\|`unsubscribe`) | `SubscriptionManager.tsx · handleSubscribe`, `handleUnsubscribe` | - |
| `alerts_view_open` | 공지 탭 사용 여부 | `view_mode`, `category` | `Alerts.tsx · initialize()` | - |
| `auth_email_verification_start` | 게스트→회원 전환 시작점 | `ui_location` | `EmailVerificationDialog.tsx · useEffect([open])` | 다이얼로그 재진입마다 전송 → funnel 시작 수 과집계 가능 |
| `auth_email_verification_success` | 회원 전환 완료 | `domain_type` | `EmailVerificationDialog.tsx · handleVerifyCode` | - |
| `auth_login_fail` | 로그인 장애 파악 | `provider`, `error_code`, `error_message` | `SettingsDialog.tsx · handleGoogleLogin` (결과·예외 분기) | - |
| `auth_login_start` | 로그인 의도 파악 | `provider`, `ui_location` | `SettingsDialog.tsx · handleGoogleLogin` | - |
| `auth_login_success` | 실제 로그인 성공률 측정 | `provider`, `is_guest` | `SettingsDialog.tsx · handleGoogleLogin` | - |
| `auth_logout` | 로그아웃 행동 파악 | `ui_location` | `SettingsDialog.tsx · handleLogout` | - |
| `banner_open` | 배너 클릭 효율 측정 | `banner_id`, `banner_title`, `banner_position` | `ImageCarousel.tsx · Image onClick` | - |
| `button_click` | 미승격 버튼 범용 클릭 | `button_name`, `button_location?` | `MainLayout.tsx` (logo·labs·settings·github), `SettingsDialog.tsx` (password_toggle·open_template_editor·open_template_list) | 제품 의미 큰 버튼은 개별 이벤트로 승격 권장 |
| `extension_first_open` | 첫 사용 cohort 정의 | `screen_name`, `entry_point` | `App.tsx · sendExtensionOpen` 내부 자동 처리 | `firstOpenSent` 플래그로 기기당 1회 보장 |
| `extension_open` | 실제 사용 시작 기록 | `screen_name`, `entry_point` | `App.tsx · useEffect → sendExtensionOpen` | - |
| `extension_session_start` | 세션 기준 정의 | `screen_name`, `entry_point` | `App.tsx · sendExtensionOpen` 내부 자동 처리 | 30분 inactivity 초과 시에만 전송 |
| `labs_feature_use` | Labs 기능 사용 측정 | `feature_name`, `result?` | `QRGeneratorSection.tsx · regenerate()`, `LibrarySeatSection.tsx · handleOpenRoom` | ServerClockSection 미연결 (passive 기능, 사용 정의 불명확) |
| `labs_view_open` | Labs 탭 진입 파악 | (없음) | `LabsDialog.tsx · useEffect([open])` | - |
| `link_open` | LinKU 핵심 가치 행동 측정 | `link_name`, `link_url`, `link_group?`, `same_host_variant?` | `LinkGroup.tsx · GridItem onClick`, `GridItemSameHost onClick` | - |
| `navigation_tab_select` | 탭 사용 패턴 파악 | `tab_name`, `feature_area?` | `TabsLayout.tsx · handleTabChange` | taxonomy 정의 `ui_location` 파라미터 미전송 |
| `search_submit` | 검색 기능 사용률 측정 | `search_term`, `search_location?` | `MainLayout.tsx · Header onKeyDown(Enter)` | - |
| `settings_credentials_deleted` | eCampus 계정 삭제 파악 | `result`(=`success`) | `SettingsDialog.tsx · deleteCredentials` | - |
| `settings_credentials_saved` | eCampus 계정 저장 파악 | `result`(=`success`) | `SettingsDialog.tsx · saveCredentials` | - |
| `settings_open` | 설정 진입 측정 | `entry_point` | `MainLayout.tsx · Settings onClick` | - |
| `system_error` | runtime 오류 집계 | `error_code`, `error_message`, `screen_name?` | `App.tsx · ErrorBoundary onError` | React 렌더 오류만 포착, network/API 오류 미포착 |
| `template_apply` | 메인 화면 적용 — 핵심 가치 행동 | `template_id`, `template_origin`, `is_default` | `TemplateListPage.tsx · handleApplyTemplate` | - |
| `template_clone_fail` | 복제 실패 파악 | `posted_template_id`, `error_code`, `error_message?` | `GalleryPage.tsx · handleClone catch` | - |
| `template_clone_success` | 공개 템플릿 복제 성공 | `posted_template_id`, `author_id_present` | `GalleryPage.tsx · handleClone` | - |
| `template_create_start` | 새 템플릿 생성 진입 | `template_origin`(`default`\|`empty`) | `TemplateListPage.tsx · handleCreateFromDefault`, `handleCreateEmpty` | - |
| `template_delete` | 템플릿 삭제 파악 | `template_id`, `template_origin`, `sync_status` | `TemplateListPage.tsx · handleDeleteTemplate` | - |
| `template_editor_open` | 에디터 진입률 측정 | `template_origin`, `template_id?` | `EditorPage.tsx · EditorPage useEffect` | `cloned` origin 미분류 — templateId 있으면 모두 `owned` 처리됨 |
| `template_gallery_open` | 갤러리 진입 | `entry_point` | `GalleryPage.tsx · useEffect([])` | - |
| `template_gallery_search` | 갤러리 검색 사용률 | `query_length`, `sort_option` | `GalleryPage.tsx · debounce useEffect([searchQuery, sort])` | - |
| `template_gallery_sort_change` | 정렬 변경 행동 파악 | `sort_option` | `GalleryPage.tsx · DropdownMenuItem onClick` | - |
| `template_item_add` | 에디터 핵심 편집 행위 | `add_method`(`drag`\|`button`), `template_id?` | `EditorPage.tsx · handleDragEnd`, `ItemPropertiesPanel.tsx · handleMoveToCanvas` | - |
| `template_item_delete` | 아이템 삭제 행위 | `delete_source`(`canvas`\|`staging`), `template_id?` | `ItemPropertiesPanel.tsx · handleDelete` | `canvas`: 임시저장 이동, `staging`: 영구삭제 |
| `template_item_update` | 아이템 속성 수정 측정 | `update_type`, `template_id?` | `ItemPropertiesPanel.tsx · handleSave` | `update_type` 항상 `"properties"` — 이름/URL/아이콘/크기 세분화 미지원 |
| `template_like_toggle` | 좋아요 사용 파악 | `posted_template_id`, `liked` | `GalleryPage.tsx · handleLike` | - |
| `template_name_edit` | 에디터 이름 편집 파악 | `template_id?` | `EditorHeader.tsx · handleNameChange` | 1초 debounce 적용 (keystroke 과다 방지) |
| `template_publish_fail` | 게시 실패 파악 | `template_id`, `error_code`, `error_message` | `EditorHeader.tsx · handlePublish` | - |
| `template_publish_success` | 갤러리 게시 성공 | `template_id`, `item_count` | `EditorHeader.tsx · handlePublish` | - |
| `template_save_fail` | 저장 실패 파악 | `template_id`, `error_code`, `error_message` | `EditorHeader.tsx · handleSave` | draft 저장 실패 시 `template_id=0` 전송 (ID 생성 전) |
| `template_save_success` | 로컬 저장 완료 | `template_id`, `template_origin`, `item_count` | `EditorHeader.tsx · handleSave` | - |
| `template_sync_fail` | 동기화 실패 파악 | `template_id`, `error_code`, `error_message` | `EditorHeader.tsx · handleSyncToServer` | - |
| `template_sync_success` | 서버 동기화 성공 | `template_id`, `item_count` | `EditorHeader.tsx · handleSyncToServer` | - |
| `todo_item_complete` | Todo 완료율 측정 | `item_type` | `TodoList.tsx · handleToggleTodo` | `custom` 타입만 전송 (eCampus todo는 완료 토글 UI 없음) |
| `todo_item_create` | Todo 입력 파악 | `source`, `has_due_date` | `TodoAddDialog.tsx · handleSubmit` | - |
| `todo_item_delete` | Todo 삭제 파악 | `item_type` | `TodoList.tsx · handleDeleteTodo` | `custom` 타입만 전송 (eCampus todo는 삭제 UI 없음) |
| `todo_view_open` | Todo 기능 사용 여부 | `todo_count` | `TodoList.tsx · useEffect([isLoading, ...])` | `viewOpenSentRef`로 최초 1회 보장 |
