CREATE TABLE user_ledgers (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  expenses jsonb NOT NULL DEFAULT '[]'::jsonb,
  paycheck_settings jsonb,
  balance_snapshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  transfers jsonb NOT NULL DEFAULT '[]'::jsonb,
  description_choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  removed_choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
