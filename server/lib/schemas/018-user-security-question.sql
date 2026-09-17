-- Up
-- Self-service password reset without email: the singer picks a question and
-- an answer, and answering it later lets them choose a new password. The
-- question is shown to anyone who types the username, so it is plain text;
-- the answer is hashed like a password (after trimming and lowercasing, so
-- "Paris " and "paris" are the same answer).
--
-- Nullable, and nothing backfills them: accounts made before this, and guests,
-- have no question and fall back to asking the host.
ALTER TABLE users ADD COLUMN "securityQuestion" text;
ALTER TABLE users ADD COLUMN "securityAnswer" text;

-- Down
ALTER TABLE users DROP COLUMN "securityAnswer";

ALTER TABLE users DROP COLUMN "securityQuestion";
