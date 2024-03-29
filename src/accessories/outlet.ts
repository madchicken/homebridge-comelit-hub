import { ComelitAccessory } from './comelit';
import { ComelitClient, ObjectStatus, OutletDeviceData } from 'comelit-client';
import client from 'prom-client';
import { ComelitPlatform } from '../comelit-platform';
import {
  PlatformAccessory,
  CharacteristicEventTypes,
  Service,
  CharacteristicGetCallback,
} from 'homebridge';

const singleConsumption = new client.Gauge({
  name: 'comelit_plug_consumption',
  help: 'Consumption for single line in Wh',
  labelNames: ['plug_name'],
});

const plugStatus = new client.Gauge({
  name: 'comelit_plug_status',
  help: 'Status of a single line (0 or 1)',
  labelNames: ['plug_name'],
});

export class Outlet extends ComelitAccessory<OutletDeviceData> {
  static readonly ON = 1;
  static readonly OFF = 0;

  private outletService: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  public update(data: OutletDeviceData) {
    const Characteristic = this.platform.Characteristic;
    const status = parseInt(data.status);
    this.outletService.getCharacteristic(Characteristic.On).updateValue(status > 0);
    plugStatus.set({ plug_name: data.descrizione }, status);
    const power = parseFloat(data.instant_power);
    this.outletService.getCharacteristic(Characteristic.InUse).updateValue(power > 0);
    singleConsumption.set({ plug_name: data.descrizione }, power);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    const Characteristic = this.platform.Characteristic;
    this.outletService =
      this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);
    this.update(this.device);
    this.outletService
      .getCharacteristic(Characteristic.InUse)
      .on(CharacteristicEventTypes.GET, async (callback: Function) => {
        const power = parseFloat(this.device.instant_power);
        callback(null, power > 0);
      });
    this.outletService
      .getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.SET, async (yes: boolean, callback: Function) => {
        const status = yes ? Outlet.ON : Outlet.OFF;
        try {
          await this.client.toggleDeviceStatus(this.device.id, status);
          callback();
        } catch (e) {
          this.log.error(e.message);
          callback(e);
        }
      })
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, this.device.status === `${ObjectStatus.ON}`);
      });
    return [accessoryInformation, this.outletService];
  }
}
