export interface SummarryTripResult {
    start_time: Date,
    stop_time: Date,
    vehicle_id: string,
    trip_mileage: number,
    start_long: number,
    start_lat: number,
    stop_long: number,
    stop_lat: number,
    type: string,
    company_name: string,
    imei: string,
    license_plate: string,
    vehicle_category: string,
    volume_capacity?: number,
}

export interface NominatimResult {
    address: {
        city_district?: string,
        city?: string,
        town?: string,
        county?: string,
        village?: string,
        industrial?: string,
        road?: string,
        state?: string,
    },
    boundingbox: string[]
}

export interface NominatimDb {
    // id: string,
    city: string,
    state: string,
    // bound_lat_1: number,
    // bound_lat_2: number,
    // bound_long_1: number,
    // bound_long_2: number,
}