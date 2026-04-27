import random
from datetime import datetime, timedelta, timezone
from supabase import create_client
import os
from dotenv import load_dotenv

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

INCIDENT_TRIGGER_CHANCE = 0.10  # 10% sansa ca o alarma sa declanseze un incident


# functie care verifica daca tabela incidents are coloanele impact si urgency
# returneaza True daca ambele coloane exista, False altfel
def tabela_are_impact_urgency():
    try:
        test = supabase.table("incidents").select("impact, urgency").limit(1).execute()
        return True
    except Exception:
        return False


# functie care calculeaza prioritatea unui incident pe baza alarmelor de pe site
# priority = media severity-urilor alarmelor de pe site incepand cu start_time_incident
#            + 1 pentru fiecare alarma inca activa (status=1)
# severity-ul fiecarei alarme se ia din tabela alarm_types prin campul type din tabela alarms
def calculeaza_priority(site_id, start_time_incident):
    alarme = (
        supabase.table("alarms")
        .select("type, status")
        .eq("site", site_id)
        .gte("start_time", start_time_incident.isoformat())
        .execute()
    )

    if not alarme.data:
        return 1  # prioritate implicita daca nu exista alarme

    type_ids = list({row["type"] for row in alarme.data})
    severitati_map = {}

    # incarca severity din alarm_types pentru fiecare tip unic de alarma
    alarm_types_data = (
        supabase.table("alarm_types")
        .select("id, severity")
        .in_("id", type_ids)
        .execute()
    )
    for at in alarm_types_data.data:
        severitati_map[at["id"]] = at["severity"]

    total_severity = 0
    nr_alarme = len(alarme.data)

    for row in alarme.data:
        severity = severitati_map.get(row["type"], 1)
        total_severity += severity
        if row["status"] == 1:  # alarma inca activa -> +1 penalizare
            total_severity += 1

    priority = round(total_severity / nr_alarme) if nr_alarme > 0 else 1
    return int(priority)


# functie care rezolva random incidentele inca active (status=1) din baza de date
# se alege un numar random de incidente de rezolvat si le inchide
# site-ul incidentului se determina indirect prin alarm_id -> alarms.site
# end_time-ul va fi >= resolved_time-ul celei mai noi alarme rezolvate de pe site-ul incidentului
# se da update la baza de date
def resolve_old_incidents():

    active = supabase.table("incidents").select("incident_id, alarm_id").eq("status", 1).execute()
    incidente_active = active.data
    print(f"Incidente active gasite: {len(incidente_active)}")

    if not incidente_active:
        return

    n_to_resolve = random.randint(
        int(0.6 * len(incidente_active)),
        int(0.9 * len(incidente_active))
    )
    incidente_de_rezolvat = random.sample(incidente_active, n_to_resolve)

    # incarca site-ul pentru fiecare alarm_id al incidentelor de rezolvat
    alarm_ids = [i["alarm_id"] for i in incidente_de_rezolvat]
    alarme_info = (
        supabase.table("alarms")
        .select("alarm_id, site")
        .in_("alarm_id", alarm_ids)
        .execute()
    )
    site_pentru_alarm = {row["alarm_id"]: row["site"] for row in alarme_info.data}

    for incident in incidente_de_rezolvat:
        incident_id = incident["incident_id"]
        alarm_id = incident["alarm_id"]

        # site-ul incidentului se obtine prin alarma care l-a declansat
        site_id = site_pentru_alarm.get(alarm_id)

        if site_id:
            # gaseste cea mai recenta alarma rezolvata de pe site-ul acestui incident
            alarme_rezolvate = (
                supabase.table("alarms")
                .select("resolved_time")
                .eq("site", site_id)
                .eq("status", 0)
                .not_.is_("resolved_time", "null")
                .order("resolved_time", desc=True)
                .limit(1)
                .execute()
            )
        else:
            alarme_rezolvate = None

        if site_id and alarme_rezolvate and alarme_rezolvate.data:
            cea_mai_noua_rezolvare = datetime.fromisoformat(alarme_rezolvate.data[0]["resolved_time"])
            # end_time-ul incidentului este >= resolved_time-ul celei mai noi alarme rezolvate
            extra_seconds = random.randint(0, 120)
            end_time = cea_mai_noua_rezolvare + timedelta(seconds=extra_seconds)
        else:
            # daca nu exista alarme rezolvate sau site-ul nu a fost gasit, inchidem la momentul curent
            end_time = datetime.now(timezone.utc)

        supabase.table("incidents").update({
            "status": 0,
            "end_time": end_time.isoformat()
        }).eq("incident_id", incident_id).execute()

    print(f"{n_to_resolve} incidente rezolvate.")


