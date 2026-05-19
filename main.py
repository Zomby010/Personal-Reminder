"""
Python Study Reminder
=====================
Runs locally on your PC. Every day at 09:00 it reads today's row
from timetable.csv, fires a desktop notification, and plays the
alarm sound.

Setup (run once in your terminal):
    pip install pandas schedule plyer pygame

Place these three files in the same folder:
    main.py
    timetable.csv
    alarm.mp3          <-- rename your siren file to alarm.mp3

Then run:
    python main.py
"""

import pandas as pd
import schedule
import time
import datetime
import os
import sys

# ── optional sound: pygame is cross-platform and reliable ─────────────────────
try:
    import pygame
    PYGAME_AVAILABLE = True
except ImportError:
    PYGAME_AVAILABLE = False

# ── desktop notifications ─────────────────────────────────────────────────────
try:
    from plyer import notification
    PLYER_AVAILABLE = True
except ImportError:
    PLYER_AVAILABLE = False


# =============================================================================
# CONFIG
# =============================================================================
TIMETABLE_FILE = "timetable.csv"
ALARM_FILE     = "alarm.mp3"
REMINDER_TIME  = "09:00"          # 24-hr format required by the schedule library
START_DATE     = None             # Set to "YYYY-MM-DD" to fix the start date,
                                  # or leave None to auto-detect from today


# =============================================================================
# LOAD TIMETABLE
# =============================================================================
def load_timetable(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        print(f"[ERROR] Timetable file not found: {path}")
        print("        Make sure timetable.csv is in the same folder as main.py")
        sys.exit(1)

    df = pd.read_csv(path)

    required = {"Day", "Topic", "Focus", "Week"}
    missing  = required - set(df.columns)
    if missing:
        print(f"[ERROR] CSV is missing columns: {missing}")
        print(f"        Columns found: {list(df.columns)}")
        sys.exit(1)

    return df


# =============================================================================
# FIGURE OUT WHICH DAY OF THE PLAN WE ARE ON
# =============================================================================
def get_plan_day(df: pd.DataFrame, start_date_str: str | None) -> int | None:
    """Return the 1-based plan day number for today, or None if out of range."""
    today = datetime.date.today()

    if start_date_str:
        start = datetime.date.fromisoformat(start_date_str)
    else:
        # Infer start date: Day 1 of the plan was (today - (today_day_number - 1)) days ago.
        # If START_DATE is None we assume the program was first run on Day 1,
        # so we read a tiny file that stores the actual start date.
        state_file = "reminder_start.txt"
        if not os.path.exists(state_file):
            # First ever run — record today as Day 1
            with open(state_file, "w") as f:
                f.write(str(today))
            start = today
            print(f"[INFO] Study plan started today ({today}). Day 1 recorded.")
        else:
            with open(state_file) as f:
                start = datetime.date.fromisoformat(f.read().strip())

    delta = (today - start).days + 1   # Day 1 = 0 days after start
    total_days = int(df["Day"].max())

    if delta < 1 or delta > total_days:
        return None
    return delta


# =============================================================================
# PLAY ALARM SOUND
# =============================================================================
def play_alarm():
    if not os.path.exists(ALARM_FILE):
        print(f"[WARN] Alarm file '{ALARM_FILE}' not found — skipping sound.")
        return
    try:
        from playsound import playsound
        playsound(ALARM_FILE)
    except Exception as e:
        print(f"[WARN] Sound error: {e}")


# =============================================================================
# SEND DESKTOP NOTIFICATION
# =============================================================================
def send_notification(title: str, message: str):
    print(f"\n{'='*60}")
    print(f"  🔔 {title}")
    print(f"  {message}")
    print(f"{'='*60}\n")

    if PLYER_AVAILABLE:
        try:
            notification.notify(
                title=title,
                message=message,
                app_name="Python Study Reminder",
                timeout=15,
            )
        except Exception as e:
            print(f"[WARN] Desktop notification failed: {e}")


# =============================================================================
# MAIN REMINDER FUNCTION (called by scheduler every day at 09:00)
# =============================================================================
def remind():
    df       = load_timetable(TIMETABLE_FILE)
    plan_day = get_plan_day(df, START_DATE)

    if plan_day is None:
        send_notification(
            "Python Study Reminder",
            "🎉 You've completed all 30 days! Keep building projects."
        )
        play_alarm()
        return

    row = df[df["Day"] == plan_day].iloc[0]

    topic   = row["Topic"]
    focus   = row["Focus"]
    week    = row["Week"]
    project = row.get("Project", "")
    res     = row.get("Resource Name", "")
    url     = row.get("Resource URL", "")

    project_line  = f"  Project : {project}" if pd.notna(project) and str(project).strip() else ""
    resource_line = f"  Resource: {res} → {url}" if pd.notna(res) and str(res).strip() else ""

    short_msg = f"Day {plan_day} | {topic}\n{focus[:80]}{'...' if len(focus) > 80 else ''}"

    full_msg = (
        f"\n📅  Day {plan_day}/30  |  {week}"
        f"\n📖  Topic  : {topic}"
        f"\n🎯  Goal   : {focus}"
        + (f"\n{project_line}" if project_line else "")
        + (f"\n{resource_line}" if resource_line else "")
    )

    print(full_msg)
    send_notification("🐍 Python Study Reminder", short_msg)
    play_alarm()


# =============================================================================
# SCHEDULE & RUN
# =============================================================================
if __name__ == "__main__":
    df = load_timetable(TIMETABLE_FILE)
    print(f"[INFO] Timetable loaded — {len(df)} days found.")
    print(f"[INFO] Daily reminder scheduled at {REMINDER_TIME}.")
    print(f"[INFO] Keeping program running... (Ctrl+C to stop)\n")

    # Fire once immediately so you can test it right away
    print("[INFO] Running an immediate test reminder...")
    remind()

    # Then schedule the real daily reminder
    schedule.every().day.at(REMINDER_TIME).do(remind)

    while True:
        schedule.run_pending()
        time.sleep(30)
