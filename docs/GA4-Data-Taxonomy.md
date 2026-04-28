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
| `template_gallery_search` | 구현됨 | 갤러리 검색 및 정렬 사용 | `query_length`, `sort_option` | P2 |
| `template_gallery_sort_change` | 통합됨 | 정렬 변경 | `template_gallery_search`의 `sort_option`으로 통합 | P3 |
| `template_clone_success` | 구현됨 | 공개 템플릿 복제 성공 | `posted_template_id`, `is_author_id_present` | P1 |
| `template_clone_fail` | 구현됨 | 복제 실패 | `posted_template_id`, `error_code`, `error_message?` | P2 |
| `template_like_toggle` | 구현됨 | 좋아요 사용 | `posted_template_id`, `is_liked` | P2 |

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

### v1.5.46 → GA4-MP 브랜치 (최초 택소노미 도입)

| 구 이벤트 | 대체된 이벤트 |
| --- | --- |
| `page_view` | 유지 (sendExtensionOpen과 함께 sendPageView 병렬 호출) |
| `search` | `MP_search_submit` |
| `tab_change` | 유지 (sendTabChange — 연속성 보존) |
| `link_click` | 유지 (sendLinkClick — 연속성 보존, 파라미터 link_group/same_host_variant 추가) |
| `setting_change` | 유지 + `MP_settingsCredentials_save` / `MP_settingsCredentials_delete` 병렬 발송 |
| `error` | 유지 (sendError — 연속성 보존, 파라미터 error_code/screen_name 추가) |
| `button_click("google_login")` | `MP_authLogin_start` + `MP_authLogin_success` / `MP_authLogin_fail` |
| `button_click("google_logout")` | `MP_auth_logout` |

### 택소노미 컨벤션 정립 (이번 작업)

| 구 이벤트명 | 신규 이벤트명 | 사유 |
| --- | --- | --- |
| `search_submit` | `MP_search_submit` | MP_ prefix 적용 |
| `auth_login_start/success/fail` | `MP_authLogin_start/success/fail` | prefix + camelCase trio |
| `auth_email_verification_start/success` | `MP_authEmailVerification_start/success` | prefix + camelCase |
| `auth_logout` | `MP_auth_logout` | prefix 적용 |
| `settings_open` | `MP_settings_open` | prefix 적용 |
| `settings_credentials_saved/deleted` | `MP_settingsCredentials_save/delete` | prefix + camelCase, 이벤트명은 동작형 save/delete 사용 |
| `template_editor_open` | `MP_templateEditor_view` | prefix + _view 진입 컨벤션 |
| `template_create_start` | `MP_template_createStart` | prefix + camelCase action |
| `template_item_add/update/delete` | `MP_templateItem_add/update/delete` | prefix + camelCase object |
| `template_save/sync/publish_success/fail` | `MP_templateSave/Sync/Publish_success/fail` | prefix + camelCase trio |
| `template_apply` | `MP_template_apply` | prefix 적용 |
| `template_delete` | `MP_template_delete` | prefix 적용 |
| `template_gallery_open` | `MP_templateGallery_view` | prefix + _view 진입 컨벤션 |
| `template_gallery_search` | `MP_templateGallery_search` | prefix + camelCase object |
| `template_gallery_sort_change` | **제거** | P3 — gallery_search의 sort_option에 흡수 |
| `template_clone_success/fail` | `MP_templateClone_success/fail` | prefix + camelCase |
| `template_like_toggle` | `MP_template_likeToggle` | prefix + camelCase action |
| `template_name_edit` | **제거** | P3 — 분석 활용도 낮음, save_success에 함축 |
| `alerts_view_open` | `MP_alerts_view` | prefix + _view 진입 컨벤션 |
| `alerts_item_open` | `MP_alertsItem_open` | prefix + camelCase object |
| `alerts_subscription_change` | `MP_alertsSubscription_update` | prefix + _change 레거시 전용 규칙 |
| `todo_view_open` | `MP_todo_view` | prefix + _view 진입 컨벤션 |
| `todo_item_create/complete/delete` | `MP_todoItem_create/complete/delete` | prefix + camelCase object |
| `labs_view_open` | `MP_labs_open` | prefix + _open 다이얼로그 컨벤션 |
| `labs_feature_use` | `MP_labsFeature_use` | prefix + camelCase object |
| `banner_open` | `MP_banner_open` | prefix 적용 |

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

### 레거시 이벤트 (v1.5.46~, MP_ prefix 없음, 연속성 유지)

