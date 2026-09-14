-- Up
-- A battle is fought by two people singing as two fighters, and the fighter is
-- the thing on screen for the whole five minutes. Until now that choice lived
-- only on the invite, which is a map entry the server deletes the instant the
-- queue row is written -- so the stage had nothing to draw with by the time it
-- was asked to draw. These two columns are where the choice survives the
-- negotiation that made it.
--
-- Text, not an integer keyed at anything. The roster is client-side art
-- (src/lib/battleSingers.ts): a slot exists because an artist delivered the
-- PNGs for it, and the server has no copy of the list and no opinion about it.
-- It stores the short id a fighter picked and hands it back on every beat. A
-- lookup table here would be a second place to forget to update when the
-- ninth fighter lands, and a foreign key would make the roster an operator's
-- to edit, which it is not.
--
-- Named the way 016 named its pair: the bare column is the challenger's, the
-- opponent's is prefixed. userId/opponentUserId and songId/opponentSongId
-- already read that way, and a battle row that spelled one of its three pairs
-- differently is a row somebody reads wrong at 2am.
--
-- Nullable, and nothing backfills them. Every battle queued before this
-- migration ran has no fighter recorded and never will -- there is no answer
-- to invent, and inventing one puts a stranger's face on somebody's turn.
-- battleSingerOrDefault reads the empty string as "draw the first playable
-- fighter", so those rows still run; they simply run with the default.
ALTER TABLE queue ADD COLUMN "singerId" text;
ALTER TABLE queue ADD COLUMN "opponentSingerId" text;

-- Down
-- Columns only. 016's downgrade deletes the battle rows because a battle
-- stripped of its second singer and second song is not a turn anybody can
-- sing; this one takes away nothing a battle needs to run, only who it is
-- drawn as. Deleting rows to undo a cosmetic column would cost a room its
-- queue to save it a default sprite.
ALTER TABLE queue DROP COLUMN "opponentSingerId";

ALTER TABLE queue DROP COLUMN "singerId";
