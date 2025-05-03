import { ComelitAccessory } from './comelit';
import { ComelitClient, DoorDeviceData, STATUS_ON } from 'comelit-client';
import { PlatformAccessory, Service } from 'homebridge';
import { ComelitPlatform } from '../comelit-platform';

export class Doorbell extends ComelitAccessory<DoorDeviceData> {
  private service: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  identify() {
    const Characteristic = this.platform.Characteristic;
    this.service.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(0);
  }

  get_model(): string {
    return 'VIP Doorbell';
  }

  protected initServices(): Service[] {
    const infoService =
      this.accessory.getService(this.platform.Service.AccessoryInformation) ||
      this.accessory.addService(this.platform.Service.AccessoryInformation);
    infoService.getCharacteristic(this.platform.Characteristic.Manufacturer).setValue('Comelit');
    infoService
      .getCharacteristic(this.platform.Characteristic.Model)
      .setValue(this.accessory.context.descrizione);

    this.service =
      this.accessory.getService(this.platform.Service.Doorbell) ||
      this.accessory.addService(this.platform.Service.Doorbell);
    this.service.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent).setProps({
      validValues: [0, 1],
    });

    return [this.service, infoService];
  }

  protected update(data: DoorDeviceData) {
    const Characteristic = this.platform.Characteristic;
    if (data.status == STATUS_ON) {
      this.service.updateCharacteristic(
        Characteristic.ProgrammableSwitchEvent,
        1
      );
      setTimeout(() => {
        this.service.updateCharacteristic(
          Characteristic.ProgrammableSwitchEvent,
          0
        );
      }, 1000);
    }
  }
}
