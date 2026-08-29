export const MIGRATION_006 = `
ALTER TABLE import_candidates ADD COLUMN source_uri TEXT;
ALTER TABLE import_candidates ADD COLUMN source_locator TEXT;
ALTER TABLE import_candidates ADD COLUMN source_page_number INTEGER;
ALTER TABLE import_candidates ADD COLUMN source_timestamp_seconds REAL;
ALTER TABLE import_candidates ADD COLUMN is_visually_concrete INTEGER CHECK(is_visually_concrete IN (0, 1));
`;
