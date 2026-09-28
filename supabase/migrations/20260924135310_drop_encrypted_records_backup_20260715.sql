-- Ręczna kopia encrypted_records zrobiona 2026-07-15 przed pogodzeniem klucza
-- tabeli (20260721103000). Nie ma FK do auth.users, więc usunięcie konta jej
-- nie czyści, a polityka prywatności obiecuje trwałe usunięcie danych.
-- Zawierała wyłącznie szyfrogram. Zastosowane na produkcji 2026-09-24 za
-- zgodą właściciela (audyt ZeccaWeb FOLLOWUP_2026-09-24, F-06).
drop table if exists public.encrypted_records_backup_20260715;
