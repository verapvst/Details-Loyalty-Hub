#!/usr/bin/env python3
"""One-time seed: preloads the real project calendar content (recurring Team/Professor
meetings, the recurring Weekly PDS deliverable, fixed milestones, approximate steering
windows, and the initial batch of research tasks) as specified by the team.

Safe to re-run only after clearing the relevant rows first — it always inserts fresh
rows rather than upserting, matching the pattern used by earlier one-time scripts
(add_analysis_features.py).

Usage: python3 seed_calendar.py
"""

import uuid
from datetime import date, timedelta

import requests

SUPABASE_URL = "https://dyuflyhkanmczwshmbyh.supabase.co"
SUPABASE_KEY = "sb_publishable_M3BltV-qjx1gED6_ktciuw_9FhwK4G5"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

CREATED_BY = "Seed"
NOW = "2026-09-15T00:00:00+00:00"
TEAM = ["Vera", "André", "Chica", "Alice", "Cá", "Maria"]

RECURRENCE_END = date(2027, 1, 3)  # occurrences generate through 3 Jan 2027


def rest(table):
    return f"{SUPABASE_URL}/rest/v1/{table}"


def mondays_from(start, until):
    d = start
    while d.weekday() != 0:  # 0 = Monday
        d += timedelta(days=1)
    dates = []
    while d <= until:
        dates.append(d)
        d += timedelta(days=7)
    return dates


def post(table, rows):
    resp = requests.post(rest(table), headers=HEADERS, json=rows)
    if resp.status_code not in (200, 201):
        print(f"FAILED inserting into {table}: {resp.status_code} {resp.text}")
        return None
    print(f"OK  {table}: {len(rows)} row(s)")
    return resp.json()


def seed_meetings():
    week_starts = mondays_from(date(2026, 9, 14), RECURRENCE_END)

    team_recurrence = str(uuid.uuid4())
    team_rows = [{
        "title": "Team Meeting",
        "meeting_type": "Team",
        "meeting_date": d.isoformat(),
        "meeting_time": "11:00",
        "end_time": "11:30",
        "format": None,
        "status": "scheduled",
        "recurrence_id": team_recurrence,
        "created_by": CREATED_BY,
        "created_at": NOW,
    } for d in week_starts]
    post("meetings", team_rows)

    professor_recurrence = str(uuid.uuid4())
    professor_rows = [{
        "title": "Professor Meeting",
        "meeting_type": "Professor",
        "meeting_date": d.isoformat(),
        "meeting_time": "11:30",
        "end_time": "12:00",
        "format": "Online",
        "status": "scheduled",
        "recurrence_id": professor_recurrence,
        "created_by": CREATED_BY,
        "created_at": NOW,
    } for d in week_starts]
    post("meetings", professor_rows)


def seed_weekly_deliverable():
    week_starts = mondays_from(date(2026, 9, 14), RECURRENCE_END)
    recurrence_id = str(uuid.uuid4())
    rows = [{
        "title": "Weekly PDS / Project Update",
        "description": "PDF prepared in PowerPoint.",
        "due_date": d.isoformat(),
        "status": "todo",
        "task_type": "Deliverable",
        "assignees": TEAM,  # not yet permanently assigned — starts as the whole team
        "recurrence_id": recurrence_id,
        "created_by": CREATED_BY,
        "created_at": NOW,
    } for d in week_starts]
    post("tasks", rows)


def seed_research_tasks():
    items = [
        ("Vera", "Read Loyalty Program Trends report"),
        ("Chica", "Research Alternative Markets — China & Australia"),
        ("Cá", "Research Retail & FMCG"),
        ("Alice", "Research Travel & Hospitality"),
        ("André", "Research Banking & Fintech"),
        ("Maria", "Research Education & Wellness"),
    ]
    rows = [{
        "title": title,
        "due_date": "2026-09-17",
        "status": "todo",
        "task_type": "Task",
        "assignees": [name],
        "created_by": CREATED_BY,
        "created_at": NOW,
    } for name, title in items]
    post("tasks", rows)


def seed_milestones():
    rows = [
        {
            "title": "Draft Thesis", "milestone_type": "deadline", "precision": "exact",
            "date_from": "2026-12-09", "date_to": "2026-12-09", "date_label": None,
            "notes": "Draft thesis due.",
        },
        {
            "title": "Final Thesis", "milestone_type": "deadline", "precision": "exact",
            "date_from": "2026-12-13", "date_to": "2026-12-13", "date_label": None,
            "notes": "Final thesis — Word document.",
        },
        {
            "title": "Final Presentation", "milestone_type": "presentation", "precision": "window",
            "date_from": "2026-12-01", "date_to": "2026-12-08", "date_label": "Early December",
            "notes": "Exact date TBD.",
        },
        {
            "title": "Steering 1", "milestone_type": "steering", "precision": "window",
            "date_from": "2026-09-21", "date_to": "2026-09-30", "date_label": "Late September",
            "notes": "Internal & External Analysis.",
        },
        {
            "title": "Steering 2", "milestone_type": "steering", "precision": "window",
            "date_from": "2026-10-19", "date_to": "2026-10-30", "date_label": "Late October",
            "notes": "Strategy & Economic Viability.",
        },
        {
            "title": "Steering 3", "milestone_type": "steering", "precision": "window",
            "date_from": "2026-11-09", "date_to": "2026-11-20", "date_label": "Mid November",
            "notes": "Roadmap.",
        },
    ]
    for r in rows:
        r["created_by"] = CREATED_BY
        r["created_at"] = NOW
    post("milestones", rows)


def main():
    seed_meetings()
    seed_weekly_deliverable()
    seed_research_tasks()
    seed_milestones()


if __name__ == "__main__":
    main()
