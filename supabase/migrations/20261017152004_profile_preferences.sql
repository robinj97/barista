-- Profile-wide preferences: temperature unit and default brew method.
-- Temperatures are always stored in degrees C; the unit only affects display.

alter table public.profiles
  add column temp_unit text not null default 'c' check (temp_unit in ('c', 'f')),
  add column default_method text not null default 'v60'
    check (default_method in ('v60', 'aeropress', 'espresso'));

alter table public.profiles
  add constraint profiles_display_name_length
  check (char_length(btrim(display_name)) between 1 and 60);

-- Keep sign-up working when a Google name is unusually long or blank.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), ''),
        'Barista user'
      ),
      60
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

grant update (temp_unit, default_method) on public.profiles to authenticated;
