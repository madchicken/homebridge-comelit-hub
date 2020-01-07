import {ComelitAccessory} from "./comelit";
import {ComelitClient, ThermostatDeviceData} from "../comelit-client";
import {Categories, Characteristic, CharacteristicEventTypes, Service} from "hap-nodejs";

export class Thermostat extends ComelitAccessory<ThermostatDeviceData> {
    static readonly OFF = 0;
    static readonly HEAT = 1;
    static readonly COOL = 2;
    static readonly CELSIUS = 0;

    private thermostatService: Service;

    constructor(log: Function, device: ThermostatDeviceData, name: string, client: ComelitClient) {
        super(log, device, name, client, Categories.THERMOSTAT);
    }

    protected initServices(): Service[] {
        const accessoryInformation = this.initAccessoryInformation();

        this.thermostatService = new Service.Thermostat(this.device.descrizione, null);
        this.thermostatService.setCharacteristic(Characteristic.CurrentHeatingCoolingState, this.device.est_inv === '0' ? Thermostat.COOL : Thermostat.HEAT);
        this.thermostatService.setCharacteristic(Characteristic.TargetHeatingCoolingState, this.device.est_inv === '0' ? Thermostat.COOL : Thermostat.HEAT);
        const temperature = this.device.temperatura ? parseFloat(this.device.temperatura) / 10 : 0;
        this.log(`Temperature for ${this.name} is ${temperature}`);
        this.thermostatService.setCharacteristic(Characteristic.CurrentTemperature, temperature);
        const targetTemperature = this.device.soglia_attiva ? parseFloat(this.device.soglia_attiva) / 10 : 0;
        this.log(`Threshold for ${this.name} is ${targetTemperature}`);
        this.thermostatService.setCharacteristic(Characteristic.TargetTemperature, targetTemperature);
        this.thermostatService.setCharacteristic(Characteristic.TemperatureDisplayUnits, Thermostat.CELSIUS);

        this.thermostatService.addCharacteristic(Characteristic.CurrentRelativeHumidity);
        this.thermostatService.getCharacteristic(Characteristic.CurrentRelativeHumidity).setValue(this.device.umidita);

        this.thermostatService
            .getCharacteristic(Characteristic.TargetTemperature)
            .on(CharacteristicEventTypes.SET, async (temperature: number, callback: Function) => {
                await this.client.setTemperature(this.device.id, temperature);
                this.device.temperatura = `${temperature * 10}`;
                callback()
            });
        return [accessoryInformation, this.thermostatService];
    }

    protected update(data: ThermostatDeviceData) {
        this.device = data;
    }
}