-- One row per address. NOCASE so Someone@x.com and someone@x.com are one signup; the
-- address is kept as it was typed.
CREATE TABLE signups (
  email      TEXT PRIMARY KEY COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
