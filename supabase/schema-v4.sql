-- ═══════════════════════════════════════════════════════════
-- 우리테이블 — 스키마 v4 (2026-08-10)
-- 붙여넣는 곳: Supabase 대시보드 → SQL Editor → 전체 실행
-- schema.sql · analytics.sql · schema-v2.sql · schema-v3.sql 다음에 돌린다.
-- 여러 번 실행해도 안전하다.
--
-- 바뀌는 것: 한 끼(날짜×끼니)에 메뉴를 여러 개 넣을 수 있다.
--   전에는 plans 한 행에 menu_id 한 칸뿐이라, 저녁에 된장찌개를 넣으면
--   계란말이는 넣을 자리가 없었다. menu_ids(jsonb)에 순서대로 담는다 —
--   첫 번째가 메인이고, 나머지는 같이 먹는 것이다.
--
--   menu_id · delivery 는 그대로 둔다. 옛 앱(캐시에 남은 index.html)이
--   아직 그 두 칸만 읽기 때문이다. 앱은 두 칸을 함께 써서, 옛 앱에도
--   최소한 메인 메뉴 하나는 보이게 한다.
-- ═══════════════════════════════════════════════════════════

alter table plans add column if not exists menu_ids jsonb not null default '[]'::jsonb;

-- 이미 있던 칸들을 새 형식으로 옮겨 적는다 (배달 찬스는 'DELIV' 한 글자로)
update plans
   set menu_ids = case
         when delivery then '["DELIV"]'::jsonb
         when menu_id is not null then jsonb_build_array(menu_id::text)
         else '[]'::jsonb
       end
 where menu_ids = '[]'::jsonb
   and (delivery or menu_id is not null);

select 'schema v4 적용 완료' as status;
