import { ComelitAccessory } from './comelit';
import { ComelitClient, ObjectStatus } from 'comelit-client';
import client from 'prom-client';
import { ComelitPlatform } from '../comelit-platform';
import {
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  PlatformAccessory,
  Service,
} from 'homebridge';
import { IrrigationDeviceData } from '../../../comelit-client/src';

const irrigationActivations = new client.Counter({
  name: 'comelit_irrigation',
  help: 'Irrigation system',
  labelNames: ['name'],
});

export class Irrigation extends ComelitAccessory<IrrigationDeviceData> {
  static readonly ON = 1;
  static readonly OFF = 0;

  private service: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  public update(data: IrrigationDeviceData) {
    const Characteristic = this.platform.Characteristic;
    const status = parseInt(data.status);
    this.service.updateCharacteristic(Characteristic.On, status);
    irrigationActivations.inc({ name: data.descrizione });
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    const Characteristic = this.platform.Characteristic;
    this.service =
      this.accessory.getService(this.platform.Service.IrrigationSystem) ||
      this.accessory.addService(this.platform.Service.IrrigationSystem);
    this.update(this.device);
    this.service
      .getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.SET, async (yes: boolean, callback: Function) => {
        const status = yes ? Irrigation.ON : Irrigation.OFF;
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
    return [accessoryInformation, this.service];
  }
}
