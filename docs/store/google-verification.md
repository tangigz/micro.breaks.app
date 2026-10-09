# Opening Google Calendar to everyone

Today the Google Cloud app is in "Testing": only listed test users can connect, 100 at most. To let anyone connect, the app must be published and verified by Google. This is a separate review from the Chrome Web Store's.

## What Google asks for

`calendar.freebusy` is a sensitive scope, so verification is required. Google will ask for:

1. **A homepage** on a domain you control: https://tangigz.github.io/micro.breaks.app/
2. **A privacy policy** on the same domain, linked from the homepage, with the Limited Use statement: https://tangigz.github.io/micro.breaks.app/privacy.html
3. **Ownership of that domain**, proven in Google Search Console.
4. **The app name, logo and support email** on the consent screen (Google Auth Platform › Branding). Use the 128 px icon in `docs/store/icon-128.png`.
5. **A justification for the scope.** Suggested text:

       micro.breaks reminds the user to take a movement break at a regular interval and locks the browser until the break is taken. calendar.freebusy is used to know when the user is in a meeting, so that no break prompt is shown during it. Only busy time ranges of the primary calendar are read. They are stored in the browser for a few hours and never leave the device.

6. **A short video** (unlisted on YouTube) showing the consent screen with the client ID visible in the address bar, the user granting access, and the feature using the data: the "Protect my meetings" card turning to "Connected", then the new tab showing "In a meeting until …".

## Steps

1. Publish the homepage and privacy policy (GitHub Pages, from the `docs/` folder).
2. Verify the site in Search Console and add the domain under Branding › Authorized domains.
3. Create the OAuth client for the store's extension ID (see `listing.md`).
4. Record the video with the store build.
5. In Google Auth Platform › Audience, click "Publish app", then submit for verification under Verification Center.

Until verification is granted, connecting still works but shows Google's "unverified app" warning, and the 100-user cap applies.
