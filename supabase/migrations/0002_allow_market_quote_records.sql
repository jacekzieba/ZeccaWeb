alter table public.encrypted_records
  drop constraint if exists encrypted_records_record_type_check;

alter table public.encrypted_records
  add constraint encrypted_records_record_type_check
  check (
    record_type in (
      'account',
      'asset',
      'transaction',
      'manualValuation',
      'income',
      'settings',
      'marketQuote'
    )
  );
