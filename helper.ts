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