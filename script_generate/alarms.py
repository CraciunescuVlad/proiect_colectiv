import random
from datetime import datetime, timedelta, timezone
from supabase import create_client
import os
from dotenv import load_dotenv

techno=["2G", "3G", "4G", "5G"]
nr_alarms=random.randint(1, 30)

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


# Returns the set of oldest active alarms across active incidents (the ones that originally triggered them)
def get_oldest_alarm_per_active_incident():

    active = supabase.table("incidents").select("incident_id").eq("status", 1).execute().data
    active_ids = [row["incident_id"] for row in active]
    if not active_ids:
        return set()
    
    links = (
        supabase.table("incident_alarms")
        .select("incident_id, alarm_id")
        .in_("incident_id", active_ids)
        .execute()
        .data
    )
    if not links:
        return set()
    
    alarm_ids = [row["alarm_id"] for row in links]
    alarms_info = (
        supabase.table("alarms")
        .select("alarm_id, start_time, status")
        .in_("alarm_id", alarm_ids)
        .execute()
        .data
    )
    alarm_data = {a["alarm_id"]: a for a in alarms_info}
    
    # Group alarms per incident
    alarms_per_incident = {}
    for row in links:
        a = alarm_data.get(row["alarm_id"])
        if a and a["status"] == 1:  # only alarms still active
            alarms_per_incident.setdefault(row["incident_id"], []).append(a)
    
    # For each incident find the oldest alarm
    protected = set()
    for inc_id, alarms in alarms_per_incident.items():
        if alarms:
            oldest = min(alarms, key=lambda x: x["start_time"])
            protected.add(oldest["alarm_id"])
    return protected


# Randomly resolves alarms that are still active (status=1) in the database
# Picks a random number of alarms to resolve and assigns each a resolved time within the last 5 minutes
# (the script runs once every 5 minutes), then writes the updates back
# After resolving, recalculates priority for the active incidents that were affected
def resolve_old_alarms():

    active = supabase.table("alarms").select("alarm_id").eq("status", 1).execute()
    alarms_active = [row["alarm_id"] for row in active.data]
    print(f"Alarme active gasite: {len(alarms_active)}")

    if not alarms_active:
        return

    protected_alarm_ids = get_oldest_alarm_per_active_incident()

    # Exclude protected alarms from the candidate pool
    eligible = [a for a in alarms_active if a not in protected_alarm_ids]
    
    if not eligible:
        print("Niciuna dintre alarmele active nu poate fi rezolvata acum (toate protejate).")
        return
    n_to_resolve = random.randint(int(0.6*len(eligible)), int(0.9*len(eligible)))
    alarm_to_resolve = random.sample(eligible, n_to_resolve)

    start_times = {row["alarm_id"]: row["start_time"] for row in supabase.table("alarms").select("alarm_id, start_time").in_("alarm_id", alarm_to_resolve).execute().data}

    for alarm in alarm_to_resolve:
        start_time = datetime.fromisoformat(start_times[alarm])
        new_resolved_time = datetime.now(timezone.utc) - timedelta(seconds=random.randint(1, 300))

        if new_resolved_time <= start_time:
            new_resolved_time = start_time + timedelta(seconds=random.randint(1, 30))

        supabase.table("alarms").update({
            "status": 0,
            "resolved_time": new_resolved_time.isoformat()
        }).eq("alarm_id", alarm).execute()

    print(f"{n_to_resolve} alarme rezolvate.")

    affected_links = (
        supabase.table("incident_alarms")
        .select("incident_id")
        .in_("alarm_id", alarm_to_resolve)
        .execute()
        .data
    )
    affected_incident_ids = {row["incident_id"] for row in affected_links}

    if affected_incident_ids:
        still_active = (
            supabase.table("incidents")
            .select("incident_id")
            .in_("incident_id", list(affected_incident_ids))
            .eq("status", 1)
            .execute()
            .data
        )
        active_affected = {row["incident_id"] for row in still_active}
        recalculate_priority_for_incidents(active_affected)


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


# Recalculates the priority for a list of incidents
# For each incident it figures out the site through the alarms linked via incident_alarms
# then calls calculate_priority with the incident's start_time and updates the priority column on incidents
# @param incident_ids Iterable of incident ids to refresh
def recalculate_priority_for_incidents(incident_ids):
    if not incident_ids:
        return

    incidents_data = (
        supabase.table("incidents")
        .select("incident_id, start_time")
        .in_("incident_id", list(incident_ids))
        .execute()
        .data
    )

    links = (
        supabase.table("incident_alarms")
        .select("incident_id, alarm_id")
        .in_("incident_id", list(incident_ids))
        .execute()
        .data
    )
    alarm_ids = [row["alarm_id"] for row in links]
    if not alarm_ids:
        return

    alarms_info = (
        supabase.table("alarms")
        .select("alarm_id, site")
        .in_("alarm_id", alarm_ids)
        .execute()
        .data
    )
    alarm_to_site = {row["alarm_id"]: row["site"] for row in alarms_info}

    site_per_incident = {}
    for row in links:
        if row["incident_id"] not in site_per_incident:
            site_per_incident[row["incident_id"]] = alarm_to_site.get(row["alarm_id"])

    for incident in incidents_data:
        incident_id = incident["incident_id"]
        site_id = site_per_incident.get(incident_id)
        if not site_id:
            continue

        incident_start = datetime.fromisoformat(incident["start_time"])
        new_priority = calculate_priority(site_id, incident_start)

        supabase.table("incidents").update({
            "priority": new_priority
        }).eq("incident_id", incident_id).execute()

    print(f"Priority recalculat pentru {len(incidents_data)} incidente.")


