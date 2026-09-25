-- Reference schema for a future adapter. The fixture intentionally uses the
-- in-memory repository; this SQL is documentation and is not executed.
CREATE TABLE reservations (
  reservation_id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('held', 'confirmed', 'cancelled'))
);

CREATE INDEX reservations_tool_window
  ON reservations (tool_id, starts_at, ends_at);
