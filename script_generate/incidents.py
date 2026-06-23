import random
from datetime import datetime, timedelta, timezone
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

INCIDENT_TRIGGER_CHANCE = random.uniform(0, 0.4)


# Computes the priority of an incident based on the alarms on its site
# Priority is a string derived from the average severity of the active alarms on the site
# Each alarm's severity comes from the alarm_types table, looked up through the type column on alarms
# @param site_id The id of the site the incident belongs to
# @param start_time_incident Only alarms started at or after this timestamp are considered
def calculate_priority(site_id, start_time_incident):
    alarms = (
        supabase.table("alarms")
        .select("type, status")
        .eq("site", site_id)
        .gte("start_time", start_time_incident.isoformat())
        .execute()
    )

    if not alarms.data:
        return "Warning"

    type_ids = list({row["type"] for row in alarms.data})
    severity_map = {}

    alarm_types_data = (
        supabase.table("alarm_types")
        .select("id, severity")
        .in_("id", type_ids)
        .execute()
    )
    for at in alarm_types_data.data:
        severity_map[at["id"]] = at["severity"]

    total_severity = 0
    nr_active_alarms = 0

    for row in alarms.data:
        if row["status"] == 1:
            severity = severity_map.get(row["type"], 1)
            total_severity += severity
            nr_active_alarms += 1

    if nr_active_alarms == 0:
        return "Warning"

    priority = total_severity / nr_active_alarms

    if priority < 1:
        return "Warning"
    elif priority < 2:
        return "Minor"
    elif priority < 3:
        return "Major"
    else:
        return "Critical"


