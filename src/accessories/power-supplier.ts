import {ComelitAccessory} from "./comelit";
import {Categories, Service} from "hap-nodejs";
import {ComelitClient, SupplierDeviceData} from "../comelit-client";
import client from "prom-client";

const consumption = new client.Gauge({ name: 'comelit_total_consumption', help: 'Consumption in Wh' });

export class PowerSupplier extends ComelitAccessory<SupplierDeviceData> {

    constructor(log: Function, device: SupplierDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.OTHER);
    }

    protected initServices(): Service[] {
        return [this.initAccessoryInformation()];
    }

    update(data: SupplierDeviceData): void {
        this.log(`Reporting instant consumption of ${data.instant_power}Wh`);
        consumption.set(parseFloat(data.instant_power));
    }
}
