function unfold(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseICalDate(s: string): Date | null {
  try {
    s = s.trim();
    if (s.length === 8) {
      return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
    }
    const d = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    const t = `${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}`;
    return new Date(s.endsWith("Z") ? `${d}T${t}Z` : `${d}T${t}`);
  } catch {
    return null;
  }
}

function parseICal(icsText: string) {
  const text = unfold(icsText);
  const now = new Date();
  const cutoff = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
  const events: { summary: string; dateStr: string; due: Date }[] = [];

  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const get = (field: string) =>
      block.match(new RegExp(`\n${field}[^:\n]*:([^\n]+)`))?.[1]?.trim();

    const summary = get("SUMMARY");
    const raw = get("DTSTART") ?? get("DUE");
    if (!summary || !raw) continue;

    const due = parseICalDate(raw);
    if (!due || due < now || due > cutoff) continue;

    events.push({
      summary,
      due,
      dateStr: due.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });
  }

  return events.sort((a, b) => a.due.getTime() - b.due.getTime());
}

export async function POST(req: Request) {
  const { messages, icalUrl, syllabus } = await req.json();

  let calendarContext = "No calendar URL provided.";
  if (icalUrl?.trim()) {
    try {
      const res = await fetch(icalUrl.trim());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const events = parseICal(await res.text());
      calendarContext =
        events.length > 0
          ? events.map((e) => `• ${e.summary} — due ${e.dateStr}`).join("\n")
          : "No upcoming deadlines found in the next 4 months.";
    } catch (err) {
      calendarContext = `Could not load calendar: ${err instanceof Error ? err.message : "unknown error"}`;
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const systemInstruction = `You are a smart academic assistant helping a university student manage their assignments and deadlines.

Today is ${today}.

UPCOMING DEADLINES (from Brightspace calendar):
${calendarContext}

COURSE SYLLABUS / NOTES:
${syllabus?.trim() || "None provided."}

Your job:
- List upcoming assignments sorted by due date when asked
- Suggest when to start each task based on urgency and complexity
- Prioritize based on due dates and weights from the syllabus if available
- Be concise, direct, and practical — use bullet points
- Be encouraging but honest about tight deadlines`;

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return new Response("Missing API key", { status: 500 });
  }

  const contents = messages.map((m: { role: string; content: string }) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const geminiBody = JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
  });

  let geminiRes: Response | null = null;
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: geminiBody,
      }
    );

    if (geminiRes.status !== 429) break;

    const wait = 2000 * Math.pow(2, attempt);
    await new Promise((res) => setTimeout(res, wait));
  }

  if (!geminiRes!.ok) {
    const err = await geminiRes!.text();
    return new Response(err, { status: geminiRes!.status });
  }

  geminiRes = geminiRes!;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (!json || json === "[DONE]") continue;
            try {
              const parsed = JSON.parse(json);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // skip malformed lines
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
