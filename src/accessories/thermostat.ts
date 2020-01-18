import {ComelitAccessory} from "./comelit";
import {ComelitClient, ThermostatDeviceData} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Service, VoidCallback} from "hap-nodejs";
import {HomebridgeAPI} from "../index";
import {
    CurrentHeatingCoolingState,
    TargetHeatingCoolingState,
    TemperatureDisplayUnits
} from "hap-nodejs/dist/lib/gen/HomeKit";

export class Thermostat extends ComelitAccessory<ThermostatDeviceData> {
    static readonly OFF = 0;
    static readonly CELSIUS = 0;

    static readonly COMELIT_AUTO_MODE = '2';

    private thermostatService: Service;

    constructor(log: Function, device: ThermostatDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.THERMOSTAT);
    }

    protected initServices(): Service[] {
        const accessoryInformation = this.initAccessoryInformation();

        this.thermostatService = new HomebridgeAPI.hap.Service.Thermostat(this.device.descrizione, null);
        const isAuto: boolean = this.device.auto_man === Thermostat.COMELIT_AUTO_MODE;
        this.log(`Thermostat auto mode is ${isAuto}`);
        const heatingCollingState = this.device.est_inv === '0' ? CurrentHeatingCoolingState.COOL : CurrentHeatingCoolingState.HEAT;
        this.thermostatService.setCharacteristic(Characteristic.CurrentHeatingCoolingState, heatingCollingState);
        this.thermostatService.setCharacteristic(Characteristic.TargetHeatingCoolingState, isAuto ? TargetHeatingCoolingState.AUTO : heatingCollingState);
        const temperature = this.device.temperatura ? parseFloat(this.device.temperatura) / 10 : 0;
        this.log(`Temperature for ${this.name} is ${temperature}`);
        this.thermostatService.setCharacteristic(Characteristic.CurrentTemperature, temperature);
        const targetTemperature = this.device.soglia_attiva ? parseFloat(this.device.soglia_attiva) / 10 : 0;
        this.log(`Threshold for ${this.name} is ${targetTemperature}`);
        this.thermostatService.setCharacteristic(Characteristic.TargetTemperature, targetTemperature);
        this.thermostatService.setCharacteristic(Characteristic.TemperatureDisplayUnits, TemperatureDisplayUnits.CELSIUS);

        this.thermostatService.addCharacteristic(Characteristic.CurrentRelativeHumidity);
        this.thermostatService.getCharacteristic(Characteristic.CurrentRelativeHumidity).setValue(this.device.umidita);

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

        this.thermostatService
            .getCharacteristic(Characteristic.TargetHeaterCoolerState)
            .on(CharacteristicEventTypes.SET, async (state: number, callback: VoidCallback) => {
                try {
                    await this.client.setTemperature(this.device.id, temperature);
                    this.device.temperatura = `${temperature * 10}`;
                    callback()
                } catch (e) {
                    callback(e);
                }
            });
        return [accessoryInformation, this.thermostatService];
    }

    public update(data: ThermostatDeviceData) {
        this.device = data;
    }
}