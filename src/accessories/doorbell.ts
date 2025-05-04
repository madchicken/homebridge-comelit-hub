import { ComelitAccessory } from './comelit';
import { ComelitClient, DoorDeviceData, STATUS_ON } from 'comelit-client';
import { CharacteristicSetCallback, PlatformAccessory, Service } from 'homebridge';
import { ComelitPlatform } from '../comelit-platform';

export class Doorbell extends ComelitAccessory<DoorDeviceData> {
  private service: Service;
  private switchService: Service;
  private busy: boolean;
  private state: number;
  private timeout: any;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
    this.state = 0;
  }

  identify() {
    const Characteristic = this.platform.Characteristic;
    this.service.getCharacteristic(Characteristic.ProgrammableSwitchEvent).setValue(0);
  }

  get_model(): string {
    return 'VIP Doorbell';
  }

  protected initServices(): Service[] {
    const Characteristic = this.platform.Characteristic;

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

    this.switchService = this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);
    this.switchService
      .getCharacteristic(Characteristic.On)
      .on('set', this.setSwitchState.bind(this));
    this.switchService.setCharacteristic(Characteristic.On, false);
    return [this.service, infoService];
  }

  protected update(_data: DoorDeviceData) {
    this.ring();
  }

  setSwitchState(newState: number, callback: CharacteristicSetCallback) {
    if (newState != 0) {
      this.ring();
    }
    callback();
  }

  stepState() {
    if (this.state === 1) {
      this.state = 2;
    } else {
      this.state = 1;
    }
  }

  ring() {
    const Characteristic = this.platform.Characteristic;

    if (!this.busy) {
      this.busy = true;
      this.service
        .getCharacteristic(Characteristic.ProgrammableSwitchEvent)
        .updateValue(this.state);
      this.stepState();
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      this.busy = false;
      this.timeout = undefined;
      this.switchService.setCharacteristic(Characteristic.On, false);
    }, 2 * 1000);
    return true;
  }
}
