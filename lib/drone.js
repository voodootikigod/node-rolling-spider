/* global Buffer */

'use strict';


var noble = require('noble');
var debug = require('debug')('rollingspider');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var _ = require('lodash');



/**
 * Constructs a new RollingSpider
 *
 * @param {Object} options to construct the drone with:
 *  - {String} uuid to connect to. If this is omitted then it will connect to the first device starting with 'RS_' as the local name.
 *  - logger function to call if/when errors occur. If omitted then uses console#log
 * @constructor
 */
var Drone = function(options) {
  EventEmitter.call(this);

  var uuid = (typeof options === 'string' ? options : undefined);
  options = options || {};

  this.uuid = null;
  this.targets = uuid || options.uuid;

  if (this.targets && !util.isArray(this.targets)) {
    this.targets = this.targets.split(',');
  }

  this.logger = options.logger || debug; //use debug instead of console.log
  this.forceConnect = options.forceConnect || false;
  this.connected = false;
  this.discovered = false;
  this.ble = noble;
  this.peripheral = null;
  this.takenOff = false;

  this.driveStepsRemaining = 0;
  this.speeds = {
    yaw: 0, // turn
    pitch: 0, // forward/backward
    roll: 0, // left/right
    altitude: 0 // up/down
  };

  /**
   * Used to store the 'counter' that's sent to each characteristic
   */
  this.steps = {
    'fa0a': 0,
    'fa0b': 0,
    'fa0c': 0
  };

  this.status = {
    stateValue: 0,
    flying: false,
    battery: 100
  };


  // handle disconnect gracefully
  this.ble.on('warning', function(message) {
    this.onDisconnect();
  }.bind(this));
};


util.inherits(Drone, EventEmitter);

/**
 * Drone.isDronePeripheral
 *
 * Accepts a BLE peripheral object record and returns true|false
 * if that record represents a Rolling Spider Drone or not.
 *
 * @param  {Object}  peripheral A BLE peripheral record
 * @return {Boolean}
 */
Drone.isDronePeripheral = function(peripheral) {
  if (!peripheral) {
    return false;
  }

  var localName = peripheral.advertisement.localName;
  var manufacturer = peripheral.advertisement.manufacturerData;

  var acceptedNames = [
    'RS_',
    'Mars_',
    'Travis_',
    'Maclan_',
    'Mambo_',
    'Blaze_',
    'Swat_'
  ];
  var acceptedManufacturers = [
    '4300cf1900090100',
    '4300cf1909090100',
    '4300cf1907090100'
  ];

  var localNameMatch = localName
    && (acceptedNames.findIndex(function(name) { return localName.startsWith(name); }) >= 0);

  var manufacturerMatch = manufacturer
    && (acceptedManufacturers.indexOf(manufacturer.toString('hex')) >= 0);

  // Is true for EITHER a valid name prefix OR manufacturer code.
  return localNameMatch || manufacturerMatch;
};


// create client helper function to match ar-drone
Drone.createClient = function(options) {
  return new Drone(options);
};

/**
 * Connects to the drone over BLE
 *
 * @param callback to be called once connected
 * @todo Make the callback be called with an error if encountered
 */
Drone.prototype.connect = function(callback) {
  this.logger('RollingSpider#connect');
  if (this.targets) {
    this.logger('RollingSpider finding: ' + this.targets.join(', '));
  }

  this.ble.on('discover', function(peripheral) {
    this.logger('RollingSpider.on(discover)');
    this.logger(peripheral);

    var isFound = false;
    var connectedRun = false;
    var matchType = 'Fuzzy';

    // Peripheral specific
    var localName = peripheral.advertisement.localName;
    var uuid = peripheral.uuid;

    // Is this peripheral a Parrot Rolling Spider?
    var isDrone = Drone.isDronePeripheral(peripheral);

    var onConnected = function(error) {
      if (connectedRun) {
        return;
      } else {
        connectedRun = true;
      }
      if (error) {
        if (typeof callback === 'function') {
          callback(error);
        }
      } else {
        this.logger('Connected to: ' + localName);
        this.ble.stopScanning();
        this.connected = true;
        this.setup(callback);
      }
    }.bind(this);

    this.logger(localName);

    if (this.targets) {
      this.logger(this.targets.indexOf(uuid));
      this.logger(this.targets.indexOf(localName));
    }

    if (!this.discovered) {

      if (this.targets &&
        (this.targets.indexOf(uuid) >= 0 || this.targets.indexOf(localName) >= 0)) {
        matchType = 'Exact';
        isFound = true;
      } else if ((typeof this.targets === 'undefined' || this.targets.length === 0) && isDrone) {
        isFound = true;
      }

      if (isFound) {
        this.logger(matchType + ' match found: ' + localName + ' <' + uuid + '>');
        this.connectPeripheral(peripheral, onConnected);
      }
    }
  }.bind(this));

  if (this.forceConnect || this.ble.state === 'poweredOn') {
    this.logger('RollingSpider.forceConnect');
    this.ble.startScanning();
  } else {
    this.logger('RollingSpider.on(stateChange)');
    this.ble.on('stateChange', function(state) {
      if (state === 'poweredOn') {
        this.logger('RollingSpider#poweredOn');
        this.ble.startScanning();
      } else {
        this.logger('stateChange == ' + state);
        this.ble.stopScanning();
        if (typeof callback === 'function') {
          callback(new Error('Error with Bluetooth Adapter, please retry'));
        }
      }
    }.bind(this));
  }
};


