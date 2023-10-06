

import dotenv from "dotenv";
dotenv.config();

import { SingleBar, Presets } from "cli-progress";
import { Client } from "pg";
import Cursor from "pg-cursor";

import { createWriteStream, readFileSync, writeFileSync, WriteStream, existsSync, mkdirSync } from "fs"

import type { NominatimResult, SummarryTripResult } from "./models"
import { generateStringTimestamp, getLastRow, nominatimUrl } from "./helper"
import dataUserVSMS from "./DataUserVSMS.json"
import { randomUUID } from "crypto";

let duv: { [key: string]: string } = {}

for (let i = 0; i < dataUserVSMS.length; i++) {
    if (dataUserVSMS[i].Domain && dataUserVSMS[i].Partner) {
        duv[dataUserVSMS[i].Domain] = String(dataUserVSMS[i].Partner).replaceAll(",", ".")
    }
}

const clibar = new SingleBar({
    format: 'Extracting Progress |{bar}| {percentage}% | {value}/{total} Rows | ETA: {eta_formatted}',
}, Presets.shades_classic);

const client = new Client({
    connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_INIT}?options=-c%20search_path%3D${process.env.DB_SCHEMA}`
});
const startDate = generateStringTimestamp(new Date(process.env.DATE_START + " 00:00:00"));
const stopDate = generateStringTimestamp(new Date(process.env.DATE_STOP + " 23:59:59"));

const query =
    `SELECT st.start_time, st.stop_time, st.vehicle_id, st.trip_mileage, st.start_long, st.start_lat, st.stop_long, st.stop_lat, st.type,
        c.name as company_name, c.domain_name, v.imei, v.license_plate, vt.category as vehicle_category, bt.box_type_id, bt.volume_capacity 
        FROM summary_trip AS st
        LEFT JOIN vehicle AS v on v.vehicle_id = st.vehicle_id
        LEFT JOIN company as c on c.company_id = v.company_id
        LEFT JOIN vehicle_type as vt on vt.vehicle_type_id = v.vehicle_type_id
        LEFT JOIN box_type as bt on bt.box_type_id = v.box_type_id
        where st.type='M' and st.start_time > $1 and st.stop_time < $2
        OFFSET $3`;

const countQuery = `SELECT COUNT(*) FROM summary_trip as st where st.type='M' and st.start_time > $1 and st.stop_time < $2`;

const values = [startDate, stopDate];

if (!existsSync('./res')) {
    console.log("Creating res folder");
    mkdirSync('./res');
}

const wsPool: { [key: string]: WriteStream } = {};

let wsOpt: { flags?: string } = {}

let increment = 0;

/* limiter semicolon */;
(async () => {

    increment = await getLastRow() as any as number;

    await client.connect();

    const count = (await client.query(countQuery, values)).rows[0].count;
    console.log(`Total data: ${count}`);

    const cursor = client.query(new Cursor(query, [...values, String(increment)])) as Cursor<SummarryTripResult>;

    clibar.start(count, increment);

    setInterval(() => {
        clibar.update(increment);
    }, 1000)

    let ids: string[] = []

    let stopCursor = false;


    const r = async () => {
        if(stopCursor){
            setTimeout(() => {
                r()
            }, 1)
            return
        }
        const res = await cursor.read(process.env.BATCH_SIZE ? Number(process.env.BATCH_SIZE) : 1);

        for (let i = 0; i < res.length; i++) {
            const id = randomUUID()
            ids.push(id)
            const data = res[i];
            if (!data) continue;
            /* second run that run async to not waiting for request the nominatim*/
            const run = async () => {
                let start: NominatimResult | undefined;
                let stop: NominatimResult | undefined;
                const startUrl = nominatimUrl(data.start_lat, data.start_long);
                const stopUrl = nominatimUrl(data.stop_lat, data.stop_long);
                try {
                    start = await (await fetch(startUrl)).json();
                    stop = await (await fetch(stopUrl)).json();
                } catch (e) {
                    // console.log(e);
                    run();
                    stopCursor = true;
                    return;
                }

                stopCursor = false;

                // prioritize city_district because for a city like Jakarta, they only have 
                // city_district (eg. North Jakarta) and city (eg. Special Capital Region of Jakarta), but not state
                // so we can use city_district as city and city as state

                let fromCity = "";
                let fromState = "";
                let toCity = "";
                let toState = "";

                if (start?.address) {
                    fromCity = start?.address.city_district ||
                        start?.address.city ||
                        start?.address.town ||
                        start?.address.county ||
                        start?.address.village ||
                        start?.address.industrial ||
                        start?.address.road ||
                        "";
                    fromState = start?.address.state || start?.address.city || ""
                }

                if (stop?.address) {
                    toCity = stop?.address.city_district ||
                        stop?.address.city ||
                        stop?.address.town ||
                        stop?.address.county ||
                        stop?.address.village ||
                        stop?.address.industrial ||
                        stop?.address.road ||
                        "";
                    toState = stop?.address.state || stop?.address.city || ""
                }

                const distance = data.trip_mileage / 1000;

                const result = {
                    vehicle_id: data.vehicle_id,
                    company: data.company_name,
                    domain: data.domain_name,
                    partner: duv[data.company_name],
                    fleet_type: data.vehicle_category,
                    box_type_id: data.box_type_id,
                    capacity: data.volume_capacity,
                    imei: data.imei,
                    license_plate: data.license_plate,
                    date_start: generateStringTimestamp(data.start_time, false),
                    date_stop: generateStringTimestamp(data.stop_time, false),
                    from_city: fromCity,
                    from_state: fromState,
                    to_city: toCity,
                    to_state: toState,
                    distance: Number(distance.toFixed(3)),
                    duration: new Date(data.stop_time.getTime() - data.start_time.getTime()).toISOString().slice(11, 19)
                };
                const fileName = data.start_time.toLocaleString('en-US', { month: 'long' }) + "-" + data.start_time.getFullYear().toString();
                if (!wsPool[fileName]) {
                    wsPool[fileName] = createWriteStream(`./res/${fileName}.csv`, wsOpt);
                    let fileWritted: string[] = [];
                    if (existsSync('./tmp1')) {
                        fileWritted = readFileSync("./tmp1").toString().split(",");
                    }
                    if (fileWritted.indexOf(fileName) === -1) {
                        wsPool[fileName].write(Object.keys(result).join(',') + '\n');
                        writeFileSync('./tmp1', fileWritted.concat(fileName).join(","))
                    }
                }

                const writeQueue = () => {
                    if (ids[0] !== id) {
                        setTimeout(() => {
                            writeQueue()
                        }, 1)
                    } else {
                        wsPool[fileName].write(Object.values(result).join(',') + '\n');
                        increment++;
                        ids.shift()
                    }
                }

                writeQueue()
            };
            run();
        }
        r()
    }
    r()
})();
