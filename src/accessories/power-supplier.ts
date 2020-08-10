import { ComelitAccessory } from './comelit';
import { ComelitClient, SupplierDeviceData } from 'comelit-client';
import client from 'prom-client';
import { ComelitPlatform } from '../comelit-platform';
import { PlatformAccessory, Service } from 'homebridge';

const consumption = new client.Gauge({
  name: 'comelit_total_consumption',
  help: 'Consumption in Wh',
});

export class PowerSupplier extends ComelitAccessory<SupplierDeviceData> {
  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    const powerManagementService =
      this.accessory.getService(this.platform.Service.PowerManagement) ||
      this.accessory.addService(this.platform.Service.PowerManagement);

    return [this.initAccessoryInformation(), powerManagementService];
  }

  update(data: SupplierDeviceData): void {
    this.log.info(`Reporting instant consumption of ${data.instant_power}Wh`);
    consumption.set(parseFloat(data.instant_power));
  }
}
