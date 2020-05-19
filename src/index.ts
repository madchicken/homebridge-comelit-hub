import { ComelitPlatform } from './comelit-platform';
import { API } from 'homebridge';

export let HomebridgeAPI: API;

export default function(homebridge: API) {
  HomebridgeAPI = homebridge;
  homebridge.registerPlatform('Comelit', ComelitPlatform);
}