Drone.prototype.connectPeripheral = function(peripheral, onConnected) {
  this.discovered = true;
  this.uuid = peripheral.uuid;
  this.name = peripheral.advertisement.localName;
  this.peripheral = peripheral;
  this.ble.stopScanning();
  this.peripheral.connect(onConnected);
  this.peripheral.on('disconnect', function() {
    this.onDisconnect();
  }.bind(this));
};

/**
 * Sets up the connection to the drone and enumerate all of the services and characteristics.
 *
 *
 * @param callback to be called once set up
 * @private
 */
Drone.prototype.setup = function(callback) {
  this.logger('RollingSpider#setup');
  this.peripheral.discoverAllServicesAndCharacteristics(function(error, services, characteristics) {
    if (error) {
      if (typeof callback === 'function') {
        callback(error);
      }
    } else {
      this.services = services;
      this.characteristics = characteristics;

      this.handshake(callback);
    }
  }.bind(this));
};

/**
 * Performs necessary handshake to initiate communication with the device. Also configures all notification handlers.
 *
 *
 * @param callback to be called once set up
 * @private
 */
Drone.prototype.handshake = function(callback) {
  this.logger('RollingSpider#handshake');
  ['fb0f', 'fb0e', 'fb1b', 'fb1c', 'fd22', 'fd23', 'fd24', 'fd52', 'fd53', 'fd54'].forEach(function(key) {
    var characteristic = this.getCharacteristic(key);
    characteristic.notify(true);
  }.bind(this));

  // Register listener for battery notifications.
  this.getCharacteristic('fb0f').on('data', function(data, isNotification) {
    if (!isNotification) {
      return;
    }
    this.status.battery = data[data.length - 1];
    this.emit('battery');
    this.logger('Battery level: ' + this.status.battery + '%');
  }.bind(this));

  /**
   * Flying statuses:
   *
   * 0: Landed
   * 1: Taking off
   * 2: Hovering
   * 3: ??
   * 4: Landing
   * 5: Emergency / Cut out
   */
  this.getCharacteristic('fb0e').on('data', function(data, isNotification) {
    if (!isNotification) {
      return;
    }
    if (data[2] !== 2) {
      return;
    }


    var prevState = this.status.flying,
      prevFlyingStatus = this.status.stateValue;

    this.logger('Flying status: ' + data[6]);
    if ([1, 2, 3, 4].indexOf(data[6]) >= 0) {
      this.status.flying = true;
    }

    this.status.stateValue = data[6];

    if (prevState !== this.status.flying) {
      this.emit('stateChange');
    }

    if (prevFlyingStatus !== this.status.stateValue) {
      this.emit('flyingStatusChange', this.status.stateValue);
    }

  }.bind(this));


  setTimeout(function() {

    this.writeTo(
      'fa0b',
      new Buffer([0x04, ++this.steps.fa0b, 0x00, 0x04, 0x01, 0x00, 0x32, 0x30, 0x31, 0x34, 0x2D, 0x31, 0x30, 0x2D, 0x32, 0x38, 0x00]),
      function(error) {
        setTimeout(function() {
          if (typeof callback === 'function') {
            callback(error);
          }
        }, 100);
      }
    );
  }.bind(this), 100);
};



/**
 * Gets a Characteristic by it's unique_uuid_segment
 *
 * @param {String} unique_uuid_segment
 * @returns Characteristic
 */
