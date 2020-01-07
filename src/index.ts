import {Homebridge} from "./types";
import {ComelitPlatform} from "./comelit-platform";

export let HomebridgeAPI: Homebridge;

export default function (homebridge: Homebridge) {
    HomebridgeAPI = homebridge;
    homebridge.registerPlatform("homebridge-comelit-hub", "Comelit", ComelitPlatform, true);
}
