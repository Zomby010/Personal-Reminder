import { useState, useEffect, useRef, useCallback } from "react";

const REMINDER_HOUR = 9;
const REMINDER_MIN = 0;

const TOPICS = [
  { day: 1,  week: "Week 1", topic: "Python Basics",         focus: "Variables, data types, and operators" },
  { day: 2,  week: "Week 1", topic: "Control Flow",          focus: "if/else, loops, and conditionals" },
  { day: 3,  week: "Week 1", topic: "Functions",             focus: "def, return, scope, and lambda" },
  { day: 4,  week: "Week 1", topic: "Lists & Tuples",        focus: "Indexing, slicing, and list methods" },
  { day: 5,  week: "Week 1", topic: "Dictionaries & Sets",   focus: "Key-value pairs, set operations" },
  { day: 6,  week: "Week 2", topic: "File I/O",              focus: "Reading and writing files with open()" },
  { day: 7,  week: "Week 2", topic: "Error Handling",        focus: "try/except/finally, custom exceptions" },
  { day: 8,  week: "Week 2", topic: "Modules & Packages",    focus: "import, pip, and virtual environments" },
  { day: 9,  week: "Week 2", topic: "OOP Basics",            focus: "Classes, objects, __init__, methods" },
  { day: 10, week: "Week 2", topic: "OOP Advanced",          focus: "Inheritance, polymorphism, dunder methods" },
];

function getTimeUntilReminder() {
  const now = new Date();
  const target = new Date();
  target.setHours(REMINDER_HOUR, REMINDER_MIN, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1);
  return Math.floor((target - now) / 1000);
}

function formatCountdown(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return {
    hours:   String(h).padStart(2, "0"),
    minutes: String(m).padStart(2, "0"),
    seconds: String(s).padStart(2, "0"),
  };
}

function getPlanDay() {
  const stored = localStorage.getItem("study_start_date");
  const today = new Date().toISOString().split("T")[0];
  if (!stored) {
    localStorage.setItem("study_start_date", today);
    return 1;
  }
  const start = new Date(stored);
  const now   = new Date(today);
  const diff  = Math.floor((now - start) / 86400000) + 1;
  return Math.max(1, Math.min(diff, TOPICS.length));
}

const NUM_BARS = 28;

