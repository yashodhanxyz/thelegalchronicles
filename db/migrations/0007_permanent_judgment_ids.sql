ALTER TABLE judgments ADD COLUMN public_id TEXT CHECK(public_id IS NULL OR (length(public_id) = 8 AND public_id NOT GLOB '*[^a-z0-9]*'));
UPDATE judgments SET public_id = lower(substr(slug, -8));
CREATE UNIQUE INDEX judgments_public_id_unique ON judgments(public_id);
CREATE TRIGGER judgments_public_id_immutable BEFORE UPDATE OF public_id ON judgments
WHEN OLD.public_id IS NOT NULL AND NEW.public_id IS NOT OLD.public_id
BEGIN SELECT RAISE(ABORT, 'Permanent judgment ID cannot change'); END;
CREATE TRIGGER judgments_public_id_required BEFORE INSERT ON judgments
WHEN NEW.public_id IS NULL
BEGIN SELECT RAISE(ABORT, 'Permanent judgment ID required'); END;
