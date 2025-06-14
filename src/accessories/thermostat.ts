import { ComelitAccessory } from './comelit';
import {
  ClimaMode,
  ClimaOnOff,
  ComelitClient,
  OBJECT_SUBTYPE,
  STATUS_OFF,
  ThermoSeason,
  ThermostatDeviceData,
} from 'comelit-client';
import {
  Active,
  CurrentHumidifierDehumidifierState,
  TargetHeatingCoolingState,
  TargetHumidifierDehumidifierState,
} from './hap';
import client from 'prom-client';
import { ComelitPlatform } from '../comelit-platform';
import {
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  PlatformAccessory,
  Service,
  VoidCallback,
} from 'homebridge';

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
const dehumidifierStatus = new client.Gauge({
  name: 'comelit_dehumidifier_status',
  help: 'Dehumidifier on/off',
  labelNames: ['dehumidifier_name'],
});
const dehumidifierHumidity = new client.Gauge({
  name: 'comelit_dehumidifier_humidity',
  help: 'Dehumidifier humidity',
  labelNames: ['dehumidifier_name'],
});

export class Thermostat extends ComelitAccessory<ThermostatDeviceData> {
  private thermostatService: Service;
  private temperatureService: Service;

  constructor(platform: ComelitPlatform, accessory: PlatformAccessory, client: ComelitClient) {
    super(platform, accessory, client);
  }

  get isDehumidifier() {
    return this.device.sub_type === OBJECT_SUBTYPE.CLIMA_THERMOSTAT_DEHUMIDIFIER;
  }

  protected initServices(): Service[] {
    const accessoryInformation = this.initAccessoryInformation();
    this.thermostatService = this.initThermostatService();
    this.temperatureService = this.initTemperatureService();
    const services = [accessoryInformation, this.thermostatService, this.temperatureService];

    if (this.isDehumidifier) {
      this.dehumidifierService = this.initDehumidifierService();
      this.humidityService = this.initHumidityService();
      services.push(this.dehumidifierService, this.humidityService);
    }

    this.update(this.device);
    return services;
  }

