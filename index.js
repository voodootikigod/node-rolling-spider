"use strict";

var Drone = function(uuid) {
  this.uuid = uuid;
  this.connected = false;
  this.ble = require("noble");
};

Drone.prototype.connect = function(callback) {
  this.ble.on("discover", function(peripheral) {
    if (peripheral.uuid === this.uuid) {
      this.peripheral = peripheral;
      this.peripheral.connect(function(error) {
        this.connected = true;
        this.ble.stopScanning();
        callback();
      }.bind(this));
    }
  }.bind(this));

  this.ble.startScanning();
};

Drone.prototype.setup = function(callback) {
  this.peripheral.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
    this.services = services;
    this.characteristics = characteristics;

    this.handshake(callback);
  }.bind(this));
};

Drone.prototype.handshake = function(callback) {
  this.getCharacteristic("fb0f").notify(true);
  this.getCharacteristic("fb0e").notify(true);
  this.getCharacteristic("fb1b").notify(true);
  this.getCharacteristic("fb1c").notify(true);
  this.getCharacteristic("fd23").notify(true);
  this.getCharacteristic("fd53").notify(true);

  setTimeout(function() {
    this.getCharacteristic("fa0b").write(
        new Buffer([0x04,0x01,0x00,0x04,0x01,0x00,0x32,0x30,0x31,0x34,0x2D,0x31,0x30,0x2D,0x32,0x38,0x00]),
        true,
        function(error) {
          setTimeout(function() {
            callback();
            // needs timing to get the sequencing right apparently...
          }, 100);
        }
        );
    // needs timing to get the sequencing right apparently...
  }.bind(this), 100);
};

Drone.prototype.getCharacteristic = function(unique_uuid_segment) {
  var filtered = this.characteristics.filter(function(c) {
    return c.uuid.search(new RegExp(unique_uuid_segment)) !== -1;
  });

  return filtered[0];
};

Drone.prototype.startPing = function() {
  setInterval(function() {
    this.getCharacteristic("fa0a").write(
        new Buffer([0x02,0x00,0x02,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]),
        true
        );
  }.bind(this), 50);
};

Drone.prototype.takeOff = function() {
  console.log("Take off");
  this.getCharacteristic("fa0b").write(
      new Buffer([0x02,0x05,0x02,0x00,0x01,0x00]),
      true
      );
};

Drone.prototype.land = function() {
  console.log("Land");
  this.getCharacteristic("fa0b").write(
      new Buffer([0x02,0x06,0x02,0x00,0x03,0x00]),
      true
      );
};

if (process.env.UUID) {
  var d = new Drone(process.env.UUID);
  d.connect(function() {
    d.setup(function() {
      d.startPing();
      d.takeOff();

      setTimeout(function() {
        d.land();
      }, 9000);
    });
  });
}
