"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
type Urgency = "red" | "yellow" | "green" | "gray";
type EventType = "exam" | "assignment" | "lecture" | "lab" | "other";

type AnalyzedEvent = {
  id: string;
  title: string;
  date: string;
  course: string;
  urgency: Urgency;
  type: EventType;
  weight?: string | null;
  notes?: string | null;
};

type WalkthroughItem = {
  id: string;
  eventIds: string[];
  message: string;
  priority: "critical" | "normal" | "info";
};

type ChatMsg = { role: "user" | "assistant"; content: string };

// ─── Urgency palette ─────────────────────────────────────────────────────────
const U: Record<Urgency, { color: string; bg: string; border: string; label: string }> = {
  red:    { color: "#f87171", bg: "rgba(239,68,68,0.22)",   border: "rgba(239,68,68,0.5)",   label: "Exam" },
  yellow: { color: "#fb923c", bg: "rgba(251,146,60,0.22)",  border: "rgba(251,146,60,0.55)", label: "Due soon" },
  green:  { color: "#4ade80", bg: "rgba(34,197,94,0.2)",    border: "rgba(34,197,94,0.5)",   label: "Upcoming" },
  gray:   { color: "#a0aec0", bg: "rgba(107,114,128,0.18)", border: "rgba(107,114,128,0.4)", label: "Class" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toYMD(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Welcome screen ───────────────────────────────────────────────────────────
function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0 }}>
      <motion.h1
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.5, ease: "easeInOut" }}
        style={{
          fontSize: "clamp(3rem, 10vw, 7rem)",
          fontWeight: 700,
          letterSpacing: "0.02em",
          margin: 0,
          background: "linear-gradient(135deg, var(--purple) 0%, var(--orange) 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        welcome.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 1.2 }}
        style={{ color: "var(--text-muted)", fontSize: "1.05rem", marginTop: "1.2rem", letterSpacing: "0.04em" }}
      >
        your AI-powered assignment planner
      </motion.p>

      <motion.button
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 3.8, duration: 0.6, type: "spring", stiffness: 260, damping: 22 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.97 }}
        onClick={onStart}
        style={{
          marginTop: "2.8rem",
          padding: "0.75rem 2.2rem",
          background: "transparent",
          border: "1px solid var(--purple)",
          borderRadius: "2rem",
          color: "var(--purple)",
          fontSize: "0.95rem",
          letterSpacing: "0.08em",
          cursor: "pointer",
          transition: "background 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(168,85,247,0.12)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        get started
      </motion.button>
    </div>
  );
}

// ─── Processing screen ────────────────────────────────────────────────────────
function ProcessingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -14, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
            style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--purple)" }}
          />
        ))}
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", letterSpacing: "0.06em" }}>
        analyzing your schedule…
      </p>
    </div>
  );
}

