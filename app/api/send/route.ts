import { NextRequest, NextResponse } from "next/server";

type SmsContact = {
  name?: string;
  phone?: string;
};

function cleanPhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const contacts = Array.isArray(body?.contacts) ? (body.contacts as SmsContact[]) : [];
  const recipients = contacts
    .map((contact) => cleanPhone(contact.phone ?? ""))
    .filter((phone) => phone.length >= 8);

  if (!message) {
    return NextResponse.json({ error: "Message text is required." }, { status: 400 });
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "At least one valid recipient is required." }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json(
      {
        error:
          "SMS provider is not configured yet. Add Twilio credentials before sending live messages.",
      },
      { status: 503 },
    );
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const results = await Promise.allSettled(
    recipients.map((to) =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          Body: message,
          From: fromNumber,
          To: to,
        }),
      }),
    ),
  );

  const sent = results.filter(
    (result) => result.status === "fulfilled" && result.value.ok,
  ).length;

  if (sent === 0) {
    return NextResponse.json(
      { error: "Twilio rejected the send request. Check credentials and phone numbers." },
      { status: 502 },
    );
  }

  return NextResponse.json({ sent, total: recipients.length });
}