# Returns a dict {site_id: incident_id} for every site that has at least one active incident attached through incident_alarms
def get_active_site_to_incident():
    active = supabase.table("incidents").select("incident_id").eq("status", 1).execute().data
    active_ids = [row["incident_id"] for row in active]
    if not active_ids:
        return {}
    incident_alarms = supabase.table("incident_alarms").select("incident_id, alarm_id").in_("incident_id", active_ids).execute().data
    alarm_ids = [row["alarm_id"] for row in incident_alarms]
    if not alarm_ids:
        return {}
    alarms = (
        supabase.table("alarms")
        .select("alarm_id, site")
        .in_("alarm_id", alarm_ids)
        .execute()
        .data
    )
    alarm_to_site = {row["alarm_id"]: row["site"] for row in alarms}
    site_to_incident = {}
    for row in incident_alarms:
        site = alarm_to_site.get(row["alarm_id"])
        if site is not None and site not in site_to_incident:
            site_to_incident[site] = row["incident_id"]
    return site_to_incident


# Inserts a batch of {incident_id, alarm_id, created_at} links into the incident_alarms table
# @param links List of link dicts to insert
def insert_incident_alarms(links):
    if not links:
        return
    supabase.table("incident_alarms").insert(links).execute()


# Creates new alarms tied to random sites
# Each alarm gets a status, info, site_id, technology and a start time within the last 5 minutes
# If the status is 0 (no longer active), a resolved time within the last 5 minutes is also set
# If the chosen site already has an active incident, the alarm is attached to it through incident_alarms
# After the inserts, priority is recalculated for the incidents that received new alarms
def deploy_new_alarms():
    site_id = [row["id"] for row in supabase.table("site").select("id").execute().data]
    print(f"Site-uri incarcate: {len(site_id)}")

    info_alarm = [row["id"] for row in supabase.table("alarm_types").select("id").execute().data]
    print(f"Tipuri alarme incarcate: {len(info_alarm)}")

    site_to_incident = get_active_site_to_incident()
    
    # Build alarms without ids, but remember which site each one is for
    alarms_to_insert = []
    for _ in range(nr_alarms):
        alarm_status = random.choice([0, 1])
        this_info = random.choice(info_alarm)
        this_site_id = random.choice(site_id)
        this_techno = random.choice(techno)

        this_alarm_datetime = datetime.now(timezone.utc) - timedelta(seconds=random.randint(0, 300))

        this_cancel_time_datetime = None
        if alarm_status == 0:
            max_seconds = int((datetime.now(timezone.utc) - this_alarm_datetime).total_seconds())
            if max_seconds > 1:
                this_cancel_time_datetime = this_alarm_datetime + timedelta(seconds=random.randint(1, max_seconds))
            else:
                this_cancel_time_datetime = datetime.now(timezone.utc)

        alarms_to_insert.append({
            # No alarm_id — Postgres will assign it
            "status": alarm_status,
            "start_time": this_alarm_datetime.isoformat(),
            "resolved_time": this_cancel_time_datetime.isoformat() if this_cancel_time_datetime else None,
            "type": this_info,
            "tehnologie": this_techno,
            "site": this_site_id,
        })

    # Insert and capture the rows back (Supabase returns them with their new alarm_ids)
    result = supabase.table("alarms").insert(alarms_to_insert).execute()
    inserted_alarms = result.data
    print(f"{len(inserted_alarms)} alarme inserate cu succes.")

    # Now build links using the real ids that came back
    new_links = []
    for alarm in inserted_alarms:
        if alarm["site"] in site_to_incident:
            new_links.append({
                "incident_id": site_to_incident[alarm["site"]],
                "alarm_id": alarm["alarm_id"],
                "created_at": alarm["start_time"],
            })

    if new_links:
        insert_incident_alarms(new_links)
        print(f"{len(new_links)} alarme atasate la incidente active.")

        affected_incident_ids = {link["incident_id"] for link in new_links}
        recalculate_priority_for_incidents(affected_incident_ids)


if __name__=="__main__":
    resolve_old_alarms()
    deploy_new_alarms()