Drone.prototype.getCharacteristic = function(unique_uuid_segment) {
  var filtered = this.characteristics.filter(function(c) {
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
Drone.prototype.writeTo = function(unique_uuid_segment, buffer, callback) {
  if (!this.characteristics) {
    var e = new Error('You must have bluetooth enabled and be connected to a drone before executing a command. Please ensure Bluetooth is enabled on your machine and you are connected.');
    if (callback) {
      callback(e);
    } else {
      throw e;
    }
  } else {
    if (typeof callback === 'function') {
      this.getCharacteristic(unique_uuid_segment).write(buffer, true, callback);
    } else {
      this.getCharacteristic(unique_uuid_segment).write(buffer, true);
    }
  }
};

Drone.prototype.onDisconnect = function() {
  if (this.connected) {
    this.logger('Disconnected from drone: ' + this.name);
    if (this.ping) {
      clearInterval(this.ping);
    }
    this.ble.removeAllListeners();
    this.connected = false;
    this.discovered = false;
    //
    //  CSW - Removed because we do not know if the device is flying or not, so leave state as is.
    //  var prevState = this.status.flying;
    //  this.status.flying = false;
    //  if (prevState !== this.status.flying) {
    //    this.emit('stateChange');
    //  }
    //  this.status.stateValue = 0;
    //
    this.emit('disconnected');
  }
};

/**
 * 'Disconnects' from the drone
 *
 * @param callback to be called once disconnected
 */
Drone.prototype.disconnect = function(callback) {
  this.logger('RollingSpider#disconnect');

  if (this.connected) {
    this.peripheral.disconnect(function(error) {
      this.onDisconnect();
      if (typeof callback === 'function') {
        callback(error);
      }
    }.bind(this));
  } else {
    if (typeof callback === 'function') {
      callback();
    }
  }
};


/**
 * Starts sending the current speed values to the drone every 50 milliseconds
 *
 * This is only sent when the drone is in the air
 *
 * @param callback to be called once the ping is started
 */
Drone.prototype.startPing = function() {
  this.logger('RollingSpider#startPing');

  this.ping = setInterval(function() {
    var buffer = new Buffer(19);
    buffer.fill(0);
    buffer.writeInt16LE(2, 0);
    buffer.writeInt16LE(++this.steps.fa0a, 1);
    buffer.writeInt16LE(2, 2);
    buffer.writeInt16LE(0, 3);
    buffer.writeInt16LE(2, 4);
    buffer.writeInt16LE(0, 5);
    buffer.writeInt16LE((this.driveStepsRemaining ? 1 : 0), 6);

    buffer.writeInt16LE(this.speeds.roll, 7);
    buffer.writeInt16LE(this.speeds.pitch, 8);
    buffer.writeInt16LE(this.speeds.yaw, 9);
    buffer.writeInt16LE(this.speeds.altitude, 10);
    buffer.writeFloatLE(0, 11);

    this.writeTo('fa0a', buffer);
    if (this.driveStepsRemaining < 0) {
      // go on the last command blindly

    } else if (this.driveStepsRemaining > 1) {
      // decrement the drive chain
      this.driveStepsRemaining--;
    } else {
      // reset to hover states
      this.emit('driveComplete', this.speeds);
      this.driveStepsRemaining = 0;
      this.hover();
    }

  }.bind(this), 50);
};





/**
 * Obtains the signal strength of the connected drone as a dBm metric.
 *
 * @param callback to be called once the signal strength has been identified
 */
Drone.prototype.signalStrength = function(callback) {
  this.logger('RollingSpider#signalStrength');
  if (this.connected) {
    this.peripheral.updateRssi(callback);
  } else {
    if (typeof callback === 'function') {
      callback(new Error('Not connected to device'));
    }
  }
};

Drone.prototype.drive = function(parameters, steps) {
  this.logger('RollingSpider#drive');
  this.logger('driveStepsRemaining', this.driveStepsRemaining);
  var params = parameters || {};
  if (!this.driveStepsRemaining || steps < 0) {
    this.logger('setting state');
    // only apply when not driving currently, this causes you to exactly move -- prevents fluid
    this.driveStepsRemaining = steps || 1;
    this.speeds.roll = params.tilt || 0;
    this.speeds.pitch = params.forward || 0;
    this.speeds.yaw = params.turn || 0;
    this.speeds.altitude = params.up || 0;

    this.logger(this.speeds);
  // inject into ping flow.
  }
};

// Operational Functions
// Multiple use cases provided to support initial build API as well as
// NodeCopter API and parity with the ar-drone library.



/**
 * Instructs the drone to take off if it isn't already in the air
 */
function takeOff(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#takeOff');

  if (this.status.battery < 10) {
    this.logger('!!! BATTERY LEVEL TOO LOW !!!');
  }
  if (!this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x00, 0x01, 0x00])
    );
    this.status.flying = true;
  }

  this.on('flyingStatusChange', function(newStatus) {
    if (newStatus === 2) {
      if (typeof callback === 'function') {
        callback();
      }
    }
  });

}



