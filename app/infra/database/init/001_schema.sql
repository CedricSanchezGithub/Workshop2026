CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  password_hash TEXT NOT NULL,
  avatar_svg TEXT NOT NULL CHECK (avatar_svg LIKE '<svg%'),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS booking_quotes (
  booking_id TEXT PRIMARY KEY,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR')
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  booking_id TEXT NOT NULL REFERENCES booking_quotes(booking_id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  status TEXT NOT NULL CHECK (status IN ('awaiting_verification','pending','processing','succeeded','failed','refund_pending','refunded')),
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  provider_reference TEXT,
  failure_code TEXT,
  payment_method_token TEXT NOT NULL,
  payment_method_last4 CHAR(4) NOT NULL,
  payment_method_brand TEXT NOT NULL CHECK (payment_method_brand IN ('visa','mastercard','amex','other')),
  payer_email TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  refund_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS payment_intents_user_idx ON payment_intents(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_jobs (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('payment.process','payment.refund')),
  payment_id TEXT NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_jobs_pending_idx ON payment_jobs(status, available_at, id);

CREATE TABLE IF NOT EXISTS queue_config (
  config_key TEXT PRIMARY KEY,
  worker_count INTEGER NOT NULL DEFAULT 1 CHECK (worker_count BETWEEN 1 AND 10)
);

INSERT INTO queue_config (config_key, worker_count) VALUES ('payments', 1)
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO booking_quotes (booking_id, amount_cents)
VALUES
  ('booking_1',3900),('booking_2',2400),('booking_3',8900),('booking_4',2900),
  ('booking_5',1800),('booking_6',3500),('booking_7',4200),('booking_8',7400),
  ('booking_9',2500),('booking_10',2200),('booking_11',4400),('booking_12',9200),
  ('booking_13',4900),('booking_14',1900),('booking_15',2100),('booking_16',9900)
ON CONFLICT (booking_id) DO UPDATE SET amount_cents = EXCLUDED.amount_cents;
