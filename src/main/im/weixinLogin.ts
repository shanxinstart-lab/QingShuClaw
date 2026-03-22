/**
 * Direct HTTP calls to WeChat ilink API for QR code login.
 * Bypasses OpenClaw Gateway — works independently.
 */

const ILINK_BASE_URL = 'https://ilinkai.weixin.qq.com';
const BOT_TYPE = '3';
const POLL_TIMEOUT_MS = 35_000;

interface IlinkQrCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

interface IlinkStatusResponse {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired';
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
}

export interface WeixinQrCodeResult {
  qrcode: string;
  qrcodeUrl: string;
}

export interface WeixinPollResult {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired';
  botToken?: string;
  accountId?: string;
  baseUrl?: string;
  userId?: string;
}

export async function fetchWeixinQrCode(): Promise<WeixinQrCodeResult> {
  const url = `${ILINK_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(BOT_TYPE)}`;
  console.log('[WeixinLogin] fetching QR code from ilink API');

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '(unreadable)');
    throw new Error(`Failed to fetch QR code: ${response.status} ${response.statusText} body=${body}`);
  }

  const data = await response.json() as IlinkQrCodeResponse;
  console.log('[WeixinLogin] QR code received, url length:', data.qrcode_img_content?.length ?? 0);

  return {
    qrcode: data.qrcode,
    qrcodeUrl: data.qrcode_img_content,
  };
}

export async function pollWeixinQrStatus(qrcode: string): Promise<WeixinPollResult> {
  const url = `${ILINK_BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'iLink-App-ClientVersion': '1' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const body = await response.text().catch(() => '(unreadable)');
      throw new Error(`Failed to poll QR status: ${response.status} ${response.statusText} body=${body}`);
    }

    const data = await response.json() as IlinkStatusResponse;
    return {
      status: data.status,
      botToken: data.bot_token,
      accountId: data.ilink_bot_id,
      baseUrl: data.baseurl,
      userId: data.ilink_user_id,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      return { status: 'wait' };
    }
    throw err;
  }
}
