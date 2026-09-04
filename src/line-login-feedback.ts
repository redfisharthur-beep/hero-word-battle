const LINE_ERROR_MESSAGES: Record<string, string> = {
  LINE_LOGIN_NOT_CONFIGURED: 'LINE 登入尚未完成 Cloudflare Channel ID / Secret 設定',
  LINE_STATE_MISMATCH: 'LINE 登入驗證逾時或 Cookie 驗證失敗，請重新點 LINE 登入',
  LINE_TOKEN_FAILED: 'LINE 授權碼交換失敗，請確認 Callback URL 與 Channel Secret',
  LINE_PROFILE_FAILED: 'LINE 個人資料讀取失敗，請重新授權',
  LINE_NAME_MISSING: 'LINE 帳號沒有可用的顯示名稱',
  LINE_LOGIN_CANCELLED: '已取消 LINE 登入',
  LINE_LOGIN_FAILED: 'LINE 登入發生連線錯誤，請再試一次',
}

const STORAGE_KEY = 'hero-line-login-error'

function captureLineError() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const raw = hash.get('line_error')?.trim()
  if (!raw) return
  const message = LINE_ERROR_MESSAGES[raw] ?? `LINE 登入失敗：${raw}`
  sessionStorage.setItem(STORAGE_KEY, message)
}

function decorateError() {
  const message = sessionStorage.getItem(STORAGE_KEY)
  if (!message) return
  const boxes = Array.from(document.querySelectorAll<HTMLElement>('.notice-box'))
  const target = boxes.find((el) => el.textContent?.includes('LINE 登入失敗'))
  if (!target) return
  target.textContent = `⚠️ ${message}`
  target.dataset.lineDiagnostic = '1'
  sessionStorage.removeItem(STORAGE_KEY)
}

export function installLineLoginFeedback() {
  captureLineError()
  decorateError()
  const observer = new MutationObserver(decorateError)
  observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
