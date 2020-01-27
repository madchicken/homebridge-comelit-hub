import {ComelitAccessory} from "./comelit";
import {ComelitClient, ThermostatDeviceData} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Service, VoidCallback} from "hap-nodejs";
import {HomebridgeAPI} from "../index";
import {
    Active,
    CurrentHeatingCoolingState, CurrentHumidifierDehumidifierState,
    TargetHeatingCoolingState, TargetHumidifierDehumidifierState,
    TemperatureDisplayUnits
} from "hap-nodejs/dist/lib/gen/HomeKit";

export class Thermostat extends ComelitAccessory<ThermostatDeviceData> {
    static readonly ON = '1';
    static readonly DEHUMIDIFIER_ON = '6';
    static readonly OFF = '0';
    static readonly AUTO_MODE = '2';

    private thermostatService: Service;
    private dehumidifierService: Service;

    constructor(log: Function, device: ThermostatDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.THERMOSTAT);
    }

    protected initServices(): Service[] {
        const accessoryInformation = this.initAccessoryInformation();

        this.thermostatService = new HomebridgeAPI.hap.Service.Thermostat(this.device.descrizione, null);
        this.dehumidifierService = new HomebridgeAPI.hap.Service.HumidifierDehumidifier(this.device.descrizione, null);
        this.update(this.device);

        this.thermostatService
            .getCharacteristic(Characteristic.TargetTemperature)
            .on(CharacteristicEventTypes.SET, async (temperature: number, callback: VoidCallback) => {
                try {
                    await this.client.setTemperature(this.device.id, temperature);
                    this.device.temperatura = `${temperature * 10}`;
                    callback()
                } catch (e) {
                    callback(e);
                }
            });

        return [accessoryInformation, this.thermostatService, this.dehumidifierService];
    }

    public update(data: ThermostatDeviceData) {
        const isOff: boolean = data.status === Thermostat.OFF;
        const isAuto: boolean = data.auto_man === Thermostat.AUTO_MODE;
        this.log(`Thermostat auto mode is ${isAuto}`);
        const heatingCollingState = isOff ? CurrentHeatingCoolingState.OFF : data.est_inv === Thermostat.OFF ? CurrentHeatingCoolingState.COOL : CurrentHeatingCoolingState.HEAT;
        this.thermostatService.setCharacteristic(Characteristic.CurrentHeatingCoolingState, heatingCollingState);
        this.thermostatService.setCharacteristic(Characteristic.TargetHeatingCoolingState, isAuto ? TargetHeatingCoolingState.AUTO : heatingCollingState);
        const temperature = data.temperatura ? parseFloat(data.temperatura) / 10 : 0;
        this.log(`Temperature for ${this.name} is ${temperature}`);
        this.thermostatService.setCharacteristic(Characteristic.CurrentTemperature, temperature);
        const targetTemperature = data.soglia_attiva ? parseFloat(data.soglia_attiva) / 10 : 0;
        this.log(`Threshold for ${this.name} is ${targetTemperature}`);
        this.thermostatService.setCharacteristic(Characteristic.TargetTemperature, targetTemperature);
        this.thermostatService.setCharacteristic(Characteristic.TemperatureDisplayUnits, TemperatureDisplayUnits.CELSIUS);

        const isDehumidifierOn = data.auto_man_umi === Thermostat.DEHUMIDIFIER_ON;
        this.dehumidifierService.setCharacteristic(Characteristic.CurrentRelativeHumidity, parseInt(data.umidita));
        this.dehumidifierService.setCharacteristic(Characteristic.CurrentHumidifierDehumidifierState, isDehumidifierOn ? CurrentHumidifierDehumidifierState.DEHUMIDIFYING : CurrentHumidifierDehumidifierState.INACTIVE);
        this.dehumidifierService.setCharacteristic(Characteristic.TargetHumidifierDehumidifierState, TargetHumidifierDehumidifierState.HUMIDIFIER_OR_DEHUMIDIFIER);
        this.dehumidifierService.setCharacteristic(Characteristic.Active, isDehumidifierOn ? Active.ACTIVE : Active.INACTIVE);
        return temperature;
    }
}