// ─── Day cell ─────────────────────────────────────────────────────────────────
function DayCell({ day, events, isToday, isHighlighted, idx, onClick }: {
  day: number; events: AnalyzedEvent[]; isToday: boolean;
  isHighlighted: boolean; idx: number; onClick: (e: React.MouseEvent) => void;
}) {
  const top = events.slice(0, 3);
  const overflow = events.length - 3;
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 440, damping: 24, delay: idx * 0.012 }}
      onClick={onClick}
      style={{
        minHeight: 88, padding: "6px 7px",
        background: isHighlighted ? "rgba(168,85,247,0.14)" : "var(--bg-card)",
        border: `1px solid ${isHighlighted ? "var(--border-bright)" : "var(--border)"}`,
        borderRadius: 10, cursor: events.length > 0 ? "pointer" : "default",
        position: "relative", transition: "background 0.3s, border-color 0.3s", userSelect: "none",
      }}
      whileHover={events.length > 0 ? { opacity: 0.85 } : {}}
    >
      {isHighlighted && (
        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: -2, borderRadius: 12, border: "2px solid rgba(168,85,247,0.55)", pointerEvents: "none" }}
        />
      )}
      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: isToday ? "var(--purple)" : "transparent", color: isToday ? "#fff" : "var(--text)", fontSize: "0.78rem", fontWeight: isToday ? 600 : 500, marginBottom: 4 }}>
        {day}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {top.map((ev) => (
          <div key={ev.id} className={`urgency-pill urgency-${ev.urgency}`} style={{ fontSize: "0.65rem", padding: "2px 5px", borderRadius: 4, background: U[ev.urgency].bg, border: `1px solid ${U[ev.urgency].border}`, color: U[ev.urgency].color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", fontWeight: 600 }}>
            {ev.title}
          </div>
        ))}
        {overflow > 0 && <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", paddingLeft: 2 }}>+{overflow} more</div>}
      </div>
    </motion.div>
  );
}

// ─── Day detail modal ─────────────────────────────────────────────────────────
function DayModal({ date, events, onClose, clickPos }: {
  date: string; events: AnalyzedEvent[]; onClose: () => void; clickPos: { x: number; y: number };
}) {
  const [year, mon, day] = date.split("-").map(Number);
  const label = new Date(year, mon - 1, day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const modalW = Math.min(400, window.innerWidth * 0.9);
  const pad = 12;
  const left = Math.min(clickPos.x + 12, window.innerWidth  - modalW - pad);
  const top  = Math.min(clickPos.y - 20, window.innerHeight - 320  - pad);
  return (
    <>
      <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, backdropFilter: "blur(3px)" }} />
      <motion.div key="modal" initial={{ opacity: 0, scale: 0.88, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88, y: 8 }} transition={{ type: "spring", stiffness: 420, damping: 28 }} style={{ position: "fixed", top: Math.max(pad, top), left: Math.max(pad, left), zIndex: 51, width: modalW, background: "var(--bg-card)", border: "1px solid var(--border-bright)", borderRadius: 14, padding: "1.25rem", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.2rem" }}>
          <div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text)" }}>{label}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>{events.length} event{events.length !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {events.map((ev) => (
            <div key={ev.id} className={`urgency-pill urgency-${ev.urgency}`} style={{ padding: "0.75rem 1rem", borderRadius: 10, background: U[ev.urgency].bg, border: `1px solid ${U[ev.urgency].border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: U[ev.urgency].color }}>{ev.title}</div>
                <span style={{ fontSize: "0.65rem", padding: "1px 6px", borderRadius: 10, background: U[ev.urgency].border, color: U[ev.urgency].color, marginLeft: 8, whiteSpace: "nowrap" }}>{U[ev.urgency].label}</span>
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>{ev.course}{ev.weight && ` · ${ev.weight}`}</div>
              {ev.notes && <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4, fontStyle: "italic" }}>{ev.notes}</div>}
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────
function AIPanel({ open, onToggle, walkthrough, walkthroughIdx, onWalkthroughNav, chatMessages, chatLoading, onSendChat, onDoneWalkthrough, mode }: {
  open: boolean; onToggle: () => void; walkthrough: WalkthroughItem[]; walkthroughIdx: number;
  onWalkthroughNav: (dir: 1 | -1) => void; chatMessages: ChatMsg[]; chatLoading: boolean;
  onSendChat: (msg: string) => void; onDoneWalkthrough: () => void; mode: "walkthrough" | "chat";
}) {
  const [draft, setDraft] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  const currentItem = walkthrough[walkthroughIdx];

  return (
    <>
      <div onClick={onToggle} style={{ position: "fixed", right: open ? 320 : 0, top: "50%", transform: "translateY(-50%)", zIndex: 31, background: "rgba(168,85,247,0.85)", borderRadius: "8px 0 0 8px", width: 28, height: 80, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "right 0.4s cubic-bezier(0.32,0,0.67,0)", boxShadow: "-3px 0 12px rgba(0,0,0,0.3)" }}>
        <span style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)", color: "#fff", fontSize: "0.7rem", letterSpacing: "0.12em", fontWeight: 600 }}>
          {open ? "close" : "AI"}
        </span>
      </div>

      <motion.div animate={{ x: open ? "0%" : "100%" }} initial={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 320, zIndex: 30, background: "rgba(10,3,22,0.92)", backdropFilter: "blur(24px)", borderLeft: "1px solid rgba(168,85,247,0.25)", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.4)" }}>
        <div style={{ padding: "1.2rem 1.2rem 0.8rem", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ fontSize: "0.7rem", color: "var(--purple)", letterSpacing: "0.12em", fontWeight: 600 }}>AI ASSISTANT</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            {mode === "walkthrough" ? `${walkthroughIdx + 1} of ${walkthrough.length}` : "chat mode"}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {mode === "walkthrough" && currentItem ? (
            <div style={{ flex: 1, padding: "1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "inline-flex", alignSelf: "flex-start", padding: "2px 10px", borderRadius: 10, fontSize: "0.65rem", letterSpacing: "0.1em", fontWeight: 600, background: currentItem.priority === "critical" ? "rgba(239,68,68,0.15)" : currentItem.priority === "normal" ? "rgba(251,146,60,0.15)" : "rgba(107,114,128,0.12)", color: currentItem.priority === "critical" ? "#ef4444" : currentItem.priority === "normal" ? "#fb923c" : "#9ca3af", border: `1px solid ${currentItem.priority === "critical" ? "rgba(239,68,68,0.3)" : currentItem.priority === "normal" ? "rgba(251,146,60,0.3)" : "rgba(107,114,128,0.2)"}` }}>
                {currentItem.priority.toUpperCase()}
              </div>
              <AnimatePresence mode="wait">
                <motion.p key={currentItem.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} style={{ color: "var(--text)", fontSize: "0.95rem", lineHeight: 1.65, margin: 0, flex: 1 }}>
                  {currentItem.message}
                </motion.p>
              </AnimatePresence>
              {currentItem.eventIds.length > 0 && (
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.6rem" }}>
                  {currentItem.eventIds.length} event{currentItem.eventIds.length !== 1 ? "s" : ""} highlighted on calendar
                </div>
              )}
              <div style={{ display: "flex", gap: 5, justifyContent: "center", paddingTop: "0.4rem" }}>
                {walkthrough.map((_, i) => (
                  <div key={i} style={{ width: i === walkthroughIdx ? 18 : 6, height: 6, borderRadius: 3, background: i === walkthroughIdx ? "var(--purple)" : "rgba(168,85,247,0.25)", transition: "width 0.3s, background 0.3s" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button onClick={() => onWalkthroughNav(-1)} disabled={walkthroughIdx === 0} style={{ flex: 1, padding: "0.5rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "var(--text-muted)", opacity: walkthroughIdx === 0 ? 0.4 : 1, cursor: walkthroughIdx === 0 ? "not-allowed" : "pointer", fontSize: "0.8rem" }}>← prev</button>
                {walkthroughIdx < walkthrough.length - 1 ? (
                  <button onClick={() => onWalkthroughNav(1)} style={{ flex: 1, padding: "0.5rem", background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 8, color: "var(--purple)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>next →</button>
                ) : (
                  <button onClick={onDoneWalkthrough} style={{ flex: 1, padding: "0.5rem", background: "rgba(168,85,247,0.25)", border: "1px solid rgba(168,85,247,0.5)", borderRadius: 8, color: "var(--purple)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>chat →</button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {chatMessages.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", textAlign: "center", marginTop: "2rem" }}>Ask me anything about your schedule!</div>}
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "0.6rem 0.9rem", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: m.role === "user" ? "rgba(168,85,247,0.22)" : "rgba(255,255,255,0.06)", border: `1px solid ${m.role === "user" ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.09)"}`, fontSize: "0.82rem", lineHeight: 1.55, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                    {m.content}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ alignSelf: "flex-start", display: "flex", gap: 4, padding: "0.6rem 0.9rem" }}>
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--purple)" }} />
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onSendChat(draft.trim()); setDraft(""); } }} style={{ padding: "0.75rem 0.8rem", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about your schedule…" style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "0.5rem 0.75rem", color: "var(--text)", fontSize: "0.82rem", outline: "none" }} />
                <button type="submit" disabled={!draft.trim() || chatLoading} style={{ padding: "0.5rem 0.8rem", background: draft.trim() ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.05)", border: `1px solid ${draft.trim() ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, color: draft.trim() ? "var(--purple)" : "var(--text-muted)", cursor: draft.trim() ? "pointer" : "not-allowed", fontSize: "0.82rem", transition: "all 0.2s" }}>↑</button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ─── Input screen ─────────────────────────────────────────────────────────────
function InputScreen({ onAnalyze }: { onAnalyze: (payload: { icalUrl?: string; icalText?: string; syllabus?: string }) => void }) {
  const [calTab, setCalTab] = useState<"url" | "file">("url");
  const [icalUrl, setIcalUrl] = useState("");
  const [icalText, setIcalText] = useState<string | null>(null);
  const [icalFileName, setIcalFileName] = useState<string | null>(null);
  const [syllabus, setSyllabus] = useState("");
  const [syllabusOpen, setSyllabusOpen] = useState(false);
  const [syllabusFiles, setSyllabusFiles] = useState<string[]>([]);
  const [draggingCal, setDraggingCal] = useState(false);
  const [draggingSyl, setDraggingSyl] = useState(false);

  const parseFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/parse", { method: "POST", body: fd });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j.text as string;
  };

  const handleIcsFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => { setIcalText(e.target?.result as string); setIcalFileName(file.name); };
    reader.readAsText(file);
  };

  const handleSyllabusFiles = async (files: FileList) => {
    const parts: string[] = [], names: string[] = [];
    for (const file of Array.from(files)) {
      try { const text = await parseFile(file); parts.push(`--- ${file.name} ---\n${text}`); names.push(file.name); } catch { /* skip */ }
    }
    setSyllabus((prev) => [prev, ...parts].filter(Boolean).join("\n\n"));
    setSyllabusFiles((prev) => [...prev, ...names]);
  };

  const canAnalyze = calTab === "url" ? icalUrl.trim().length > 0 : icalText !== null;

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <div style={{ width: "min(480px, 100%)", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 300, color: "var(--text)", margin: 0, letterSpacing: "0.03em" }}>connect your calendar</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.4rem" }}>paste your Brightspace iCal URL or upload an .ics file</p>
        </div>

        <div className="planner-tab-bar" style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["url", "file"] as const).map((t) => (
            <button key={t} onClick={() => setCalTab(t)} style={{ flex: 1, padding: "0.45rem", borderRadius: 8, border: "none", background: calTab === t ? "rgba(168,85,247,0.22)" : "transparent", color: calTab === t ? "var(--purple)" : "var(--text-muted)", fontSize: "0.82rem", cursor: "pointer", transition: "all 0.2s", fontWeight: calTab === t ? 600 : 400 }}>
              {t === "url" ? "Brightspace URL" : "Upload .ics"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {calTab === "url" ? (
            <motion.div key="url" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <input value={icalUrl} onChange={(e) => setIcalUrl(e.target.value)} placeholder="https://brightspace.example.com/calendar.ics" className="planner-input" style={{ width: "100%", padding: "0.75rem 1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "var(--text)", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
            </motion.div>
          ) : (
            <motion.div key="file" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div onDragOver={(e) => { e.preventDefault(); setDraggingCal(true); }} onDragLeave={() => setDraggingCal(false)} onDrop={(e) => { e.preventDefault(); setDraggingCal(false); const file = e.dataTransfer.files[0]; if (file?.name.endsWith(".ics")) handleIcsFile(file); }} onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".ics"; inp.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) handleIcsFile(file); }; inp.click(); }} className="planner-drop-zone" style={{ padding: "2rem", border: `2px dashed ${draggingCal ? "var(--purple)" : "rgba(255,255,255,0.15)"}`, borderRadius: 12, background: draggingCal ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.03)", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}>
                {icalFileName ? <div style={{ color: "var(--purple)", fontSize: "0.85rem" }}>✓ {icalFileName}</div> : <><div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📅</div><div style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>drop your .ics file here or click to browse</div></>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="planner-section" style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <button onClick={() => setSyllabusOpen((o) => !o)} className="planner-section-btn" style={{ width: "100%", padding: "0.9rem 1rem", background: "rgba(255,255,255,0.03)", border: "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: "var(--text)", fontSize: "0.88rem" }}>
            <span>Add syllabus / notes{syllabusFiles.length > 0 && <span style={{ color: "var(--purple)", marginLeft: 8, fontSize: "0.75rem" }}>({syllabusFiles.length} file{syllabusFiles.length !== 1 ? "s" : ""})</span>}</span>
            <motion.span animate={{ rotate: syllabusOpen ? 180 : 0 }} style={{ color: "var(--text-muted)" }}>▾</motion.span>
          </button>
          <AnimatePresence>
            {syllabusOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: "hidden" }}>
                <div style={{ padding: "0.8rem 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div onDragOver={(e) => { e.preventDefault(); setDraggingSyl(true); }} onDragLeave={() => setDraggingSyl(false)} onDrop={async (e) => { e.preventDefault(); setDraggingSyl(false); await handleSyllabusFiles(e.dataTransfer.files); }} onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".pdf,.docx"; inp.multiple = true; inp.onchange = async (e) => { const files = (e.target as HTMLInputElement).files; if (files) await handleSyllabusFiles(files); }; inp.click(); }} className="planner-drop-zone" style={{ padding: "1.2rem", border: `2px dashed ${draggingSyl ? "var(--purple)" : "rgba(255,255,255,0.12)"}`, borderRadius: 10, textAlign: "center", cursor: "pointer", background: draggingSyl ? "rgba(168,85,247,0.08)" : "transparent", transition: "all 0.2s" }}>
                    {syllabusFiles.length > 0 ? <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{syllabusFiles.map((f, i) => <div key={i} style={{ color: "var(--purple)", fontSize: "0.75rem" }}>✓ {f}</div>)}</div> : <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>drop PDF or DOCX syllabuses here</div>}
                  </div>
                  <textarea value={syllabus} onChange={(e) => setSyllabus(e.target.value)} placeholder="Or paste syllabus text, assignment weights, notes…" rows={5} className="planner-textarea" style={{ width: "100%", padding: "0.65rem 0.85rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "var(--text)", fontSize: "0.8rem", resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button whileHover={canAnalyze ? { scale: 1.02 } : {}} whileTap={canAnalyze ? { scale: 0.98 } : {}} onClick={() => onAnalyze({ icalUrl: calTab === "url" ? icalUrl.trim() : undefined, icalText: calTab === "file" ? icalText ?? undefined : undefined, syllabus })} disabled={!canAnalyze} style={{ padding: "0.85rem", background: canAnalyze ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${canAnalyze ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, color: canAnalyze ? "var(--purple)" : "var(--text-muted)", fontSize: "0.9rem", fontWeight: 600, cursor: canAnalyze ? "pointer" : "not-allowed", letterSpacing: "0.06em", transition: "all 0.2s" }}>
          analyze schedule →
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      {(Object.entries(U) as [Urgency, typeof U.red][]).map(([key, val]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: val.bg, border: `1px solid ${val.border}` }} />
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{val.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DeadlinesApp() {
  const [step, setStep] = useState<"welcome" | "input" | "processing" | "calendar">("welcome");
  const [events, setEvents] = useState<AnalyzedEvent[]>([]);
  const [walkthrough, setWalkthrough] = useState<WalkthroughItem[]>([]);
  const [savedPayload, setSavedPayload] = useState<{ icalUrl?: string; icalText?: string; syllabus?: string } | null>(null);
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<{ date: string; x: number; y: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [walkthroughIdx, setWalkthroughIdx] = useState(0);
  const [aiMode, setAiMode] = useState<"walkthrough" | "chat">("walkthrough");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const highlightedEventIds = aiMode === "walkthrough" && walkthrough[walkthroughIdx] ? walkthrough[walkthroughIdx].eventIds : [];
  const highlightedDates = new Set(events.filter((e) => highlightedEventIds.includes(e.id)).map((e) => e.date));

  const runAnalyze = useCallback(async (payload: { icalUrl?: string; icalText?: string; syllabus?: string }) => {
    setSavedPayload(payload);
    setStep("processing");
    try {
      const r = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error ?? "Analysis failed");
      setEvents(json.events ?? []);
      setWalkthrough(json.walkthroughItems ?? []);
      setWalkthroughIdx(0);
      setAiMode("walkthrough");
      setChatMessages([]);
      if ((json.events ?? []).length > 0) {
        const [y, m] = (json.events[0].date as string).split("-").map(Number);
        setCalYear(y); setCalMonth(m - 1);
      }
      setStep("calendar");
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      setStep("input");
    }
  }, []);

  const sendChat = useCallback(async (text: string) => {
    const newMessages: ChatMsg[] = [...chatMessages, { role: "user", content: text }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const r = await fetch("/api/planner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMessages, icalUrl: savedPayload?.icalUrl, syllabus: savedPayload?.syllabus }) });
      if (!r.ok || !r.body) throw new Error(await r.text());
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      setChatMessages([...newMessages, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setChatMessages([...newMessages, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      setChatMessages([...newMessages, { role: "assistant", content: `Error: ${err instanceof Error ? err.message : "unknown"}` }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatMessages, savedPayload]);

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const eventsByDate: Record<string, AnalyzedEvent[]> = {};
  for (const ev of events) { if (!eventsByDate[ev.date]) eventsByDate[ev.date] = []; eventsByDate[ev.date].push(ev); }
  const selectedEvents = selectedDay ? (eventsByDate[selectedDay.date] ?? []) : [];

  return (
    <>
      <style>{`* { box-sizing: border-box; } body { margin: 0; } input, textarea, button { font-family: inherit; }`}</style>

      <AnimatePresence mode="wait">
        {step === "welcome" && <motion.div key="welcome" exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}><WelcomeScreen onStart={() => setStep("input")} /></motion.div>}
        {step === "input"   && <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><InputScreen onAnalyze={runAnalyze} /></motion.div>}
        {step === "processing" && <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><ProcessingScreen /></motion.div>}
        {step === "calendar" && (
          <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ minHeight: "100vh", background: "var(--bg)", paddingRight: panelOpen ? 320 : 0, transition: "padding-right 0.4s cubic-bezier(0.32,0,0.67,0)" }}>
            <div style={{ padding: "1.5rem 1.5rem 3rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", flexWrap: "wrap", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <button onClick={() => setStep("input")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.75rem", padding: 0, display: "flex", alignItems: "center", gap: "0.4rem", transition: "color 0.2s" }} onMouseEnter={e => (e.currentTarget.style.color = "var(--purple)")} onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                    back
                  </button>
                  <h1 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 300, color: "var(--text)" }}>your schedule</h1>
                </div>
                <Legend />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); } else setCalMonth((m) => m - 1); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "var(--text)", cursor: "pointer", padding: "0.35rem 0.7rem", fontSize: "0.85rem" }}>‹</button>
                <div style={{ fontWeight: 500, color: "var(--text)", minWidth: 160, textAlign: "center" }}>{MONTHS[calMonth]} {calYear}</div>
                <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); } else setCalMonth((m) => m + 1); }} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "var(--text)", cursor: "pointer", padding: "0.35rem 0.7rem", fontSize: "0.85rem" }}>›</button>
                <button onClick={() => { setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); }} style={{ marginLeft: "auto", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "var(--text-muted)", cursor: "pointer", padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>today</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
                {DAYS.map((d) => <div key={d} style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.05em", padding: "0.3rem 0" }}>{d}</div>)}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {Array.from({ length: totalCells }, (_, i) => {
                  const dayNum = i - firstDay + 1;
                  if (dayNum < 1 || dayNum > daysInMonth) return <div key={`empty-${i}`} style={{ minHeight: 88 }} />;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const dayEvents = eventsByDate[dateStr] ?? [];
                  return <DayCell key={dateStr} day={dayNum} events={dayEvents} isToday={dateStr === toYMD(today)} isHighlighted={highlightedDates.has(dateStr)} idx={i} onClick={(e) => { if (dayEvents.length > 0) setSelectedDay({ date: dateStr, x: e.clientX, y: e.clientY }); }} />;
                })}
              </div>

              {events.length > 0 && (
                <div style={{ marginTop: "1.5rem", padding: "0.75rem 1rem", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", fontSize: "0.78rem", color: "var(--text-muted)", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                  {(["red", "yellow", "green", "gray"] as Urgency[]).map((u) => { const count = events.filter((e) => e.urgency === u).length; if (count === 0) return null; return <span key={u}><span style={{ color: U[u].color, fontWeight: 600 }}>{count}</span> {U[u].label.toLowerCase()}</span>; })}
                  <span style={{ marginLeft: "auto" }}>{events.length} total</span>
                </div>
              )}
            </div>

            <AIPanel open={panelOpen} onToggle={() => setPanelOpen((o) => !o)} walkthrough={walkthrough} walkthroughIdx={walkthroughIdx} onWalkthroughNav={(dir) => setWalkthroughIdx((i) => Math.max(0, Math.min(walkthrough.length - 1, i + dir)))} chatMessages={chatMessages} chatLoading={chatLoading} onSendChat={sendChat} onDoneWalkthrough={() => setAiMode("chat")} mode={aiMode} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDay && selectedEvents.length > 0 && (
          <DayModal date={selectedDay.date} events={selectedEvents} onClose={() => setSelectedDay(null)} clickPos={{ x: selectedDay.x, y: selectedDay.y }} />
        )}
      </AnimatePresence>
    </>
  );
}
