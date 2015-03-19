'use strict';

var noble = require('noble');

/**
 * Constructs a new RollingSpider
 *
 * @param {Object} options to construct the drone with:
 *  - {String} uuid to connect to. If this is omitted then it wil connect to the first device starting with 'RS_'
 *  - logger function to call if/when errors occur. If omitted then uses console#log
 * @constructor
 */
var RollingSpider = function (options) {

  options = options || {};

  this.uuid = options.uuid;

  this.logger = options.logger || console.log;

  this.ble = noble;

  /**
   * Used to store the 'counter' that's sent to each characteristic
   */
  this.steps = {
    'fa0a': 0,
    'fa0b': 0,
    'fa0c': 0
  };

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

/**
 * Connects to the drone over BLE
 *
 * @param callback to be called once connected
 * @todo Make the callback be called with an error if encountered
 */
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

      this.logger("Found " + peripheral.advertisement.localName + " (" + peripheral.uuid + ")");

      this.peripheral = peripheral;
      this.peripheral.connect(onConnected);
    }

  }.bind(this));

  this.ble.startScanning();
};

/**
 * 'Disconnects' from the drone
 *
 * @todo Make sure this actually disconnects the device
 * @param callback to be called once disconnected
 */
RollingSpider.prototype.disconnect = function (callback) {

  /*
   * At the moment this is the only thing I think it needs to do
   */
  clearInterval(this.ping);
  clearInterval(this.drive);

  callback();

};

/**
 * Sets up the connection to the drone
 *
 * @todo Make the callback be called with an error if encountered
 *
 * @param callback to be called once set up
 * @private
 */
RollingSpider.prototype.setup = function (callback) {

  this.peripheral.discoverAllServicesAndCharacteristics(function (error, services, characteristics) {

    this.services = services;
    this.characteristics = characteristics;

    /*
     * @todo find out what this is doing
     */
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

      /*
       * @todo why is this incrementing fa0b but writing fa0a?
       */
      this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

      this.getCharacteristic('fa0b').write(
        new Buffer([0x04, this.steps['fa0a'], 0x00, 0x04, 0x01, 0x00, 0x32, 0x30, 0x31, 0x34, 0x2D, 0x31, 0x30, 0x2D, 0x32, 0x38, 0x00]),
        true,
        /*
         * @todo Make this be returned?
         */
        function (error) {
          setTimeout(function () {

            this.startDrive(callback);

          }.bind(this), 100);
        }.bind(this));
    }.bind(this), 100);
  }.bind(this));

};

/**
 * Gets a Characteristic by it's unique_uuid_segment
 *
 * @param {String} unique_uuid_segment
 * @returns Characteristic
 */
RollingSpider.prototype.getCharacteristic = function (unique_uuid_segment) {

  var filtered = this.characteristics.filter(function (c) {
    return c.uuid.search(new RegExp(unique_uuid_segment)) !== -1;
  });

  return filtered[0];

};

/**
 * Writes a Buffer to a Characteristic by it's unique_uuid_segment
 *
 * @param {String} unique_uuid_segment
 * @param {Buffer} buffer
 */
RollingSpider.prototype.writeTo = function (unique_uuid_segment, buffer) {
  this.getCharacteristic(unique_uuid_segment).write(buffer, true);
};

/**
 * Starts sending the current speed values to the drone every 50 milliseconds
 *
 * This is only sent when the drone is in the air
 *
 * @param callback to be called once the ping is started
 */
RollingSpider.prototype.startDrive = function (callback) {

  this.drive = setInterval(function () {

    this.steps['fa0a'] = (this.steps['fa0a'] || 0) + 1;

    var buffer = new Buffer(19);

    buffer.fill(0);
    buffer.writeInt16LE(2, 0);
    buffer.writeInt16LE(this.steps['fa0a'], 1);
    buffer.writeInt16LE(2, 2);
    buffer.writeInt16LE(0, 3);
    buffer.writeInt16LE(2, 4);
    buffer.writeInt16LE(0, 5);

    if (this.takenOff) {

      buffer.writeInt16LE(1, 6);
      buffer.writeInt16LE(this.speeds.roll, 7);
      buffer.writeInt16LE(this.speeds.pitch, 8);
      buffer.writeInt16LE(this.speeds.yaw, 9);
      buffer.writeInt16LE(this.speeds.altitude, 10);

    } else {

      buffer.writeInt16LE(0, 6);
      buffer.writeInt16LE(0, 7);
      buffer.writeInt16LE(0, 8);
      buffer.writeInt16LE(0, 9);
      buffer.writeInt16LE(0, 10);

    }

    buffer.writeFloatLE(0, 11);

    this.writeTo('fa0a', buffer);

  }.bind(this), 50);

  callback();

};

/**
 * Instructs the drone to take off if it isn't already in the air
 *
 * @todo Make this detect when it's in the air and call a callback function
 */
RollingSpider.prototype.takeOff = function () {

  if (!this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x00, 0x01, 0x00])
    );

  } else {

    this.logger("Calling RollingSpider#takeOff when it's in the air isn't going to do anything");

  }

  this.takenOff = true;
};

