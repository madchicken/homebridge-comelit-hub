import { ComelitAccessory } from './comelit';
import { ComelitClient, OtherDeviceData, STATUS_ON } from 'comelit-client';
import { ComelitPlatform } from '../comelit-platform';
import { CharacteristicEventTypes, PlatformAccessory, Service } from 'homebridge';

export class Other extends ComelitAccessory<OtherDeviceData> {
  static readonly ON = 1;
  static readonly OFF = 0;

  private switchService: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  public update(data: OtherDeviceData) {
    const Characteristic = this.platform.Characteristic;
    const status = parseInt(data.status);
    this.switchService.getCharacteristic(Characteristic.On).updateValue(status > 0);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    const Characteristic = this.platform.Characteristic;
    this.switchService =
      this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);
    this.update(this.device);
    const characteristic = this.switchService.getCharacteristic(Characteristic.On);
    characteristic.on(CharacteristicEventTypes.GET, callback => {
      callback(null, this.device.status === STATUS_ON);
    });
    characteristic.on(CharacteristicEventTypes.SET, async (value, callback) => {
      const status = value ? Other.ON : Other.OFF;
      try {
        await this.client.toggleDeviceStatus(this.device.id, status);
        callback();
      } catch (e) {
        this.log.error(e.message);
        callback(e);
      }
    });
    return [accessoryInformation, this.switchService];
  }
}