| 이벤트명 | 항목 | 수집 목적 | 수집 속성 | 사용 코드 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `button_click` | 버튼 클릭 | 미승격 버튼 범용 클릭 | `button_name`, `button_location?` | `MainLayout.tsx` (logo·settings·github), `SettingsDialog.tsx` (password_toggle·open_template_list) | 제품 의미 큰 버튼은 개별 MP_ 이벤트로 승격 |
| `error` | 렌더 오류 발생 | runtime 오류 집계 | `error_code`, `error_message`, `screen_name?` | `App.tsx · ErrorBoundary onError` | React 렌더 오류만 포착 |
| `link_click` | 링크 클릭 | LinKU 핵심 가치 행동 측정 | `link_name`, `link_url`, `link_group?`, `same_host_variant?` | `LinkGroup.tsx · GridItem onClick`, `GridItemSameHost onClick` | - |
| `page_view` | 팝업 열기 | 실제 사용 시작 기록 (레거시) | `page_title`, `page_location`, `page_referrer` | `App.tsx · useEffect → sendPageView` | sendExtensionOpen과 함께 호출 |
| `setting_change` | 계정 정보 변경 | eCampus 자격증명 변경 파악 (레거시) | `setting_name`, `setting_value` | `SettingsDialog.tsx` 내부 병렬 발송 | MP_settingsCredentials_* 와 동시 발화 |
| `tab_change` | 탭 선택 | 탭 사용 패턴 파악 | `tab_name`, `feature_area?` | `TabsLayout.tsx · handleTabChange` | - |

### 신규 이벤트 (택소노미 정립 후, MP_ prefix)

