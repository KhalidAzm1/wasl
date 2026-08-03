/**
 * Public auth routes — no requireAuth middleware here.
 * Mounted BEFORE secured routers in routes/index.ts.
 *
 * POST /api/auth/forgot-password
 *   – Uses Supabase's built-in password-reset email (no custom domain needed)
 *   – Always returns { ok: true } to prevent email enumeration
 */
import { Router, type IRouter } from "express";
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

// ── Route ─────────────────────────────────────────────────────────────────────
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  try {
    const rawEmail = (req.body as { email?: string }).email ?? "";
    const email    = rawEmail.trim().toLowerCase();

    if (!email || !/.+@.+\..+/.test(email)) {
      res.status(400).json({ error: "البريد الإلكتروني غير صالح" });
      return;
    }

    if (isRateLimited(email)) {
      res.json({ ok: true });
      return;
    }

    // Build the redirect URL: prefer the configured FRONTEND_URL, then
    // REPLIT_DEV_DOMAIN (always correct in the Replit environment), then
    // the request Origin header, and finally fall back to the request host.
    const appBase =
      process.env.FRONTEND_URL
      ?? (process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : null)
      ?? (req.headers.origin as string | undefined)
      ?? `https://${req.headers.host}`;
    const redirectTo = `${appBase}/reset-password`;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      req.log?.warn({ email, err: error.message }, "[auth] forgot-password: failed");
    } else {
      req.log?.info({ email }, "[auth] forgot-password: sent ✓");
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
