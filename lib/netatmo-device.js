'use strict';

const REFRESH_CHECK_RATE = 5 * 60 * 1000; // 5 minutes
const DEFAULT_CACHE_TTL = REFRESH_CHECK_RATE; // use config["ttl"] to override
const REFRESH_RUN_RATE = 20 * 1000; // 20 seconds

var NodeCache = require("node-cache");

class NetatmoDevice {
	constructor(log, api, config) {
		this.api = api;
		this.log = log;
		this.ttl = typeof config.ttl !== 'undefined' ? config.ttl : DEFAULT_CACHE_TTL;
		var refreshCheckRate = typeof config.refresh_check !== 'undefined' ? config.refresh_check : REFRESH_CHECK_RATE;
		var refreshRunRate = typeof config.refresh_run !== 'undefined' ? config.refresh_run : REFRESH_RUN_RATE;

		this.cache = new NodeCache({
			stdTTL: this.ttl
		});
		this.config = config;

		this.deviceData = null;
		this.accessories = [];
		this.refreshRequired = false;
		this.refreshCheckRunning = false;

		this.runCheckInterval = setInterval(function() {
			if (!this.refreshCheckRunning) {
				this.refreshCheckRunning = true;
				if (this.refreshRequired) {
					this.log.debug("Executing Timed Refresh");

					this.refreshRequired = false;
					this.refreshDeviceData(function(err, data) {
						if (this.accessories) {
							this.accessories.forEach(function(accessory) {
								accessory.notifyUpdate(data);
							}.bind(this));
						}
						this.refreshCheckRunning = false;
					}.bind(this));
				} else {
					this.refreshCheckRunning = false;
				}
			}
		}.bind(this), refreshRunRate);

		this.refreshDataInterval = setInterval(function() {
			this.refreshRequired = true;
		}.bind(this), refreshCheckRate);

	}

	buildAccessoriesForDevices(callback) {
		var accessories = [];
		this.refreshDeviceData(function(err, data) {
			if (!err) {
				this.buildAccessories(callback);
			} else {
				callback(err, accessories);
			}
		}.bind(this));
	}

	refreshDeviceData(callback) {
		this.log.debug("Refreshing data for netatmo " + this.deviceType);
		this.cache.get((this.deviceType), function(err, data) {
			if (!err) {
				if (data === undefined || data === null) {
					this.log("Loading new data from API for: " + this.deviceType);
					this.loadDeviceData(function(err, data) {
						callback(err, data);
					}.bind(this));
				} else {
					this.deviceData = data;
					callback(null, data);
				}
			} else {
				callback(err, this.deviceData);
			}
		}.bind(this));
	}

	forceRefresh() {
		this.cache.del(this.deviceType, function(err, count) {
			this.refreshRequired = true;
		}.bind(this));
	}

	loadDeviceData(callback) {
		this.deviceData = null;
		callback("The abstract method loadDeviceData should be overridden", null);
	}

	buildAccessories(callback) {
		Object.keys(this.deviceData).forEach(function(key) {

			// key is id! Should go into blacklist / whitelist !
			var keep = true;

			if (this.config.whitelist && this.config.whitelist.length > 0) {
				keep = (this.config.whitelist.indexOf(key) > -1);
			}
			if (this.config.blacklist && this.config.blacklist.length > 0) {
				keep = keep && (this.config.blacklist.indexOf(key) < 0);
			}

			if (keep) {
				var accessory = this.buildAccessory(this.deviceData[key]);
				if(accessory) {
					this.log.debug("Did build accessory " + accessory.name);
					this.accessories.push(accessory);	
				} else {
					this.log.debug("Skipped building accessory " + accessory.name);
				}
			}

		}.bind(this));
		callback(null, this.accessories);
	}

}

module.exports = NetatmoDevice;
