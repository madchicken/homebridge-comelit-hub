import { ComelitClient, DeviceData } from 'comelit-client';
import { Characteristic, Controller, Service } from 'hap-nodejs';
import { AccessoryPlugin, Logger, PlatformAccessory } from 'homebridge';
import { ComelitPlatform } from '../comelit-platform';

export abstract class ComelitAccessory<T extends DeviceData> implements AccessoryPlugin {
  readonly platform: ComelitPlatform;
  readonly accessory: PlatformAccessory;
  readonly log: Logger;
  readonly device: T;
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
    this.device = this.accessory.context as T;
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
      .setCharacteristic(Characteristic.Name, this.accessory.displayName)
      .setCharacteristic(Characteristic.Manufacturer, 'Comelit')
      .setCharacteristic(Characteristic.Model, 'None')
      .setCharacteristic(Characteristic.FirmwareRevision, 'None')
      .setCharacteristic(Characteristic.SerialNumber, this.device.objectId);
    return accessoryInformation;
  }

  protected abstract initServices(): Service[];

  public abstract update(data: T): void;
}
