# deadlines.

An academic calendar planner that parses your Brightspace iCal feed, classifies every event by urgency using Gemini 2.5 Flash, and renders a full-screen interactive calendar with a collapsible AI assistant panel.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)

## Features

- **iCal / ICS support** — paste your Brightspace calendar URL or drop an `.ics` file
- **Syllabus parsing** — upload a PDF or DOCX and the AI uses it to enrich event context
- **Gemini 2.5 Flash JSON mode** — structured classification of every event with urgency, course, type, weight, and notes
- **Urgency color coding** — red for exams, yellow for assignments due soon, green for upcoming assignments, gray for lectures
- **Full-screen calendar** — spring-animated day cells with per-day event pills; click any day for a detail modal
- **AI walkthrough** — guided tour through your most critical deadlines in priority order
- **AI chat** — ask questions about your schedule with full calendar and syllabus context
- **Dark / light mode** — dark by default, persisted to localStorage with no flash on load

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + CSS variables |
| Animations | Framer Motion |
| AI | Gemini 2.5 Flash (direct REST, JSON mode + SSE streaming) |
| File parsing | `unpdf` (PDF), `mammoth` (DOCX) |
| Calendar format | iCal / ICS |

## Getting Started

```bash
git clone https://github.com/iabounaaj/deadlines.git
cd deadlines
npm install
```

Create a `.env.local` file:

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key from [Google AI Studio](https://aistudio.google.com/) |

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/analyze` | POST | Parses iCal, calls Gemini, returns structured events + walkthrough items |
| `/api/planner` | POST | Streaming chat with calendar + syllabus context |
| `/api/parse` | POST | Extracts text from uploaded PDF or DOCX |
