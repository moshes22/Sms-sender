# Signal Deck Bulk SMS

A clean mobile-first platform for managing contacts and sending bulk SMS campaigns.

## Features

- Contacts tab with manual entry
- CSV, TSV, XLS, and XLSX contact upload with `name` and `phone` column support
- Local contact persistence in the browser
- Send tab with a message composer and recipient count
- Server endpoint ready for Twilio SMS delivery

## SMS Provider Setup

Live SMS delivery requires Twilio credentials:

```bash
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+12125550123
```

Without those values, the app will prevent live sending and show a provider configuration message.

## Development

```bash
npm install
npm run dev
npm run build
```

Use this only for opted-in contacts and follow SMS consent rules for your region.