# Returns the most recent resolved_time among the resolved alarms of a site, or now if none exist
# @param site_id The site to look at
def get_latest_resolved_on_site(site_id):
    if not site_id:
        return datetime.now(timezone.utc)
    resolved = (
        supabase.table("alarms")
        .select("resolved_time")
        .eq("site", site_id)
        .eq("status", 0)
        .not_.is_("resolved_time", "null")
        .order("resolved_time", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if resolved:
        return datetime.fromisoformat(resolved[0]["resolved_time"])
    return datetime.now(timezone.utc)


# Resolves a random subset of currently active incidents
# For each one, resolves its linked alarms in a consistent order (oldest first, then the rest within that window)
# and assigns the incident to a random viewer profile before marking it as resolved
def resolve_old_incidents():
    active = supabase.table("incidents").select("incident_id, start_time").eq("status", 1).execute()
    active_incidents = active.data
    print(f"Incidente active gasite: {len(active_incidents)}")

    if not active_incidents:
        return

    n_to_resolve = random.randint(int(0.6 * len(active_incidents)), int(0.9 * len(active_incidents)))
    incidents_to_resolve = random.sample(active_incidents, n_to_resolve)
    incident_ids_to_resolve = [i["incident_id"] for i in incidents_to_resolve]

    links = (
        supabase.table("incident_alarms")
        .select("incident_id, alarm_id")
        .in_("incident_id", incident_ids_to_resolve)
        .execute()
        .data
    )
    alarm_ids = [row["alarm_id"] for row in links]
    alarms_info = (
        supabase.table("alarms")
        .select("alarm_id, site, start_time, status")
        .in_("alarm_id", alarm_ids)
        .execute()
        .data
    )

    alarm_to_data = {row["alarm_id"]: row for row in alarms_info}
    alarms_per_incident = {}
    for row in links:
        alarms_per_incident.setdefault(row["incident_id"], []).append(alarm_to_data.get(row["alarm_id"]))

    site_per_incident = {}
    for inc_id, alarms in alarms_per_incident.items():
        for a in alarms:
            if a:
                site_per_incident[inc_id] = a["site"]
                break
    
    viewers = supabase.table("profiles").select("id").eq("role", "viewer").execute().data
    viewer_ids = [row["id"] for row in viewers]
    for incident in incidents_to_resolve:
        incident_id = incident["incident_id"]
        site_id = site_per_incident.get(incident_id)
        incident_start = datetime.fromisoformat(incident["start_time"])
        incident_alarms_data = [a for a in alarms_per_incident.get(incident_id, []) if a]

        latest_resolved = get_latest_resolved_on_site(site_id)
        active_alarms = [a for a in incident_alarms_data if a["status"] == 1]

        assigned_to=random.choice(viewer_ids)
        if not active_alarms:
            end_time = incident_start + timedelta(seconds=random.randint(10, 120))
            supabase.table("incidents").update({
                "status": 0,
                "end_time": end_time.isoformat(),
                "assigned_to": assigned_to
            }).eq("incident_id", incident_id).execute()
            continue

        active_alarms.sort(key=lambda a: a["start_time"])
        oldest_alarm = active_alarms[0]
        other_alarms = active_alarms[1:]

        oldest_resolved_time = latest_resolved + timedelta(seconds=random.randint(10, 120))
        oldest_start = datetime.fromisoformat(oldest_alarm["start_time"])
        if oldest_resolved_time < oldest_start:
            oldest_resolved_time = oldest_start + timedelta(seconds=random.randint(10, 120))

        supabase.table("alarms").update({
            "status": 0,
            "resolved_time": oldest_resolved_time.isoformat()
        }).eq("alarm_id", oldest_alarm["alarm_id"]).execute()

        for alarm in other_alarms:
            alarm_start = datetime.fromisoformat(alarm["start_time"])
            lower_bound = max(alarm_start, oldest_start)
            upper_bound = oldest_resolved_time
            if upper_bound <= lower_bound:
                resolved_time = lower_bound + timedelta(seconds=random.randint(1, 30))
            else:
                delta_seconds = int((upper_bound - lower_bound).total_seconds())
                resolved_time = lower_bound + timedelta(seconds=random.randint(1, max(1, delta_seconds)))

            supabase.table("alarms").update({
                "status": 0,
                "resolved_time": resolved_time.isoformat()
            }).eq("alarm_id", alarm["alarm_id"]).execute()

        end_time = oldest_resolved_time + timedelta(seconds=random.randint(10, 120))
        if end_time < incident_start:
            end_time = incident_start + timedelta(seconds=random.randint(10, 120))

        supabase.table("incidents").update({
            "status": 0,
            "end_time": end_time.isoformat(),
            "assigned_to": assigned_to
        }).eq("incident_id", incident_id).execute()

    print(f"{n_to_resolve} incidente rezolvate.")


# Returns the set of site ids that currently have at least one active incident, resolved through incident_alarms -> alarms.site
def get_active_sites():
    active = supabase.table("incidents").select("incident_id").eq("status", 1).execute().data
    active_ids = [row["incident_id"] for row in active]
    if not active_ids:
        return set()
    incident_alarms = supabase.table("incident_alarms").select("alarm_id").in_("incident_id", active_ids).execute().data
    alarm_ids = [row["alarm_id"] for row in incident_alarms]
    if not alarm_ids:
        return set()
    alarms = (
        supabase.table("alarms")
        .select("site")
        .in_("alarm_id", alarm_ids)
        .execute()
        .data
    )
    return {row["site"] for row in alarms}


# Inserts a batch of incident-alarm links, generating a unique random id for each row before the insert
# @param links List of {incident_id, alarm_id, created_at} dicts to insert
def insert_incident_alarms(links):
    if not links:
        return
    existing = supabase.table("incident_alarms").select("id").execute().data
    existing_ids = {row["id"] for row in existing}

    for link in links:
        new_id = random.randint(100000, 999999)
        while new_id in existing_ids:
            new_id = random.randint(100000, 999999)
        link["id"] = new_id
        existing_ids.add(new_id)

    supabase.table("incident_alarms").insert(links).execute()


# Generates new incidents based on the alarms that were just created
# Each site can have at most one active incident at a time
# The site of an active incident is resolved indirectly through incident_alarms -> alarms.site
# Each alarm has a INCIDENT_TRIGGER_CHANCE probability of triggering an incident on its site
# If the site already has an active incident, no new one is created
# When an incident is created, all active alarms on that site that are not already linked to another incident
# are attached to it, not just the triggering one
def deploy_new_incidents():

    all_incidents = [row["incident_id"] for row in supabase.table("incidents").select("incident_id").execute().data]

    active_incident_sites = get_active_sites()

    print(f"Site-uri cu incident activ deja: {len(active_incident_sites)}")

    window_start = datetime.now(timezone.utc) - timedelta(seconds=300)
    new_alarms = (
        supabase.table("alarms")
        .select("alarm_id, site, start_time, status")
        .gte("start_time", window_start.isoformat())
        .eq("status", 1)
        .execute()
    )
    print(f"Alarme noi gasite in fereastra de 5 minute: {len(new_alarms.data)}")

    new_incidents = []
    new_links = []

    used = supabase.table("incident_alarms").select("alarm_id").execute().data
    used_alarm_ids = {row["alarm_id"] for row in used}

    all_active_alarms = (
        supabase.table("alarms")
        .select("alarm_id, site, start_time")
        .eq("status", 1)
        .execute()
        .data
    )
    alarms_per_site = {}
    for a in all_active_alarms:
        alarms_per_site.setdefault(a["site"], []).append(a)

    for alarm in new_alarms.data:
        if alarm["alarm_id"] in used_alarm_ids:
            continue
        site_id = alarm["site"]
        alarm_id = alarm["alarm_id"]
        alarm_start_time = datetime.fromisoformat(alarm["start_time"])

        if site_id in active_incident_sites:
            continue

        if random.random() > INCIDENT_TRIGGER_CHANCE:
            continue

        this_incident_id = random.randint(10000, 99999)
        while this_incident_id in all_incidents:
            this_incident_id = random.randint(10000, 99999)
        all_incidents.append(this_incident_id)

        incident_start_time = alarm_start_time

        priority = calculate_priority(site_id, incident_start_time)

        incident_row = {
            "incident_id": this_incident_id,
            "status": 1,
            "start_time": incident_start_time.isoformat(),
            "end_time": None,
            "priority": priority,
            "assigned_to": None,
        }
        new_incidents.append(incident_row)

        for a in alarms_per_site.get(site_id, []):
            if a["alarm_id"] in used_alarm_ids:
                continue
            new_links.append({
                "incident_id": this_incident_id,
                "alarm_id": a["alarm_id"],
                "created_at": a["start_time"],
            })
            used_alarm_ids.add(a["alarm_id"])

        active_incident_sites.add(site_id)

    if new_incidents:
        supabase.table("incidents").insert(new_incidents).execute()
        insert_incident_alarms(new_links)
        print(f"{len(new_incidents)} incidente noi inserate cu succes.")
        print(f"{len(new_links)} legaturi incident-alarma inserate.")
    else:
        print("Niciun incident nou generat in aceasta rulare.")


if __name__ == "__main__":
    resolve_old_incidents()
    deploy_new_incidents()