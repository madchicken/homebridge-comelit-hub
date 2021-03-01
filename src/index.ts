import { ComelitPlatform } from './comelit-platform';
import { API, Formats, Perms, Units, PlatformAccessory } from 'homebridge';
import { Service, Characteristic } from 'hap-nodejs';
import fakegato from 'fakegato-history';
import { FakegatoService } from './types';

interface ExtraHAPTypes {
  Service: typeof Service;
  Characteristic: typeof Characteristic;
  PlatformAccessory: typeof PlatformAccessory;
  CurrentPowerConsumption: typeof CurrentPowerConsumption;
  TotalConsumption: typeof TotalConsumption;
  PowerMeterService: typeof PowerMeterService;
  FakeGatoHistoryService: FakegatoService;
}

export let HomebridgeAPI: API;
export const HAP: ExtraHAPTypes = {
  Service: null,
  Characteristic: null,
  PlatformAccessory: null,
  CurrentPowerConsumption: null,
  TotalConsumption: null,
  PowerMeterService: null,
  FakeGatoHistoryService: null,
};

export class CurrentPowerConsumption extends Characteristic {
  public static readonly UUID: string = 'C6A07A7E-ECD2-426B-89D7-E8664CF782C1';

  constructor() {
    super('Current power consumption', CurrentPowerConsumption.UUID, {
      format: Formats.UINT16,
      unit: 'watts' as Units, // ??
      maxValue: 100000,
      minValue: 0,
      minStep: 1,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY],
    });
  }
}
HAP.CurrentPowerConsumption = CurrentPowerConsumption;

class TotalConsumption extends Characteristic {
  public static readonly UUID: string = 'E863F10C-079E-48FF-8F27-9C2605A29F52';

  constructor() {
    super('Total power consumption', TotalConsumption.UUID, {
      format: Formats.FLOAT,
      unit: 'kWh' as Units, // ??
      minValue: 0,
      minStep: 0.001,
      perms: [Perms.PAIRED_READ, Perms.NOTIFY],
    });
  }
}
HAP.TotalConsumption = TotalConsumption;

class PowerMeterService extends Service {
  public static readonly UUID: string = 'D9C50529-BC9A-4324-8E79-E17C85FCAC62';

  public UUID: string;
  constructor(displayName?: string, subtype?: string) {
    super(displayName, PowerMeterService.UUID, subtype);
    this.addCharacteristic(HAP.CurrentPowerConsumption);
    // this.addCharacteristic(HAP.TotalConsumption);
  }
}
HAP.PowerMeterService = PowerMeterService;

export default function(homebridge: API) {
  HomebridgeAPI = homebridge;
  HAP.Service = homebridge.hap.Service;
  HAP.Characteristic = homebridge.hap.Characteristic;
  HAP.PlatformAccessory = homebridge.platformAccessory;
  HAP.FakeGatoHistoryService = fakegato(homebridge);

  homebridge.registerPlatform('Comelit', ComelitPlatform);
}
