# Gmail Email Forwarding

Use this as the MVP email ingestion path while HealthFolio is using a shared Gmail inbox instead
of a custom email-receiving domain.

## What This Does

Users choose a unique alias in the HealthFolio Profile screen, then forward documents to Gmail
plus-addresses like:

```text
test.healthfolio+hf-useralias@gmail.com
```

Google Apps Script reads attachments from that Gmail inbox and posts them to the deployed Supabase
function:

```text
https://qojdeuacwkmlxmodeabt.supabase.co/functions/v1/inbound-email-ingest
```

For this MVP, any sender can forward attachments to a user's assigned alias. Treat aliases as
private upload addresses and rotate a user's alias if it is shared too broadly.

## Setup Steps

1. Sign in to the MVP Gmail inbox:

   ```text
   test.healthfolio@gmail.com
   ```

2. In this repo/app config, set:

   ```text
   EXPO_PUBLIC_INBOUND_EMAIL_ADDRESS_TEMPLATE=test.healthfolio+{alias}@gmail.com
   ```

   The app will show each user a forwarding address by replacing `{alias}` with their chosen
   unique `User.inboundEmailAlias`.

3. Open [Google Apps Script](https://script.google.com/).

4. Create a new project.

5. Paste this code into `Code.gs`.

6. Replace:

   - `WEBHOOK_SECRET`

   Use the same value stored in Supabase as `EMAIL_INGEST_WEBHOOK_SECRET`. The local setup file used
   during deployment was:

   ```text
   /tmp/healthfolio-email-ingest-webhook-secret.txt
   ```

7. Click **Save**.

8. In Apps Script, open **Triggers**.

9. Add a trigger:

   - Function: `processHealthFolioForwardedMail`
   - Event source: **Time-driven**
   - Type: **Minutes timer**
   - Every 5 minutes

10. Run `processHealthFolioForwardedMail` once manually and approve Gmail/URL Fetch permissions.

11. To test, send a PDF/JPG/PNG attachment from your HealthFolio account email to the forwarding
    address shown in the app, for example:

    ```text
    test.healthfolio+hf-useralias@gmail.com
    ```

## Apps Script

```js
const SUPABASE_WEBHOOK_URL =
  'https://qojdeuacwkmlxmodeabt.supabase.co/functions/v1/inbound-email-ingest';
const WEBHOOK_SECRET = 'paste-email-ingest-webhook-secret-here';
const HEALTHFOLIO_RECIPIENT_PATTERN = /test\.healthfolio\+[a-z0-9-]+@gmail\.com/i;
const PROCESSED_LABEL = 'HealthFolio/Processed';
const PROCESSED_IDS_KEY = 'healthfolio_processed_message_ids_v1';
const MAX_PROCESSED_IDS = 500;
const MAX_THREADS_PER_RUN = 20;

function processHealthFolioForwardedMail() {
  const label = getOrCreateLabel_(PROCESSED_LABEL);
  const processedIds = loadProcessedIds_();
  const nextProcessedIds = new Set(processedIds);
  const query = ['newer_than:14d', 'has:attachment'].join(' ');
  const threads = GmailApp.search(query, 0, MAX_THREADS_PER_RUN);

  for (const thread of threads) {
    let processedAny = false;
    for (const message of thread.getMessages()) {
      const messageId = message.getId();
      if (processedIds.has(messageId)) continue;

      const attachments = message
        .getAttachments({ includeInlineImages: false, includeAttachments: true })
        .filter(isSupportedAttachment_);

      if (attachments.length === 0) continue;

      const recipients = [message.getTo(), message.getCc(), message.getBcc()]
        .filter(Boolean)
        .join(', ');
      if (!HEALTHFOLIO_RECIPIENT_PATTERN.test(recipients)) continue;

      const payload = {
        to: recipients,
        from: message.getFrom(),
        subject: message.getSubject(),
        attachments: attachments.map((attachment, index) => {
          const bytes = attachment.getBytes();
          return {
            filename: attachment.getName(),
            contentType: attachment.getContentType(),
            idempotencyKey: [
              messageId,
              index,
              attachment.getName(),
              bytes.length,
            ].join(':'),
            contentBase64: Utilities.base64Encode(bytes),
          };
        }),
      };

      UrlFetchApp.fetch(SUPABASE_WEBHOOK_URL, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'x-healthfolio-email-secret': WEBHOOK_SECRET,
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: false,
      });

      nextProcessedIds.add(messageId);
      processedAny = true;
    }

    if (processedAny) thread.addLabel(label);
  }

  saveProcessedIds_(nextProcessedIds);
}

function isSupportedAttachment_(attachment) {
  const contentType = String(attachment.getContentType() || '').toLowerCase();
  const name = String(attachment.getName() || '').toLowerCase();
  return (
    contentType === 'application/pdf' ||
    contentType === 'image/jpeg' ||
    contentType === 'image/png' ||
    name.endsWith('.pdf') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png')
  );
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function loadProcessedIds_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PROCESSED_IDS_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch (error) {
    return new Set();
  }
}

function saveProcessedIds_(ids) {
  const recent = Array.from(ids).slice(-MAX_PROCESSED_IDS);
  PropertiesService.getScriptProperties().setProperty(
    PROCESSED_IDS_KEY,
    JSON.stringify(recent),
  );
}
```
