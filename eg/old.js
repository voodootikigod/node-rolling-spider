'use strict';

var noble = require('noble');
var util = require('util');

var connectedDrone;
var pingValue = 0;

var Drone = function(peripheral, services, characteristics) {
  this.peripheral = peripheral;
  this.services = services;
  this.characteristics = characteristics;
};

Drone.prototype.connect = function(cb) {
  console.log('connecting');

  this.findCharacteristic('fb0f').notify(true);
  this.findCharacteristic('fb0e').notify(true);
  this.findCharacteristic('fb1b').notify(true);
  this.findCharacteristic('fb1c').notify(true);
  this.findCharacteristic('fd23').notify(true);
  this.findCharacteristic('fd53').notify(true);

  var drone = this;
  setTimeout(function() {
    drone.findCharacteristic('fa0b').write(new Buffer([0x04,0x01,0x00,0x04,0x01,0x00,0x32,0x30,0x31,0x34,0x2D,0x31,0x30,0x2D,0x32,0x38,0x00]), true, function(error) {
      console.log('connected');
      if (error) { console.log('error connecting'); }

      // setInterval(function() {
      //   console.log("Ping: " + pingValue);
      //   drone.findCharacteristic("fa0a").write(new Buffer([0x02,pingValue,0x02,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]), true);
      //   pingValue++;
      // }, 500);

      setTimeout(function() {
        cb();
      }, 100);
    });
  }, 100);
};

Drone.prototype.takeOff = function() {
  console.log('Taking off... prepare for pain');

  this.findCharacteristic('fa0b').write(new Buffer([0x02,0x05,0x02,0x00,0x01,0x00]), true);
  var self = this;
  setTimeout(function() {
    self.findCharacteristic('fa0a').write(new Buffer([0x02,0x01,0x02,0x00,0x02,0x00,0x01,0x00,0x00,0x32,0x00,0x00]), true);
  }, 2000);
};

Drone.prototype.findCharacteristic = function(unique_uuid_segment) {
  var theChars = this.characteristics.filter(function(characteristic) {
    return characteristic.uuid.search(new RegExp(unique_uuid_segment)) != -1;
  });

  return theChars[0];
};

if (process.env.UUID) {
  console.log('Looking for device with UUID: ' + process.env.UUID);

  noble.startScanning();

  noble.on('discover', function(peripheral) {
    if (peripheral.uuid === process.env.UUID) {
      peripheral.connect();
      peripheral.on('connect', function(error) {
        if (error) { return; }

        peripheral.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
          if (error) { return; }

          connectedDrone = new Drone(peripheral, services, characteristics);
          connectedDrone.connect(function(error) {
            if (error) { console.log('Problem connecting'); }

            connectedDrone.takeOff();
          });
        });
      });
    }
  });
} else {
  console.log('No UUID specified');
}
