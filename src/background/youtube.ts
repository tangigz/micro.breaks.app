import { browser } from 'wxt/browser';

const RULE_ID = 1;
/** Who is embedding the video, as far as YouTube is concerned. */
const REFERER = 'https://github.com/tangigz/micro.breaks.app';

/**
 * YouTube refuses to play an embed that arrives without a Referer ("Video player configuration
 * error", error 153), and extension pages send none. This adds one, only to the player frames
 * that micro.breaks itself opens.
 */
export async function allowYouTubeEmbeds(): Promise<void> {
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: [
      {
        id: RULE_ID,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [{ header: 'referer', operation: 'set', value: REFERER }],
        },
        condition: {
          urlFilter: '||youtube-nocookie.com/embed/',
          resourceTypes: ['sub_frame'],
          initiatorDomains: [browser.runtime.id],
        },
      },
    ],
  });
}
