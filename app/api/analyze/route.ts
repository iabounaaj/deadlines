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
  const cutoff = new Date(now.getTime() + 150 * 24 * 60 * 60 * 1000);
  const events: { summary: string; dateStr: string; due: Date }[] = [];

  for (const block of text.split("BEGIN:VEVENT").slice(1)) {
    const get = (field: string) =>
      block.match(new RegExp(`\n${field}[^:\n]*:([^\n]+)`))?.[1]?.trim();

    const summary = get("SUMMARY");
    const raw = get("DTSTART") ?? get("DUE");
    if (!summary || !raw) continue;

    const due = parseICalDate(raw);
    if (!due || due < now || due > cutoff) continue;

    const yyyy = due.getFullYear();
    const mm = String(due.getMonth() + 1).padStart(2, "0");
    const dd = String(due.getDate()).padStart(2, "0");

    events.push({ summary, due, dateStr: `${yyyy}-${mm}-${dd}` });
  }

  return events.sort((a, b) => a.due.getTime() - b.due.getTime());
}

export async function POST(req: Request) {
  const { icalUrl, icalText, syllabus } = await req.json();

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return Response.json({ error: "Missing API key" }, { status: 500 });

  let rawIcal = icalText as string | null;
  if (!rawIcal && icalUrl?.trim()) {
    try {
      const r = await fetch(icalUrl.trim());
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      rawIcal = await r.text();
    } catch (err) {
      return Response.json(
        { error: `Could not fetch calendar: ${err instanceof Error ? err.message : "unknown"}` },
        { status: 400 }
      );
    }
  }

  if (!rawIcal) return Response.json({ error: "No calendar data" }, { status: 400 });

  const parsed = parseICal(rawIcal);
  if (parsed.length === 0) {
    return Response.json({
      events: [],
      walkthroughItems: [
        {
          id: "w0",
          eventIds: [],
          message: "No upcoming deadlines found in your calendar for the next 5 months.",
          priority: "info",
        },
      ],
    });
  }

  const eventList = parsed
    .map((e, i) => `${i + 1}. [${e.dateStr}] ${e.summary}`)
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);

  const prompt = `You are an academic schedule analyzer. Today is ${today}.

Here are the upcoming calendar events:
${eventList}

${syllabus?.trim() ? `Course syllabus / notes:\n${syllabus.trim()}` : "No syllabus provided."}

Return a JSON object with exactly this structure:
{
  "events": [
    {
      "id": "e1",
      "title": "Assignment title",
      "date": "YYYY-MM-DD",
      "course": "Course name or code",
      "urgency": "red|yellow|green|gray",
      "type": "exam|assignment|lecture|lab|other",
      "weight": "30% or null",
      "notes": "short note or null"
    }
  ],
  "walkthroughItems": [
    {
      "id": "w1",
      "eventIds": ["e1", "e2"],
      "message": "Conversational message about these events",
      "priority": "critical|normal|info"
    }
  ]
}

Urgency rules:
- "red" = exams, tests, quizzes, midterms, finals
- "yellow" = assignments, projects, submissions due within 14 days from today
- "green" = assignments, projects, submissions due more than 14 days away
- "gray" = lectures, labs, tutorials, office hours, and anything routine/recurring

Walkthrough rules:
- Order walkthrough items by priority: critical first, then normal, then info
- Group all lectures/tutorials for the same course into ONE info item (e.g. "You have lectures for COMP 101 every Monday and Wednesday")
- Each exam or important deadline should get its own critical/normal item
- Be conversational and encouraging — you're a friendly academic assistant
- Mention weight from syllabus if available
- Keep each message under 40 words
- Generate 4–10 walkthrough items total

Return ONLY the JSON object. No markdown, no explanation.`;

  const geminiBody = JSON.stringify({
    generationConfig: { responseMimeType: "application/json" },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  let geminiRes: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: geminiBody,
      }
    );
    if (geminiRes.status !== 429) break;
    await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
  }

  if (!geminiRes!.ok) {
    const err = await geminiRes!.text();
    return Response.json({ error: err }, { status: geminiRes!.status });
  }

  const data = await geminiRes!.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return Response.json({ error: "Empty Gemini response" }, { status: 500 });

  try {
    const result = JSON.parse(raw);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Invalid JSON from Gemini", raw }, { status: 500 });
  }
}
