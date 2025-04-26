import { PlatformAccessory } from 'homebridge';
import { Service } from 'hap-nodejs';

export interface FakegatoEntry {
  time: number;
  power: number;
}

export interface FakegatoHistoryService extends Service {
  addEntry(config: FakegatoEntry);
}

export interface FakegatoService {
  new (type: string, plugin: PlatformAccessory, config: any): FakegatoHistoryService;
}

export enum SupportedTypes {
  garage_door = 'garage_door',
  door = 'door',
  lock = 'lock',
}

export interface DoorDeviceConfig {
  name: string;
  type: SupportedTypes;
  opening_time: number;
  closing_time: number;
  opened_time: number;
}
