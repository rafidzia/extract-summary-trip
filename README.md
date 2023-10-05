# VSMS Database Data Extraction Script

## Description

This script is used to extract data from summary trip data in MCEasy VSMS database to a CSV file.

## Usage

1. **Build the script**

   Run the  `npm run build`  to compile ts file to js in build directory

2. **Running the Extraction Script**

   Run the  `npm run start`  to run the extraction process

   You need to fill the required env variable in .env

3. **Converting CSV to XLSX**

   Use the `csvtoexcel.ts` script to convert the CSV output to XLSX.

   `node build/csvtoexcel.js`

4. **Compress XLSX file**

   You can use this website `https://www.clipcompress.com/excel-compress/` to compress the XLSX file