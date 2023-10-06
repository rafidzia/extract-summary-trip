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