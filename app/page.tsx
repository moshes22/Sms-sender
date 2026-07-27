"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Contact = {
  id: string;
  name: string;
  phone: string;
};

type SendState = "idle" | "sending" | "sent" | "error";

const sampleContacts: Contact[] = [
  { id: "sample-1", name: "Ari Lane", phone: "+12125550104" },
  { id: "sample-2", name: "Nia Cruz", phone: "+12125550139" },
];

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<"contacts" | "send">("contacts");
  const [contacts, setContacts] = useState<Contact[]>(sampleContacts);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("sms-sender-contacts");
    if (saved) {
      setContacts(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sms-sender-contacts", JSON.stringify(contacts));
  }, [contacts]);

  const validContacts = useMemo(
    () => contacts.filter((contact) => normalizePhone(contact.phone).length >= 8),
    [contacts],
  );

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
      setNotice("For now, export Excel sheets as CSV or paste Excel rows into the upload file.");
      event.target.value = "";
      return;
    }

    const imported = parseDelimited(await file.text());
    addContacts(imported);
    setNotice(`${imported.length} contacts imported.`);
    event.target.value = "";
  }

  async function sendBulkMessage() {
    if (!message.trim()) {
      setNotice("Write a message before sending.");
      return;
    }

    if (validContacts.length === 0) {
      setNotice("Add at least one valid contact.");
      return;
    }

    setSendState("sending");
    setNotice("");

    const response = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        contacts: validContacts.map(({ name, phone }) => ({ name, phone })),
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setSendState("error");
      setNotice(result.error ?? "Message could not be sent.");
      return;
    }

    setSendState("sent");
    setNotice(`Queued ${result.sent} messages.`);
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

        <nav className="mb-5 grid grid-cols-2 rounded-full border border-white/10 bg-white/5 p-1">
          <button
            className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
              activeTab === "contacts" ? "bg-white text-black" : "text-white/65"
            }`}
            onClick={() => setActiveTab("contacts")}
            type="button"
          >
            Contacts
          </button>
          <button
            className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
              activeTab === "send" ? "bg-[#42f5c8] text-black" : "text-white/65"
            }`}
            onClick={() => setActiveTab("send")}
            type="button"
          >
            Send
          </button>
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
        ) : (
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
              Send only to people who opted in. Provider credentials are required before live SMS can leave the app.
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
        )}
      </section>
    </main>
  );
}