export default function App() {
  const [secondsLeft, setSecondsLeft]   = useState(getTimeUntilReminder);
  const [alarmActive, setAlarmActive]   = useState(false);
  const [barHeights,  setBarHeights]    = useState(() => Array(NUM_BARS).fill(0.15));
  const [planDay,     setPlanDay]       = useState(getPlanDay);
  const [dismissed,  setDismissed]      = useState(false);
  const animRef  = useRef(null);
  const audioRef = useRef(null);

  /* ── Countdown tick ─────────────────────────────────────────────────── */
  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setAlarmActive(true);
          setDismissed(false);
          return getTimeUntilReminder();
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Sound bar animation ─────────────────────────────────────────────── */
  const animateBars = useCallback(() => {
    setBarHeights(prev =>
      prev.map((h, i) => {
        const target = alarmActive
          ? 0.2 + Math.random() * 0.8
          : 0.05 + Math.sin(Date.now() / 800 + i * 0.4) * 0.04 + 0.06;
        return h + (target - h) * (alarmActive ? 0.35 : 0.08);
      })
    );
    animRef.current = requestAnimationFrame(animateBars);
  }, [alarmActive]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(animateBars);
    return () => cancelAnimationFrame(animRef.current);
  }, [animateBars]);

  /* ── Web Audio alarm (no file needed) ───────────────────────────────── */
  useEffect(() => {
    if (!alarmActive || dismissed) return;
    let ctx, gain, stopped = false;

    (async () => {
      ctx  = new (window.AudioContext || window.webkitAudioContext)();
      gain = ctx.createGain();
      gain.connect(ctx.destination);

      const beep = (freq, start, dur) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.3, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.05);
      };

      const pattern = () => {
        if (stopped) return;
        beep(880, 0.0,  0.12);
        beep(660, 0.15, 0.12);
        beep(880, 0.30, 0.12);
        beep(660, 0.45, 0.12);
        setTimeout(() => { if (!stopped) pattern(); }, 1200);
      };
      pattern();
      audioRef.current = { stop: () => { stopped = true; ctx.close(); } };
    })();

    return () => { audioRef.current?.stop(); };
  }, [alarmActive, dismissed]);

  const dismiss = () => {
    setAlarmActive(false);
    setDismissed(true);
    audioRef.current?.stop();
    setPlanDay(getPlanDay());
  };

  const todayEntry = TOPICS.find(t => t.day === planDay) || TOPICS[0];
  const { hours, minutes, seconds } = formatCountdown(secondsLeft);
  const progress = 1 - secondsLeft / 86400;

  return (
    <div style={styles.root}>
      {/* ── background grid ── */}
      <div style={styles.grid} aria-hidden="true" />

      <div style={styles.shell}>

        {/* ── header ── */}
        <header style={styles.header}>
          <span style={styles.dot(alarmActive ? "#f87171" : "#4ade80")} />
          <span style={styles.headerTitle}>STUDY REMINDER</span>
          <span style={styles.headerSub}>DAY {planDay} / {TOPICS.length}</span>
        </header>

        {/* ── countdown clock ── */}
        <section style={styles.clockSection} aria-label="Countdown to next reminder">
          <p style={styles.clockLabel}>NEXT ALARM IN</p>
          <div style={styles.clockRow}>
            <ClockUnit value={hours}   label="HRS" flash={alarmActive} />
            <span style={styles.colon(alarmActive)}>:</span>
            <ClockUnit value={minutes} label="MIN" flash={alarmActive} />
            <span style={styles.colon(alarmActive)}>:</span>
            <ClockUnit value={seconds} label="SEC" flash={alarmActive} />
          </div>

          {/* progress arc */}
          <div style={styles.arcWrap} aria-hidden="true">
            <svg viewBox="0 0 220 12" style={{ width: "100%", display: "block" }}>
              <rect x="0" y="4" width="220" height="4" rx="2" fill="#1e293b" />
              <rect x="0" y="4" width={220 * progress} height="4" rx="2"
                fill={alarmActive ? "#f87171" : "#38bdf8"} />
            </svg>
            <div style={styles.arcLabels}>
              <span style={styles.arcLabel}>00:00</span>
              <span style={styles.arcLabel}>09:00</span>
            </div>
          </div>
        </section>

        {/* ── sound bar ── */}
        <section style={styles.soundSection} aria-label="Sound bar visualizer">
          <p style={styles.soundLabel}>
            <span style={styles.dot(alarmActive ? "#f87171" : "#475569")} />
            {alarmActive ? "ALARM PLAYING" : "STANDBY"}
          </p>
          <div style={styles.bars}>
            {barHeights.map((h, i) => (
              <div
                key={i}
                style={{
                  ...styles.bar,
                  height: `${Math.round(h * 64)}px`,
                  background: alarmActive
                    ? `hsl(${0 + i * 2}, 85%, ${55 + h * 20}%)`
                    : `hsl(210, 30%, ${25 + h * 30}%)`,
                  opacity: alarmActive ? 0.85 + h * 0.15 : 0.5,
                  transition: alarmActive ? "none" : "height 0.4s ease, background 0.4s ease",
                }}
              />
            ))}
          </div>
        </section>

        {/* ── today's topic ── */}
        <section style={styles.topicSection}>
          <div style={styles.topicCard}>
            <div style={styles.topicHeader}>
              <span style={styles.weekBadge}>{todayEntry.week}</span>
              <span style={styles.topicDay}>Day {todayEntry.day}</span>
            </div>
            <h2 style={styles.topicTitle}>{todayEntry.topic}</h2>
            <p  style={styles.topicFocus}>{todayEntry.focus}</p>
          </div>
        </section>

        {/* ── alarm overlay ── */}
        {alarmActive && !dismissed && (
          <div style={styles.alarmOverlay} role="alert">
            <div style={styles.alarmBox}>
              <p style={styles.alarmEmoji}>⏰</p>
              <p style={styles.alarmHeading}>TIME TO STUDY</p>
              <p style={styles.alarmTopic}>{todayEntry.topic}</p>
              <p style={styles.alarmFocus}>{todayEntry.focus}</p>
              <button style={styles.dismissBtn} onClick={dismiss}>
                DISMISS ALARM
              </button>
            </div>
          </div>
        )}

        {/* ── footer ── */}
        <footer style={styles.footer}>
          <span>PYTHON STUDY PLANNER</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>ALARM AT 09:00 DAILY</span>
        </footer>
      </div>
    </div>
  );
}

function ClockUnit({ value, label, flash }) {
  return (
    <div style={styles.clockUnit}>
      <span style={{ ...styles.clockDigit, color: flash ? "#f87171" : "#e2e8f0",
        textShadow: flash ? "0 0 24px #f87171aa" : "0 0 16px #38bdf844" }}>
        {value}
      </span>
      <span style={styles.clockUnitLabel}>{label}</span>
    </div>
  );
}

