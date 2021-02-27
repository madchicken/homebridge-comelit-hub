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
      disableTimer: true,
      storage: 'fs',
      path: `${this.platform.homebridge.user.storagePath()}/accessories`,
      filename: `history_${this.accessory.displayName}.json`,
    });
    const hap = this.platform.homebridge.hap;
    this.powerMeterService =
      this.accessory.getService(hap.Service.PowerManagement) ||
      this.accessory.addService(hap.Service.PowerManagement);

    this.powerMeterService.getCharacteristic(hap.Characteristic.WakeConfiguration).setValue(0);
    this.powerMeterService.addOptionalCharacteristic(HAP.CurrentPowerConsumption);
    this.powerMeterService.addOptionalCharacteristic(HAP.TotalConsumption);

    return [this.initAccessoryInformation(), this.powerMeterService, this.historyService];
  }

  update(data: SupplierDeviceData): void {
    const instantPower = parseFloat(data.instant_power);
    this.log.info(`Reporting instant consumption of ${instantPower}Wh`);
    consumption.set(instantPower);

    /* this.powerMeterService.getCharacteristic(HAP.CurrentPowerConsumption).setValue(instantPower);
    this.powerMeterService.getCharacteristic(HAP.TotalConsumption).setValue(
      <number>this.powerMeterService.getCharacteristic(HAP.TotalConsumption).value +
        instantPower / 1000 // total is in kWh
    );
*/
    this.historyService.addEntry({
      time: Date.now() / 1000,
      power: instantPower,
    });
  }
}
