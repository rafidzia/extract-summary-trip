

import dotenv from "dotenv";
dotenv.config();

import { SingleBar, Presets } from "cli-progress";
import { Database } from "sqlite3"
import { open } from "sqlite";
import { Client } from "pg";
import Cursor from "pg-cursor";

import { createWriteStream, WriteStream } from "fs"
import { randomUUID } from "crypto";
import { existsSync, mkdirSync } from "fs";

import type { NominatimResult, NominatimDb, SummarryTripResult } from "./models"
import { generateStringTimestamp, nominatimUrl } from "./helper"
import dataUserVSMS from "./DataUserVSMS.json"

let duv: {[key: string]: string} = {}

for(let i = 0; i < dataUserVSMS.length; i++){
    if(dataUserVSMS[i].Domain && dataUserVSMS[i].Partner){
        duv[dataUserVSMS[i].Domain] = String(dataUserVSMS[i].Partner)
    }
}

const clibar = new SingleBar({
    format: 'Extracting Progress |{bar}| {percentage}% | {value}/{total} Chunks | ETA: {eta_formatted} | cacheHit: {cacheHit}',
}, Presets.shades_classic);

const wsPool: { [key: string]: WriteStream } = {};
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
        where st.type='M' and st.start_time > $1 and st.stop_time < $2`;

const countQuery = `SELECT COUNT(*) FROM summary_trip as st where st.type='M' and st.start_time > $1 and st.stop_time < $2`;

const values = [startDate, stopDate];

if(!existsSync('./res')) {
    console.log("Creating res folder");
    mkdirSync('./res');
}

let isFirst: string[] = []
let cacheHit = 0;
let increment = 0;

/* limiter semicolon */;
(async () => {
    await client.connect();

    // const db = await open({ filename: 'data.db', driver: Database });
    // db.exec("CREATE TABLE IF NOT EXISTS nominatim_result (id TEXT PRIMARY KEY, city TEXT, state TEXT, bound_lat_1 INTEGER, bound_lat_2 INTEGER, bound_long_1 INTEGER, bound_long_2 INTEGER)");

    const count = (await client.query(countQuery, values)).rows[0].count;
    console.log(`Total data: ${count}`);

    clibar.start(count, 0, { cacheHit: 'N/A' });

    const cursor = client.query(new Cursor(query, values)) as Cursor<SummarryTripResult>;

    let cond = true;
    while (cond) {
        const res = await cursor.read(process.env.BATCH_SIZE ? Number(process.env.BATCH_SIZE) : 1);
        for (let i = 0; i < res.length; i++) {
            const data = res[i];
            if (!data) {
                cond = false;
                break;
            }
            /* second run that run async to not waiting for request the nominatim*/
            const run = async () => {
                let start: NominatimResult | undefined;
                let stop: NominatimResult | undefined;

                // let startCached = false;
                // let stopCached = false;

                // if (process.env.CACHING?.toLowerCase() == 'true') {
                //     let tmpNominatim = await db.get(`SELECT city, state FROM nominatim_result WHERE ${Number(data.start_lat)} between bound_lat_1 and bound_lat_2 and ${Number(data.start_long)} between bound_long_1 and bound_long_2`) as NominatimDb;
                //     if (tmpNominatim) {
                //         cacheHit++;
                //         startCached = true;
                //         start = {
                //             address: {
                //                 city: tmpNominatim.city,
                //                 state: tmpNominatim.state,
                //             },
                //             boundingbox: []
                //         };
                //     }
                // }

                if (!start) {
                    const startUrl = nominatimUrl(data.start_lat, data.start_long);
                    try {
                        start = await (await fetch(startUrl)).json();
                    }
                    catch (e) {
                        console.log(e);
                        run();
                        return;
                    }
                }

                // if (process.env.CACHING?.toLowerCase() == 'true') {
                //     let tmpNominatim = await db.get(`SELECT city, state FROM nominatim_result WHERE ${Number(data.stop_lat)} between bound_lat_1 and bound_lat_2 and ${Number(data.stop_long)} between bound_long_1 and bound_long_2`) as NominatimDb;
                //     if (tmpNominatim) {
                //         cacheHit++;
                //         stopCached = true;
                //         stop = {
                //             address: {
                //                 city: tmpNominatim.city,
                //                 state: tmpNominatim.state,
                //             },
                //             boundingbox: []
                //         };
                //     }
                // }

                if (!stop) {
                    const stopUrl = nominatimUrl(data.stop_lat, data.stop_long);
                    try {
                        stop = await (await fetch(stopUrl)).json();
                    }
                    catch (e) {
                        console.log(e);
                        run();
                        return;
                    }
                }

                if (!start?.address || !stop?.address) {
                    if (!start?.address) console.error("start address is undefined");
                    if (!stop?.address) console.error("stop address is undefined");
                    run();
                    return;
                }
                // prioritize city_district because for a city like Jakarta, they only have 
                // city_district (eg. North Jakarta) and city (eg. Special Capital Region of Jakarta), but not state
                // so we can use city_district as city and city as state
                const fromCity = start?.address.city_district ||
                    start?.address.city ||
                    start?.address.town ||
                    start?.address.county ||
                    start?.address.village ||
                    start?.address.industrial ||
                    start?.address.road ||
                    "";
                const fromState = start?.address.state || start?.address.city;
                const toCity = stop?.address.city_district ||
                    stop?.address.city ||
                    stop?.address.town ||
                    stop?.address.county ||
                    stop?.address.village ||
                    stop?.address.industrial ||
                    stop?.address.road ||
                    "";
                const toState = stop?.address.state || stop?.address.city;

                // if (process.env.CACHING?.toLowerCase() == 'true') {
                //     if (!startCached) {
                //         await db.exec(`INSERT INTO nominatim_result (id, city, state, bound_lat_1, bound_lat_2, bound_long_1, bound_long_2) VALUES ('${randomUUID()}', '${fromCity}', '${fromState}', '${Number(start?.boundingbox[0])}', '${Number(start?.boundingbox[1])}', '${Number(start?.boundingbox[2])}', '${Number(start?.boundingbox[3])}')`);
                //     }
                //     if (!stopCached) {
                //         await db.exec(`INSERT INTO nominatim_result (id, city, state, bound_lat_1, bound_lat_2, bound_long_1, bound_long_2) VALUES ('${randomUUID()}', '${toCity}', '${toState}', '${Number(stop?.boundingbox[0])}', '${Number(stop?.boundingbox[1])}', '${Number(stop?.boundingbox[2])}', '${Number(stop?.boundingbox[3])}')`);
                //     }
                // }

                const distance = data.trip_mileage / 1000;

                const result = {
                    vehicle_id: data.vehicle_id,
                    company: data.company_name,
                    domain: data.domain_name,
                    partner: duv[data.company_name] || "",
                    fleet_type: data.vehicle_category,
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
                    wsPool[fileName] = createWriteStream(`./res/${fileName}.csv`);
                }
                if (isFirst.indexOf(fileName) < 0) {
                    isFirst.push(fileName);
                    const keys = Object.keys(result);
                    wsPool[fileName].write(keys.join(',') + '\n');
                }
                wsPool[fileName].write(Object.values(result).join(',') + '\n');
                clibar.update(++increment, {
                    cacheHit: cacheHit.toString()
                });
            };
            run();
        }
    }
    clibar.stop();
    for (const key in wsPool) {
        wsPool[key].close();
    }
    await client.end();
})();