/**
 * Configures the drone to fly in 'wheel on' or protected mode.
 *
 */

function wheelOn(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#wheelOn');
  this.writeTo(
    'fa0b',
    new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x01, 0x02, 0x00, 0x01])
  );

  if (callback) {
    callback();
  }
}

/**
 * Configures the drone to fly in 'wheel off' or unprotected mode.
 *
 */
function wheelOff(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#wheelOff');
  this.writeTo(
    'fa0b',
    new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x01, 0x02, 0x00, 0x00])
  );
  if (callback) {
    callback();
  }
}

/**
 * Instructs the drone to land if it's in the air.
 */

function land(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#land');
  if (this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x00, 0x03, 0x00])
    );

    this.on('flyingStatusChange', function(newStatus) {
      if (newStatus === 0) {
        this.status.flying = false;
        if (typeof callback === 'function') {
          callback();
        }
      }
    });

  } else {
    this.logger('Calling RollingSpider#land when it\'s not in the air isn\'t going to do anything');
    if (callback) {
      callback();
    }
  }
}


function toggle(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#toggle');
  if (this.status.flying) {
    this.land(options, callback);
  } else {
    this.takeOff(options, callback);
  }
}

/**
 * Instructs the drone to do an emergency landing.
 */
function cutOff(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#cutOff');
  this.status.flying = false;
  this.writeTo(
    'fa0c',
    new Buffer([0x02, ++this.steps.fa0c & 0xFF, 0x02, 0x00, 0x04, 0x00])
    , callback);
}

/**
 * Instructs the drone to trim. Make sure to call this before taking off.
 */
function flatTrim(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#flatTrim');
  this.writeTo(
    'fa0b',
    new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x00, 0x00, 0x00]),
    callback
  );
}



/**
 * Instructs the drone to do a front flip.
 *
 * It will only do this if it's in the air
 *
 */

function frontFlip(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#frontFlip');
  if (this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      callback
    );
  } else {
    this.logger('Calling RollingSpider#frontFlip when it\'s not in the air isn\'t going to do anything');
    if (typeof callback === 'function') {
      callback();
    }
  }
  if (callback) {
    callback();
  }
}

/**
 * Instructs the drone to do a back flip.
 *
 * It will only do this if it's in the air
 *
 */

function backFlip(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#backFlip');
  if (this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]),
      callback
    );
  } else {
    this.logger('Calling RollingSpider#backFlip when it\'s not in the air isn\'t going to do anything');
    if (typeof callback === 'function') {
      callback();
    }
  }
  if (callback) {
    callback();
  }
}

/**
 * Instructs the drone to do a right flip.
 *
 * It will only do this if it's in the air
 *
 */
function rightFlip(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#rightFlip');
  if (this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]),
      callback
    );
  } else {
    this.logger('Calling RollingSpider#rightFlip when it\'s not in the air isn\'t going to do anything');
    if (typeof callback === 'function') {
      callback();
    }
  }

  if (callback) {
    callback();
  }
}

/**
 * Instructs the drone to do a left flip.
 *
 * It will only do this if it's in the air
 *
 */

function leftFlip(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  this.logger('RollingSpider#leftFlip');
  if (this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00]),
      callback
    );
  } else {
    this.logger('Calling RollingSpider#leftFlip when it\'s not in the air isn\'t going to do anything');
    if (typeof callback === 'function') {
      callback();
    }
  }
  if (callback) {
    callback();
  }
}

function driveBuilder(parameters) {
  var name = parameters.name,
    parameterToChange = parameters.parameterToChange,
    scaleFactor = parameters.scaleFactor;

  scaleFactor = scaleFactor || 1;

  return function(possibleOptions, possibleCallback) {
    var options, callback;
    if (_.isPlainObject(possibleOptions)) {
      options = possibleOptions;
      callback = _.isFunction(possibleCallback) ? possibleCallback : _.noop;
    } else if (_.isFunction(possibleOptions)) {
      callback = possibleOptions;
    } else {
      callback = _.noop;
    }

    this.logger('RollingSpider#' + name);
    if (this.status.flying) {
      options = options || {};
      var speed = options.speed || 50;
      var steps = options.steps || 50;
      if (!validSpeed(speed)) {
        this.logger('RollingSpider#' + name + 'was called with an invalid speed: ' + speed);
        callback();
      } else {
        var driveParams = {};
        driveParams[parameterToChange] = speed * scaleFactor;
        this.drive(driveParams, steps);
        this.once('driveComplete', callback);
      }
    } else {
      this.logger('RollingSpider#' + name + ' when it\'s not in the air isn\'t going to do anything');
      callback();
    }
  };

}

