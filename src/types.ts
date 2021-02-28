import { PlatformAccessory } from 'homebridge';

export interface FakegatoEntry {
  time: number;
  power: number;
}

export interface FakegatoHistory {
  addEntry(config: FakegatoEntry);
}

export interface Fakegato {
  new (type: string, plugin: PlatformAccessory, config: any): FakegatoHistory;
}
