"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Contact = {
  id: string;
  name: string;
  phone: string;
};

type DeliveryStatus = "queued" | "sent" | "delivered" | "failed";

type MessageResult = Contact & {
  status: DeliveryStatus;
  providerId?: string;
  error?: string;
  readStatus: "not_supported";
};

type Campaign = {
  id: string;
  message: string;
  createdAt: string;
  results: MessageResult[];
};

type SendState = "idle" | "sending" | "sent" | "error";
type Tab = "contacts" | "send" | "tracking";

const sampleContacts: Contact[] = [
  { id: "sample-1", name: "Ari Lane", phone: "+12125550104" },
  { id: "sample-2", name: "Nia Cruz", phone: "+12125550139" },
];

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

function campaignCounts(campaigns: Campaign[]) {
  const latest = campaigns[0];
  const results = latest?.results ?? [];

  return {
    total: results.length,
    failed: results.filter((result) => result.status === "failed").length,
    delivered: results.filter((result) => result.status === "delivered").length,
    queued: results.filter((result) => result.status === "queued" || result.status === "sent").length,
  };
}

function parseDelimited(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  const delimiter = rows[0].includes("\t") ? "\t" : ",";
  const firstCells = rows[0].split(delimiter).map((cell) => cell.trim().toLowerCase());
  const hasHeader =
    firstCells.some((cell) => ["name", "first name", "full name"].includes(cell)) ||
    firstCells.some((cell) => ["phone", "mobile", "number", "phone number"].includes(cell));
  const phoneIndex = Math.max(
    firstCells.findIndex((cell) => ["phone", "mobile", "number", "phone number"].includes(cell)),
    0,
  );
  const nameIndex = firstCells.findIndex((cell) =>
    ["name", "first name", "full name"].includes(cell),
  );

  return rows.slice(hasHeader ? 1 : 0).flatMap((row, index) => {
    const cells = row.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const phone = normalizePhone(cells[phoneIndex] ?? cells[0] ?? "");

    if (!phone) {
      return [];
    }

    return {
      id: `${Date.now()}-${index}-${phone}`,
      name: nameIndex >= 0 ? cells[nameIndex] || "Untitled contact" : cells[1] || "Untitled contact",
      phone,
    };
  });
}

function contactsFromRows(rows: unknown[][]) {
  if (rows.length === 0) {
    return [];
  }

  const firstCells = rows[0].map((cell) => String(cell ?? "").trim().toLowerCase());
  const hasHeader =
    firstCells.some((cell) => ["name", "first name", "full name"].includes(cell)) ||
    firstCells.some((cell) => ["phone", "mobile", "number", "phone number"].includes(cell));
  const phoneIndex = Math.max(
    firstCells.findIndex((cell) => ["phone", "mobile", "number", "phone number"].includes(cell)),
    0,
  );
  const nameIndex = firstCells.findIndex((cell) =>
    ["name", "first name", "full name"].includes(cell),
  );

  return rows.slice(hasHeader ? 1 : 0).flatMap((row, index) => {
    const phone = normalizePhone(String(row[phoneIndex] ?? row[0] ?? ""));

    if (!phone) {
      return [];
    }

    return {
      id: `${Date.now()}-sheet-${index}-${phone}`,
      name:
        nameIndex >= 0
          ? String(row[nameIndex] ?? "").trim() || "Untitled contact"
          : String(row[1] ?? "").trim() || "Untitled contact",
      phone,
    };
  });
}

