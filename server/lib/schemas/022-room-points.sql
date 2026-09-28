-- Up
-- The night's leaderboard: one running total per player per room, fed by
-- everything that earns points — singing, battles, trivia. Per room and per
-- night, like triviaScores: stopping the room empties it. Absence from this
-- table is "has not scored yet", so the board only ever lists people who have.
CREATE TABLE IF NOT EXISTS "roomPoints" (
  "roomId" integer NOT NULL REFERENCES rooms(roomId) DEFERRABLE INITIALLY DEFERRED,
  "userId" integer NOT NULL REFERENCES users(userId) DEFERRABLE INITIALLY DEFERRED,
  "points" integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idxRoomPointsRoomUser ON "roomPoints" ("roomId" ASC, "userId" ASC);

-- Down
DROP INDEX IF EXISTS idxRoomPointsRoomUser;
DROP TABLE roomPoints;
