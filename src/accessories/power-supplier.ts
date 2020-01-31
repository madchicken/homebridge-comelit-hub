import {ComelitAccessory} from "./comelit";
import {Categories, Service} from "hap-nodejs";
import {ComelitClient, SupplierDeviceData} from "../comelit-client";
import client from "prom-client";

export class PowerSupplier extends ComelitAccessory<SupplierDeviceData> {

    constructor(log: Function, device: SupplierDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.OTHER);
    }

    protected initServices(): Service[] {
        return [];
    }

    update(data: SupplierDeviceData): void {
        const gauge = new client.Gauge({ name: 'comelit_total_consumption', help: 'Consumption in Wh' });
        gauge.set(parseFloat(data.instant_power));
    }
}
