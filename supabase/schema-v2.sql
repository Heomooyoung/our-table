-- ═══════════════════════════════════════════════════════════
-- 우리집 식탁 — 스키마 v2 (2026-08-09)
-- 붙여넣는 곳: Supabase 대시보드 → SQL Editor → 전체 실행
-- schema.sql · analytics.sql 을 이미 돌린 프로젝트에 덧씌우는 변경분이다.
-- 여러 번 실행해도 안전하다.
--
-- 바뀌는 것 셋:
--   1. 한 계정 = 한 우리집  — 로그인만 하면 집이 자동으로 생기므로,
--                            버튼을 다시 눌러도 집이 새로 생기지 않게 한다.
--   2. 사진은 우리집 폴더 안에만  — 남의 집 경로로 못 올린다.
--   3. 투표는 진짜 비밀  — 남의 표는 아무도 못 읽고, 개표는 숫자만 받아온다.
-- ═══════════════════════════════════════════════════════════

-- ── 1. 우리집 만들기: 이미 있으면 그 집을 돌려준다 ─────────────
-- 전에는 부를 때마다 새 집이 생겼다(익명 계정 하나로 무제한 생성 가능).
-- 이제 집은 계정당 하나. 이름만 바꿔서 다시 불러도 같은 집이 나온다.
create or replace function create_home(member_name text)
returns table (home_id uuid, code text)
language plpgsql security definer set search_path = public as $$
declare h uuid; c text; nm text;
begin
  if auth.uid() is null then raise exception 'NOT_LOGGED_IN'; end if;
  nm := coalesce(nullif(btrim(member_name), ''), '나');

  -- 이미 속한 집이 있으면 새로 만들지 않는다 (가장 최근에 합류한 집)
  select m.home_id into h from members m
   where m.user_id = auth.uid() order by m.created_at desc limit 1;

  if h is not null then
    update members m set name = nm where m.user_id = auth.uid() and m.home_id = h;
    return query select h, ho.code from homes ho where ho.id = h;
    return;
  end if;

  loop
    c := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from homes where homes.code = c);
  end loop;
  insert into homes (code) values (c) returning id into h;
  insert into members (home_id, user_id, name) values (h, auth.uid(), nm);
  return query select h, c;
end $$;

-- 합류: 이름이 비면 '나'로. (초대 링크로 오면 이름을 안 물어보므로)
create or replace function join_home(invite_code text, member_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid; nm text;
begin
  if auth.uid() is null then raise exception 'NOT_LOGGED_IN'; end if;
  nm := coalesce(nullif(btrim(member_name), ''), '나');
  select id into h from homes where code = upper(btrim(invite_code));
  if h is null then raise exception 'INVALID_CODE'; end if;
  insert into members (home_id, user_id, name) values (h, auth.uid(), nm)
    on conflict (home_id, user_id) do update set name = excluded.name;
  return h;
end $$;

-- 내 이름 바꾸기 (설정에서)
create or replace function rename_me(new_name text)
returns void
language sql security definer set search_path = public as $$
  update members set name = coalesce(nullif(btrim(new_name), ''), name)
   where user_id = auth.uid()
$$;

-- ── 2. 사진: 우리집 폴더 안에만 올릴 수 있다 ───────────────────
-- 앱은 photos/<home_id>/<파일>.jpg 로 올린다. 남의 집 폴더나 아무 경로에는 못 올린다.
drop policy if exists "photos_upload" on storage.objects;
drop policy if exists photos_upload   on storage.objects;
create policy photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'photos'
    and (storage.foldername(name))[1] in (select h::text from my_home_ids() h));

-- 우리집 사진은 우리집 식구가 지울 수 있다 (메뉴를 지웠을 때 정리용)
drop policy if exists photos_delete on storage.objects;
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos'
    and (storage.foldername(name))[1] in (select h::text from my_home_ids() h));

-- ── 3. 투표: 남의 표는 아무도 못 본다 ─────────────────────────
-- 전에는 같은 집 식구면 ballots를 통째로 읽을 수 있어서, 누가 뭘 찍었는지 다 보였다.
-- 이제 읽을 수 있는 건 자기 표뿐이고, 개표는 아래 vote_tally가 숫자만 돌려준다.
drop policy if exists ballots_all on ballots;
drop policy if exists ballots_r   on ballots;
drop policy if exists ballots_w   on ballots;
drop policy if exists ballots_u   on ballots;
drop policy if exists ballots_d   on ballots;

create policy ballots_r on ballots for select using (
  member_id in (select id from members where user_id = auth.uid()));
create policy ballots_w on ballots for insert with check (
  member_id in (select id from members where user_id = auth.uid())
  and vote_id in (select id from votes where home_id in (select my_home_ids())));
create policy ballots_u on ballots for update
  using      (member_id in (select id from members where user_id = auth.uid()))
  with check (member_id in (select id from members where user_id = auth.uid()));
create policy ballots_d on ballots for delete using (
  member_id in (select id from members where user_id = auth.uid()));

-- 개표: 후보별 표 수만. 누가 찍었는지는 나가지 않는다.
create or replace function vote_tally(v_id uuid)
returns table (choice text, cnt bigint)
language sql security definer set search_path = public stable as $$
  select b.choice, count(*)::bigint
    from ballots b join votes v on v.id = b.vote_id
   where b.vote_id = v_id
     and v.home_id in (select my_home_ids())     -- 우리집 투표만
   group by b.choice
$$;

-- 실시간 개표를 유지하기 위한 장치.
-- 남의 표를 못 읽게 되면서 ballots 변경 알림도 못 받는다. 그래서 표가 들어올 때마다
-- votes 행을 건드려, 같은 집 식구 모두에게 "다시 세어봐" 신호가 가게 한다.
alter table votes add column if not exists updated_at timestamptz not null default now();

create or replace function bump_vote() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update votes set updated_at = now()
   where id = coalesce(new.vote_id, old.vote_id);
  return null;
end $$;

drop trigger if exists ballots_bump on ballots;
create trigger ballots_bump after insert or update or delete on ballots
  for each row execute function bump_vote();

-- ── 확인 ──────────────────────────────────────────────────────
select 'schema v2 적용 완료' as status;
