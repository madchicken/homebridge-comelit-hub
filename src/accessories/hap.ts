import { CharacteristicSetCallback } from 'hap-nodejs';
import { Logger } from 'homebridge';

export enum Active {
  INACTIVE = 0,
  ACTIVE = 1,
}

export enum CurrentHumidifierDehumidifierState {
  INACTIVE = 0,
  IDLE = 1,
  HUMIDIFYING = 2,
  DEHUMIDIFYING = 3,
}

export enum TargetHumidifierDehumidifierState {
  HUMIDIFIER_OR_DEHUMIDIFIER = 0,
  HUMIDIFIER = 1,
  DEHUMIDIFIER = 2,
}

export enum PositionState {
  DECREASING = 0,
  INCREASING = 1,
  STOPPED = 2,
}

export enum TargetHeatingCoolingState {
  OFF = 0,
  HEAT = 1,
  COOL = 2,
  AUTO = 3,
}

export enum TemperatureDisplayUnits {
  CELSIUS = 0,
  FAHRENHEIT = 1,
}
