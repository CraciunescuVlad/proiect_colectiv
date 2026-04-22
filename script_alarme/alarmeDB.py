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

# functie care rezolva random alarmele inca active (status=1) din baza de date
# se alege un numar random de alarme de rezolvat si le rezolva
# se alege un resolve time in ultimele 5 minute (scriptul se actualizeaza o data la 5 minute)
# se da update la baza de date si se transmite 
def resolve_old_alarms():

    active = supabase.table("alarms").select("alarm_id").eq("status", 1).execute()
    alarm_id_active = [row["alarm_id"] for row in active.data]
    print(f"Alarme active gasite: {len(alarm_id_active)}")

    if alarm_id_active:
        n_to_resolve = random.randint(int(0.6*len(alarm_id_active)), int(0.9*len(alarm_id_active)))
        alarm_to_resolve = random.sample(alarm_id_active, n_to_resolve)

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

    
# functie care creeaza alarme noi in functie de sites
# se atribuie un id random unic, status, info, site_id, tehnologie si data de inceput a alarmei care este in ultimele 5 minute
# daca statusul este 0 (nu mai este activa alarma), atunci se atribuie si o data de rezolvare in ultimele 5 minute
# se da update la baza de date
def deploy_new_alarms():

    alarm_id_existente = [row["alarm_id"] for row in supabase.table("alarms").select("alarm_id").execute().data]

    site_id = [row["id"] for row in supabase.table("site").select("id").execute().data]
    print(f"Site-uri incarcate: {len(site_id)}")

    info_alarm = [row["id"] for row in supabase.table("alarm_types").select("id").execute().data]
    print(f"Tipuri alarme incarcate: {len(info_alarm)}")

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

    supabase.table("alarms").insert(rows).execute()
    print(f"{nr_alarms} alarme inserate cu succes.")


if __name__=="__main__":
    resolve_old_alarms()
    deploy_new_alarms()