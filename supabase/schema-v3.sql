-- ═══════════════════════════════════════════════════════════
-- 우리집 식탁 — 스키마 v3 (2026-08-09)
-- 관리자를 '계정 ID'가 아니라 '이메일'로 기억한다.
--
-- 전에는 admins에 user_id를 넣어뒀는데, 테스트하려고 계정을 지웠다 다시
-- 만들면 ID가 바뀌어서 관리자 자격이 날아갔다. 이메일은 그대로이므로
-- 몇 번을 지웠다 다시 로그인해도 접속 로그를 계속 볼 수 있다.
-- ═══════════════════════════════════════════════════════════

alter table admins add column if not exists email text;

-- user_id 없이 이메일만으로도 등록할 수 있어야 하므로 기본키를 먼저 푼다
alter table admins drop constraint if exists admins_pkey;
alter table admins alter column user_id drop not null;
create unique index if not exists admins_email_uq on admins (lower(email)) where email is not null;
create unique index if not exists admins_uid_uq   on admins (user_id)      where user_id is not null;

create or replace function is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from admins a
     where (a.user_id is not null and a.user_id = auth.uid())
        or (a.email  is not null and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email','')))
  )
$$;

select 'schema v3 적용 완료' as status;
