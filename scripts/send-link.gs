/**
 * micro.breaks: "Email me the link" for the landing page.
 *
 * The mobile landing page posts {"email": "..."} here. This script sends the install email
 * from your Gmail and adds a row to the "Requests" sheet (time, email, page, status).
 *
 * Setup (once, about 10 minutes): see docs/development.md, "Send-the-link email".
 * Runs as you, so the email comes from your Gmail account, under the name "micro.breaks".
 */

const STORE_URL = 'https://chromewebstore.google.com/detail/microbreaks/ldieiojondcbnfaefdklpifeiamnpmnj?utm_source=email&utm_medium=send_to_laptop';
const SENDER_NAME = 'micro.breaks';
const SUBJECT = 'Your micro.breaks link';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PER_ADDRESS_SECONDS = 600; // one email per address every 10 minutes
const DAILY_CAP = 90;            // stay under Gmail's ~100 a day on a free account

function doPost(e) {
  let email = '';
  let page = '';
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    email = String(body.email || '').trim().toLowerCase().slice(0, 254);
    page = String(body.page || '').slice(0, 200);
  } catch (err) {
    return reply({ ok: false, error: 'bad_request' });
  }
  if (!EMAIL_RE.test(email)) return reply({ ok: false, error: 'invalid_email' });

  // Double taps and repeated requests: answer ok, send nothing.
  const cache = CacheService.getScriptCache();
  if (cache.get('sent:' + email)) return reply({ ok: true, repeat: true });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const today = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
    const props = PropertiesService.getScriptProperties();
    const count = props.getProperty('day') === today ? Number(props.getProperty('count') || 0) : 0;
    if (count >= DAILY_CAP || MailApp.getRemainingDailyQuota() < 1) {
      log(email, page, 'over daily limit');
      return reply({ ok: false, error: 'busy' });
    }
    GmailApp.sendEmail(email, SUBJECT, plainText(), { name: SENDER_NAME, htmlBody: html() });
    props.setProperties({ day: today, count: String(count + 1) });
    cache.put('sent:' + email, '1', PER_ADDRESS_SECONDS);
    log(email, page, 'sent');
    return reply({ ok: true });
  } catch (err) {
    log(email, page, 'error: ' + err);
    return reply({ ok: false, error: 'send_failed' });
  } finally {
    lock.releaseLock();
  }
}

// Opening the web app URL in a browser shows this: a quick check that the deployment works.
function doGet() {
  return reply({ ok: true, service: 'micro.breaks send-link' });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function log(email, page, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Requests') || ss.insertSheet('Requests');
  if (sheet.getLastRow() === 0) sheet.appendRow(['Time', 'Email', 'Page', 'Status']);
  sheet.appendRow([new Date(), email, page, status]);
}

// Run this once from the editor to send the email to yourself and grant the permissions.
function testSend() {
  const me = Session.getActiveUser().getEmail();
  GmailApp.sendEmail(me, SUBJECT, plainText(), { name: SENDER_NAME, htmlBody: html() });
  log(me, 'test', 'sent (test)');
}

function plainText() {
  return [
    'Here’s your link.',
    '',
    'Open it in Chrome on your computer:',
    STORE_URL,
    '',
    '1. Add to Chrome: one click on the Chrome Web Store.',
    '2. Pin it: click the puzzle icon next to the address bar, then the pin.',
    '3. Set your rhythm: open a new tab and pick your working hours.',
    '',
    'You get this email once, because you asked for it from your phone. No newsletter, no follow-ups.'
  ].join('\n');
}

function html() {
  const font = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;";
  const step = (n, title, text) =>
    '<tr><td valign="top" style="padding:0 14px 18px 0;width:28px">' +
    '<div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:#F0F0F2;text-align:center;' + font + 'font-size:14px;font-weight:700;color:#111111">' + n + '</div></td>' +
    '<td valign="top" style="padding:0 0 18px 0;' + font + '"><div style="font-size:15px;font-weight:700;color:#111111">' + title + '</div>' +
    '<div style="margin-top:3px;font-size:14px;line-height:1.45;color:#55555B">' + text + '</div></td></tr>';
  return '' +
    '<div style="display:none;max-height:0;overflow:hidden">Open this on your computer. It takes 10 seconds.</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F6"><tr><td align="center" style="padding:28px 16px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:20px"><tr><td style="padding:40px 40px 22px;' + font + 'color:#111111">' +
    '<div style="font-size:20px;font-weight:700;letter-spacing:-0.03em">micro<span style="color:#2E7D32">.</span>breaks</div>' +
    '<h1 style="margin:32px 0 0;font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-0.04em">Here’s your link.</h1>' +
    '<p style="margin:14px 0 0;font-size:16px;line-height:1.5;color:#55555B">Open it in Chrome on this computer and click below.</p>' +
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px"><tr><td style="border-radius:999px;background:#111111">' +
    '<a href="' + STORE_URL + '" style="display:inline-block;padding:16px 28px;' + font + 'font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none">Add to Chrome, it’s free</a></td></tr></table>' +
    '<div style="margin-top:36px;padding-top:28px;border-top:1px solid #E6E6EA"><table role="presentation" cellpadding="0" cellspacing="0">' +
    step(1, 'Add to Chrome', 'One click on the Chrome Web Store.') +
    step(2, 'Pin it', 'Click the puzzle icon next to the address bar, then the pin. Your battery stays in sight.') +
    step(3, 'Set your rhythm', 'Open a new tab and pick your working hours. Your first break comes on its own.') +
    '</table></div></td></tr></table>' +
    '<p style="max-width:560px;margin:18px auto 0;' + font + 'font-size:12px;line-height:1.5;color:#77777D;text-align:left">You get this email once, because you asked for it from your phone. No newsletter, no follow-ups.</p>' +
    '</td></tr></table>';
}
