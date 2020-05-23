import { ComelitAccessory } from './comelit';
import { ComelitClient, LightDeviceData, ObjectStatus } from 'comelit-client';
import client from 'prom-client';
import { PlatformAccessory, CharacteristicEventTypes, Service } from 'homebridge';
import { ComelitPlatform } from '../comelit-platform';

const lightStatus = new client.Gauge({
  name: 'comelit_light_status',
  help: 'Lightbulb on/off',
  labelNames: ['light_name'],
});
const lightCount = new client.Counter({
  name: 'comelit_light_total',
  help: 'Lightbulb on/off counter',
  labelNames: ['light_name'],
});

export class Lightbulb extends ComelitAccessory<LightDeviceData> {
  static readonly ON = 1;
  static readonly OFF = 0;

  private lightbulbService: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  async identify() {
    const Characteristic = this.platform.Characteristic;
    if (this.isOn()) {
      this.lightbulbService.setCharacteristic(Characteristic.On, false);
      setTimeout(() => {
        this.lightbulbService.setCharacteristic(Characteristic.On, true);
      }, 1000);
    } else {
      this.lightbulbService.setCharacteristic(Characteristic.On, true);
      setTimeout(() => {
        this.lightbulbService.setCharacteristic(Characteristic.On, false);
      }, 1000);
    }
  }

  isOn(): boolean {
    return parseInt(this.device.status) === ObjectStatus.ON;
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation(); // common info about the accessory

    const Characteristic = this.platform.Characteristic;
    const status = parseInt(this.device.status);
    this.lightbulbService =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    this.lightbulbService.setCharacteristic(Characteristic.On, status === ObjectStatus.ON);

    this.lightbulbService
      .getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.SET, async (yes: boolean, callback: Function) => {
        const status = yes ? ObjectStatus.ON : ObjectStatus.OFF;
        try {
          await this.client.toggleDeviceStatus(this.device.id, status);
          this.device.status = `${status}`;
          callback();
        } catch (e) {
          callback(e);
        }
      });

    return [accessoryInformation, this.lightbulbService];
  }

  public update(data: LightDeviceData) {
    const Characteristic = this.platform.Characteristic;
    const status = parseInt(data.status) === ObjectStatus.ON;
    this.log.info(`Updating status of light ${this.device.id}. New status is ${status}`);
    lightStatus.set({ light_name: data.descrizione }, parseInt(data.status));
    if (status) {
      lightCount.inc({ light_name: data.descrizione });
    }
    this.lightbulbService.getCharacteristic(Characteristic.On).updateValue(status);
  }
}
