import { PlatformAccessory, Service } from 'homebridge';
import { ACTION_TYPE, ComelitClient, DoorDeviceData } from 'comelit-client';
import { ComelitPlatform } from '../comelit-platform';
import { SupportedTypes } from '../types';
import { ComelitAccessory } from './comelit';
import { CharacteristicValue } from 'hap-nodejs/dist/types';
import Timeout = NodeJS.Timeout;
import { getDoorDeviceConfigOrDefault } from '../utils';

export class DoorAccessory extends ComelitAccessory<DoorDeviceData> {
  private closeTimeout: Timeout;
  private closingTimeout: Timeout;
  private lockState: number;
  private service: Service;

  constructor(
    platform: ComelitPlatform,
    accessory: PlatformAccessory,
    client: ComelitClient,
  ) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    const Characteristic = this.platform.Characteristic;

    this.lockState = Characteristic.LockCurrentState.SECURED;

    const infoService =
      this.accessory.getService(this.platform.Service.AccessoryInformation) ||
      this.accessory.addService(this.platform.Service.AccessoryInformation);
    infoService.getCharacteristic(this.platform.Characteristic.Manufacturer).setValue('Comelit');
      infoService.getCharacteristic(this.platform.Characteristic.Model).setValue('ICONA');

    let config = getDoorDeviceConfigOrDefault(this.platform.config, this.accessory.context.id)
    switch (config.type) {
      case SupportedTypes.door:
        this.service = this.mountAsDoor();
        break;
      case SupportedTypes.garage_door:
        this.service = this.mountAsGarageDoor();
        break;
      case SupportedTypes.lock:
      default:
        this.service = this.mountAsLock();
    }
    return [infoService, this.service];
  }

  private mountAsLock() {
    const Characteristic = this.platform.Characteristic;
    this.log.info(`Mounting ${this.accessory.displayName} as Lock`);
    const service =
      this.accessory.getService(this.platform.Service.LockMechanism) ||
      this.accessory.addService(this.platform.Service.LockMechanism);
    service
      .getCharacteristic(Characteristic.LockCurrentState)
      .onGet(this.handleCurrentPosition.bind(this));
    service
      .getCharacteristic(Characteristic.LockTargetState)
      .onSet(this.handleTargetPositionSet.bind(this))
      .onGet(this.handleCurrentPosition.bind(this));
    return service;
  }

  private mountAsGarageDoor() {
    const Characteristic = this.platform.Characteristic;
    this.log.info(`Mounting ${this.accessory.displayName} as Garage Door`);
    const service =
      this.accessory.getService(this.platform.Service.GarageDoorOpener) ||
      this.accessory.addService(this.platform.Service.GarageDoorOpener);
    service
      .getCharacteristic(Characteristic.CurrentDoorState)
      .updateValue(Characteristic.CurrentDoorState.CLOSED);
    service
      .getCharacteristic(Characteristic.TargetDoorState)
      .updateValue(Characteristic.TargetDoorState.CLOSED);
    service
      .getCharacteristic(Characteristic.TargetDoorState)
      .onSet(this.handleTargetPositionSet.bind(this));
    return service;
  }

  /**
   * Handle requests to set the "Target Position" characteristic
   */
  async handleTargetPositionSet(value: CharacteristicValue) {
    this.log.debug('Triggered SET TargetPosition:' + value);
    let config = getDoorDeviceConfigOrDefault(this.platform.config, this.accessory.context.id)
    await this.client.sendAction(config.name, ACTION_TYPE.SET, 1);
    clearTimeout(this.closeTimeout);
    clearTimeout(this.closingTimeout);
    switch (config.type) {
      case SupportedTypes.door:
        this.handleAsDoor();
        break;
      case SupportedTypes.garage_door:
        this.handleAsGarageDoor();
        break;
      case SupportedTypes.lock:
      default:
        this.handleAsLock();
    }
  }

  private mountAsDoor() {
    const Characteristic = this.platform.Characteristic;
    this.log.info(`Mounting ${this.accessory.displayName} as Door`);
    const service =
      this.accessory.getService(this.platform.Service.Door) ||
      this.accessory.addService(this.platform.Service.Door);
    service.getCharacteristic(Characteristic.TargetPosition).setProps({
      unit: null,
      minValue: 0,
      maxValue: 1,
      minStep: 1,
      validValues: [0, 1],
    });
    service.getCharacteristic(Characteristic.CurrentPosition).setProps({
      unit: null,
      minValue: 0,
      maxValue: 1,
      minStep: 1,
      validValues: [0, 1],
    });
    service
      .getCharacteristic(Characteristic.PositionState)
      .updateValue(Characteristic.PositionState.STOPPED);
    service
      .getCharacteristic(Characteristic.TargetPosition)
      .onSet(this.handleTargetPositionSet.bind(this));
    return service;
  }

  protected update(_data: DoorDeviceData) {}

  private async handleCurrentPosition() {
    return this.lockState;
  }

  private handleAsLock() {
    const Characteristic = this.platform.Characteristic;
    let config = getDoorDeviceConfigOrDefault(this.platform.config, this.accessory.context.id)
    this.lockState = Characteristic.LockCurrentState.UNSECURED;
    this.service.getCharacteristic(Characteristic.LockCurrentState).updateValue(this.lockState);
    this.closeTimeout = setTimeout(() => {
      this.lockState = Characteristic.LockCurrentState.SECURED;
      this.service.getCharacteristic(Characteristic.LockTargetState).updateValue(this.lockState);
      this.service.getCharacteristic(Characteristic.LockCurrentState).updateValue(this.lockState);
    }, config.opened_time * 1000);
  }

  private handleAsDoor() {
    let config = getDoorDeviceConfigOrDefault(this.platform.config, this.accessory.context.id)
    const Characteristic = this.platform.Characteristic;
    this.service.getCharacteristic(Characteristic.TargetPosition).updateValue(1);
    this.service.getCharacteristic(Characteristic.CurrentPosition).updateValue(1);
    this.service
      .getCharacteristic(Characteristic.PositionState)
      .updateValue(Characteristic.PositionState.INCREASING);
    this.closeTimeout = setTimeout(() => {
      this.service
        .getCharacteristic(Characteristic.PositionState)
        .updateValue(Characteristic.PositionState.STOPPED);
      this.service.getCharacteristic(Characteristic.TargetPosition).updateValue(0);
      this.service.getCharacteristic(Characteristic.CurrentPosition).updateValue(0);
    }, config.opened_time * 1000);
  }

  private handleAsGarageDoor() {
    let config = getDoorDeviceConfigOrDefault(this.platform.config, this.accessory.context.id)
    const Characteristic = this.platform.Characteristic;
    this.service
      .getCharacteristic(Characteristic.CurrentDoorState)
      .updateValue(Characteristic.CurrentDoorState.OPENING);
    this.service
      .getCharacteristic(Characteristic.TargetDoorState)
      .updateValue(Characteristic.TargetDoorState.OPEN);
    setTimeout(() => {
      this.service
        .getCharacteristic(Characteristic.CurrentDoorState)
        .updateValue(Characteristic.CurrentDoorState.OPEN);
      this.closeTimeout = setTimeout(() => {
        this.service
          .getCharacteristic(Characteristic.CurrentDoorState)
          .updateValue(Characteristic.CurrentDoorState.CLOSING);
        this.service
          .getCharacteristic(Characteristic.TargetDoorState)
          .updateValue(Characteristic.TargetDoorState.CLOSED);
        this.closingTimeout = setTimeout(() => {
          this.service
            .getCharacteristic(Characteristic.CurrentDoorState)
            .updateValue(Characteristic.CurrentDoorState.CLOSED);
        }, config.opening_time * 1000);
      }, config.opened_time * 1000);
    }, config.closing_time * 1000);
  }
}
