'use strict';

var noble = require('noble');

var RollingSpider = function (uuid) {

  this.uuid = uuid;

  this.ble = noble;

  this.steps = {};

  this.takenOff = false;

  this.speeds = {

    //turn
    yaw: 0,

    //forwards/backwards
    pitch: 0,

    //left/right
    roll: 0,

    //up/down
    altitude: 0

  };

};

RollingSpider.prototype.connect = function (callback) {

  this.ble.on('discover', function (peripheral) {

    var onConnected = function (error) {

      this.ble.stopScanning();

      this.setup(callback);

    }.bind(this);

    if (peripheral.uuid === this.uuid) {

      this.peripheral = peripheral;
      this.peripheral.connect(onConnected);

    } else if ((typeof this.uuid) === 'undefined' &&
      peripheral.advertisement.localName &&
      peripheral.advertisement.localName.indexOf('RS_') === 0) {
      //found a rolling spider

      this.peripheral = peripheral;
      this.peripheral.connect(onConnected);
    }

  }.bind(this));

  this.ble.startScanning();
};

RollingSpider.prototype.setup = function (callback) {

  this.peripheral.discoverAllServicesAndCharacteristics(function (error, services, characteristics) {
    this.services = services;
    this.characteristics = characteristics;
    this.handshake(function () {
      this.startDrive(callback);
    }.bind(this));
  }.bind(this));

};

RollingSpider.prototype.handshake = function (callback) {

  this.getCharacteristic('fb0f').notify(true);
  this.getCharacteristic('fb0e').notify(true);
  this.getCharacteristic('fb1b').notify(true);
  this.getCharacteristic('fb1c').notify(true);
  this.getCharacteristic('fd22').notify(true);
  this.getCharacteristic('fd23').notify(true);
  this.getCharacteristic('fd24').notify(true);
  this.getCharacteristic('fd52').notify(true);
  this.getCharacteristic('fd53').notify(true);
  this.getCharacteristic('fd54').notify(true);

  setTimeout(function () {
    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.getCharacteristic('fa0b').write(
      new Buffer([0x04, this.steps['fa0a'], 0x00, 0x04, 0x01, 0x00, 0x32, 0x30, 0x31, 0x34, 0x2D, 0x31, 0x30, 0x2D, 0x32, 0x38, 0x00]),
      true,
      function (error) {
        setTimeout(function () {
          callback();
        }, 100);
      }
    );

  }.bind(this), 100);

};

RollingSpider.prototype.getCharacteristic = function (unique_uuid_segment) {

  var filtered = this.characteristics.filter(function (c) {
    return c.uuid.search(new RegExp(unique_uuid_segment)) !== -1;
  });

  return filtered[0];

};

RollingSpider.prototype.writeTo = function (unique_uuid_segment, buffer) {
  this.getCharacteristic(unique_uuid_segment).write(buffer, true);
};

RollingSpider.prototype.startDrive = function (callback) {

  setInterval(function () {

    if (this.takenOff) {

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
      buffer.writeInt16LE(this.speeds.roll, 7);
      buffer.writeInt16LE(this.speeds.pitch, 8);
      buffer.writeInt16LE(this.speeds.yaw, 9);
      buffer.writeInt16LE(this.speeds.altitude, 10);
      buffer.writeFloatLE(0, 11);

      this.writeTo('fa0a', buffer);

    }

  }.bind(this), 50);

  callback();

};

RollingSpider.prototype.takeOff = function () {

  if (!this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x00, 0x01, 0x00])
    );

  }

  this.takenOff = true;
};

RollingSpider.prototype.land = function () {

  if (this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x00, 0x03, 0x00])
    );

  }

  this.takenOff = false;

};

RollingSpider.prototype.emergencyLand = function () {

  this.steps['fa0c'] = (this.steps['fa0c'] || 0) + 1;

  this.writeTo(
    'fa0c',
    new Buffer([0x02, this.steps['fa0c'] & 0xFF, 0x02, 0x00, 0x04, 0x00])
  );

  this.takenOff = false;
};

RollingSpider.prototype.trim = function () {

  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
    'fa0b',
    new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x00, 0x00, 0x00])
  );

};

RollingSpider.prototype.frontFlip = function () {

  if (this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    );

  }

};

RollingSpider.prototype.backFlip = function () {

  if (this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01])
    );

  }

};

RollingSpider.prototype.rightFlip = function () {

  if (this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02])
    );

  }

};

RollingSpider.prototype.leftFlip = function () {

  if (this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03])
    );

  }

};

function validSpeed(speed) {

  return (0 <= speed && speed <= 100);

}

RollingSpider.prototype.clockwise = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.yaw = speed;
  }

};

RollingSpider.prototype.counterClockwise = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.yaw = 0 - speed;
  }

};

RollingSpider.prototype.forward = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.pitch = speed;
  }

};

RollingSpider.prototype.backward = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.pitch = 0 - speed;
  }

};

RollingSpider.prototype.left = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.roll = 0 - speed;
  }

};

RollingSpider.prototype.right = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.roll = speed;
  }

};

RollingSpider.prototype.up = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.altitude = speed;
  }

};

RollingSpider.prototype.down = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.altitude = 0 - speed;
  }

};

module.exports = RollingSpider;
