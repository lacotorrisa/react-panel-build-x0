alter table recepciones add column if not exists updated_at timestamptz default now();

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_recepciones_updated_at on recepciones;
create trigger set_recepciones_updated_at
before update on recepciones
for each row execute function set_updated_at();
