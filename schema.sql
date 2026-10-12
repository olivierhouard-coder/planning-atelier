PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  return_date TEXT,
  vehicle_info TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_slots_entry_date ON slots(entry_date);
CREATE INDEX IF NOT EXISTS idx_slots_return_date ON slots(return_date);

CREATE TABLE IF NOT EXISTS slot_photos (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  remind_at TEXT NOT NULL,
  message TEXT,
  recipient_olivier INTEGER NOT NULL DEFAULT 1,
  recipient_christophe INTEGER NOT NULL DEFAULT 1,
  completed_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(remind_at, sent_at, completed_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_name TEXT NOT NULL DEFAULT 'Téléphone',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
