-- Ręczna kopia encrypted_records zrobiona 2026-07-15 przed pogodzeniem klucza
-- tabeli (20260721103000). Nie ma FK do auth.users, więc usunięcie konta jej
-- nie czyści, a polityka prywatności obiecuje trwałe usunięcie danych.
-- Zawiera wyłącznie szyfrogram. Przed zastosowaniem: upewnij się, że żaden
-- użytkownik nie czeka na odzysk danych z tej kopii.
drop table if exists public.encrypted_records_backup_20260715;
