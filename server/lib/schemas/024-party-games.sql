-- Up
CREATE TABLE partyState (
  roomId INTEGER NOT NULL REFERENCES rooms(roomId) ON DELETE CASCADE,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (roomId, key)
);
-- Down
DROP TABLE partyState;
