/**
 * One-off provisioning script: creates Supabase Auth users and their
 * matching `profiles` rows. Run with:
 *
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/provisionUsers.ts users.json
 *
 * users.json is an array of { name, email, password, role }.
 * Not wired into any HTTP route -- run manually, and never commit real
 * passwords into the repo (the temp input file is deleted after use).
 */
import { readFileSync } from "node:fs";
import { getSupabaseAdmin } from "@workspace/supabase";

interface UserInput {
  name: string;
  email: string;
  password: string;
  role: "super_admin" | "admin";
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: tsx provisionUsers.ts <users.json>");
    process.exit(1);
  }

  const users: UserInput[] = JSON.parse(readFileSync(filePath, "utf-8"));
  const supabase = getSupabaseAdmin();
  const results: Array<{ email: string; role: string; status: string; error?: string }> = [];

  for (const user of users) {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name },
    });

    if (createError || !created?.user) {
      results.push({ email: user.email, role: user.role, status: "FAILED", error: createError?.message });
      continue;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: created.user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    if (profileError) {
      results.push({ email: user.email, role: user.role, status: "AUTH_OK_PROFILE_FAILED", error: profileError.message });
      continue;
    }

    results.push({ email: user.email, role: user.role, status: "OK" });
  }

  console.log(JSON.stringify(results, null, 2));

  const failures = results.filter((r) => r.status !== "OK");
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
