'use strict';

var noble = require('noble');

var Drone = function(uuid) {
  this.uuid = uuid;
  this.connected = false;
  this.ble = noble;
  this.steps = {};
};

Drone.prototype.connect = function(callback) {
  this.ble.on('discover', function(peripheral) {
    if (peripheral.uuid === this.uuid) {
      this.peripheral = peripheral;
      this.peripheral.connect(function(error) {
        this.connected = true;
        this.ble.stopScanning();
        callback();
      }.bind(this));
    } else if ((typeof this.uuid) === 'undefined') {

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
  this.getCharacteristic('fb0f').notify(true);
  this.getCharacteristic('fb0e').notify(true);
  this.getCharacteristic('fb1b').notify(true);
  this.getCharacteristic('fb1c').notify(true);
  this.getCharacteristic('fd23').notify(true);
  this.getCharacteristic('fd53').notify(true);

  setTimeout(function() {
    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.getCharacteristic('fa0b').write(
        new Buffer([0x04,this.steps['fa0a'],0x00,0x04,0x01,0x00,0x32,0x30,0x31,0x34,0x2D,0x31,0x30,0x2D,0x32,0x38,0x00]),
        true,
        function(error) {
          setTimeout(function() {
            callback();
          }, 100);
        }
        );
  }.bind(this), 100);
};

Drone.prototype.getCharacteristic = function(unique_uuid_segment) {
  var filtered = this.characteristics.filter(function(c) {
    return c.uuid.search(new RegExp(unique_uuid_segment)) !== -1;
  });

  return filtered[0];
};

Drone.prototype.writeTo = function(unique_uuid_segment, buffer) {
  this.getCharacteristic(unique_uuid_segment).write(buffer, true);
};

Drone.prototype.startPing = function() {
  setInterval(function() {
    this.steps['fa0a'] = (this.steps['fa0a'] || 0) + 1;

    this.writeTo(
        'fa0a',
        new Buffer([0x02,this.steps['fa0a'],0x02,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00])
        );
  }.bind(this), 50);
};

Drone.prototype.takeOff = function() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x00,0x01,0x00])
      );
};

Drone.prototype.land = function() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x00,0x03,0x00])
      );
};

Drone.prototype.emergency = function() {
  this.steps['fa0c'] = (this.steps['fa0c'] || 0) + 1;

  this.writeTo(
      'fa0c',
      new Buffer([0x02,this.steps['fa0c'] & 0xFF,0x02,0x00,0x04,0x00])
      );
};

Drone.prototype.flatTrim = function() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x00,0x00,0x00])
      );
};

Drone.prototype.frontFlip = function() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x00])
      );
};

Drone.prototype.backFlip = function() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x01])
      );
};

Drone.prototype.rightFlip = function() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x02])
      );
};

Drone.prototype.leftFlip = function() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x03])
      );
};

//
// tilt [-100:100]
// forward [-100:100]
// turn [-100:100]
// up [-100:100]
//
Drone.prototype.drive = function(tilt, forward, turn, up, steps) {
  for (var i=0; i < steps; i++) {
    this.steps['fa0a'] = (this.steps['fa0a'] || 0) + 1;

    var buffer = new Buffer(19);
    buffer.fill(0);
    buffer.writeInt16LE(2, 0);
    buffer.writeInt16LE(this.steps['fa0a'], 1);
    buffer.writeInt16LE(2, 2);
    buffer.writeInt16LE(0, 3);
    buffer.writeInt16LE(2, 4);
    buffer.writeInt16LE(0, 5);
    buffer.writeInt16LE(1, 6);
    buffer.writeInt16LE(tilt, 7);
    buffer.writeInt16LE(forward, 8);
    buffer.writeInt16LE(turn, 9);
    buffer.writeInt16LE(up, 10);
    buffer.writeFloatLE(0, 11);

    this.writeTo('fa0a', buffer);
  }
};

Drone.prototype.up = function(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, 0, speed, steps);
};

Drone.prototype.down = function(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, 0, speed * -1, steps);
};

Drone.prototype.forward = function(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, speed, 0, 0, steps);
};

Drone.prototype.backward = function(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, speed * -1, 0, 0, steps);
};

Drone.prototype.turnRight = function(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, speed, 0, steps);
};

Drone.prototype.turnLeft = function(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, speed * -1, 0, steps);
};

Drone.prototype.tiltRight = function(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(speed, 0, 0, 0, steps);
};

Drone.prototype.tiltLeft = function(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(speed * -1, 0, 0, 0, steps);
};

module.exports = Drone;
