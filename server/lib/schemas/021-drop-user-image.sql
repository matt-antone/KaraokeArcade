-- Up
-- The uploaded photo is gone. A singer is a fighter from the roster now, and
-- 020 is where that choice lives; nothing has read this column since the last
-- render site moved over to it.
--
-- Deliberately its own migration rather than part of 020. 020 is additive and
-- safe to run ahead of anything: a server rolled back to before this point
-- still has every photo. This one is the single step that cannot be undone, so
-- it stands alone and it lands one change after the last reader of the data
-- went away.
--
-- Operators are told outright, in CHANGELOG.md, that upgrading destroys stored
-- photos and that anyone who wants them should dump the database first. A
-- destructive migration nobody is warned about is the actual hazard here; the
-- migration itself is ordinary.
ALTER TABLE users DROP COLUMN "image";

-- Down
-- The column comes back empty and stays empty. The photos are not recoverable
-- from anywhere in this database -- they were the only copy the server held,
-- and dropping the column dropped the blobs with it. Said plainly rather than
-- implied, because a downgrade that silently restores an empty column is a
-- downgrade somebody reads as "the photos will come back".
ALTER TABLE users ADD COLUMN "image" blob;
