import { ComelitAccessory } from './comelit';
import { ComelitClient, SupplierDeviceData } from 'comelit-client';
import client from 'prom-client';
import { ComelitPlatform } from '../comelit-platform';
import { Formats, Perms, PlatformAccessory, Service, Units } from 'homebridge';

const consumption = new client.Gauge({
  name: 'comelit_total_consumption',
  help: 'Consumption in Wh',
});

let CurrentPowerConsumption;

export class PowerSupplier extends ComelitAccessory<SupplierDeviceData> {
  private outletService: Service;
  private fakegatoService: any;
  private powerMeterService: Service;

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

    const Characteristic = this.platform.homebridge.hap.Characteristic;
    CurrentPowerConsumption = new Characteristic(
      'Current power consumption',
      'E863F10D-079E-48FF-8F27-9C2605A29F52',
      {
        format: Formats.UINT16,
        unit: 'watts' as Units, // ??
        maxValue: 100000,
        minValue: 0,
        minStep: 1,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      }
    );

    this.powerMeterService = new this.platform.homebridge.hap.Service(
      'Power meter service',
      '00000001-0000-1777-8000-775D67EC4377'
    );
    this.powerMeterService.addCharacteristic(CurrentPowerConsumption);

    this.fakegatoService = this.platform.powerLoggingService;
    return [
      this.initAccessoryInformation(),
      this.outletService,
      this.fakegatoService,
      this.powerMeterService,
    ];
  }

  update(data: SupplierDeviceData): void {
    const instantPower = parseFloat(data.instant_power);
    this.log.info(`Reporting instant consumption of ${instantPower}Wh`);
    consumption.set(instantPower);

    this.fakegatoService.addEntry({
      time: Date.now() / 1000,
      power: instantPower,
    });

    this.outletService
      .getCharacteristic(this.platform.homebridge.hap.Characteristic.OutletInUse)
      .updateValue(instantPower > 0);
  }
}
