/**
 * One-time migration: expand 8-stage implementation template to 10 stages
 * by inserting "NDA" (position 2) and "Agreement" (position 3).
 *
 * New order:
 *  0 Initial Engagement      (unchanged)
 *  1 NDA                     (NEW)
 *  2 Agreement               (NEW)
 *  3 Business Analysis       (was 1)
 *  4 Technical Development   (was 2)
 *  5 Integration Testing     (was 3)
 *  6 UAT                     (was 4)
 *  7 PT-AV                   (was 5)
 *  8 Go-Live Preparation     (was 6)
 *  9 Production Go-Live      (was 7)
 *
 * Usage:  node scripts/migrate-stages-10.mjs
 */
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const NEW_DEFAULT_STAGES = [
  "Initial Engagement",
  "NDA",
  "Agreement",
  "Business Analysis",
  "Technical Development",
  "Integration Testing (STG)",
  "User Acceptance Testing (UAT)",
  "Penetration Testing & Vulnerability Assessment (PT-AV)",
  "Go-Live Preparation",
  "Production Go-Live",
];

async function run() {
  const client = await pool.connect();
  const report = {
    banksUpdated: [],
    stagesInserted: 0,
    stagesReordered: 0,
    errors: [],
    summary: [],
  };

  try {
    await client.query('BEGIN');

    // ── 1. Snapshot before state ────────────────────────────────────────────
    const { rows: before } = await client.query(`
      SELECT bank_id,
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE completed) as done,
             ROUND(COUNT(*) FILTER (WHERE completed)::numeric / NULLIF(COUNT(*) FILTER (WHERE NOT skipped), 0) * 100, 1) AS pct_before
      FROM implementation_stages
      GROUP BY bank_id
      ORDER BY bank_id
    `);

    // ── 2. Guard: skip banks that already have NDA (idempotent) ────────────
    const { rows: alreadyMigrated } = await client.query(`
      SELECT DISTINCT bank_id FROM implementation_stages WHERE name = 'NDA'
    `);
    const migratedSet = new Set(alreadyMigrated.map(r => r.bank_id));

    const banksToMigrate = before.filter(r => !migratedSet.has(r.bank_id));

    if (banksToMigrate.length === 0) {
      console.log('✅ All banks already migrated to 10-stage template. Nothing to do.');
      await client.query('ROLLBACK');
      return;
    }

    if (alreadyMigrated.length > 0) {
      console.log(`⚠️  Skipping ${alreadyMigrated.length} banks already migrated: ${alreadyMigrated.map(r=>r.bank_id).join(', ')}`);
    }

    const bankIds = banksToMigrate.map(r => r.bank_id);

    // ── 3. Shift display_order +2 for all stages at position ≥ 1 ──────────
    const { rowCount: shifted } = await client.query(`
      UPDATE implementation_stages
      SET display_order = display_order + 2
      WHERE bank_id = ANY($1::text[])
        AND display_order >= 1
    `, [bankIds]);
    report.stagesReordered = shifted;

    // ── 4. Insert NDA (order 1) and Agreement (order 2) for each bank ──────
    const ndaValues = bankIds.map((id, i) => `($${i * 5 + 1}, 'NDA', 1, 'not_started', false)`);
    const agreementValues = bankIds.map((id, i) => `($${i * 5 + 1}, 'Agreement', 2, 'not_started', false)`);

    // Build parameterized inserts
    const ndaParams = bankIds.flatMap(id => [id]);
    const agParams  = bankIds.flatMap(id => [id]);

    // Build placeholders properly
    const ndaPlaceholders = bankIds.map((_, i) => `($${i*1+1}, 'NDA', 1, 'not_started', false)`).join(',');
    const agPlaceholders  = bankIds.map((_, i) => `($${i*1+1}, 'Agreement', 2, 'not_started', false)`).join(',');

    await client.query(
      `INSERT INTO implementation_stages (bank_id, name, display_order, status, skipped, completed)
       VALUES ${ndaPlaceholders}`,
      ndaParams
    );
    await client.query(
      `INSERT INTO implementation_stages (bank_id, name, display_order, status, skipped, completed)
       VALUES ${agPlaceholders}`,
      agParams
    );
    report.stagesInserted = bankIds.length * 2;

    // ── 5. Update implementation_settings.default_stages ───────────────────
    await client.query(`
      UPDATE implementation_settings
      SET value = $1
      WHERE key = 'default_stages'
    `, [JSON.stringify(NEW_DEFAULT_STAGES)]);

    // ── 6. Snapshot after state ─────────────────────────────────────────────
    const { rows: after } = await client.query(`
      SELECT bank_id,
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE completed) as done,
             COUNT(*) FILTER (WHERE skipped) as skipped,
             ROUND(COUNT(*) FILTER (WHERE completed)::numeric / NULLIF(COUNT(*) FILTER (WHERE NOT skipped), 0) * 100, 1) AS pct_after
      FROM implementation_stages
      WHERE bank_id = ANY($1::text[])
      GROUP BY bank_id
      ORDER BY bank_id
    `, [bankIds]);

    const afterMap = new Map(after.map(r => [r.bank_id, r]));

    for (const b of banksToMigrate) {
      const a = afterMap.get(b.bank_id) ?? {};
      report.banksUpdated.push(b.bank_id);
      report.summary.push({
        bankId: b.bank_id,
        stagesBefore: Number(b.total),
        stagesAfter: Number(a.total ?? 0),
        completedStages: Number(a.done ?? 0),
        skippedStages: Number(a.skipped ?? 0),
        percentageBefore: Number(b.pct_before ?? 0),
        percentageAfter: Number(a.pct_after ?? 0),
      });
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration committed successfully.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    report.errors.push(String(err));
    console.error('❌ Migration failed — rolled back.', err);
  } finally {
    client.release();
  }

  // ── 7. Print migration report ───────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  IMPLEMENTATION STAGE MIGRATION REPORT  (8 → 10 stages)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Banks updated      : ${report.banksUpdated.length}`);
  console.log(`  Stages inserted    : ${report.stagesInserted}  (NDA + Agreement × ${report.banksUpdated.length} banks)`);
  console.log(`  Stages reordered   : ${report.stagesReordered}`);
  console.log(`  Errors             : ${report.errors.length}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('  Per-bank breakdown:');
  console.log('');
  for (const b of report.summary) {
    const pctArrow = b.percentageBefore === b.percentageAfter
      ? `${b.percentageAfter}% (unchanged)`
      : `${b.percentageBefore}% → ${b.percentageAfter}%`;
    console.log(
      `  ${b.bankId.padEnd(10)} | ${b.stagesBefore}→${b.stagesAfter} stages | done:${b.completedStages} skip:${b.skippedStages} | ${pctArrow}`
    );
  }
  if (report.errors.length) {
    console.log('\n  ERRORS:');
    report.errors.forEach(e => console.log('  ' + e));
  }
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n  New default stage template:');
  NEW_DEFAULT_STAGES.forEach((s, i) => console.log(`    ${String(i+1).padStart(2)}. ${s}`));
  console.log('');

  await pool.end();
}

run();
