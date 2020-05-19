import { ComelitAccessory } from './comelit';
import {
  ClimaMode,
  ClimaOnOff,
  ComelitClient,
  STATUS_ON,
  ThermoSeason,
  ThermostatDeviceData,
} from 'comelit-client';
import { Characteristic, CharacteristicEventTypes, Service, VoidCallback } from 'hap-nodejs';
import { HomebridgeAPI } from '../index';
import {
  TargetHeatingCoolingState,
  TemperatureDisplayUnits,
} from 'hap-nodejs/dist/lib/gen/HomeKit';
import client from 'prom-client';
import { ComelitPlatform } from '../comelit-platform';
import { PlatformAccessory } from 'homebridge';

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
  private thermostatService: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();

    this.thermostatService = new HomebridgeAPI.hap.Service.Thermostat(
      this.device.descrizione,
      null
    );
    this.update(this.device);

    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .on(CharacteristicEventTypes.SET, async (temperature: number, callback: VoidCallback) => {
        try {
          const currentTemperature = this.thermostatService.getCharacteristic(
            Characteristic.TargetTemperature
          ).value;
          const normalizedTemp = temperature * 10;
          if (currentTemperature !== temperature) {
            await this.client.setTemperature(this.device.id, normalizedTemp);
            this.device.temperatura = `${normalizedTemp}`;
          }
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

  public update(data: ThermostatDeviceData): void {
    const currentCoolingState = this.isOff()
      ? TargetHeatingCoolingState.OFF
      : this.isWinter()
      ? TargetHeatingCoolingState.HEAT
      : TargetHeatingCoolingState.COOL;
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
      .updateValue(currentCoolingState);

    let targetState;
    if (this.isOff()) {
      targetState = TargetHeatingCoolingState.OFF;
    } else if (this.isAuto()) {
      targetState = TargetHeatingCoolingState.AUTO;
    } else {
      if (this.isWinter()) {
        targetState = TargetHeatingCoolingState.HEAT;
      } else {
        targetState = TargetHeatingCoolingState.COOL;
      }
    }
    this.thermostatService
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .updateValue(targetState);

    console.log(
      `Current cooling state is now ${currentCoolingState}, target state is ${targetState}`
    );
    const temperature = data.temperatura ? parseFloat(data.temperatura) / 10 : 0;
    this.log.info(`Temperature for ${this.accessory.displayName} is ${temperature}`);
    this.thermostatService
      .getCharacteristic(Characteristic.CurrentTemperature)
      .updateValue(temperature);

    const activeThreshold = data.soglia_attiva;
    const targetTemperature = activeThreshold ? parseFloat(activeThreshold) / 10 : 0;
    this.log.info(`Threshold for ${this.accessory.displayName} is ${targetTemperature}`);
    this.thermostatService
      .getCharacteristic(Characteristic.TargetTemperature)
      .updateValue(targetTemperature);
    this.thermostatService
      .getCharacteristic(Characteristic.TemperatureDisplayUnits)
      .updateValue(TemperatureDisplayUnits.CELSIUS);

    thermostatStatus.set({ thermostat_name: data.descrizione }, parseInt(this.device.status));
    thermostatTemperature.set({ thermostat_name: data.descrizione }, temperature);
  }

  isOff(): boolean {
    return (
      this.device.auto_man === ClimaMode.OFF_AUTO || this.device.auto_man === ClimaMode.OFF_MANUAL
    );
  }

  isRunning(): boolean {
    return this.device.status === STATUS_ON;
  }

  isAuto(): boolean {
    return this.device.auto_man === ClimaMode.OFF_AUTO || this.device.auto_man === ClimaMode.AUTO;
  }

  isWinter(): boolean {
    return this.device.est_inv === ThermoSeason.WINTER;
  }
}
