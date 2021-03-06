'use strict';

var NetatmoDevice = require("../lib/netatmo-device");

var homebridge;
var EveatmoRoomAccessory;
var EveatmoWeatherAccessory;
var EveatmoRainAccessory;
var EveatmoWindAccessory;

module.exports = function(pHomebridge) {
	if (pHomebridge && !homebridge) {
		homebridge = pHomebridge;
		EveatmoRoomAccessory = require("../accessory/eveatmo-room-accessory")(homebridge);
		EveatmoWeatherAccessory = require("../accessory/eveatmo-weather-accessory")(homebridge);
		EveatmoRainAccessory = require("../accessory/eveatmo-rain-accessory")(homebridge);
        EveatmoWindAccessory = require("../accessory/eveatmo-wind-accessory")(homebridge);
	}

	class WeatherstationDeviceType extends NetatmoDevice {
		constructor(log, api, config) {
			super(log, api, config);
			this.log.debug("Creating Weatherstation Devices");
			this.deviceType = "weatherstation";
		}

		loadDeviceData(callback) {
			this.api.getStationsData(function(err, devices) {
				var deviceMap = {};
				devices.forEach(function(device) {
					deviceMap[device._id] = device;

					if(this.config.module_suffix != "") {
						device._name =  device.module_name + " " + this.config.module_suffix;
					} else {
						device._name = device.station_name + " " + device.module_name;
					}

					if (device.modules) {
						device.modules.forEach(function(module) {
							if(this.config.module_suffix != "") {
								module._name = module.module_name + " " + this.config.module_suffix;
							} else {
								module._name = device.station_name + " " + module.module_name;
							}

							deviceMap[module._id] = module;
						}.bind(this));
					}
				}.bind(this));
				this.log.debug("Setting cache with key: "+this.deviceType);
				this.cache.set(this.deviceType, deviceMap);
				this.deviceData = deviceMap;
				
				if (this.accessories) {
					this.accessories.forEach(function(accessory) {
						accessory.notifyUpdate(this.deviceData);
					}.bind(this));
				}			
				callback(null, this.deviceData);
			}.bind(this));
		}

		buildAccessory(deviceData) {
			if(deviceData.type == 'NAMain') { // Basestation
				return new EveatmoRoomAccessory(deviceData, this);
			} else if(deviceData.type == 'NAModule4') { // Indoor
				return new EveatmoRoomAccessory(deviceData, this);
			} else if(deviceData.type == 'NAModule1') { // Outdoor
				return new EveatmoWeatherAccessory(deviceData, this);
			} else if(deviceData.type == 'NAModule3') { // Rain
				return new EveatmoRainAccessory(deviceData, this);
			} else if(deviceData.type == 'NAModule2') { // Wind
                return new EveatmoWindAccessory(deviceData, this);
            }
			return false;
		}
	}

	return WeatherstationDeviceType;

};