/**
 * Instructs the drone to start moving upward at speed
 *
 * @param {float} speed at which the drive should occur
 * @param {float} steps the length of steps (time) the drive should happen
 */
var up = driveBuilder({
  name: 'up',
  parameterToChange: 'up'
});

/**
 * Instructs the drone to start moving downward at speed
 *
 * @param {float} speed at which the drive should occur
 * @param {float} steps the length of steps (time) the drive should happen
 */
var down = driveBuilder({
  name: 'down',
  parameterToChange: 'up',
  scaleFactor: -1
});

/**
 * Instructs the drone to start moving forward at speed
 *
 * @param {float} speed at which the drive should occur. 0-100 values.
 * @param {float} steps the length of steps (time) the drive should happen
 */
var forward = driveBuilder({
  name: 'forward',
  parameterToChange: 'forward'
});


/**
 * Instructs the drone to start moving backward at speed
 *
 * @param {float} speed at which the drive should occur
 * @param {float} steps the length of steps (time) the drive should happen
 */
var backward = driveBuilder({
  name: 'backward',
  parameterToChange: 'forward',
  scaleFactor: -1
});


/**
 * Instructs the drone to start spinning clockwise at speed
 *
 * @param {float} speed at which the rotation should occur
 * @param {float} steps the length of steps (time) the turning should happen
 */
var turnRight = driveBuilder({
  name: 'turnRight',
  parameterToChange: 'turn'
});

/**
 * Instructs the drone to start spinning counter-clockwise at speed
 *
 * @param {float} speed at which the rotation should occur
 * @param {float} steps the length of steps (time) the turning should happen
 */
var turnLeft = driveBuilder({
  name: 'turnLeft',
  parameterToChange: 'turn',
  scaleFactor: -1
});


/**
 * Instructs the drone to start moving right at speed
 *
 * @param {float} speed at which the rotation should occur
 * @param {float} steps the length of steps (time) the turning should happen
 */
var tiltRight = driveBuilder({
  name: 'tiltRight',
  parameterToChange: 'tilt'
});


/**
 * Instructs the drone to start moving left at speed
 *
 * @param {float} speed at which the rotation should occur
 * @param {float} steps the length of steps (time) the turning should happen
 */
var tiltLeft = driveBuilder({
  name: 'tiltLeft',
  parameterToChange: 'tilt',
  scaleFactor: -1
});

function hover(options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  //this.logger('RollingSpider#hover');
  this.driveStepsRemaining = 0;
  this.speeds.roll = 0;
  this.speeds.pitch = 0;
  this.speeds.yaw = 0;
  this.speeds.altitude = 0;
  if (callback) {
    callback();
  }
}


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
* Gets the Bluetooth name of the drone
* @returns {string}
*/
function getDroneName()  {
  return this.peripheral.advertisement.localName;
}


// provide options for use case
Drone.prototype.takeoff = takeOff;
Drone.prototype.takeOff = takeOff;
Drone.prototype.wheelOff = wheelOff;
Drone.prototype.wheelOn = wheelOn;
Drone.prototype.land = land;
Drone.prototype.toggle = toggle;
Drone.prototype.emergency = cutOff;
Drone.prototype.emergancy = cutOff;
Drone.prototype.flatTrim = flatTrim;
Drone.prototype.calibrate = flatTrim;
Drone.prototype.up = up;
Drone.prototype.down = down;
// animation
Drone.prototype.frontFlip = frontFlip;
Drone.prototype.backFlip = backFlip;
Drone.prototype.rightFlip = rightFlip;
Drone.prototype.leftFlip = leftFlip;

// rotational
Drone.prototype.turnRight = turnRight;
Drone.prototype.clockwise = turnRight;
Drone.prototype.turnLeft = turnLeft;
Drone.prototype.counterClockwise = turnLeft;

// directional
Drone.prototype.forward = forward;
Drone.prototype.backward = backward;
Drone.prototype.tiltRight = tiltRight;
Drone.prototype.tiltLeft = tiltLeft;
Drone.prototype.right = tiltRight;
Drone.prototype.left = tiltLeft;

Drone.prototype.hover = hover;
Drone.prototype.getDroneName = getDroneName;

module.exports = Drone;