function statusTone(status: DeliveryStatus) {
  if (status === "failed") {
    return "border-[#ff6b8a]/30 bg-[#ff6b8a]/10 text-[#ff9bb0]";
  }

  if (status === "delivered") {
    return "border-[#42f5c8]/30 bg-[#42f5c8]/10 text-[#9dffe8]";
  }

  return "border-white/10 bg-white/10 text-white/65";
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("contacts");
  const [contacts, setContacts] = useState<Contact[]>(sampleContacts);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "failed">("all");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const savedContacts = window.localStorage.getItem("sms-sender-contacts");
    const savedCampaigns = window.localStorage.getItem("sms-sender-campaigns");

    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    }

    if (savedCampaigns) {
      setCampaigns(JSON.parse(savedCampaigns));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sms-sender-contacts", JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    window.localStorage.setItem("sms-sender-campaigns", JSON.stringify(campaigns));
  }, [campaigns]);

  const validContacts = useMemo(
    () => contacts.filter((contact) => normalizePhone(contact.phone).length >= 8),
    [contacts],
  );
  const counts = campaignCounts(campaigns);
  const latestCampaign = campaigns[0];
  const visibleResults = (latestCampaign?.results ?? []).filter(
    (result) => statusFilter === "all" || result.status === "failed",
  );
  const failedContacts = latestCampaign?.results.filter((result) => result.status === "failed") ?? [];

  function addContacts(nextContacts: Contact[]) {
    setContacts((current) => {
      const existing = new Set(current.map((contact) => normalizePhone(contact.phone)));
      const fresh = nextContacts.filter((contact) => {
        const normalized = normalizePhone(contact.phone);
        if (!normalized || existing.has(normalized)) {
          return false;
        }
        existing.add(normalized);
        return true;
      });

      return [...fresh, ...current];
    });
  }

  function addManualContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizePhone(phone);

    if (!normalized) {
      setNotice("Add a phone number first.");
      return;
    }

    addContacts([
      {
        id: `${Date.now()}-${normalized}`,
        name: name.trim() || "Untitled contact",
        phone: normalized,
      },
    ]);
    setName("");
    setPhone("");
    setNotice("Contact added.");
  }

  async function uploadContacts(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "xlsx" || extension === "xls") {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 });
      const imported = contactsFromRows(rows);
      addContacts(imported);
      setNotice(`${imported.length} contacts imported.`);
      event.target.value = "";
      return;
    }

    const imported = parseDelimited(await file.text());
    addContacts(imported);
    setNotice(`${imported.length} contacts imported.`);
    event.target.value = "";
  }

  async function sendToRecipients(recipients: Contact[], text: string, resend = false) {
    if (!text.trim()) {
      setNotice("Write a message before sending.");
      return;
    }

    if (recipients.length === 0) {
      setNotice("Add at least one valid contact.");
      return;
    }

    setSendState("sending");
    setNotice("");

    const response = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        contacts: recipients.map(({ name, phone }) => ({ name, phone })),
      }),
    });
    const result = await response.json();
    const results: MessageResult[] =
      result.results?.map((entry: MessageResult, index: number) => ({
        id: `${Date.now()}-${index}-${entry.phone}`,
        name: entry.name,
        phone: entry.phone,
        status: entry.status,
        providerId: entry.providerId,
        error: entry.error,
        readStatus: "not_supported",
      })) ?? [];

    if (results.length > 0) {
      setCampaigns((current) => [
        {
          id: `${Date.now()}`,
          message: text,
          createdAt: new Date().toISOString(),
          results,
        },
        ...current,
      ]);
      setActiveTab("tracking");
    }

    if (!response.ok) {
      setSendState("error");
      setNotice(result.error ?? "Message could not be sent.");
      return;
    }

    setSendState("sent");
    setNotice(
      resend
        ? `Resent to ${result.sent} failed recipients.`
        : `Queued ${result.sent} messages. Watch status in Tracking.`,
    );
  }

  function sendBulkMessage() {
    void sendToRecipients(validContacts, message);
  }

  function resendFailed() {
    if (!latestCampaign || failedContacts.length === 0) {
      setNotice("There are no failed recipients to resend.");
      return;
    }

    void sendToRecipients(failedContacts, latestCampaign.message, true);
  }

  return (
    <main className="min-h-screen bg-[#08090d] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-6 pt-5">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#42f5c8]">
              Signal Deck
            </p>
            <h1 className="text-4xl font-semibold leading-none tracking-normal">
              Bulk SMS
            </h1>
          </div>
          <div className="rounded-full border border-white/15 px-3 py-2 text-right">
            <p className="text-xl font-semibold">{validContacts.length}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">ready</p>
          </div>
        </header>

        <nav className="mb-5 grid grid-cols-3 rounded-full border border-white/10 bg-white/5 p-1">
          {(["contacts", "send", "tracking"] as Tab[]).map((tab) => (
            <button
              className={`rounded-full px-2 py-3 text-sm font-semibold capitalize transition ${
                activeTab === tab
                  ? tab === "send"
                    ? "bg-[#42f5c8] text-black"
                    : "bg-white text-black"
                  : "text-white/65"
              }`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </nav>

        {notice ? (
          <div className="mb-4 rounded-md border border-[#42f5c8]/30 bg-[#42f5c8]/10 px-4 py-3 text-sm text-[#b8ffee]">
            {notice}
          </div>
        ) : null}

        {activeTab === "contacts" ? (
          <div className="flex flex-1 flex-col gap-4">
            <form
              className="rounded-lg border border-white/10 bg-white/[0.06] p-4"
              onSubmit={addManualContact}
            >
              <div className="mb-3 grid grid-cols-1 gap-3">
                <input
                  className="h-12 rounded-md border border-white/10 bg-black/30 px-4 text-base outline-none ring-[#42f5c8]/50 placeholder:text-white/35 focus:ring-2"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Name"
                  value={name}
                />
                <input
                  className="h-12 rounded-md border border-white/10 bg-black/30 px-4 text-base outline-none ring-[#42f5c8]/50 placeholder:text-white/35 focus:ring-2"
                  inputMode="tel"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+1 212 555 0104"
                  value={phone}
                />
              </div>
              <button
                className="h-12 w-full rounded-md bg-white text-sm font-bold text-black"
                type="submit"
              >
                Add Contact
              </button>
            </form>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#42f5c8]/50 bg-[#42f5c8]/10 px-4 py-6 text-center">
              <span className="text-sm font-bold text-[#42f5c8]">Upload CSV or Excel export</span>
              <span className="mt-1 text-xs text-white/55">Name, phone columns work best</span>
              <input
                accept=".csv,.tsv,.txt,.xls,.xlsx"
                className="sr-only"
                onChange={uploadContacts}
                type="file"
              />
            </label>

            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/45">
                Contact List
              </h2>
              <button
                className="text-sm font-semibold text-white/60"
                onClick={() => setContacts([])}
                type="button"
              >
                Clear
              </button>
            </div>

            <div className="grid gap-2 pb-16">
              {contacts.map((contact) => (
                <article
                  className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-4 py-3"
                  key={contact.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{contact.name}</p>
                    <p className="truncate text-sm text-white/50">{contact.phone}</p>
                  </div>
                  <button
                    className="ml-3 shrink-0 text-sm font-semibold text-[#ff6b8a]"
                    onClick={() =>
                      setContacts((current) =>
                        current.filter((saved) => saved.id !== contact.id),
                      )
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "send" ? (
          <div className="flex flex-1 flex-col">
            <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.06] p-4">
              <label className="mb-3 block text-sm font-semibold text-white/65">
                Text message
              </label>
              <textarea
                className="min-h-44 w-full resize-none rounded-md border border-white/10 bg-black/35 p-4 text-base leading-6 outline-none ring-[#42f5c8]/50 placeholder:text-white/30 focus:ring-2"
                maxLength={480}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type the message you want to send to everyone..."
                value={message}
              />
              <div className="mt-3 flex justify-between text-xs text-white/45">
                <span>{validContacts.length} recipients</span>
                <span>{message.length}/480</span>
              </div>
            </div>

            <div className="mb-5 rounded-md border border-white/10 bg-black/25 px-4 py-3 text-xs leading-5 text-white/50">
              Delivery can be tracked through the SMS provider. Regular SMS does not provide reliable read receipts.
            </div>

            <button
              className="mt-auto h-14 w-full rounded-md bg-[#42f5c8] text-base font-black text-black disabled:cursor-not-allowed disabled:opacity-45"
              disabled={sendState === "sending"}
              onClick={sendBulkMessage}
              type="button"
            >
              {sendState === "sending" ? "Sending..." : "Send to All Contacts"}
            </button>
          </div>
        ) : null}

        {activeTab === "tracking" ? (
          <div className="flex flex-1 flex-col gap-4">
            <div className="grid grid-cols-4 gap-2">
              {[
                ["Total", counts.total],
                ["Queued", counts.queued],
                ["Delivered", counts.delivered],
                ["Failed", counts.failed],
              ].map(([label, value]) => (
                <div className="rounded-md border border-white/10 bg-white/[0.04] p-3 text-center" key={label}>
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">{label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                className={`h-11 rounded-md text-sm font-bold ${
                  statusFilter === "all" ? "bg-white text-black" : "border border-white/10 text-white/60"
                }`}
                onClick={() => setStatusFilter("all")}
                type="button"
              >
                All
              </button>
              <button
                className={`h-11 rounded-md text-sm font-bold ${
                  statusFilter === "failed" ? "bg-[#ff6b8a] text-black" : "border border-white/10 text-white/60"
                }`}
                onClick={() => setStatusFilter("failed")}
                type="button"
              >
                Failed
              </button>
            </div>

            <button
              className="h-12 rounded-md bg-[#ff6b8a] text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
              disabled={sendState === "sending" || failedContacts.length === 0}
              onClick={resendFailed}
              type="button"
            >
              Resend to All Failed
            </button>

            <div className="rounded-md border border-white/10 bg-black/25 px-4 py-3 text-xs leading-5 text-white/50">
              Read status is marked unavailable because carrier SMS normally confirms delivery, not whether someone opened the message.
            </div>

            <div className="grid gap-2 pb-16">
              {visibleResults.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm text-white/45">
                  No tracking records yet.
                </div>
              ) : (
                visibleResults.map((result) => (
                  <article
                    className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3"
                    key={result.id}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{result.name}</p>
                        <p className="truncate text-sm text-white/50">{result.phone}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusTone(
                          result.status,
                        )}`}
                      >
                        {result.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/45">
                      <span>Read: unavailable for SMS</span>
                      <span>{result.error ?? result.providerId ?? "provider pending"}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
