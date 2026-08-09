# 배포와 운영

현재 상태 · 앱으로 내보내는 경로 · 서버를 운영 등급으로 올리는 절차를 정리합니다.

---

## 지금 상태 (2026-08-08)

| 항목 | 내용 |
|---|---|
| 웹 (정식) | **https://uritable.vercel.app** (Vercel, 무료 · `git push` 시 자동 배포) |
| 웹 (구주소) | https://heomooyoung.github.io/our-table/ (GitHub Pages, 당분간 유지) |
| 백엔드 | Supabase **무료** 전용 프로젝트 `uritable` (`agiclnnwevimdkwaufdl`, Seoul) |
| 인증 | 익명 로그인 + 초대 코드, 카카오 로그인(앱 키 등록 대기) |
| 저장 | Postgres + RLS(가족 단위 격리), Storage `photos`(공개 버킷) |
| 외부 | 쿠팡 파트너스 중계 Edge Function `coupang` — **새 프로젝트에 아직 미배포** |
| 앱화 | **PWA 완료** — 홈 화면 설치·전체화면·오프라인 실행 |

---

## 1. 앱으로 만드는 세 가지 경로

### A. PWA — **이미 적용됨, 비용 0**

폰 브라우저에서 주소를 열고 **공유 → 홈 화면에 추가**를 하면 아이콘이 생기고,
주소창 없는 전체화면으로 실행되며, 껍데기는 캐시되어 인터넷이 끊겨도 열립니다.

- 스토어 심사·수수료·개발자 계정 **전부 불필요**
- 배포 = `git push` (지금 그대로)
- 한계: **스토어 검색에 안 나옴**, iOS 웹푸시는 홈 화면 추가한 경우에만 동작

### B. Capacitor 래핑 — 스토어 출시용, **웹 코드 그대로 재사용**

`index.html` 하나를 iOS/Android 네이티브 껍데기에 담아 App Store / Play Store에 올립니다.
**웹 버전은 그대로 두고 앱 버전만 추가로 만드는 방식**이라 코드가 갈라지지 않습니다.

```
npm i @capacitor/core @capacitor/cli
npx cap init "우리집 식탁" com.hamong.ourtable --web-dir=.
npx cap add ios && npx cap add android
npx cap sync
npx cap open ios      # Xcode에서 빌드·업로드
```

필요한 것:

| 항목 | 비용 | 비고 |
|---|---|---|
| Apple Developer | **$99 / 년** | iOS 필수. Mac + Xcode 필요 |
| Google Play 등록 | **$25 (1회)** | Android |
| 심사 기간 | 1~7일 | 반려 시 재제출 |

**주의 — 반려 위험**: Apple은 "웹사이트를 그냥 감싼 앱"을 거부합니다(가이드라인 4.2).
통과하려면 네이티브 기능이 실제로 있어야 하는데, 우리 앱은 자연스럽게 붙일 것이 있습니다:
**푸시 알림(투표하세요)**, **카메라(음식 사진)**, **공유 익스텐션**, **위젯(오늘의 메뉴)**.

**Apple 필수 요건**: 계정을 만들 수 있는 앱은 **앱 안에서 계정 삭제**가 가능해야 합니다.
현재 로그아웃은 있지만 계정·데이터 삭제는 없으므로 스토어 전에 반드시 추가해야 합니다.

### C. 네이티브 재작성 (Flutter/RN) — **지금은 낭비**

기능이 확정되지 않았고 사용자도 가족 단위인 단계에서 재작성은 비용만 큽니다. 보류.

### 권장 순서

```
지금 ─ PWA로 가족·지인 배포 (완료)
  └─ 2~4주 실사용 → 매일 켜지는지 확인
       └─ 계속 쓰이면 ─ Supabase Pro 전환 (아래 2단계)
                        └─ 계정 삭제·약관·푸시 추가 → Capacitor로 스토어
```

---

## 2. 서버·DB를 운영 등급으로

### 지금 구조로는 안 되는 이유

1. **무료 티어는 1주 미사용 시 프로젝트가 잠듭니다** — 사용자가 열면 에러
2. **자동 백업이 없습니다** — 사고 시 복구 불가
3. `bapsang` 프로젝트에 **옛 실험 테이블(elders·meals·medications 등)이 섞여 있습니다**

### 해야 할 일 (우선순위 순)

