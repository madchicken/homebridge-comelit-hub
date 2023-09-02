[![npm version](https://badge.fury.io/js/homebridge-comelit-platform.svg)](https://badge.fury.io/js/homebridge-comelit-platform)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

![Homebridge](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/homebridge.png)

# Comelit HUB integration for Homebridge

![Comelit](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/comelit.png)

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
- Irrigation

Missing devices:

- RGB lights
- Dimmerable lights

## Configuration

To configure Comelit platform you need to provide some information in the configuration.
Add the following section to the platform array in the Homebridge config.json file:

```json
{
  "platform": "Comelit",
  "name": "Comelit",
  "username": "YOUR_USERNAME",
  "password": "YOUR_PASSWORD"
}
```

By default, username and password are both set to `admin`.
You can also provide the `broker_url` as config parameter, that is the HUB IP address on your network,
or leave it empty and let the plugin auto discover the HUB for you.

## Find the broker URL

If you don't know the IP of the HUB on your local network, you can use the comelit CLI. After installing this plugin,
just type:

    comelit scan

You should get an output like this:

    Executing command scan
    server listening 0.0.0.0:55546
    Found hardware IcoM MAC XXXXXXXXXXXX, app Mngr version 3.0.1, system id ViP_, IcoM -  at IP [X.X.X.X]
    Found hardware D407 MAC XXXXXXXXXXXX, app HSrv version 1.2.0, system id ViP_, Home server - Comelit Hub 1 at IP [X.X.X.X]

The IP you are looking for is the `app HSrv` one.

## VEDO alarm support

VEDO alarm supported has been moved to a separate plugin: https://github.com/madchicken/homebridge-comelit-vedo

## Advanced configuration

The plugin offers some extra configuration flag. Here is the list

- broker_url: string - IP of your HUB (optional)
- blind_closing_time: number - number of seconds your blinds take to go from fully open to fully closed (default 35)
- keep_alive?: number - number of seconds for the MQTT keep alive message
- avoid_duplicates: boolean - set this to true to avoid mapping different devices with the same name (it will append a numeric postfix to the name)
- hide_lights: boolean - true to hide lights to HomeKit
- hide_blinds: boolean - true to hide blinds to HomeKit
- hide_thermostats: boolean - true to hide thermostats to HomeKit
- hide_dehumidifiers: boolean - true to hide dehumidifiers to HomeKit
- hide_power_suppliers: boolean - true to hide power suppliers (aka "Controllo Carichi") to HomeKit
- hide_outlets: boolean - true to hide outlets to HomeKit
- hide_others: boolean - true to hide so called "other devices" to HomeKit
- hide_irrigation: boolean - true to hide sprinklers to HomeKit

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

## Compiling from source

This plugin uses `yarn`, so you need to install it before starting (see https://yarnpkg.com for instructions).
Once you have it, just run

```
yarn && yarn build
```

inside the project folder.

## Contribute

Any help on this project is really welcome, so if you have some programming skill, and you want to improve
the current implementation, fork the repo and open your PR!
If otherwise, you simply enjoyed using this plugin, and you want to contribute in some way, you can always donate something!

## Screenshots

![Home application screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/home.png)

![Grafana screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/grafana.png)
