import { PlatformAccessory } from 'homebridge';

export interface FakeGato {
  [k: string]: any;
}
export interface FakeGatoCtor {
  new (type: string, plugin: PlatformAccessory, config: any): FakeGato;
}
