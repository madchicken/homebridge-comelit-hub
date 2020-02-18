# Comelit HUB integration for Homebridge

This is an Homebridge platform plugin to expose Comelit Home Automation to Apple HomeKit and use it with Siri.
The code is based on the reverse engineering of the official protocol, so expect bugs.

Note: the supported model of the HUB is this one 
    
    https://pro.comelitgroup.com/product/20003150

The old Comelit Serial Bridge is _not_ supported by this plugin.

Currently supported devices:

- Simple lights
- Blinds
- Thermostats
- Humidifiers/Dehumidifiers
- Controlled plugs

Missing devices:

- RGB lights
- Dimmerable lights
- Irrigation
- Vedo/VIP

## Configuration

To configure Comelit platform you need to provide some information in the configuration.
Add the following section to the platform array in the Homebridge config.json file:

```json
{
    "platform": "Comelit",
    "name": "My Home",
    "username": "YOUR_USERNAME",
    "password": "YOUR_PASSWORD",
    "broker_url": "mqtt://192.168.1.2"
}
```

By default username and password are both set to `admin`.
`broker_url` is the `mqtt://` + the IP/name of your HUB in the local network.

## Prometheus Metrics
This plugin exports some Prometheus metric to allow you to monitor your house. If you have a Prometheus instance running
with a Grafana UI, you can display useful information about your house domotic usage. All exported metrics have `comelit_` prefix.
The default port for the `/metrics` exporter is `3002` but can be configured by adding a `exporter_http_port` config value in 
the `config.json` file.
To enable metrics, specify `export_prometheus_metrics: true` in the platform config. 

## Screenshots
![Home application screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/home.png)

![Grafana screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/grafana.png)
