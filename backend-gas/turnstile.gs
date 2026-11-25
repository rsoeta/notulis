/**
 * ============================================================================
 * NOTULIS — Utilitas Verifikasi Cloudflare Turnstile (Google Apps Script)
 * ============================================================================
 * Endpoint resmi Cloudflare:
 *   https://challenges.cloudflare.com/turnstile/v0/siteverify
 *
 * Script Property opsional:
 * - TURNSTILE_SECRET_KEY : Secret Key dari Dashboard Cloudflare Turnstile.
 *   Jika belum diatur, otomatis memakai dummy testing secret key Cloudflare
 *   (1x0000000000000000000000000000000AA) untuk pengujian development.
 * ============================================================================
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DUMMY_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

/**
 * Memverifikasi token respons Cloudflare Turnstile ke API siteverify.
 * @param {string} token - Nilai `cf-turnstile-response` / `turnstileToken` dari client.
 * @param {string} [remoteIp] - IP pengguna opsional.
 * @return {{ valid: boolean, code: number, message?: string, errorCodes?: string[] }}
 */
function verifyTurnstileToken(token, remoteIp) {
  const cleanToken = typeof token === 'string' ? token.trim() : '';
  if (!cleanToken) {
    return {
      valid: false,
      code: 400,
      message: 'Verifikasi anti-bot (Cloudflare Turnstile) wajib diselesaikan.'
    };
  }

  const secretKey =
    PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET_KEY') ||
    DUMMY_TEST_SECRET_KEY;

  const formPayload = {
    secret: secretKey,
    response: cleanToken
  };
  if (remoteIp) {
    formPayload.remoteip = String(remoteIp);
  }

  try {
    const response = UrlFetchApp.fetch(TURNSTILE_VERIFY_URL, {
      method: 'post',
      payload: formPayload,
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    if (statusCode < 200 || statusCode >= 300) {
      Logger.log(`Turnstile HTTP error ${statusCode}: ${response.getContentText()}`);
      return {
        valid: false,
        code: 403,
        message: 'Layanan verifikasi anti-bot tidak dapat dihubungi. Silakan coba lagi.'
      };
    }

    const result = JSON.parse(response.getContentText() || '{}');
    if (!result.success) {
      return {
        valid: false,
        code: 403,
        message: 'Verifikasi anti-bot gagal atau telah kedaluwarsa. Silakan ulangi verifikasi.',
        errorCodes: result['error-codes'] || []
      };
    }

    return { valid: true, code: 200 };
  } catch (err) {
    Logger.log(`Turnstile verify error: ${err}`);
    return {
      valid: false,
      code: 403,
      message: 'Gagal memvalidasi verifikasi anti-bot. Silakan coba lagi.'
    };
  }
}
