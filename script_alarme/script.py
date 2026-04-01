#sa iau datele din topologie (doar prima coloana)
#sa generez alarm_id (fie ceva gen 6 cifre, random dar unic)
#alarm_number e ceva contor?

import csv
import random

alarm_id=[]
site_id=[]
techno=["2G", "3G", "4G", "5G"]
alarm_number=0
nr_alarms=random.randint(50, 140)
info_alarm=[]

#citim datele din topologie (doar site_id ne intereseaza)
with open("topologie.csv", newline='', encoding='utf-8') as read_file:
    reader = csv.reader(read_file)
    header=next(reader)
    for row in reader:
        site_id.append(row[0])

#citim tot csv-ul cu info/motive pentru alarme - numar alarma, text, severitate
with open("motive_alarme.csv", newline='', encoding='utf-8') as read_file:
    reader = csv.reader(read_file)
    header=next(reader)
    for row in reader:
        info_alarm.append(row)

with open("alarms.csv", 'w', newline='', encoding='utf-8') as write_file:
    writer = csv.writer(write_file)
    writer.writerow(["alarm_id", "alarm_status", "alarm_time", "cancel_time", "alam_number", "info", "severity", "technology"])
    for alarm in range(nr_alarms):
        this_alarm_id = random.randint(10000, 99999)
        while this_alarm_id in alarm_id:
            this_alarm_id = random.randint(10000, 99999)
        alarm_id.append(this_alarm_id)
        alarm_number = alarm_number + 1

        alarm_status = random.choice([0, 1])

        info = random.choice(info_alarm)
        this_info = info[0] + " " + info[1]
        this_severity = int(info[2])

        this_site_id = random.choice(site_id)

        this_techno = random.choice(techno)

        this_alarm_time_min = random.randint(0, 59)
        this_alarm_time_sec = random.randint(0, 59)

        this_cancel_time_min = random.randint(this_alarm_time_min, 59)
        if alarm_status == 1:
            this_cancel_time=""
        elif this_alarm_time_min == this_cancel_time_min:
            this_cancel_time_sec = random.randint(this_alarm_time_sec, 59)
            this_cancel_time = str(this_cancel_time_min) + ":" + f"{this_cancel_time_sec:02d}"
        else:
            this_cancel_time_sec = random.randint(0, 59)
            this_cancel_time = str(this_cancel_time_min) + ":" + f"{this_cancel_time_sec:02d}"

        this_alarm_time = str(this_alarm_time_min) + ":" + f"{this_alarm_time_sec:02d}"


        writer.writerow([this_alarm_id, alarm_status, this_alarm_time, this_cancel_time, alarm_number, this_info, this_severity,this_site_id, this_techno])





