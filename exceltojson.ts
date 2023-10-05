import xlsx from 'node-xlsx';
import * as fs from 'fs';

const workSheetsFromFile = xlsx.parse(`./DataUserVSMS.xlsx`);

let dataout: any[] = []

const keys = workSheetsFromFile[0].data[0]

for(let i = 1; i < workSheetsFromFile[0].data.length; i++){
    let tmp = {}
    // @ts-ignore
    tmp[keys[0]] = workSheetsFromFile[0].data[i][0]
    // @ts-ignore
    tmp[keys[1]] = workSheetsFromFile[0].data[i][1]
    dataout.push(tmp)
}


fs.writeFileSync('./DataUserVSMS.json', JSON.stringify(dataout, null, 2))