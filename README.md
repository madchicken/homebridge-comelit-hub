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

## Prometheus Metrics
This plugin exports some Prometheus metric to allow you to monitor your house. If you have a Prometheus instance running
with a Grafana UI, you can display useful information about your house domotic usage. All exported metrics have `comelit_` prefix.
The default port for the `/metrics` exporter is `3002` but can be configured by adding a `exporter_http_port` config value in 
the `config.json` file.
To enable metrics, specify `export_prometheus_metrics: true` in the platform config. 

## Screenshots
![Home application screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/home.png)

![Grafana screenshot](https://github.com/madchicken/homebridge-comelit-hub/raw/master/images/grafana.png)