/* ── styles ─────────────────────────────────────────────────────────────── */
const styles = {
  root: {
    minHeight: "100vh",
    background: "#020917",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Courier New', Courier, monospace",
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    position: "absolute", inset: 0, zIndex: 0,
    backgroundImage:
      "linear-gradient(rgba(56,189,248,0.04) 1px, transparent 1px)," +
      "linear-gradient(90deg, rgba(56,189,248,0.04) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    pointerEvents: "none",
  },
  shell: {
    position: "relative", zIndex: 1,
    width: "100%", maxWidth: "520px",
    padding: "2rem 1.5rem",
    display: "flex", flexDirection: "column", gap: "2rem",
  },
  header: {
    display: "flex", alignItems: "center", gap: "10px",
  },
  headerTitle: {
    fontSize: "11px", letterSpacing: "0.2em",
    color: "#64748b", fontWeight: 700, flex: 1,
  },
  headerSub: {
    fontSize: "11px", letterSpacing: "0.15em", color: "#334155",
  },
  dot: (color) => ({
    width: "8px", height: "8px", borderRadius: "50%",
    background: color, display: "inline-block",
    boxShadow: `0 0 8px ${color}`,
    flexShrink: 0,
  }),
  clockSection: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem",
  },
  clockLabel: {
    fontSize: "10px", letterSpacing: "0.25em",
    color: "#334155", margin: 0, fontWeight: 700,
  },
  clockRow: {
    display: "flex", alignItems: "flex-start", gap: "4px",
  },
  clockUnit: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
    minWidth: "96px",
  },
  clockDigit: {
    fontSize: "clamp(52px, 12vw, 80px)",
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: "0.04em",
    transition: "color 0.3s, text-shadow 0.3s",
  },
  clockUnitLabel: {
    fontSize: "9px", letterSpacing: "0.2em",
    color: "#334155", fontWeight: 700,
  },
  colon: (flash) => ({
    fontSize: "clamp(44px, 10vw, 68px)",
    fontWeight: 700, lineHeight: 1,
    color: flash ? "#f87171" : "#1e3a5f",
    paddingBottom: "16px",
    transition: "color 0.3s",
  }),
  arcWrap: { width: "100%", maxWidth: "360px" },
  arcLabels: {
    display: "flex", justifyContent: "space-between",
    marginTop: "4px",
  },
  arcLabel: { fontSize: "9px", color: "#334155", letterSpacing: "0.1em" },

  soundSection: {
    display: "flex", flexDirection: "column", gap: "10px",
  },
  soundLabel: {
    fontSize: "10px", letterSpacing: "0.2em", color: "#334155",
    margin: 0, fontWeight: 700,
    display: "flex", alignItems: "center", gap: "8px",
  },
  bars: {
    display: "flex", alignItems: "flex-end",
    gap: "3px", height: "64px",
  },
  bar: {
    flex: 1,
    borderRadius: "2px 2px 0 0",
    minHeight: "3px",
  },

  topicSection: {},
  topicCard: {
    border: "0.5px solid #1e3a5f",
    borderRadius: "8px",
    padding: "1.25rem 1.5rem",
    background: "rgba(14,26,48,0.7)",
    display: "flex", flexDirection: "column", gap: "8px",
  },
  topicHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  weekBadge: {
    fontSize: "9px", letterSpacing: "0.2em", fontWeight: 700,
    color: "#38bdf8", background: "rgba(56,189,248,0.1)",
    padding: "3px 8px", borderRadius: "4px",
    border: "0.5px solid rgba(56,189,248,0.2)",
  },
  topicDay: {
    fontSize: "10px", color: "#334155", letterSpacing: "0.1em",
  },
  topicTitle: {
    margin: 0, fontSize: "18px", fontWeight: 700,
    color: "#e2e8f0", letterSpacing: "0.04em",
  },
  topicFocus: {
    margin: 0, fontSize: "13px", color: "#64748b",
    lineHeight: 1.6,
  },

  alarmOverlay: {
    position: "fixed", inset: 0, zIndex: 100,
    background: "rgba(2,9,23,0.92)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  alarmBox: {
    border: "1px solid #f87171",
    borderRadius: "12px",
    padding: "2rem 2.5rem",
    background: "#0a0f1e",
    textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
    maxWidth: "340px", width: "90%",
    boxShadow: "0 0 60px rgba(248,113,113,0.2)",
  },
  alarmEmoji: { fontSize: "36px", margin: 0 },
  alarmHeading: {
    fontSize: "13px", letterSpacing: "0.3em", fontWeight: 700,
    color: "#f87171", margin: 0,
  },
  alarmTopic: {
    fontSize: "20px", fontWeight: 700,
    color: "#e2e8f0", margin: 0,
  },
  alarmFocus: {
    fontSize: "13px", color: "#64748b",
    margin: 0, lineHeight: 1.6,
  },
  dismissBtn: {
    marginTop: "8px",
    padding: "10px 28px",
    fontSize: "11px", letterSpacing: "0.2em", fontWeight: 700,
    color: "#f87171",
    background: "transparent",
    border: "1px solid #f87171",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background 0.2s",
    fontFamily: "inherit",
  },

  footer: {
    display: "flex", gap: "10px", justifyContent: "center",
    fontSize: "9px", letterSpacing: "0.15em",
    color: "#1e3a5f",
  },
};
