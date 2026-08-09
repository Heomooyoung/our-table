-- ═══════════════════════════════════════════════════════════
-- 전부 비우기 — 실사용자를 받기 전에만 쓴다 (2026-08-09)
-- 붙여넣는 곳: Supabase 대시보드 → SQL Editor → 전체 실행
--
-- ⚠️ 이 파일은 데이터를 통째로 지운다. 가족이 쓰기 시작한 뒤에는 절대 실행하지 말 것.
--    테스트를 여러 번 돌린 뒤 깨끗한 상태에서 다시 시작하고 싶을 때만 쓴다.
--    homes를 지우면 members·menus·plans·votes는 on delete cascade로 같이 사라진다.
-- ═══════════════════════════════════════════════════════════

delete from homes;
delete from visits;
delete from feedback;
delete from auth.users;

select (select count(*) from homes)      as 우리집,
       (select count(*) from members)    as 식구,
       (select count(*) from menus)      as 메뉴,
       (select count(*) from visits)     as 접속로그,
       (select count(*) from auth.users) as 계정;

-- 사진은 SQL로 못 지운다(스토리지 보호 장치). 대시보드에서:
--   Storage → photos → 폴더 전체 삭제
