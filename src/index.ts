import { ComelitPlatform } from './comelit-platform';
import { API, Formats, Perms, Units, PlatformAccessory, Characteristic, Service } from 'homebridge';
import fakegato from 'fakegato-history';
import { FakegatoService } from './types';

interface ExtraHAPTypes {
  Service: typeof Service;
  Characteristic: typeof Characteristic;
  PlatformAccessory: typeof PlatformAccessory;
  CurrentPowerConsumption: any;
  TotalConsumption: any;
  FakeGatoHistoryService: FakegatoService;
}

export let HomebridgeAPI: API;
export const HAP: ExtraHAPTypes = {
  Service: null,
  Characteristic: null,
  PlatformAccessory: null,
  CurrentPowerConsumption: null,
  TotalConsumption: null,
  FakeGatoHistoryService: null,
};

export default function(homebridge: API) {
  HomebridgeAPI = homebridge;
  HAP.Service = homebridge.hap.Service;
  HAP.Characteristic = homebridge.hap.Characteristic;
  HAP.PlatformAccessory = homebridge.platformAccessory;
  HAP.FakeGatoHistoryService = fakegato(homebridge);

  HAP.CurrentPowerConsumption = class CurrentPowerConsumption extends HAP.Characteristic {
    public static readonly UUID: string = 'E863F10D-079E-48FF-8F27-9C2605A29F52';

    constructor() {
      super('CurrentConsumption', CurrentPowerConsumption.UUID, {
        format: Formats.UINT16,
        unit: 'watts' as Units, // ??
        maxValue: 100000,
        minValue: 0,
        minStep: 1,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      });
    }
  };

  HAP.TotalConsumption = class TotalConsumption extends HAP.Characteristic {
    public static readonly UUID: string = 'E863F10C-079E-48FF-8F27-9C2605A29F52';

    constructor() {
      super('TotalConsumption', TotalConsumption.UUID, {
        format: Formats.FLOAT,
        unit: 'kWh' as Units, // ??
        minValue: 0,
        minStep: 0.001,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      });
    }
  };

  homebridge.registerPlatform('Comelit', ComelitPlatform);
}
