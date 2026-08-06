-- ═══════════════════════════════════════════════════════════
-- 우리집 식탁 — Supabase 스키마 v1
-- 붙여넣는 곳: Supabase 대시보드 → SQL Editor → 전체 실행
--
-- 인증 모델: 익명 로그인(Anonymous Sign-in)을 사용한다.
--   각 가족 기기가 익명 유저(auth.uid())가 되고, 6자리 초대 코드로
--   우리집(home)에 합류하면 members에 매핑된다. 비밀번호 없음.
--   ※ 대시보드 → Authentication → Sign In / Up → Anonymous Sign-ins 켜기
-- ═══════════════════════════════════════════════════════════

-- 우리집 (가족 단위)
create table homes (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,              -- 초대 코드 (6자, 대문자)
  name       text not null default '우리집',
  created_at timestamptz not null default now()
);

-- 가족 구성원 (기기 = 익명 유저 1명)
create table members (
  id         uuid primary key default gen_random_uuid(),
  home_id    uuid not null references homes(id) on delete cascade,
  user_id    uuid not null,                     -- auth.uid()
  name       text not null,
  created_at timestamptz not null default now(),
  unique (home_id, user_id)
);

-- 메뉴판
create table menus (
  id             uuid primary key,
  home_id        uuid not null references homes(id) on delete cascade,
  no             int  not null default 0,       -- 우리집 내 등록번호 (트리거로 서버 발급)
  name           text not null,
  cat            text not null default '',
  rating         int  not null default 0,
  cook_count     int  not null default 0,
  last_cooked_at date,
  photo_url      text not null default '',      -- Storage 경로만. dataURI 저장 금지
  memo           text not null default '',
  ingredients    jsonb not null default '[]',   -- [{name,amount,brand,photo_url}]
  steps          jsonb not null default '[]',
  deleted        boolean not null default false, -- 동기화용 tombstone (하드삭제 금지)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- No. 서버 발급 (가족 규모라 엄격한 잠금은 생략 — 충돌해도 표시용이라 무해)
create or replace function set_menu_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.no is null or new.no = 0 then
    select coalesce(max(no), 0) + 1 into new.no from menus where home_id = new.home_id;
  end if;
  return new;
end $$;
create trigger menus_no before insert on menus
  for each row execute function set_menu_no();

-- 주간 식단표 (칸 = 날짜×끼니)
create table plans (
  home_id    uuid not null references homes(id) on delete cascade,
  date       date not null,
  meal       text not null check (meal in ('b','l','d')),
  menu_id    uuid references menus(id) on delete cascade,
  delivery   boolean not null default false,    -- 배달 찬스가 이긴 날
  updated_at timestamptz not null default now(),
  primary key (home_id, date, meal)
);

-- 장보기: 직접 추가 항목
create table shopping_extras (
  id         uuid primary key default gen_random_uuid(),
  home_id    uuid not null references homes(id) on delete cascade,
  week       date not null,                     -- 그 주 월요일
  name       text not null,
  amount     text not null default '',
  created_at timestamptz not null default now()
);

-- 장보기: 체크 상태
create table shopping_checked (
  home_id    uuid not null references homes(id) on delete cascade,
  week       date not null,
  item_key   text not null,                     -- 재료명 또는 x{extra_id}
  checked    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (home_id, week, item_key)
);

-- 투표 (원격: 각자 폰에서)
create table votes (
  id         uuid primary key default gen_random_uuid(),
  home_id    uuid not null references homes(id) on delete cascade,
  date       date not null,
  meal       text not null check (meal in ('b','l','d')),
  candidates jsonb not null,                    -- ["<menu_id>", ..., "DELIV"]
  status     text not null default 'open' check (status in ('open','closed')),
  created_by uuid,                              -- members.id
  created_at timestamptz not null default now()
);

create table ballots (
  vote_id    uuid not null references votes(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  choice     text not null,                     -- menu_id 또는 'DELIV'
  created_at timestamptz not null default now(),
  primary key (vote_id, member_id)              -- 1인 1표, 다시 찍으면 upsert
);

-- ═══════════ RLS: 우리집 멤버만 우리집 데이터 접근 ═══════════
alter table homes            enable row level security;
alter table members          enable row level security;
alter table menus            enable row level security;
alter table plans            enable row level security;
alter table shopping_extras  enable row level security;
alter table shopping_checked enable row level security;
alter table votes            enable row level security;
alter table ballots          enable row level security;

create or replace function my_home_ids() returns setof uuid
language sql security definer set search_path = public stable as $$
  select home_id from members where user_id = auth.uid()
$$;

create policy homes_r   on homes   for select using (id in (select my_home_ids()));
create policy members_r on members for select using (home_id in (select my_home_ids()));
create policy members_u on members for update using (home_id in (select my_home_ids()));
create policy members_d on members for delete using (home_id in (select my_home_ids()));

create policy menus_all   on menus            for all using (home_id in (select my_home_ids())) with check (home_id in (select my_home_ids()));
create policy plans_all   on plans            for all using (home_id in (select my_home_ids())) with check (home_id in (select my_home_ids()));
create policy extras_all  on shopping_extras  for all using (home_id in (select my_home_ids())) with check (home_id in (select my_home_ids()));
create policy checked_all on shopping_checked for all using (home_id in (select my_home_ids())) with check (home_id in (select my_home_ids()));
create policy votes_all   on votes            for all using (home_id in (select my_home_ids())) with check (home_id in (select my_home_ids()));
create policy ballots_all on ballots
  for all using (vote_id in (select id from votes where home_id in (select my_home_ids())))
  with check (member_id in (select id from members where user_id = auth.uid()));

-- ═══════════ 가입/합류 RPC (RLS 우회가 필요한 두 동작) ═══════════

-- 새 우리집 만들기 → 초대 코드 반환
create or replace function create_home(member_name text)
returns table (home_id uuid, code text)
language plpgsql security definer set search_path = public as $$
declare h uuid; c text;
begin
  loop
    c := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from homes where homes.code = c);
  end loop;
  insert into homes (code) values (c) returning id into h;
  insert into members (home_id, user_id, name) values (h, auth.uid(), member_name);
  return query select h, c;
end $$;

-- 초대 코드로 합류
create or replace function join_home(invite_code text, member_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  select id into h from homes where code = upper(trim(invite_code));
  if h is null then raise exception 'INVALID_CODE'; end if;
  insert into members (home_id, user_id, name) values (h, auth.uid(), member_name)
    on conflict (home_id, user_id) do update set name = excluded.name;
  return h;
end $$;

-- ═══════════ 실시간 (투표 개표·오늘 메뉴가 가족 폰에 바로 뜨게) ═══════════
alter publication supabase_realtime add table plans, votes, ballots, menus, shopping_extras, shopping_checked;

-- ═══════════ Storage (사진) ═══════════
-- 버킷은 API/대시보드에서: 이름 photos, Public bucket 체크. (public 읽기)
-- 업로드 정책 (익명 포함 로그인 유저 허용):
create policy "photos_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
