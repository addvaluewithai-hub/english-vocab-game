import type { SqlDatabase } from '@/data/database';
import { createId } from '@/utils/id';
import type { EnrichmentKind, EnrichmentProvenance } from './rules';

export interface SenseEnrichment {
  id: string;
  senseId: string;
  kind: EnrichmentKind;
  valueText: string | null;
  valueUri: string | null;
  provenance: EnrichmentProvenance;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  deletedAt: string | null;
}

type Row = {
  id: string;
  sense_id: string;
  kind: EnrichmentKind;
  value_text: string | null;
  value_uri: string | null;
  provenance: EnrichmentProvenance;
  source_id: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function mapRow(row: Row): SenseEnrichment {
  return {
    id: row.id,
    senseId: row.sense_id,
    kind: row.kind,
    valueText: row.value_text,
    valueUri: row.value_uri,
    provenance: row.provenance,
    sourceId: row.source_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

export class SenseEnrichmentRepository {
  constructor(private readonly db: SqlDatabase) {}

  async listForSense(senseId: string): Promise<SenseEnrichment[]> {
    const rows = await this.db.getAllAsync<Row>(
      `SELECT * FROM sense_enrichments WHERE sense_id=? AND deleted_at IS NULL ORDER BY created_at ASC, id ASC`,
      senseId,
    );
    return rows.map(mapRow);
  }

  async add(input: {
    senseId: string;
    kind: EnrichmentKind;
    valueText?: string | null;
    valueUri?: string | null;
    provenance: EnrichmentProvenance;
    sourceId?: string | null;
  }, now = new Date()): Promise<SenseEnrichment> {
    const timestamp = now.toISOString();
    const enrichment: SenseEnrichment = {
      id: createId('enrichment'),
      senseId: input.senseId,
      kind: input.kind,
      valueText: input.valueText?.trim() || null,
      valueUri: input.valueUri?.trim() || null,
      provenance: input.provenance,
      sourceId: input.sourceId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      deletedAt: null,
    };
    await this.db.runAsync(
      `INSERT INTO sense_enrichments(id,sense_id,kind,value_text,value_uri,provenance,source_id,created_at,updated_at,version,deleted_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,NULL)`,
      enrichment.id,
      enrichment.senseId,
      enrichment.kind,
      enrichment.valueText,
      enrichment.valueUri,
      enrichment.provenance,
      enrichment.sourceId,
      enrichment.createdAt,
      enrichment.updatedAt,
      enrichment.version,
    );
    return enrichment;
  }

  async remove(id: string, now = new Date()): Promise<void> {
    await this.db.runAsync(
      `UPDATE sense_enrichments SET deleted_at=?, updated_at=?, version=version+1 WHERE id=? AND deleted_at IS NULL`,
      now.toISOString(),
      now.toISOString(),
      id,
    );
  }
}
