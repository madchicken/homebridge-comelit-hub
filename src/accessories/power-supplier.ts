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
  private powerMeterService: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    this.historyService = new HAP.FakeGatoHistoryService('energy', this.accessory, {
      storage: 'fs',
    });
    this.powerMeterService =
      this.accessory.getService(HAP.PowerMeterService) ||
      this.accessory.addService(HAP.PowerMeterService);

    this.powerMeterService.addCharacteristic(HAP.CurrentPowerConsumption);
    return [this.initAccessoryInformation(), this.powerMeterService, this.historyService];
  }

  update(data: SupplierDeviceData): void {
    const instantPower = parseFloat(data.instant_power);
    this.log.info(`Reporting instant consumption of ${instantPower}Wh`);
    consumption.set(instantPower);

    this.powerMeterService.updateCharacteristic(HAP.CurrentPowerConsumption, instantPower);

    this.historyService.addEntry({
      time: Date.now() / 1000,
      power: instantPower,
    });
  }
}
