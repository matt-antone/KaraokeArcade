-- Up
-- Where tonight's points came from, beside the total: songs sung to the end,
-- battles won, battles lost or drawn, trivia points and trivia rounds played.
-- The account page draws one ledger row per kind. Counters rather than a log:
-- the room only ever asks "how many" and "how much", and a row per event
-- would be a table that grows all night to answer the same question.
--
-- A row now also exists for everyone who joins the room, at 0, so the board
-- lists the whole room rather than only the people who have scored.
ALTER TABLE roomPoints ADD COLUMN "sings" integer NOT NULL DEFAULT 0;
ALTER TABLE roomPoints ADD COLUMN "battleWins" integer NOT NULL DEFAULT 0;
ALTER TABLE roomPoints ADD COLUMN "battlePlays" integer NOT NULL DEFAULT 0;
ALTER TABLE roomPoints ADD COLUMN "triviaPoints" integer NOT NULL DEFAULT 0;
ALTER TABLE roomPoints ADD COLUMN "triviaRounds" integer NOT NULL DEFAULT 0;

-- Down
ALTER TABLE roomPoints DROP COLUMN "triviaRounds";
ALTER TABLE roomPoints DROP COLUMN "triviaPoints";
ALTER TABLE roomPoints DROP COLUMN "battlePlays";
ALTER TABLE roomPoints DROP COLUMN "battleWins";
ALTER TABLE roomPoints DROP COLUMN "sings";
