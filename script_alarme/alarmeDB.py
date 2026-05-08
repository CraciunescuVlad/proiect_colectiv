import random
from datetime import datetime, timedelta, timezone
from supabase import create_client
import os
from dotenv import load_dotenv

alarm_id=[]
site_id=[]
techno=["2G", "3G", "4G", "5G"]
nr_alarms=random.randint(1, 30)
info_alarm=[]
rows = []

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

def get_all_alarm_ids():
    all_ids = []
    page_size = 1000
    offset = 0
    while True:
        batch = supabase.table("alarms").select("alarm_id").range(offset, offset + page_size - 1).execute().data
        if not batch:
            break
        all_ids.extend(row["alarm_id"] for row in batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return all_ids
#returneaza setul cu alarmele active cele mai vechi din incidente (cele care "l-au generat")
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
    
    # grupeaza alarmele per incident
    alarms_per_incident = {}
    for row in links:
        a = alarm_data.get(row["alarm_id"])
        if a and a["status"] == 1:  # doar alarmele inca active
            alarms_per_incident.setdefault(row["incident_id"], []).append(a)
    
    # pentru fiecare incident, gaseste alarma cea mai veche
    protected = set()
    for inc_id, alarms in alarms_per_incident.items():
        if alarms:
            oldest = min(alarms, key=lambda x: x["start_time"])
            protected.add(oldest["alarm_id"])
    return protected

# functie care rezolva random alarmele inca active (status=1) din baza de date
# se alege un numar random de alarme de rezolvat si le rezolva
# se alege un resolve time in ultimele 5 minute (scriptul se actualizeaza o data la 5 minute)
# se da update la baza de date
# dupa rezolvare, recalculeaza priority pentru incidentele active afectate
def resolve_old_alarms():

    active = supabase.table("alarms").select("alarm_id").eq("status", 1).execute()
    alarms_active = [row["alarm_id"] for row in active.data]
    print(f"Alarme active gasite: {len(alarms_active)}")

    if not alarms_active:
        return

    protected_alarm_ids = get_oldest_alarm_per_active_incident()

    # exclude alarmele protejate din pool-ul de candidati
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


# functie care calculeaza prioritatea unui incident pe baza alarmelor de pe site
# priority = string pe baza mediei severity-urilor alarmelor active de pe site
# severity-ul fiecarei alarme se ia din tabela alarm_types prin campul type din tabela alarms
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


# functie care recalculeaza priority pentru o lista de incidente
# pentru fiecare incident determina site-ul prin alarme atasate prin incident_alarms
# si reapeleaza calculate_priority cu start_time-ul incidentului
# face update pe coloana priority din tabela incidents
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


# functie care returneaza un dictionar {site_id: incident_id} pentru toate site-urile
# care au cel putin un incident activ atasat prin tabela incident_alarms
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


# functie care insereaza in batch o lista de legaturi {incident_id, alarm_id, created_at}
# in tabela incident_alarms, generand id unic pentru fiecare legatura
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


# functie care creeaza alarme noi in functie de sites
# se atribuie un id random unic, status, info, site_id, tehnologie si data de inceput a alarmei care este in ultimele 5 minute
# daca statusul este 0 (nu mai este activa alarma), atunci se atribuie si o data de rezolvare in ultimele 5 minute
# daca site-ul are deja un incident activ, alarma se ataseaza la acel incident prin incident_alarms
# se da update la baza de date
# dupa atasare, recalculeaza priority pentru incidentele care au primit alarme noi
def deploy_new_alarms():

    alarm_id_existente = get_all_alarm_ids()
    site_id = [row["id"] for row in supabase.table("site").select("id").execute().data]
    print(f"Site-uri incarcate: {len(site_id)}")

    info_alarm = [row["id"] for row in supabase.table("alarm_types").select("id").execute().data]
    print(f"Tipuri alarme incarcate: {len(info_alarm)}")

    site_to_incident = get_active_site_to_incident()
    new_links = []

    for alarm in range(nr_alarms):
        this_alarm_id = random.randint(10000, 99999)
        while this_alarm_id in alarm_id_existente or this_alarm_id in alarm_id:
            this_alarm_id = random.randint(10000, 99999)
        alarm_id.append(this_alarm_id)

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

        rows.append({
            "alarm_id": this_alarm_id,
            "status": alarm_status,
            "start_time": this_alarm_datetime.isoformat(),
            "resolved_time": this_cancel_time_datetime.isoformat() if this_cancel_time_datetime else None,
            "type": this_info,
            "tehnologie": this_techno,
            "site": this_site_id
        })

        if this_site_id in site_to_incident:
            new_links.append({
                "incident_id": site_to_incident[this_site_id],
                "alarm_id": this_alarm_id,
                "created_at": this_alarm_datetime.isoformat(),
            })

    supabase.table("alarms").insert(rows).execute()
    print(f"{nr_alarms} alarme inserate cu succes.")

    if new_links:
        insert_incident_alarms(new_links)
        print(f"{len(new_links)} alarme atasate la incidente active.")

        affected_incident_ids = {link["incident_id"] for link in new_links}
        recalculate_priority_for_incidents(affected_incident_ids)


if __name__=="__main__":
    resolve_old_alarms()
    deploy_new_alarms()