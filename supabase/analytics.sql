-- ═══════════════════════════════════════════════════════════
-- 우리집 식탁 — 접속 로그 v1 (테스터 관찰용)
-- 붙여넣는 곳: Supabase 대시보드 → SQL Editor → 전체 실행
--
-- 남는 것: 어떤 기기가 언제 들어와서 어디까지 갔는지(열어봄 → 시작 →
--          우리집 만듦 → 메뉴 등록 → 식단 배치 → 투표 …).
-- 읽는 사람: admins 에 등록된 계정 하나뿐. 나머지는 쓰기만 되고 읽지 못한다.
-- 보는 곳: 앱 주소 뒤에 #log  (예: https://uritable.vercel.app/#log)
-- ═══════════════════════════════════════════════════════════

create table if not exists visits (
  id         uuid primary key default gen_random_uuid(),
  device     text not null,                 -- 기기 고유값(localStorage) — 로그인 전에도 사람을 묶어준다
  user_id    uuid,                          -- 로그인했으면 auth.uid()
  home_id    uuid,
  event      text not null,                 -- open/guest/home_new/join/menu_add/plan_set/vote/tour_done/feedback
  detail     text not null default '',
  ref        text not null default '',      -- 유입 경로(referrer) — 카톡으로 보낸 링크인지 등
  ua         text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists visits_at  on visits (created_at desc);
create index if not exists visits_dev on visits (device, created_at desc);

alter table visits enable row level security;

-- 쓰기: 로그인 전(anon)에도 남아야 "들어왔다 그냥 나간 사람"이 잡힌다.
drop policy if exists visits_w on visits;
create policy visits_w on visits for insert to anon, authenticated with check (true);

-- 관리자 명단. 정책이 하나도 없으므로 앱에서는 읽지도 쓰지도 못한다(대시보드 전용).
create table if not exists admins (
  user_id uuid primary key,
  memo    text not null default ''
);
alter table admins enable row level security;

create or replace function is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

-- 읽기: 관리자만.
drop policy if exists visits_r on visits;
create policy visits_r on visits for select to authenticated using (is_admin());

-- 보내온 의견도 관리자만 읽는다 (feedback 테이블 자체는 schema.sql에 있다)
drop policy if exists feedback_r on feedback;
create policy feedback_r on feedback for select to authenticated using (is_admin());

-- ── 마지막 한 단계 (딱 한 번만) ─────────────────────────────
-- 1) 내 폰/PC에서 앱을 열고 주소 끝에 #log 를 붙여 접속 → 내 계정 ID가 뜬다(복사 버튼 있음)
-- 2) 그 ID로 아래 한 줄 실행
--      insert into admins (user_id, memo) values ('여기에-붙여넣기', '나') on conflict do nothing;
-- 3) 다시 #log 로 들어가면 로그가 보이고, 설정 맨 아래에도 '접속 로그'가 생긴다
--
-- 참고: 오래된 기록 정리는 이 한 줄로.
--   delete from visits where created_at < now() - interval '90 days';