| # | 작업 | 비용 | 왜 |
|---|---|---|---|
| 1 | **Supabase Pro 전환** | $25/월 | 휴면 없음, 자동 백업 + 7일 시점 복구(PITR), 8GB DB / 100GB 스토리지 |
| 2 | **전용 프로젝트로 분리** | 0 | 옛 실험과 섞이지 않게. 스키마 + Storage + Edge Function 이관 |
| 3 | **Storage 정책 강화** | 0 | 지금은 로그인만 하면 누구나 업로드 가능 → 경로에 `home_id` 강제 |
| 4 | **우리집 생성 제한** | 0 | 익명 계정당 1개, 시간당 N개 — 악용·용량 폭주 방지 |
| 5 | **백업 리허설** | 0 | 실제로 한 번 복구해봐야 백업이라 부를 수 있음 |
| 6 | **계정·데이터 삭제 기능** | 0 | 개인정보 요구사항이자 Apple 필수 |
| 7 | **약관 · 개인정보처리방침** | 0 | 공개 배포·스토어 심사 필수 |
| 8 | **에러 모니터링** | 0 | Edge Function 실패·인증 오류 알림 |

### 용량·비용 예측

사진은 업로드 전 900px/JPEG 82%로 줄여 저장하므로 장당 약 **150KB**.

| 규모 | 사진 | 스토리지 | 플랜 |
|---|---|---|---|
| 가족 1팀 | 100장 | 15MB | 무료로 충분 |
| 50가족 | 5,000장 | 750MB | 무료 한도(1GB) 근처 |
| 500가족 | 50,000장 | 7.5GB | **Pro** 여유 |
| 5,000가족 | 500,000장 | 75GB | Pro 한도 근처, 전송량 확인 필요 |

즉 **Pro 한 장($25/월)으로 수백~수천 가족까지** 감당됩니다. 그 이상은 그때 수익 구조를 함께 논의할 단계입니다.

---

## 2-1. 호스팅 (Vercel)

- 프로젝트 `our-table` / 계정 `myscan1213-4257`
- 주소: **uritable.vercel.app** (별칭) · our-table-nu.vercel.app (기본)
- **GitHub 연결 완료** — `main`에 push하면 자동 배포
- 배포 보호(Vercel Authentication)는 **꺼둠** — 켜져 있으면 방문자가 로그인 화면으로 튕김
- Supabase 리다이렉트 허용 목록에 새·구 주소 모두 등록됨

수동 배포가 필요하면:

```
npx vercel deploy --prod --yes
```

## 2-1-1. Supabase 전용 프로젝트 (2026-08-09 이관)

전에는 다른 앱(노인 돌봄)과 `bapsang` 프로젝트를 같이 쓰고 있었다. 테이블 이름이 겹치고
(`is_admin()` 충돌) 서로의 데이터가 한 DB에 섞여서, 실사용자가 붙기 전에 **전용 프로젝트로 분리**했다.
이관 시점 데이터는 0건이라 옮긴 것은 없다. 구 프로젝트 `bapsang`은 그대로 두었다.

새로 만들 때 필요한 것 (대시보드에서 4가지, 순서대로):

1. 프로젝트 생성 — 리전 **Seoul**, DB 비밀번호는 따로 보관
2. Authentication → Sign In / Providers → **Allow anonymous sign-ins 켜기**
   (안 켜면 '시작하기'가 아예 동작하지 않는다)
3. Storage → New bucket → 이름 `photos`, **Public 체크**
4. SQL Editor에서 **`supabase/schema.sql` → `supabase/analytics.sql` 순서로** 실행
   (analytics가 schema의 `feedback`을 참조하므로 순서를 지켜야 한다)

그리고 Settings → API의 Project URL·publishable 키를 `index.html`의 `OT_CONFIG`에 넣는다.
※ 키가 예전 JWT(`eyJ...`)가 아니라 새 형식(`sb_publishable_...`)이다. supabase-js 2.112 이상에서 동작하며,
   앱은 esm.sh에서 `@2` 최신을 받으므로 그대로 두면 된다.

## 2-1-2. 연결 점검 결과 (2026-08-09)

새 프로젝트에 대고 실제 API를 끝까지 돌려본 결과. 다시 확인할 일이 생기면 같은 순서로 하면 된다.

| 확인한 것 | 결과 |
|---|---|
| 익명 로그인 | 정상 (`anonymous_users: true`) |
| 우리집 만들기 → 초대 코드 → 다른 기기 합류 | 정상 |
| 메뉴 등록 · No. 서버 발급 트리거 | 정상 (`no=1` 자동 부여) |
| 식단표 배치 | 정상 |
| **가족 격리(RLS)** | 정상 — 합류 전에는 남의 집 메뉴·집 목록이 빈 배열 |
| 잘못된 초대 코드 | `INVALID_CODE`로 거절 |
| 실시간 동기화 | 정상 — A가 등록한 메뉴가 B 기기에 즉시 도착 |
| **실시간에도 RLS 적용** | 정상 — 남의 집 변경은 아예 안 옴 (채널명이 `home-sync` 공용이라 확인함) |
| 접속 로그 쓰기(익명 포함) / 읽기 차단 | 정상 — 비관리자는 빈 배열 |
| 의견 보내기 / 읽기 차단 | 정상 |
| 사진 업로드 + 공개 URL 읽기 | 정상 |
| 남의 사진 목록 훑기 · 덮어쓰기 · 삭제 | 전부 막힘 |
| 옛 앱 테이블(`elders`·`meals`·`medications`) 혼입 | 없음 — 분리 성공 |
| 로컬 UX 테스트 `npm test` | 140 PASS / 0 FAIL |
| 배포본(uritable.vercel.app)·구주소 설정 | 둘 다 새 프로젝트를 봄 |

