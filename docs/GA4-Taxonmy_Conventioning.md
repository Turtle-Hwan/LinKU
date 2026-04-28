## 구현된 이벤트 전체 레퍼런스

`src/utils/analytics.ts`에 정의된 헬퍼 기준 알파벳 순 정리.
모든 헬퍼는 `sendGAEvent` (internal) → GA4 MP `/mp/collect`로 전송된다.

### 레거시 이벤트 (v1.5.46~, 연속성 유지)

| 이벤트명 | 항목 | 수집 목적 | 수집 속성 | 사용 코드 | 비고 / 잔존이슈 |
| --- | --- | --- | --- | --- | --- |
| `button_click` | 버튼 클릭 | 미승격 버튼 범용 클릭 | `button_name`, `button_location?` | `MainLayout.tsx` (logo·settings·github), `SettingsDialog.tsx` (password_toggle·open_template_list) | 제품 의미 큰 버튼은 개별 MP_ 이벤트로 승격 권장 |
| `error` | 렌더 오류 발생 | runtime 오류 집계 | `error_code`, `error_message`, `screen_name?` | `App.tsx · ErrorBoundary onError` | React 렌더 오류만 포착, network/API 오류 미포착 |
| `link_click` | 링크 클릭 | LinKU 핵심 가치 행동 측정 | `link_name`, `link_url`, `link_group?`, `same_host_variant?` | `LinkGroup.tsx · GridItem onClick`, `GridItemSameHost onClick` | - |
| `page_view` | 팝업 열기 | 실제 사용 시작 기록 (레거시) | `page_title`, `page_location`, `page_referrer` | `App.tsx · useEffect → sendPageView` | sendExtensionOpen과 함께 호출 |
| `setting_change` | 계정 정보 변경 | eCampus 자격증명 변경 (레거시) | `setting_name`, `setting_value` | `SettingsDialog.tsx` 내부 병렬 발송 | MP_settingsCredentials_* 와 동시 발화 |
| `tab_change` | 탭 선택 | 탭 사용 패턴 파악 | `tab_name`, `feature_area?` | `TabsLayout.tsx · handleTabChange` | - |

### 신규 이벤트 (택소노미 정립 후, MP_ prefix)

| 이벤트명 | 항목 | 수집 목적 | 수집 속성 | 사용 코드 | 비고 / 잔존이슈 |
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
| `MP_labsFeature_use` | Labs 기능 사용 | Labs 기능 사용 측정 | `feature_name`, `result?` | `QRGeneratorSection.tsx · regenerate()`, `LibrarySeatSection.tsx · handleOpenRoom` | ServerClockSection 미연결 (passive 기능) |
| `MP_labs_open` | Labs 다이얼로그 진입 | Labs 탭 진입 파악 | (없음) | `LabsDialog.tsx · useEffect([open])` | - |
| `MP_search_submit` | 검색 실행 | 검색 기능 사용률 측정 | `search_term`, `search_location?` | `MainLayout.tsx · Header onKeyDown(Enter)` | - |
| `MP_settings_open` | 설정 열기 | 설정 진입 측정 | `entry_point` | `MainLayout.tsx · Settings onClick` | - |
| `MP_settingsCredentials_delete` | 계정 정보 삭제 | eCampus 계정 삭제 파악 | `result`(=`success`) | `SettingsDialog.tsx · deleteCredentials` | setting_change 레거시와 병렬 발송 |
| `MP_settingsCredentials_save` | 계정 정보 저장 | eCampus 계정 저장 파악 | `result`(=`success`) | `SettingsDialog.tsx · saveCredentials` | setting_change 레거시와 병렬 발송 |
| `MP_template_apply` | 템플릿 적용 | 메인 화면 적용 — 핵심 가치 행동 | `template_id`, `template_origin`, `is_default` | `TemplateListPage.tsx · handleApplyTemplate` | - |
| `MP_template_createStart` | 템플릿 생성 시작 | 새 템플릿 생성 진입 | `template_origin`(`default`\|`empty`) | `TemplateListPage.tsx · handleCreateFromDefault`, `handleCreateEmpty` | - |
| `MP_template_delete` | 템플릿 삭제 | 템플릿 삭제 파악 | `template_id`, `template_origin`, `sync_status` | `TemplateListPage.tsx · handleDeleteTemplate` | - |
| `MP_template_likeToggle` | 좋아요 토글 | 좋아요 사용 파악 | `posted_template_id`, `is_liked` | `GalleryPage.tsx · handleLike` | - |
| `MP_templateClone_fail` | 복제 실패 | 복제 실패 파악 | `posted_template_id`, `error_code`, `error_message?` | `GalleryPage.tsx · handleClone catch` | - |
| `MP_templateClone_success` | 복제 성공 | 공개 템플릿 복제 성공 | `posted_template_id`, `is_author_id_present` | `GalleryPage.tsx · handleClone` | - |
| `MP_templateEditor_view` | 에디터 진입 | 에디터 진입률 측정 | `template_origin`, `template_id?` | `EditorPage.tsx · EditorPage useEffect` | `cloned` origin 미분류 — templateId 있으면 모두 `owned` 처리됨 |
| `MP_templateGallery_search` | 갤러리 검색 | 갤러리 검색 사용률 | `query_length`, `sort_option` | `GalleryPage.tsx · debounce useEffect([searchQuery, sort])` | - |
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