| 이벤트명 | 항목 | 수집 목적 | 수집 속성 | 사용 코드 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `extension_first_open` | 최초 실행 | 첫 사용 cohort 정의 | `screen_name`, `entry_point` | `App.tsx · sendExtensionOpen` 내부 자동 처리 | `firstOpenSent` 플래그로 기기당 1회 보장 |
| `extension_open` | 팝업 열기 | 실제 사용 시작 기록 | `screen_name`, `entry_point` | `App.tsx · useEffect → sendExtensionOpen` | - |
| `extension_session_start` | 세션 시작 | 세션 기준 정의 | `screen_name`, `entry_point` | `App.tsx · sendExtensionOpen` 내부 자동 처리 | 30분 inactivity 초과 시에만 전송 |
| `MP_alerts_view` | 공지 탭 진입 | 공지 탭 사용 여부 | `view_mode`, `category` | `Alerts.tsx · initialize()` | - |
| `MP_alertsItem_open` | 공지 클릭 | 공지 클릭률 측정 | `alert_id`, `category`, `source` | `AlertItem.tsx · handleClick` | - |
| `MP_alertsSubscription_update` | 구독 변경 | 학과 구독 변경 파악 | `category`, `subscription_result`(`subscribe`\|`unsubscribe`) | `SubscriptionManager.tsx · handleSubscribe`, `handleUnsubscribe` | - |
| `MP_authEmailVerification_start` | 이메일 인증 시작 | 게스트→회원 전환 시작점 | `ui_location` | `EmailVerificationDialog.tsx · useEffect([open])` | 다이얼로그 재진입마다 전송 → funnel 시작 수 과집계 가능 |
| `MP_authEmailVerification_success` | 이메일 인증 완료 | 회원 전환 완료 | `domain_type` | `EmailVerificationDialog.tsx · handleVerifyCode` | - |
| `MP_authLogin_fail` | 로그인 실패 | 로그인 장애 파악 | `provider`, `error_code`, `error_message` | `SettingsDialog.tsx · handleGoogleLogin` (결과·예외 분기) | - |
| `MP_authLogin_start` | 로그인 시도 | 로그인 의도 파악 | `provider`, `ui_location` | `SettingsDialog.tsx · handleGoogleLogin` | - |
| `MP_authLogin_success` | 로그인 성공 | 실제 로그인 성공률 측정 | `provider`, `is_guest` | `SettingsDialog.tsx · handleGoogleLogin` | - |
| `MP_auth_logout` | 로그아웃 | 로그아웃 행동 파악 | `ui_location` | `SettingsDialog.tsx · handleLogout` | - |
| `MP_banner_open` | 배너 클릭 | 배너 클릭 효율 측정 | `banner_id`, `banner_title`, `banner_position` | `ImageCarousel.tsx · Image onClick` | - |
| `MP_labsFeature_use` | Labs 기능 사용 | Labs 기능 사용 측정 | `feature_name`, `result?` | `QRGeneratorSection.tsx · regenerate()`, `LibrarySeatSection.tsx · handleOpenRoom` | ServerClockSection 미연결 |
| `MP_labs_open` | Labs 다이얼로그 진입 | Labs 탭 진입 파악 | (없음) | `LabsDialog.tsx · useEffect([open])` | - |
| `MP_search_submit` | 검색 실행 | 검색 기능 사용률 측정 | `search_term`, `search_location?` | `MainLayout.tsx · Header onKeyDown(Enter)` | - |
| `MP_settings_open` | 설정 열기 | 설정 진입 측정 | `entry_point` | `MainLayout.tsx · Settings onClick` | button_click(settings_icon)과 중복 없음 (sendSettingsOpen 직접 중복 제거됨) |
| `MP_settingsCredentials_delete` | 계정 정보 삭제 | eCampus 계정 삭제 파악 | `result`(=`success`) | `SettingsDialog.tsx · deleteCredentials` | setting_change 레거시와 병렬 발송 |
| `MP_settingsCredentials_save` | 계정 정보 저장 | eCampus 계정 저장 파악 | `result`(=`success`) | `SettingsDialog.tsx · saveCredentials` | setting_change 레거시와 병렬 발송 |
| `MP_template_apply` | 템플릿 적용 | 메인 화면 적용 — 핵심 가치 행동 | `template_id`, `template_origin`, `is_default` | `TemplateListPage.tsx · handleApplyTemplate` | - |
| `MP_template_createStart` | 템플릿 생성 시작 | 새 템플릿 생성 진입 | `template_origin`(`default`\|`empty`) | `TemplateListPage.tsx · handleCreateFromDefault`, `handleCreateEmpty` | - |
| `MP_template_delete` | 템플릿 삭제 | 템플릿 삭제 파악 | `template_id`, `template_origin`, `sync_status` | `TemplateListPage.tsx · handleDeleteTemplate` | - |
| `MP_template_likeToggle` | 좋아요 토글 | 좋아요 사용 파악 | `posted_template_id`, `is_liked` | `GalleryPage.tsx · handleLike` | - |
| `MP_templateClone_fail` | 복제 실패 | 복제 실패 파악 | `posted_template_id`, `error_code`, `error_message?` | `GalleryPage.tsx · handleClone catch` | - |
| `MP_templateClone_success` | 복제 성공 | 공개 템플릿 복제 성공 | `posted_template_id`, `is_author_id_present` | `GalleryPage.tsx · handleClone` | - |
| `MP_templateEditor_view` | 에디터 진입 | 에디터 진입률 측정 | `template_origin`, `template_id?` | `EditorPage.tsx · EditorContent useEffect` | 기존 템플릿은 로드된 `template.cloned` 값으로 `owned`/`cloned` 구분 |
| `MP_templateGallery_search` | 갤러리 검색/정렬 | 갤러리 검색 및 정렬 사용률 | `query_length`, `sort_option` | `GalleryPage.tsx · debounce useEffect([searchQuery, sort])` | 검색어가 없어도 정렬 변경 시 `query_length=0`으로 전송 |
| `MP_templateGallery_view` | 갤러리 진입 | 갤러리 진입 파악 | `entry_point` | `GalleryPage.tsx · useEffect([])` | - |
| `MP_templateItem_add` | 아이템 추가 | 에디터 핵심 편집 행위 | `add_method`(`drag`\|`button`), `template_id?` | `EditorPage.tsx · handleDragEnd`, `ItemPropertiesPanel.tsx · handleMoveToCanvas` | - |
| `MP_templateItem_delete` | 아이템 삭제 | 아이템 삭제 행위 | `delete_source`(`canvas`\|`staging`), `template_id?` | `ItemPropertiesPanel.tsx · handleDelete` | `canvas`: 임시저장 이동, `staging`: 영구삭제 |
| `MP_templateItem_update` | 아이템 속성 수정 | 아이템 속성 수정 측정 | `update_type`, `template_id?` | `ItemPropertiesPanel.tsx · handleSave` | `update_type` 항상 `"properties"` — 향후 세분화 시 개선 가능 |
| `MP_templatePublish_fail` | 게시 실패 | 게시 실패 파악 | `template_id`, `error_code`, `error_message` | `EditorHeader.tsx · handlePublish` | - |
| `MP_templatePublish_success` | 게시 성공 | 갤러리 게시 성공 | `template_id`, `item_count` | `EditorHeader.tsx · handlePublish` | - |
| `MP_templateSave_fail` | 저장 실패 | 저장 실패 파악 | `template_id`, `error_code`, `error_message` | `EditorHeader.tsx · handleSave` | draft 저장 실패 시 `template_id=0` 전송 (ID 생성 전) |
| `MP_templateSave_success` | 저장 성공 | 로컬 저장 완료 | `template_id`, `template_origin`, `item_count` | `EditorHeader.tsx · handleSave` | - |
| `MP_templateSync_fail` | 동기화 실패 | 동기화 실패 파악 | `template_id`, `error_code`, `error_message` | `EditorHeader.tsx · handleSyncToServer` | - |
| `MP_templateSync_success` | 동기화 성공 | 서버 동기화 성공 | `template_id`, `item_count` | `EditorHeader.tsx · handleSyncToServer` | - |
| `MP_todoItem_complete` | Todo 완료 체크 | Todo 완료율 측정 | `item_type` | `TodoList.tsx · handleToggleTodo` | `custom` 타입만 전송 (eCampus todo는 완료 토글 UI 없음) |
| `MP_todoItem_create` | Todo 추가 | Todo 입력 파악 | `source`, `has_due_date` | `TodoAddDialog.tsx · handleSubmit` | - |
| `MP_todoItem_delete` | Todo 삭제 | Todo 삭제 파악 | `item_type` | `TodoList.tsx · handleDeleteTodo` | `custom` 타입만 전송 (eCampus todo는 삭제 UI 없음) |
| `MP_todo_view` | Todo 탭 진입 | Todo 기능 사용 여부 | `todo_count` | `TodoList.tsx · useEffect([isLoading, ...])` | `viewOpenSentRef`로 최초 1회 보장 |
