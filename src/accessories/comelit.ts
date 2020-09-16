import { ComelitClient, DeviceData } from 'comelit-client';
import { Controller, Logger, PlatformAccessory, PlatformAccessoryEvent, Service } from 'homebridge';
import { ComelitPlatform } from '../comelit-platform';

export abstract class ComelitAccessory<T extends DeviceData> {
  readonly platform: ComelitPlatform;
  readonly accessory: PlatformAccessory;
  readonly log: Logger;
  readonly client: ComelitClient;
  protected device: Readonly<T>;

  services: Service[];
  reachable: boolean;

  protected constructor(
    platform: ComelitPlatform,
    accessory: PlatformAccessory,
    client: ComelitClient
  ) {
    this.platform = platform;
    this.accessory = accessory;
    this.device = this.accessory.context as T;
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

  identify(): void {}

  protected initAccessoryInformation(): Service {
    const accessoryInformation = this.accessory.getService(
      this.platform.Service.AccessoryInformation
    );
    accessoryInformation!
      .setCharacteristic(this.platform.Characteristic.Name, this.accessory.displayName)
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Comelit')
      .setCharacteristic(this.platform.Characteristic.Model, 'None')
      .setCharacteristic(this.platform.Characteristic.FirmwareRevision, 'None')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.context.objectId
      );
    return accessoryInformation;
  }

  protected abstract initServices(): Service[];

  protected abstract update(data: T): void;

  updateDevice(data: T) {
    this.device = { ...this.device, ...data };
    this.update(data);
  }
}
