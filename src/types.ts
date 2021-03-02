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
