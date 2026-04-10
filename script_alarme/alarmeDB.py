import random
from datetime import datetime, timedelta
from supabase import create_client
import os
from dotenv import load_dotenv

alarm_id=[]
site_id=[]
techno=["2G", "3G", "4G", "5G"]
nr_alarms=random.randint(50, 140)
info_alarm=[]
rows = []

load_dotenv()
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

# se sterg datele din tabela alarms care existau inainte de rularea scriptului
supabase.table("alarms").delete().neq("alarm_id", -1).execute()
print("Tabela alarms golita.")

# se citesc datele din tabela sites
site_id = [row["id"] for row in supabase.table("site").select("id").execute().data]
print(f"Site-uri incarcate: {len(site_id)}")

# se citesc tipurile de alarme din tabela alarm_types
info_alarm = [row["id"] for row in supabase.table("alarm_types").select("id").execute().data]
print(f"Tipuri alarme incarcate: {len(info_alarm)}")

for alarm in range(nr_alarms):
    this_alarm_id = random.randint(10000, 99999)
    while this_alarm_id in alarm_id:
       this_alarm_id = random.randint(10000, 99999)
    alarm_id.append(this_alarm_id)

    alarm_status = random.choice([0, 1])

    info = random.choice(info_alarm)
    this_info = info
    this_site_id = random.choice(site_id)
    this_techno = random.choice(techno)

    this_alarm_time_min = random.randint(0, 59)
    this_alarm_time_sec = random.randint(0, 59)
    this_alarm_datetime = datetime.today() - timedelta(days=random.randint(0, 30))

    this_cancel_time_min = random.randint(this_alarm_time_min, 59)
    if alarm_status == 1:
        this_cancel_time_datetime = None
    elif this_alarm_time_min == this_cancel_time_min:
        this_cancel_time_sec = random.randint(this_alarm_time_sec, 59)
        this_cancel_time_datetime = this_alarm_datetime + timedelta(
            minutes=(this_cancel_time_min - this_alarm_time_min),
            seconds=(this_cancel_time_sec - this_alarm_time_sec)
        )
    else:
        this_cancel_time_sec = random.randint(0, 59)
        this_cancel_time_datetime = this_alarm_datetime + timedelta(
            minutes=(this_cancel_time_min - this_alarm_time_min),
            seconds=(this_cancel_time_sec - this_alarm_time_sec)
        )

    this_alarm_time = this_alarm_datetime.isoformat()
    this_cancel_time = this_cancel_time_datetime.isoformat() if this_cancel_time_datetime else None

    rows.append({
        "alarm_id": this_alarm_id,
        "status": alarm_status,
        "start_time": this_alarm_time,
        "resolved_time": this_cancel_time if this_cancel_time else None,
        "type": this_info,
        "tehnologie": this_techno,
        "site": this_site_id
    })

# 5. Insert bulk
supabase.table("alarms").insert(rows).execute()
print(f"{nr_alarms} alarme inserate cu succes.")


