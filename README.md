[![npm version](https://badge.fury.io/js/homebridge-comelit-platform.svg)](https://badge.fury.io/js/homebridge-comelit-platform)

# Comelit HUB integration for Homebridge

This is an Homebridge platform plugin to expose Comelit Home Automation to Apple HomeKit and use it with Siri.
The code is based on the reverse engineering of the official protocol, so expect bugs.

Note: the supported model of the HUB is this one

https://pro.comelitgroup.com/product/20003150

The old Comelit Serial Bridge is _not_ supported by this plugin.

Currently supported devices:

- Simple lights
- Blinds
- Thermostats (summer/winter mode)
- Controlled plugs
- Vedo Alarm
- Dehumidifiers

Missing devices:

- RGB lights
- Dimmerable lights
- Irrigation

## Configuration

To configure Comelit platform you need to provide some information in the configuration.
Add the following section to the platform array in the Homebridge config.json file:

```json
{
  "platform": "Comelit",
  "name": "Comelit",
  "username": "YOUR_USERNAME",
  "password": "YOUR_PASSWORD",
  "broker_url": "mqtt://192.168.1.2"
}
```

By default username and password are both set to `admin`.
`broker_url` is the `mqtt://` + the IP/name of your HUB in the local network.

## Find the broker URL

If you don't know the IP of the HUB on your local network, you can use the comelit CLI. After installing this plugin,
just type:

    comelit scan

You should get an output like this:

    Executing command scan
    server listening 0.0.0.0:55546
    Found hardware IcoM MAC XXXXXXXXXXXX, app Mngr version 3.0.1, system id ViP_, IcoM -  at IP [X.X.X.X]
    Found hardware D407 MAC XXXXXXXXXXXX, app HSrv version 1.2.0, system id ViP_, Home server - Comelit Hub 1 at IP [X.X.X.X]

Hit CTRL+C to interrupt the scan command.
The IP you are looking for is the `Home server` one.

## VEDO alarm support

VEDO alarm supported has been moved to a separate plugin: https://github.com/madchicken/homebridge-comelit-vedo

## Advanced configuration

The plugin offers some extra configuration flag. Here is the list

- sentry_dsn: string - DSN for Sentry monitoring (see https://sentry.com)
- blind_closing_time: number - number of seconds your blinds take to go from fully open to fully closed (default 35)
- keep_alive?: number - number of seconds for the MQTT keep alive message
- avoid_duplicates?: boolean - set this to true to avoid mapping different devices with the same name (it will append a numeric postfix to the name)
- hide_lights?: boolean - true to hide lights to HomeKit
- hide_blinds?: boolean - true to hide blinds to HomeKit
- hide_thermostats?: boolean - true to hide thermostats to HomeKit
- hide_dehumidifiers?: boolean - true to hide dehumidifiers to HomeKit
- hide_power_suppliers?: boolean - true to hide power suppliers (aka "Controllo Carichi") to HomeKit
- hide_outlets?: boolean - true to hide outlets to HomeKit

**Note**: When hiding thermostats you will automatically exclude dehumidifiers

## Prometheus Metrics

This plugin exports some Prometheus metric to allow you to monitor your house. If you have a Prometheus instance running
with a Grafana UI, you can display useful information about your house domotic usage. All exported metrics have `comelit_` prefix.
The default port for the `/metrics` exporter is `3002` but can be configured by adding a `exporter_http_port` config value in
the `config.json` file.
To enable metrics, specify `export_prometheus_metrics: true` in the platform config.

```json
{
  "platform": "Comelit",
  "name": "My Home",
  "username": "YOUR_USERNAME",
  "password": "YOUR_PASSWORD",
  "broker_url": "mqtt://192.168.1.2",
  "export_prometheus_metrics": true,
  "exporter_http_port": 3002
}
```

## Version History

1.0.0 - Initial version
1.0.1 - Bug Fixes
1.0.2 - Bug Fixes
1.0.3 - Bug Fixes
1.0.4 - Shutter timing fixes
1.1.0 - VEDO alarm support and various fixes
1.2.0 - Switch to use external comelit-client dependency
2.0.0 - Major update to support Homebridge 1.1.0

## Screenshots

![Home application screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/home.png)

![Grafana screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/grafana.png)
