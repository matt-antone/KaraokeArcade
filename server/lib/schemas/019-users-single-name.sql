-- Up
-- An account used to have a username to sign in with and a separate display
-- name for the queue. They are one name now: the username. The name column
-- stays as what every queue, battle and trivia query reads, and is kept equal
-- to the username for everyone but guests, who have no username of their own
-- (theirs is a generated guest-XXXXX) and so keep the name they typed.
UPDATE users
SET name = username
WHERE roleId <> (SELECT roleId FROM roles WHERE name = 'guest');

-- Down
-- Nothing to undo: the display names this overwrote are gone.
