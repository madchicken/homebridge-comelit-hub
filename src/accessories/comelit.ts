import { ComelitClient, DeviceData } from 'comelit-client';
import { Controller, Logger, PlatformAccessory, PlatformAccessoryEvent, Service } from 'homebridge';
import { ComelitPlatform } from '../comelit-platform';

export abstract class ComelitAccessory<T extends DeviceData> {
  readonly platform: ComelitPlatform;
  readonly accessory: PlatformAccessory;
  readonly log: Logger;
  readonly client: ComelitClient;

  services: Service[];
  reachable: boolean;

  protected constructor(
    platform: ComelitPlatform,
    accessory: PlatformAccessory,
    client: ComelitClient
  ) {
    this.platform = platform;
    this.accessory = accessory;
    this.log = platform.log;
    this.client = client;
    this.services = this.initServices();
    this.reachable = true;
    this.accessory.on(PlatformAccessoryEvent.IDENTIFY, () => this.identify());
  }

  getServices(): Service[] {
    return this.services;
  }

  getControllers(): Controller[] {
    return [];
  }

  get device(): Readonly<T> {
    return this.accessory.context as T;
  }

  identify(): void {}

  get_model(): string {
    return 'None';
  }

  protected initAccessoryInformation(): Service {
    const accessoryInformation = this.accessory.getService(
      this.platform.Service.AccessoryInformation
    );
    accessoryInformation!
      .setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName)
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Comelit')
      .setCharacteristic(this.platform.Characteristic.Model, this.get_model())
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, 'None')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.id
      );
    return accessoryInformation;
  }

  protected abstract initServices(): Service[];

  protected abstract update(data: T): void;

  updateDevice(data: T) {
    this.accessory.context = { ...this.accessory.context, ...data };
    this.update(data);
  }
}
