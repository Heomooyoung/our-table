-- ═══════════════════════════════════════════════════════════
-- 연결 테스트로 생긴 찌꺼기 지우기 (2026-08-09)
-- 붙여넣는 곳: Supabase 대시보드 → SQL Editor → 전체 실행
--
-- 테스트에서 만든 것만 골라 지운다. 실제 데이터는 건드리지 않는다.
-- homes를 지우면 members·menus·plans는 on delete cascade로 같이 사라진다.
-- ═══════════════════════════════════════════════════════════

-- 1) 테스트로 만든 우리집 7개 (초대 코드로 특정)
delete from homes where code in
  ('EB3F70','641A2A','63AD89','BBA016','39F1FD','B298A0','7A5737');

-- 2) 테스트 접속 로그 · 의견
delete from visits   where device = 'E2E-TEST-DEVICE';
delete from feedback where message = 'E2E 테스트 의견';

-- 3) 어느 집에도 속하지 않게 된 익명 계정 (테스트로 만든 것들)
--    실제 사용자는 members에 행이 있으므로 남는다.
delete from auth.users u
 where u.is_anonymous
   and not exists (select 1 from members m where m.user_id = u.id)
   and u.created_at > now() - interval '1 day';

-- 4) 확인 — 셋 다 0이어야 한다
select
  (select count(*) from homes   where code in ('EB3F70','641A2A','63AD89','BBA016','39F1FD','B298A0','7A5737')) as 남은_테스트집,
  (select count(*) from visits  where device = 'E2E-TEST-DEVICE')                                              as 남은_테스트로그,
  (select count(*) from menus   where name in ('E2E 김치찌개','실시간 된장찌개','남의집 비밀메뉴 갈비찜'))      as 남은_테스트메뉴;

-- 5) 테스트 사진 한 장은 Storage에 있다. 대시보드에서 지운다:
--    Storage → photos → e2e-test/ 폴더 삭제
