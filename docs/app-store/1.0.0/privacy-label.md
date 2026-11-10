# App Privacy Answers

Answer `Yes, we collect data from this app`.

For every selected type below:

- Collected: `Yes`
- Linked to the user: `Yes`
- Used for tracking: `No`
- Purpose: `App Functionality` only
- Advertising, developer marketing, analytics, and product personalization: `No`

## Select These Data Types

| Apple category   | Data type          | Why HealthFolio collects it                                                             |
| ---------------- | ------------------ | --------------------------------------------------------------------------------------- |
| Contact Info     | Name               | Account and health-profile display                                                      |
| Contact Info     | Email Address      | Authentication, account recovery, and email ingestion                                   |
| Health & Fitness | Health             | Medical documents, readings, medications, health-profile context, and care data         |
| User Content     | Emails or Text Messages | Sender and subject from records intentionally forwarded by email                    |
| User Content     | Photos or Videos   | Medical document images selected by the user                                            |
| User Content     | Other User Content | PDFs, notes, assistant questions, forwarded attachments, and share/export configuration |
| Identifiers      | User ID            | Authentication, profile routing, access control, and account deletion                   |

## Do Not Select For Build 73

- Phone Number
- Precise or coarse location
- Contacts
- Purchases or payment information
- Browsing or search history
- Advertising data
- Diagnostics, crash data, performance data, or other diagnostics
- Fitness data
- Sensitive Info as a separate category beyond the declared Health data

The codebase has no persistent third-party advertising, tracking, analytics, or crash-reporting SDK configured for build 73. Revisit these answers before any SDK change.

## Third-Party Processing Included In These Answers

- Supabase: authentication, database, private storage, and Edge Functions.
- OpenAI: uploaded or forwarded medical files are sent to extract text and readings. Assistant questions and relevant information from the selected health profile are sent to generate replies. Purpose is App Functionality. This is not tracking, advertising, or product personalization.
- Apple or Google: authentication only when the user selects that provider.