  private initThermostatService(): Service {
    const Characteristic = this.platform.Characteristic;
    const service =
      this.accessory.getService(this.platform.Service.Thermostat) ||
      this.accessory.addService(this.platform.Service.Thermostat);

    service
      .getCharacteristic(Characteristic.TargetTemperature)
      .on(CharacteristicEventTypes.SET, async (temperature: number, callback: VoidCallback) => {
        try {
          await this.setTargetTemperature(temperature);
          callback();
        } catch (e) {
          this.log.error(e.message);
          callback(e);
        }
      })
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, parseInt(this.device.soglia_attiva) / 10);
      });

    service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, parseInt(this.device.temperatura) / 10);
      });

    service
      .getCharacteristic(Characteristic.TargetHeatingCoolingState)
      .on(CharacteristicEventTypes.SET, async (state: number, callback: VoidCallback) => {
        const currentState = service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
          .value;
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
          this.log.error(e.message);
          callback(e);
        }
      })
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        const auto_man = this.device.auto_man;
        const isOff = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.OFF_MANUAL;
        const isWinter = this.device.est_inv === ThermoSeason.WINTER;

        const currentCoolingState = isOff
          ? TargetHeatingCoolingState.OFF
          : isWinter
          ? TargetHeatingCoolingState.HEAT
          : TargetHeatingCoolingState.COOL;
        callback(null, currentCoolingState);
      });

    return service;
  }

  private initTemperatureService(): Service {
    const Characteristic = this.platform.Characteristic;
    const service =
      this.accessory.getService(this.platform.Service.TemperatureSensor) ||
      this.accessory.addService(this.platform.Service.TemperatureSensor);

    service
      .getCharacteristic(Characteristic.CurrentTemperature)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, parseInt(this.device.temperatura) / 10);
      });
    return service;
  }

  private dehumidifierService: Service;
  private humidityService: Service;

  private initDehumidifierService(): Service {
    const Characteristic = this.platform.Characteristic;
    const service =
      this.accessory.getService(this.platform.Service.HumidifierDehumidifier) ||
      this.accessory.addService(this.platform.Service.HumidifierDehumidifier);

    service.addOptionalCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold);
    service.addOptionalCharacteristic(Characteristic.RelativeHumidityHumidifierThreshold);
    service.addOptionalCharacteristic(Characteristic.Active);

    service
      .getCharacteristic(Characteristic.RelativeHumidityDehumidifierThreshold)
      .on(CharacteristicEventTypes.SET, async (humidity: number, callback: VoidCallback) => {
        try {
          this.log.info(
            `Modifying target humidity threshold of ${this.accessory.displayName}-dehumidifier to ${humidity}%`
          );
          await this.client.setHumidity(this.device.id, humidity);
          callback();
        } catch (e) {
          this.log.error(e.message);
          callback(e);
        }
      })
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, parseInt(this.device.soglia_attiva_umi));
      });

    service
      .getCharacteristic(Characteristic.TargetHumidifierDehumidifierState)
      .setProps({
        validValues: [0, 2], // only show dehumidifier
      })
      .on(CharacteristicEventTypes.SET, async (state: number, callback: VoidCallback) => {
        try {
          this.log.info(
            `Modifying target state of ${this.accessory.displayName}-dehumidifier to ${state}`
          );
          switch (state) {
            case TargetHumidifierDehumidifierState.DEHUMIDIFIER:
            case TargetHumidifierDehumidifierState.HUMIDIFIER:
              await this.client.switchHumidifierMode(this.device.id, ClimaMode.MANUAL);
              break;
            case TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER:
              await this.client.switchHumidifierMode(this.device.id, ClimaMode.AUTO);
              break;
          }
          callback();
        } catch (e) {
          this.log.error(e.message);
          callback(e);
        }
      })
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        const auto_man = this.device.auto_man_umi;
        const isAuto = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.AUTO;
        const targetState = isAuto
          ? TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER
          : TargetHumidifierDehumidifierState.DEHUMIDIFIER;

        callback(null, targetState);
      });

    service
      .getCharacteristic(Characteristic.Active)
      .on(
        CharacteristicEventTypes.SET,
        async (state: number, callback: CharacteristicSetCallback) => {
          try {
            this.log.info(
              `Modifying active state of ${this.accessory.displayName}-dehumidifier to ${state}`
            );
            switch (state) {
              case Active.ACTIVE:
                await this.client.toggleHumidifierStatus(this.device.id, ClimaOnOff.ON_HUMI);
                break;
              case Active.INACTIVE:
                await this.client.toggleHumidifierStatus(this.device.id, ClimaOnOff.OFF_HUMI);
                break;
            }
            callback();
          } catch (e) {
            this.log.error(e.message);
            callback(e);
          }
        }
      )
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        const auto_man = this.device.auto_man_umi;
        const isOn = auto_man === ClimaMode.AUTO || auto_man === ClimaMode.MANUAL;
        const isWorking = isOn && this.device.status !== STATUS_OFF;
        callback(null, isWorking);
      });

    return service;
  }

  private initHumidityService(): Service {
    const Characteristic = this.platform.Characteristic;
    const service =
      this.accessory.getService(this.platform.Service.HumiditySensor) ||
      this.accessory.addService(this.platform.Service.HumiditySensor);

    service
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        callback(null, parseInt(this.device.umidita));
      });
    return service;
  }

  private async setTargetTemperature(temperature: number) {
    const Characteristic = this.platform.Characteristic;
    const currentTemperature = this.thermostatService.getCharacteristic(
      Characteristic.TargetTemperature
    ).value;
    const normalizedTemp = temperature * 10;
    if (currentTemperature !== temperature) {
      await this.client.setTemperature(this.device.id, normalizedTemp);
    }
  }

  public update(data: ThermostatDeviceData): void {
    try {
      this.updateThermostat(data);
      if (this.isDehumidifier) {
        this.updateDehumidifier(data);
      }
    } catch (e) {
      this.log.error(e);
    }
  }

  public updateThermostat(data: ThermostatDeviceData): void {
    const Characteristic = this.platform.Characteristic;

    const auto_man = data.auto_man;
    const isOff = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.OFF_MANUAL;
    const isWinter = data.est_inv === ThermoSeason.WINTER;
    const isAuto = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.AUTO;
    const isOn = auto_man === ClimaMode.AUTO || auto_man === ClimaMode.MANUAL;
    const isWorking = isOn && data.status !== STATUS_OFF;

    const currentCoolingState = isOff
      ? TargetHeatingCoolingState.OFF
      : isWinter
      ? TargetHeatingCoolingState.HEAT
      : TargetHeatingCoolingState.COOL;

    let targetState: TargetHeatingCoolingState;
    if (isOff) {
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

    const temperature = data.temperatura ? parseFloat(data.temperatura) / 10 : 0;
    this.temperatureService.updateCharacteristic(Characteristic.CurrentTemperature, temperature);
    const targetTemperature = data.soglia_attiva ? parseFloat(data.soglia_attiva) / 10 : 0;
    this.log.info(
      `${data.id} - ${this.accessory.displayName}:\nThermostat status ${
        isOff ? 'OFF' : 'ON'
      }, ${isAuto ? 'auto mode' : 'manual mode'}, ${
        data.est_inv === ThermoSeason.WINTER ? 'winter' : 'summer'
      }, Temperature ${temperature}°, threshold ${targetTemperature}° (currently ${
        isWorking ? 'active' : 'not active'
      }`
    );

    this.thermostatService.updateCharacteristic(
      Characteristic.CurrentHeatingCoolingState,
      currentCoolingState
    );

    this.thermostatService.updateCharacteristic(
      Characteristic.TargetHeatingCoolingState,
      targetState
    );

    this.thermostatService.updateCharacteristic(Characteristic.CurrentTemperature, temperature);

    this.thermostatService.updateCharacteristic(
      Characteristic.TargetTemperature,
      targetTemperature
    );

    this.thermostatService.updateCharacteristic(Characteristic.Active, isOn);

    thermostatStatus.set({ thermostat_name: data.descrizione }, isWorking ? 1 : 0);
    thermostatTemperature.set({ thermostat_name: data.descrizione }, temperature);
  }

  public updateDehumidifier(data: ThermostatDeviceData): void {
    if (this.dehumidifierService) {
      const Characteristic = this.platform.Characteristic;
      const auto_man = data.auto_man_umi;
      const isOff = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.OFF_MANUAL;
      const isOn = auto_man === ClimaMode.AUTO || auto_man === ClimaMode.MANUAL;
      const isAuto = auto_man === ClimaMode.OFF_AUTO || auto_man === ClimaMode.AUTO;
      const isWorking = isOn && data.status !== STATUS_OFF;
      const currentDehumidifierState = isOff
        ? CurrentHumidifierDehumidifierState.INACTIVE
        : isWorking
        ? CurrentHumidifierDehumidifierState.DEHUMIDIFYING
        : CurrentHumidifierDehumidifierState.IDLE;
      const targetState = isAuto
        ? TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER
        : TargetHumidifierDehumidifierState.DEHUMIDIFIER;

      console.log(
        `Dehumidifier status is ${isOff ? 'OFF' : 'ON'}, ${
          isAuto ? 'auto mode' : 'manual mode'
        }, Humidity level ${parseInt(data.umidita)}%, threshold ${
          data.soglia_attiva_umi
        }%\nGeneral status is ${data.status !== STATUS_OFF ? 'ON' : 'OFF'}`
      );

      this.humidityService.updateCharacteristic(
        Characteristic.CurrentRelativeHumidity,
        parseInt(data.umidita)
      );
      this.dehumidifierService.updateCharacteristic(
        Characteristic.CurrentRelativeHumidity,
        parseInt(data.umidita)
      );
      this.dehumidifierService.updateCharacteristic(
        Characteristic.RelativeHumidityHumidifierThreshold,
        parseInt(data.soglia_attiva_umi)
      );
      this.dehumidifierService.updateCharacteristic(
        Characteristic.RelativeHumidityDehumidifierThreshold,
        parseInt(data.soglia_attiva_umi)
      );
      this.dehumidifierService.updateCharacteristic(
        Characteristic.CurrentHumidifierDehumidifierState,
        currentDehumidifierState
      );
      this.dehumidifierService.updateCharacteristic(
        Characteristic.TargetHumidifierDehumidifierState,
        targetState
      );
      this.dehumidifierService.updateCharacteristic(Characteristic.Active, isOn);

      dehumidifierStatus.set({ dehumidifier_name: data.descrizione }, isWorking ? 1 : 0);
      dehumidifierHumidity.set({ dehumidifier_name: data.descrizione }, parseInt(data.umidita));
    }
  }
}