아직 안 되는 것 (알고 있는 것):

- **`coupang` Edge Function 미배포** — 호출 시 404. 장보기의 쿠팡 검색만 동작 안 함 (3장 참고)
- **카카오 로그인 미설정** — 프로바이더 `kakao: false`
- **우리집 무제한 생성** — 익명 계정 하나로 연속 3번 만들어짐 (2장 항목 4)
- **사진 경로에 `home_id` 강제 없음** — 로그인만 하면 `photos/아무데나`로 올릴 수 있음 (2장 항목 3)
- **투표는 DB상 비밀이 아님** — 같은 집 식구면 `ballots`에서 누가 뭘 찍었는지 조회 가능.
  지금은 한 폰을 돌려 쓰는 방식이라 문제가 없지만, **원격 투표를 붙일 때 정책을 좁혀야 한다.**

점검하며 만든 테스트 데이터는 `supabase/cleanup-test-data.sql`을 SQL Editor에서 한 번 실행하면 지워진다.

## 2-2. 누가 들어왔는지 보기 (테스트 관찰)

두 가지를 같이 쓴다. 하나는 "몇 명이 왔나", 하나는 "와서 뭘 했나".

### A. Vercel Web Analytics — 방문 수·유입 경로

- `index.html`에 `/_vercel/insights/script.js` 태그가 들어가 있다.
- **Vercel 대시보드 → 프로젝트 → Analytics → Enable** 을 한 번 눌러야 수집이 시작된다. (Hobby 무료, 이벤트 상한 있음)
- 여기서 보이는 것: 방문자 수·페이지뷰·유입 경로(카톡/직접 접속)·기기·국가. **익명 집계라 개인 추적은 안 된다.**

### B. 앱 안 접속 로그 — 와서 뭘 했나

- 스키마: `supabase/analytics.sql` (Supabase → SQL Editor에 붙여넣고 전체 실행)
- 기록되는 것: `open`(열어봄) · `guest`(시작하기) · `home_new` · `join` · `menu_add` · `plan_set` · `vote` · `tour_done` · `feedback`
- 기기 단위(`localStorage`의 device id)로 묶이므로 **로그인 전에 나간 사람도 잡힌다.**
- 보는 법: 주소 끝에 `#log` → `https://uritable.vercel.app/#log`
  - 처음엔 "관리자 등록 전" 화면이 뜬다. 거기 뜬 ID를 복사해서 SQL Editor에서 한 번만 실행:
    `insert into admins (user_id, memo) values ('붙여넣기', '나') on conflict do nothing;`
  - 등록 후에는 `#log`로 바로 열리고, **설정 → 정보**에도 '접속 로그' 항목이 생긴다(관리자에게만 보임).
- 읽기는 RLS로 `admins` 계정만 가능. 쓰기는 익명 포함 누구나(첫 방문을 잡아야 하므로) — 그래서 이론상 스팸이 가능하니, 필요하면 오래된 기록을 지운다:
  `delete from visits where created_at < now() - interval '90 days';`

## 3. 다음에 바로 할 수 있는 것

- [ ] **`coupang` Edge Function을 새 프로젝트에 배포** — 이거 전엔 장보기의 쿠팡 검색만 동작 안 함
  ```
  npx supabase login
  npx supabase link --project-ref agiclnnwevimdkwaufdl
  npx supabase functions deploy coupang
  ```
  그리고 Edge Functions → Secrets에 `COUPANG_ACCESS_KEY`·`COUPANG_SECRET_KEY` 등록.
  구 프로젝트에서 값이 안 보이면 쿠팡 파트너스에서 재발급받아야 한다.
- [ ] 카카오 앱 키 등록 → 로그인 완성 (개발자 콘솔 작업만 남음)
- [ ] 웹푸시(투표 알림) — PWA 상태에서 바로 가능, iOS는 홈 화면 추가 필요
- [ ] 계정·데이터 삭제 기능
- [x] ~~전용 Supabase 프로젝트 이관~~ (2026-08-09 완료 — 2-1-1 참고)
- [ ] Supabase Pro 전환
- [ ] 약관·개인정보처리방침 페이지
- [ ] Capacitor 스캐폴드 (Mac에서 빌드)
