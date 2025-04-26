import { ComelitAccessory } from './comelit';
import { ComelitClient, DoorDeviceData, STATUS_ON } from 'comelit-client';
import { PlatformAccessory, Service } from 'homebridge';
import { ComelitPlatform } from '../comelit-platform';

export class Doorbell extends ComelitAccessory<DoorDeviceData> {
  private service: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    // const Characteristic = this.platform.Characteristic;
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
    // this.service.getCharacteristic(Characteristic.ProgrammableSwitchEvent)
    //   .onGet(this.handleProgrammableSwitchEventGet.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent).setProps({
      validValues: [this.platform.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS],
    });
    return [infoService, this.service];
  }

  // handleProgrammableSwitchEventGet() {
  //   const Characteristic = this.platform.Characteristic;
  //   this.log.debug('Triggered GET ProgrammableSwitchEvent');
  //
  //   // set this to a valid value for ProgrammableSwitchEvent
  //   const currentValue = Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS;
  //
  //   return currentValue;
  // }

  protected update(data: DoorDeviceData) {
    const Characteristic = this.platform.Characteristic;
    if (data.status == STATUS_ON) {
      this.service.updateCharacteristic(
        Characteristic.ProgrammableSwitchEvent,
        Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS
      );
    }
  }
}
