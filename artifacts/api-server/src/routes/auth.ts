/**
 * Public auth routes — no requireAuth middleware here.
 * Mounted BEFORE secured routers in routes/index.ts.
 *
 * POST /api/auth/forgot-password
 *   – Generates a Supabase recovery link (Supabase does NOT send email)
 *   – Sends a branded Arabic email via Resend immediately
 *   – Always returns { ok: true } to prevent email enumeration
 */
import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { getSupabaseAdmin } from "@workspace/supabase";

const router: IRouter = Router();

// ── Simple in-process rate limiter ────────────────────────────────────────────
// Max 3 requests per email per 10 minutes
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX       = 3;
const rateMap        = new Map<string, { count: number; reset: number }>();

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(email);
  if (!entry || now > entry.reset) {
    rateMap.set(email, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_MAX) return true;
  entry.count++;
  return false;
}

// ── Resend email sender ───────────────────────────────────────────────────────
async function sendResetEmail(to: string, resetLink: string): Promise<void> {
  const apiKey    = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");

  const payload = {
    from:    `منصة وصل <${fromEmail}>`,
    to:      [to],
    subject: "إعادة تعيين كلمة المرور — منصة وصل",
    html:    buildEmailHtml(to, resetLink),
  };

  const response = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Resend error ${response.status}: ${responseText}`);
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  try {
    const rawEmail = (req.body as { email?: string }).email ?? "";
    const email    = rawEmail.trim().toLowerCase();

    if (!email || !/.+@.+\..+/.test(email)) {
      res.status(400).json({ error: "البريد الإلكتروني غير صالح" });
      return;
    }

    // Rate-limit silently — still return ok so attackers learn nothing
    if (isRateLimited(email)) {
      res.json({ ok: true });
      return;
    }

    // Determine the redirect URL for the reset page
    const origin     = (req.headers.origin as string | undefined)
                    ?? process.env.FRONTEND_URL
                    ?? "https://wasl.app";
    const redirectTo = `${origin}/reset-password`;

    const supabase = getSupabaseAdmin();

    // ── Plan A: generate link via Admin + send via Resend (custom template) ──
    let sentViaResend = false;
    try {
      const { data, error } = await supabase.auth.admin.generateLink({
        type:    "recovery",
        email,
        options: { redirectTo },
      });

      if (!error && data?.properties?.action_link) {
        await sendResetEmail(email, data.properties.action_link);
        req.log?.info({ email }, "[auth] forgot-password: sent via Resend ✓");
        sentViaResend = true;
      } else {
        req.log?.warn({ email, err: error?.message }, "[auth] forgot-password: generateLink failed — falling back to Supabase email");
      }
    } catch (resendErr: any) {
      req.log?.warn({ email, err: resendErr?.message }, "[auth] forgot-password: Resend send failed — falling back to Supabase email");
    }

    // ── Plan B: let Supabase send its own email if Plan A failed ──
    if (!sentViaResend) {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetErr) {
        req.log?.warn({ email, err: resetErr.message }, "[auth] forgot-password: Supabase fallback also failed");
      } else {
        req.log?.info({ email }, "[auth] forgot-password: sent via Supabase fallback ✓");
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    req.log?.error({ err: err?.message }, "[auth] forgot-password: unexpected error");
    res.json({ ok: true });
  }
});

// ── Email HTML template ───────────────────────────────────────────────────────
function buildEmailHtml(email: string, resetLink: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>إعادة تعيين كلمة المرور</title>
</head>
<body style="margin:0;padding:0;background:#0d1526;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1526;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#111c30;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a,#4c1d95);padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.04em;">منصة وصل</p>
              <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.55);letter-spacing:0.06em;">WASL PLATFORM</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">إعادة تعيين كلمة المرور</p>
              <p style="margin:0 0 24px;font-size:13.5px;color:rgba(255,255,255,0.55);">تلقّينا طلباً لإعادة تعيين كلمة المرور للحساب المرتبط بـ <strong style="color:rgba(255,255,255,0.8);">${email}</strong></p>

              <p style="margin:0 0 20px;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.7;">
                اضغط على الزر أدناه لإنشاء كلمة مرور جديدة. الرابط صالح لمدة <strong style="color:#a5b4fc;">ساعة واحدة</strong> فقط.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetLink}"
                       style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;letter-spacing:0.03em;box-shadow:0 4px 20px rgba(99,102,241,0.4);">
                      إعادة تعيين كلمة المرور
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:28px 0;" />

              <p style="margin:0 0 8px;font-size:12.5px;color:rgba(255,255,255,0.35);">
                إذا لم يعمل الزر، انسخ الرابط التالي وألصقه في متصفحك:
              </p>
              <p style="margin:0;font-size:11px;color:rgba(165,180,252,0.6);word-break:break-all;line-height:1.6;">
                ${resetLink}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:rgba(0,0,0,0.2);padding:20px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.3);">
                إذا لم تطلب إعادة التعيين، تجاهل هذا الإيميل — لن يتغير شيء.
              </p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.2);">
                © ${new Date().getFullYear()} منصة وصل. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default router;
