CREATE INDEX IF NOT EXISTS idx_finance_records_kind_currency_date ON finance_records(kind,currency,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_valuations_record_date ON finance_valuations(finance_record_id,value_date DESC);