/**
 * Instructs the drone to land if it's in the air
 *
 * @todo Make this detect when it's landed and call a callback function
 */
RollingSpider.prototype.land = function () {

  if (this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x00, 0x03, 0x00])
    );

  } else {

    this.logger("Calling RollingSpider#land when it's not in the air isn't going to do anything");

  }

  this.takenOff = false;

};

/**
 * Instructs the drone to do an emergency landing.
 */
RollingSpider.prototype.emergencyLand = function () {

  this.steps['fa0c'] = (this.steps['fa0c'] || 0) + 1;

  this.writeTo(
    'fa0c',
    new Buffer([0x02, this.steps['fa0c'] & 0xFF, 0x02, 0x00, 0x04, 0x00])
  );

  this.takenOff = false;
};

/**
 * Instructs the drone to trim. Make sure to call this before taking off.
 */
RollingSpider.prototype.trim = function () {

  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
    'fa0b',
    new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x00, 0x00, 0x00])
  );

};

/**
 * Instructs the drone to do a front flip.
 *
 * It will only do this if it's in the air
 *
 */
RollingSpider.prototype.frontFlip = function () {

  if (this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    );

  } else {

    this.logger("Calling RollingSpider#frontFlip when it's not in the air isn't going to do anything");

  }

};

/**
 * Instructs the drone to do a back flip.
 *
 * It will only do this if it's in the air
 *
 */
RollingSpider.prototype.backFlip = function () {

  if (this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01])
    );

  } else {

    this.logger("Calling RollingSpider#backFlip when it's not in the air isn't going to do anything");

  }

};

/**
 * Instructs the drone to do a right flip.
 *
 * It will only do this if it's in the air.
 *
 * Please only call this function if you haven't got the wheels on!
 *
 */
RollingSpider.prototype.rightFlip = function () {

  if (this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02])
    );

  } else {

    this.logger("Calling RollingSpider#rightFlip when it's not in the air isn't going to do anything");

  }

};

/**
 * Instructs the drone to do a left flip.
 *
 * It will only do this if it's in the air.
 *
 * Please only call this function if you haven't got the wheels on!
 *
 */
RollingSpider.prototype.leftFlip = function () {

  if (this.takenOff) {

    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.writeTo(
      'fa0b',
      new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03])
    );

  } else {

    this.logger("Calling RollingSpider#leftFlip when it's not in the air isn't going to do anything");

  }

};

/**
 * Checks whether a speed is valid or not
 *
 * @private
 * @param {float} speed
 * @returns {boolean}
 */
function validSpeed(speed) {

  return (0 <= speed && speed <= 100);

}

/**
 * Instructs the drone to start spinning clockwise at speed
 *
 * @param {float} speed
 */
RollingSpider.prototype.clockwise = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.yaw = speed;

  } else {

    this.logger("RollingSpider#clockwise was called with an invalid speed: ", speed);

  }

};

/**
 * Instructs the drone to start spinning counter clockwise at speed
 *
 * @param {float} speed
 */
RollingSpider.prototype.counterClockwise = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.yaw = 0 - speed;

  } else {

    this.logger("RollingSpider#counterClockwise was called with an invalid speed: ", speed);

  }

};

/**
 * Instructs the drone to start moving forwards at speed
 *
 * @param {float} speed
 */
RollingSpider.prototype.forward = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.pitch = speed;

  } else {

    this.logger("RollingSpider#forward was called with an invalid speed: ", speed);

  }

};

/**
 * Instructs the drone to start moving backwards at speed
 *
 * @param {float} speed
 */
RollingSpider.prototype.backward = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.pitch = 0 - speed;

  } else {

    this.logger("RollingSpider#backward was called with an invalid speed: ", speed);

  }


};

/**
 * Instructs the drone to start moving left at speed
 *
 * @param {float} speed
 */
RollingSpider.prototype.left = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.roll = 0 - speed;

  } else {

    this.logger("RollingSpider#left was called with an invalid speed: ", speed);

  }

};

/**
 * Instructs the drone to start moving right at speed
 *
 * @param {float} speed
 */
RollingSpider.prototype.right = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.roll = speed;

  } else {

    this.logger("RollingSpider#right was called with an invalid speed: ", speed);

  }

};

/**
 * Instructs the drone to start moving up at speed
 *
 * @param {float} speed
 */
RollingSpider.prototype.up = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.altitude = speed;

  } else {

    this.logger("RollingSpider#up was called with an invalid speed: ", speed);

  }

};

/**
 * Instructs the drone to start moving down at speed
 *
 * @param {float} speed
 */
RollingSpider.prototype.down = function (speed) {

  if (validSpeed(speed)) {

    speed = Math.round(speed);

    this.speeds.altitude = 0 - speed;

  } else {

    this.logger("RollingSpider#down was called with an invalid speed: ", speed);

  }

};

/**
 * Instructs the drone to hover
 */
RollingSpider.prototype.hover = function () {

  this.speeds.yaw = 0;
  this.speeds.altitude = 0;
  this.speeds.pitch = 0;
  this.speeds.roll = 0;

};

module.exports = RollingSpider;
