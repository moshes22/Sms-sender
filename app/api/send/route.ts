import { NextRequest, NextResponse } from "next/server";

type SmsContact = {
  name?: string;
  phone?: string;
};

type SmsResult = {
  name: string;
  phone: string;
  status: "queued" | "failed";
  providerId?: string;
  error?: string;
};

function cleanPhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const contacts = Array.isArray(body?.contacts) ? (body.contacts as SmsContact[]) : [];
  const recipients = contacts.flatMap((contact) => {
    const phone = cleanPhone(contact.phone ?? "");

    if (phone.length < 8) {
      return [];
    }

    return {
      name: contact.name?.trim() || "Untitled contact",
      phone,
    };
  });

  if (!message) {
    return NextResponse.json({ error: "Message text is required." }, { status: 400 });
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "At least one valid recipient is required." },
      { status: 400 },
    );
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json(
      {
        error:
          "SMS provider is not configured yet. Add Twilio credentials before sending live messages.",
        results: recipients.map((recipient) => ({
          ...recipient,
          status: "failed",
          error: "provider not configured",
        })),
      },
      { status: 503 },
    );
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const results = await Promise.allSettled(
    recipients.map(async (recipient): Promise<SmsResult> => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          Body: message,
          From: fromNumber,
          To: recipient.phone,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          ...recipient,
          status: "failed",
          error: payload?.message ?? "provider rejected",
        };
      }

      return {
        ...recipient,
        status: "queued",
        providerId: payload?.sid,
      };
    }),
  );
  const finalized = results.map((result, index): SmsResult => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      ...recipients[index],
      status: "failed",
      error: "network error",
    };
  });
  const sent = finalized.filter((result) => result.status !== "failed").length;

  if (sent === 0) {
    return NextResponse.json(
      {
        error: "Twilio rejected the send request. Check credentials and phone numbers.",
        results: finalized,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ sent, total: recipients.length, results: finalized });
}
