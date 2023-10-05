import * as fs from 'fs';
import * as path from 'path';
import { convertCsvToXlsx } from '@aternus/csv-to-xlsx';

const csvFolderPath = path.join(__dirname, '../res');

fs.readdir(csvFolderPath, (err, files) => {
    if (err) {
        console.error(err);
        return;
    }

    files.forEach(file => {
        const filePath = path.join(csvFolderPath, file);

        if (path.extname(filePath) === '.csv') {
            const excelFilePath = path.join(csvFolderPath, `${path.basename(file, '.csv')}.xlsx`);
            try{
                convertCsvToXlsx(filePath, excelFilePath)
            }catch(err){
                console.error(err);
            }finally{
                console.log(`Converted ${file} to ${path.basename(excelFilePath)}`);
            }
        }
    });
});
