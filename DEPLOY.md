# 배포 절차 — 가족 실사용 버전

목표: `https://myscan1213.github.io/our-table/` 를 가족 모두 폰 홈 화면에 설치, 데이터는 Supabase로 실시간 동기화, 투표는 각자 폰에서.

## 1. 계정 준비 (사람이 하는 일 — 각 5분)

- [ ] **GitHub 로그인**: 터미널에서 `gh auth login -p https -w` → 코드 입력
- [ ] **Supabase**: supabase.com → GitHub 계정으로 가입 → New Project (리전 Northeast Asia/Seoul)
  - Project Settings → API 에서 **Project URL**, **anon public key** 두 값 확보
  - Authentication → Sign In / Up → **Anonymous Sign-ins 켜기**
  - SQL Editor → `supabase/schema.sql` 전체 붙여넣고 Run
  - Storage → New bucket `photos` (Public)

## 2. 호스팅 (Claude가 하는 일)

- [ ] `gh repo create our-table --public --source . --push` (Pages 무료는 공개 저장소 필요)
- [ ] GitHub Pages 활성화 (main 브랜치 루트)
- [ ] index.html에 Supabase URL/key 설정 + 동기화 레이어 구현
- [ ] 첫 실행 온보딩: "새 우리집 만들기(초대 코드 발급)" / "초대 코드로 합류"
- [ ] 기존 로컬 데이터 → 서버로 올리기 마이그레이션 (JSON 백업 그대로 사용)
- [ ] 투표: 만들면 카톡 공유 링크 생성 → 각자 폰에서 접속·투표 → 실시간 개표

## 3. 알림 단계

1. **v1 — 카톡 링크** (모든 폰 동작 보장): 투표 생성 시 공유 시트로 가족방에 전송
2. **v2 — 웹푸시**: PWA(manifest + service worker) + Web Push. 앱 닫혀 있어도 알림.
   아이폰은 iOS 16.4+ 에서 "홈 화면에 추가"한 경우에만 지원 — 가족 온보딩 때 안내 필요

## 구조 메모

- 사진: dataURI 로컬 저장 → 동기화 버전에선 Supabase Storage 업로드 후 URL만 DB에
- 충돌: 메뉴/식단은 updated_at 기준 최신 우선(LWW), 삭제는 tombstone(`deleted=true`)
- No. 번호는 서버 트리거 발급 (기기 간 충돌 방지)
- claude.ai 아티팩트 버전은 보안 정책상 외부 통신 불가 → 동기화 기능은 Pages 배포판에서만 활성화 (로컬 모드로 폴백)
