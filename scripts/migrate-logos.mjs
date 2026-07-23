/**
 * Downloads every bank logo stored as an external HTTP URL,
 * uploads it to Supabase wasl-documents storage, and updates
 * the bank row's logo_url to the new storage path.
 */
import { getSupabaseAdmin } from "../lib/supabase/dist/index.js";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: DATABASE_URL });

function getContentType(url, buffer) {
  if (url.includes(".svg")) {
    const text = buffer.slice(0, 300).toString("utf8");
    if (text.includes("<svg") || text.includes("<?xml")) return "image/svg+xml";
  }
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  const sig = buffer.slice(0, 4);
  if (sig[0] === 0x89 && sig[1] === 0x50) return "image/png";
  if (sig[0] === 0xff && sig[1] === 0xd8) return "image/jpeg";
  const text = buffer.slice(0, 300).toString("utf8");
  if (text.includes("<svg") || text.includes("<?xml")) return "image/svg+xml";
  return "image/png";
}

async function downloadLogo(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
      "Accept": "image/*,*/*;q=0.8",
      "Referer": "https://www.google.com/",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToSupabase(bankId, buffer, contentType) {
  const supabase = getSupabaseAdmin();
  const ext = contentType.includes("svg") ? "svg" : contentType.includes("webp") ? "webp" : contentType.includes("jpeg") ? "jpg" : "png";
  const path = `bank-images/${bankId}/logo_migrated.${ext}`;
  // Try to delete existing first (ignore errors)
  await supabase.storage.from("wasl-documents").remove([path]).catch(() => {});
  const { error } = await supabase.storage.from("wasl-documents").upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Supabase: ${error.message}`);
  return path;
}

const { rows } = await pool.query(
  `SELECT id, name_en, logo_url FROM banks WHERE logo_url LIKE 'http%' ORDER BY name_en`
);
console.log(`Migrating ${rows.length} logos...\n`);

for (const bank of rows) {
  process.stdout.write(`  ${bank.name_en.padEnd(42)} → `);
  try {
    const buffer = await downloadLogo(bank.logo_url);
    const ct = getContentType(bank.logo_url, buffer);
    const path = await uploadToSupabase(bank.id, buffer, ct);
    await pool.query("UPDATE banks SET logo_url = $1 WHERE id = $2", [path, bank.id]);
    console.log(`✅ ${path.split("/").pop()} (${(buffer.byteLength/1024).toFixed(0)}kb, ${ct.split("/")[1]})`);
  } catch(e) {
    console.log(`❌ ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 400));
}

await pool.end();
console.log("\n✅ Done");
