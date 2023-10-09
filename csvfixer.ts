import * as fs from 'fs';
import * as path from 'path';
import * as readline from "readline"

const csvFolderPath = path.join(__dirname, '../res');

fs.readdir(csvFolderPath, (err, files) => {
    if (err) {
        console.error(err);
        return;
    }

    const separatorAmount = 16

    files.forEach(async file => {
        const filePath = path.join(csvFolderPath, file);

        // let tempStr = ""
        const fileName = path.basename(filePath, '.csv')
        const newSeparator = ";"

        const folder = "./res2/"


        let part = 1
        let header = [
            'vehicle_id', 'company', 'partner',
            'fleet_type', 'box_type_id', 'capacity',
            'imei', 'license_plate',
            'date_start', 'date_stop',
            'from_city', 'from_state',
            'to_city', 'to_state',
            'distance', 'duration'
        ]

        const rs = fs.createReadStream(filePath);
        let ws = fs.createWriteStream(folder + fileName + "-" + part + ".csv");
        ws.write(header.join(newSeparator) + "\n")

        const rl = readline.createInterface({
            input: rs,
            crlfDelay: Infinity
        })

        let countline = 0
        for await (const line of rl) {
            countline++
            if (line.split(",")[0] == "vehicle_id") continue

            if (countline > 1000000) {
                part++
                countline = 0
                ws.end()
                ws.close()
                ws = fs.createWriteStream(folder + fileName + "-" + part + ".csv");
                ws.write(header.join(newSeparator) + "\n")
            }

            let countSeparator = (line.match(/\,/g) || []).length;
            let data = line.split(",")


            let datestart = new Date(data[9])
            // @ts-ignore
            if (datestart == "Invalid Date") {
                data[8] = data[8] + "," + data[9]
                data.splice(9, 1)
                countSeparator--
            }
            if (countSeparator > separatorAmount) {

                let step = 1
                for (let i = 0; i < data.length; i++) {
                    if (data[i].charAt(0) == " ") {
                        data[i - step] = data[i - step] + "," + data[i]
                        step++
                    }
                }

                data = data.filter((value, index) => {
                    if (value.charAt(0) == " ") {
                        return false
                    } else {
                        return true
                    }
                })
            }
            data[3] = data[3].replaceAll(".", ",")
            data.splice(2, 1)
            ws.write(data.join(newSeparator) + "\n")

        }
    });
});
