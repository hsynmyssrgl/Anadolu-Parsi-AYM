ALTER TABLE archive_versions ADD COLUMN stored_name TEXT;
UPDATE archive_versions SET stored_name=(SELECT stored_name FROM archive_items WHERE archive_items.id=archive_versions.archive_item_id) WHERE stored_name IS NULL;
CREATE INDEX IF NOT EXISTS idx_archive_items_family_created ON archive_items(family_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_versions_item_version ON archive_versions(archive_item_id,version_no DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_archive_versions_item_sha ON archive_versions(archive_item_id,sha256);
