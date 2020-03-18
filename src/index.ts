import { ComelitPlatform } from "./comelit-platform";
import { Homebridge } from "../types";

export let HomebridgeAPI: Homebridge;

export default function(homebridge: Homebridge) {
  HomebridgeAPI = homebridge;
  homebridge.registerPlatform(
    "homebridge-comelit-hub",
    "Comelit",
    ComelitPlatform,
    true
  );
}
