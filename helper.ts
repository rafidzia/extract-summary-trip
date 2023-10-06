import * as fs from "fs"
import * as path from 'path';

export const generateStringTimestamp = (date: Date, withTimeZone = true) => {
    const offset = date.getTimezoneOffset() / 60 * -1;
    const out = date.getFullYear() + "-" +
        (date.getMonth() + 1).toString().padStart(2, '0') + "-" +
        date.getDate().toString().padStart(2, '0') + " " +
        date.getHours().toString().padStart(2, '0') + ":" +
        date.getMinutes().toString().padStart(2, '0') + ":" +
        date.getSeconds().toString().padStart(2, '0') + "" +
        (withTimeZone ? ((offset > 0) ? '+' : '') + offset.toString().padStart(2, '0') : '');
    return out;
};

export const nominatimUrl = (lat: number, long: number) =>
    `https://geolocation.mceasy.com/reverse?format=json&lat=${lat.toString()}&lon=${long.toString()}`;

export const CloneArray = (obj: object[]) => {
    let out: object[] = new Array(obj.length).fill({});
    for (let i = 0; i < obj.length; i++) {
        Object.assign(out[i], obj[i]);
    }
    return out;
}

function countFileLines(filePath: string) {
    return new Promise((resolve, reject) => {
        let lineCount = 0;
        fs.createReadStream(filePath)
            .on("data", (buffer) => {
                let idx = -1;
                lineCount--; // Because the loop will run once for idx=-1
                do {
                    // @ts-ignore
                    idx = buffer.indexOf(10, idx + 1);
                    lineCount++;
                } while (idx !== -1);
            }).on("end", () => {
                resolve(lineCount);
            }).on("error", reject);
    });
};

export function getLastRow() {
    return new Promise((resolve, reject) => {
        fs.readdir("./res", async (err, files) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }

            let lastRow = 0;

            for(let i = 0; i < files.length; i++){
                const filePath = `./res/${files[i]}`;

                if (path.extname(filePath) === '.csv') {
                    let lineCount = await countFileLines(filePath) as any as number
                    lastRow += lineCount;
                }
            }

            resolve(lastRow);
        })
    })
}