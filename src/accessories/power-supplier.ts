import { ComelitAccessory } from './comelit';
import { ComelitClient, SupplierDeviceData } from 'comelit-client';
import client from 'prom-client';
import { ComelitPlatform } from '../comelit-platform';
import { PlatformAccessory, Service } from 'homebridge';
import { HAP } from '../index';

const consumption = new client.Gauge({
  name: 'comelit_total_consumption',
  help: 'Consumption in Wh',
});

export class PowerSupplier extends ComelitAccessory<SupplierDeviceData> {
  private historyService: any;
  private outletService: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    this.outletService =
      this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    this.outletService
      .getCharacteristic(this.platform.homebridge.hap.Characteristic.On)
      .setValue(true);

    this.historyService = new HAP.FakeGatoHistoryService('energy', this.accessory, {
      log: this.log,
      disableTimer: true,
      storage: 'fs',
      path: `${this.platform.homebridge.user.storagePath()}/accessories`,
      filename: `history_${this.accessory.displayName}.json`,
    });

    return [this.initAccessoryInformation(), this.outletService, this.historyService];
  }

  update(data: SupplierDeviceData): void {
    const instantPower = parseFloat(data.instant_power);
    this.log.info(`Reporting instant consumption of ${instantPower}Wh`);
    consumption.set(instantPower);

    this.outletService
      .getCharacteristic(this.platform.homebridge.hap.Characteristic.OutletInUse)
      .updateValue(instantPower > 0);

    this.historyService.addEntry({
      time: Date.now() / 1000,
      power: instantPower,
    });
  }
}
