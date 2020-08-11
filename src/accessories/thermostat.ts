import { ComelitAccessory } from './comelit';
import {
  ClimaMode,
  ClimaOnOff,
  ComelitClient,
  STATUS_ON,
  ThermoSeason,
  ThermostatDeviceData,
} from 'comelit-client';
import { TargetHeatingCoolingState } from './hap';
import client from 'prom-client';
import { ComelitPlatform } from '../comelit-platform';
import { CharacteristicEventTypes, PlatformAccessory, Service, VoidCallback } from 'homebridge';

const thermostatStatus = new client.Gauge({
  name: 'comelit_thermostat_status',
  help: 'Thermostat on/off',
  labelNames: ['thermostat_name'],
});
const thermostatTemperature = new client.Gauge({
  name: 'comelit_thermostat_temperature',
  help: 'Thermostat temperature',
  labelNames: ['thermostat_name'],
});

export class Thermostat extends ComelitAccessory<ThermostatDeviceData> {
  protected thermostatService: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    const Characteristic = this.platform.Characteristic;
    this.thermostatService =
      this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);
    this.update(this.device);

    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .on(CharacteristicEventTypes.SET, async (temperature: number, callback: VoidCallback) => {
        try {
          await this.setTargetTemperature(temperature);
          callback();
        } catch (e) {
          callback(e);
        }
      });

    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on(CharacteristicEventTypes.SET, async (state: number, callback: VoidCallback) => {
        const currentState = this.thermostatService.getCharacteristic(
          Characteristic.TargetHeatingCoolingState
        ).value;
        try {
          if (currentState !== state) {
            this.log.info(`Modifying state of ${this.accessory.displayName} to ${state}`);
            if (currentState === TargetHeatingCoolingState.OFF) {
              // before doing anything, we need to turn on the thermostat
              await this.client.toggleThermostatStatus(this.device.id, ClimaOnOff.ON_THERMO);
            }

            if (
              currentState === TargetHeatingCoolingState.AUTO &&
              state !== TargetHeatingCoolingState.OFF
            ) {
              // if in AUTO mode, switch to MANUAL here
              await this.client.switchThermostatMode(this.device.id, ClimaMode.MANUAL);
            }

            switch (state) {
              case TargetHeatingCoolingState.AUTO:
                await this.client.switchThermostatMode(this.device.id, ClimaMode.AUTO);
                break;
              case TargetHeatingCoolingState.COOL:
                await this.client.switchThermostatSeason(this.device.id, ThermoSeason.SUMMER);
                break;
              case TargetHeatingCoolingState.HEAT:
                await this.client.switchThermostatSeason(this.device.id, ThermoSeason.WINTER);
                break;
              case TargetHeatingCoolingState.OFF:
                await this.client.toggleThermostatStatus(this.device.id, ClimaOnOff.OFF_THERMO);
                break;
            }
          }
          callback();
        } catch (e) {
          callback(e);
        }
      });

    return [accessoryInformation, this.thermostatService];
  }

  private async setTargetTemperature(temperature: number) {
    const Characteristic = this.platform.Characteristic;
    const currentTemperature = this.thermostatService.getCharacteristic(
      Characteristic.TargetTemperature
    ).value;
    const normalizedTemp = temperature * 10;
    if (currentTemperature !== temperature) {
      await this.client.setTemperature(this.device.id, normalizedTemp);
      this.device.temperatura = `${normalizedTemp}`;
    }
  }

  public update(data: ThermostatDeviceData): void {
    const Characteristic = this.platform.Characteristic;

    const auto_man = data.auto_man;
    const isOff = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.OFF_MANUAL;
    const isWinter = data.est_inv === ThermoSeason.WINTER;
    const isAuto = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.AUTO;
    const isOn = auto_man === ClimaMode.AUTO || auto_man === ClimaMode.MANUAL;
    const isWorking = isOn && data.status === STATUS_ON;

    const currentCoolingState = isOff
      ? TargetHeatingCoolingState.OFF
      : isWinter
      ? TargetHeatingCoolingState.HEAT
      : TargetHeatingCoolingState.COOL;
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .updateValue(currentCoolingState);

    let targetState: TargetHeatingCoolingState;
    if (isOff || !isWorking) {
      targetState = TargetHeatingCoolingState.OFF;
    } else if (isAuto) {
      targetState = TargetHeatingCoolingState.AUTO;
    } else {
      if (isWinter) {
        targetState = TargetHeatingCoolingState.HEAT;
      } else {
        targetState = TargetHeatingCoolingState.COOL;
      }
    }
    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .updateValue(targetState);

    const temperature = data.temperatura ? parseFloat(data.temperatura) / 10 : 0;
    const targetTemperature = data.soglia_attiva ? parseFloat(data.soglia_attiva) / 10 : 0;
    this.log.info(
      `${data.objectId} - ${this.accessory.displayName}:\nThermostat status ${
        isOff ? 'OFF' : 'ON'
      }, ${isAuto ? 'auto mode' : 'manual mode'}, ${
        data.est_inv === ThermoSeason.WINTER ? 'winter' : 'summer'
      }, Temperature ${temperature}°, threshold ${targetTemperature}°`
    );
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .updateValue(temperature);

    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .updateValue(targetTemperature);

    thermostatStatus.set({ thermostat_name: data.descrizione }, isWorking ? 0 : 1);
    thermostatTemperature.set({ thermostat_name: data.descrizione }, temperature);
  }
}
