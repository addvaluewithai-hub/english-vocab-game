export const MIGRATION_007 = `
ALTER TABLE import_candidates ADD COLUMN cefr_level TEXT CHECK(cefr_level IN ('A1','A2','B1','B2','C1','C2'));
`;