# functie care genereaza incidente noi pe baza alarmelor nou create
# fiecare site poate avea cel mult un incident activ odata
# site-ul unui incident activ se determina indirect prin alarm_id -> alarms.site
# fiecare alarma are o sansa de 10% sa declanseze un incident pe site-ul ei
# daca site-ul are deja un incident activ, nu se mai creeaza unul nou
# priority se calculeaza ca media severity alarmelor de pe site + 1 pentru fiecare alarma activa
# daca tabela are coloanele impact si urgency, acestea primesc aceeasi valoare ca priority
# se da update la baza de date
def deploy_new_incidents():

    are_impact_urgency = tabela_are_impact_urgency()
    print(f"Tabela incidents are coloanele impact/urgency: {are_impact_urgency}")

    incident_id_existente = [
        row["incident_id"] for row in supabase.table("incidents").select("incident_id").execute().data
    ]

    # determina site-urile care au deja un incident activ prin alarm_id -> alarms.site
    incidente_active = supabase.table("incidents").select("alarm_id").eq("status", 1).execute().data
    alarm_ids_active = [row["alarm_id"] for row in incidente_active]

    site_uri_cu_incident_activ = set()
    if alarm_ids_active:
        alarme_active_info = (
            supabase.table("alarms")
            .select("alarm_id, site")
            .in_("alarm_id", alarm_ids_active)
            .execute()
        )
        site_uri_cu_incident_activ = {row["site"] for row in alarme_active_info.data}
    print(f"Site-uri cu incident activ deja: {len(site_uri_cu_incident_activ)}")

    # ia toate alarmele create in ultimele 5 minute (fereastra de rulare a scriptului)
    fereastra_start = datetime.now(timezone.utc) - timedelta(seconds=300)
    alarme_noi = (
        supabase.table("alarms")
        .select("alarm_id, site, start_time")
        .gte("start_time", fereastra_start.isoformat())
        .execute()
    )
    print(f"Alarme noi gasite in fereastra de 5 minute: {len(alarme_noi.data)}")

    incidente_noi = []
    incident_id_folosite = list(incident_id_existente)
    site_uri_prelucrate = set(site_uri_cu_incident_activ)  # copie locala pentru a evita duplicate in acelasi batch

    for alarma in alarme_noi.data:
        site_id = alarma["site"]
        alarm_id = alarma["alarm_id"]
        start_time_alarma = datetime.fromisoformat(alarma["start_time"])

        # verificare: site-ul nu are deja un incident activ
        if site_id in site_uri_prelucrate:
            continue

        # 10% sansa ca aceasta alarma sa declanseze un incident
        if random.random() > INCIDENT_TRIGGER_CHANCE:
            continue

        # genereaza un incident_id unic
        this_incident_id = random.randint(10000, 99999)
        while this_incident_id in incident_id_folosite:
            this_incident_id = random.randint(10000, 99999)
        incident_id_folosite.append(this_incident_id)

        # start_time-ul incidentului este acelasi cu start_time-ul alarmei care l-a declansat
        start_time_incident = start_time_alarma

        # calculeaza priority pe baza alarmelor de pe site incepand cu start_time_incident
        priority = calculeaza_priority(site_id, start_time_incident)

        incident_row = {
            "incident_id": this_incident_id,
            "alarm_id": alarm_id,        # alarma care a declansat incidentul
            "status": 1,                 # incident activ
            "start_time": start_time_incident.isoformat(),
            "end_time": None,
            "priority": priority,
            "assigned_to": None,         # nealocat implicit
        }

        # daca tabela suporta impact si urgency, le setam cu aceeasi valoare ca priority
        if are_impact_urgency:
            incident_row["urgency"] = priority
            incident_row["impact"] = priority

        incidente_noi.append(incident_row)
        site_uri_prelucrate.add(site_id)  # marcam site-ul ca avand deja un incident in acest batch

    if incidente_noi:
        supabase.table("incidents").insert(incidente_noi).execute()
        print(f"{len(incidente_noi)} incidente noi inserate cu succes.")
    else:
        print("Niciun incident nou generat in aceasta rulare.")


if __name__ == "__main__":
    resolve_old_incidents()
    deploy_new_incidents()