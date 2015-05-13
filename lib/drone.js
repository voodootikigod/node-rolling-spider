/* global Buffer */
/*jslint node: true*/
'use strict';


var noble = require('noble');
var debug = require('debug')('rollingspider');
var EventEmitter = require('events').EventEmitter;
var util = require('util');



/**
 * Constructs a new RollingSpider
 *
 * @param {Object} options to construct the drone with:
 *  - {String} uuid to connect to. If this is omitted then it will connect to the first device starting with 'RS_' as the local name.
 *  - logger function to call if/when errors occur. If omitted then uses console#log
 * @constructor
 */
var Drone = function (options) {
  EventEmitter.call(this);

  var uuid = (typeof options === 'string' ? options : undefined);
  options = options || {};

  this.uuid = null;
  this.targets = uuid || options.uuid;

  if (this.targets && !util.isArray(this.targets))  {
    this.targets = this.targets.split(',');
  }

  this.logger = options.logger || debug;    //use debug instead of console.log
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
    flying: false,
    battery: 100
  };
};


util.inherits(Drone, EventEmitter);


// create client helper function to match ar-drone
Drone.createClient = function (options) {
  this.logger('RollingSpider#createClient');
  return new Drone(options);
};

/**
 * Connects to the drone over BLE
 *
 * @param callback to be called once connected
 * @todo Make the callback be called with an error if encountered
 */
Drone.prototype.connect = function (callback) {
  this.logger('RollingSpider#connect');
  if (this.targets) {
    this.logger('RollingSpider finding: '+this.targets.join(', '));
  }
  this.ble.on('discover', function (peripheral) {
    this.logger('RollingSpider.on(discover)');
    this.logger(peripheral);
    var connectedRun = false;
    var onConnected = function (error) {
      if (connectedRun) {
        return;
      } else {
        connectedRun = true;
      }
      if (error) {
        if (callback) {
          callback(error);
        }
      } else {
        this.logger('Connected to: ' + peripheral.advertisement.localName);
        this.ble.stopScanning();
        this.connected = true;
        this.setup(callback);
      }

    }.bind(this);

    this.logger(peripheral.advertisement.localName);
    this.logger(this.targets.indexOf(peripheral.uuid));
    this.logger(this.targets.indexOf(peripheral.advertisement.localName));
    if (!this.discovered) {
      if (this.targets && (this.targets.indexOf(peripheral.uuid) >= 0 || this.targets.indexOf(peripheral.advertisement.localName) >= 0)) {
        this.logger('Exact match found: ' + peripheral.advertisement.localName + ' <' + peripheral.uuid + '>');
        this.peripheral = peripheral;
        this.discovered = true;
        this.uuid = peripheral.uuid;
        this.name = peripheral.advertisement.localName;
        this.peripheral.connect(onConnected);
      } else if ((typeof this.targets) === 'undefined' &&
        peripheral.advertisement.localName &&
        peripheral.advertisement.localName.indexOf('RS_') === 0) {
        //found a rolling spider
        this.logger('Fuzzy match found: ' + peripheral.advertisement.localName + ' <' + peripheral.uuid + '>');
        this.discovered = true;
        this.uuid = peripheral.uuid;
        this.name = peripheral.advertisement.localName;
        this.peripheral = peripheral;
        this.peripheral.connect(onConnected);
      }
    }

  }.bind(this));

  if (this.forceConnect || this.ble.state === 'poweredOn') {
    this.logger('RollingSpider.forceConnect');
    this.ble.startScanning();
  } else {
    this.logger('RollingSpider.on(stateChange)');
    this.ble.on('stateChange', function (state) {
      if (state === 'poweredOn') {
        this.logger('RollingSpider#poweredOn');
        this.ble.startScanning();
      } else {
        this.logger('stateChange == '+state);
        this.ble.stopScanning();
        if (callback) {
          callback(new Error('Error with Bluetooth Adapter, please retry'));
        }
      }
    }.bind(this));
  }
};

/**
 * Sets up the connection to the drone and enumerate all of the services and characteristics.
 *
 *
 * @param callback to be called once set up
 * @private
 */
Drone.prototype.setup = function (callback) {
  this.logger('RollingSpider#setup');
  this.peripheral.discoverAllServicesAndCharacteristics(function (error, services, characteristics) {
    if (error) {
      if (callback) {
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
Drone.prototype.handshake = function (callback) {
  this.logger('RollingSpider#handshake');
  ['fb0f', 'fb0e', 'fb1b', 'fb1c', 'fd22', 'fd23', 'fd24', 'fd52', 'fd53', 'fd54'].forEach(function (key) {
    this.getCharacteristic(key).notify(true);
  }.bind(this));

  // Register listener for battery notifications.
  this.getCharacteristic('fb0f').on('data', function (data, isNotification) {
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
  this.getCharacteristic('fb0e').on('data', function (data, isNotification) {
    if (!isNotification || !data[6]) {return;}

    if (data[6] === 5) {
      this.status.flying = false;
    }
  }.bind(this));


  setTimeout(function () {
    this.getCharacteristic('fa0b').write(
      new Buffer([0x04, ++this.steps.fa0b, 0x00, 0x04, 0x01, 0x00, 0x32, 0x30, 0x31, 0x34, 0x2D, 0x31, 0x30, 0x2D, 0x32, 0x38, 0x00]),
      true,
      function (error) {
        setTimeout(function () {
          if (callback) {
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
Drone.prototype.getCharacteristic = function (unique_uuid_segment) {
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
Drone.prototype.writeTo = function (unique_uuid_segment, buffer) {
  this.getCharacteristic(unique_uuid_segment).write(buffer, true);
};


/**
 * 'Disconnects' from the drone
 *
 * @param callback to be called once disconnected
 */
Drone.prototype.disconnect = function (callback) {
  this.logger('RollingSpider#disconnect');

  if (this.connected) {
    clearInterval(this.ping);
    this.peripheral.disconnect(function (error) {
      this.logger('Disconnected from drone: ' + this.name);
      this.connected = false;
      this.discovered = false;
      if (callback) {
        callback(error);
      }
    }.bind(this));
  } else {
    if (callback)  {
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
Drone.prototype.startPing = function () {
  this.logger('RollingSpider#startPing');

  this.ping = setInterval(function () {
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

    if (this.driveStepsRemaining > 1) {
      this.driveStepsRemaining--;
    } else {
      // reset to hover states
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
Drone.prototype.signalStrength = function (callback) {
  this.logger('RollingSpider#signalStrength');
  if (this.connected) {
    this.peripheral.updateRssi(callback);
  } else {
    if (callback) {
      callback(new Error('Not connected to device'));
    }
  }
};




Drone.prototype.drive = function (tilt, forward, turn, up, steps) {
  this.logger('RollingSpider#drive');
  if (!this.driveStepsRemaining) {
    // only apply when not driving currently, this causes you to exactly move -- prevents fluid
    this.driveStepsRemaining = steps || 1;
    this.speeds.roll = tilt;
    this.speeds.pitch = forward;
    this.speeds.yaw = turn;
    this.speeds.altitude = up;
    // inject into ping flow.
  }
};


// Operational Functions
// Multiple use cases provided to support initial build API as well as
// NodeCopter API and parity with the ar-drone library.



/**
 * Instructs the drone to take off if it isn't already in the air
 *
 * @todo Make this detect when it's in the air and call a callback function
 */
function takeOff() {
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

}



/**
 * Configures the drone to fly in 'wheel on' or protected mode.
 *
 */

function wheelOn() {
  this.logger('RollingSpider#wheelOn');
  this.writeTo(
    'fa0b',
    new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x01, 0x02, 0x00, 0x01])
    );
}

/**
 * Configures the drone to fly in 'wheel off' or unprotected mode.
 *
 */
function wheelOff() {
  this.logger('RollingSpider#wheelOff');
  this.writeTo(
    'fa0b',
    new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x01, 0x02, 0x00, 0x00])
    );
}

/**
 * Instructs the drone to land if it's in the air
 *
 * @todo Make this detect when it's landed and call a callback function
 */

function land() {
  this.logger('RollingSpider#land');
  if (this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x00, 0x03, 0x00])
      );
  } else {
    this.logger('Calling RollingSpider#land when it\'s not in the air isn\'t going to do anything');
  }
  this.status.flying = false;
}

function toggle() {
  this.logger('RollingSpider#toggle');
  if (this.status.flying) {
    this.land();
  } else {
    this.takeOff();
  }
}

/**
 * Instructs the drone to do an emergency landing.
 */
function cutOff() {
  this.logger('RollingSpider#cutOff');
  this.writeTo(
    'fa0c',
    new Buffer([0x02, ++this.steps.fa0c & 0xFF, 0x02, 0x00, 0x04, 0x00])
    );
  this.status.flying = false;
  this.disconnect();
}

/**
 * Instructs the drone to trim. Make sure to call this before taking off.
 */
function flatTrim() {
  this.logger('RollingSpider#flatTrim');
  this.writeTo(
    'fa0b',
    new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x00, 0x00, 0x00])
    );
}



/**
 * Instructs the drone to do a front flip.
 *
 * It will only do this if it's in the air
 *
 */
function frontFlip() {
  this.logger('RollingSpider#frontFlip');
  if (this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
      );
  } else {
    this.logger('Calling RollingSpider#frontFlip when it\'s not in the air isn\'t going to do anything');
  }
}

/**
 * Instructs the drone to do a back flip.
 *
 * It will only do this if it's in the air
 *
 */
function backFlip() {
  this.logger('RollingSpider#backFlip');
  if (this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00])
      );
  } else {
    this.logger('Calling RollingSpider#backFlip when it\'s not in the air isn\'t going to do anything');
  }
}

/**
 * Instructs the drone to do a right flip.
 *
 * It will only do this if it's in the air
 *
 */
function rightFlip() {
  this.logger('RollingSpider#rightFlip');
  if (this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00])
      );
  } else {
    this.logger('Calling RollingSpider#rightFlip when it\'s not in the air isn\'t going to do anything');
  }
}

/**
 * Instructs the drone to do a left flip.
 *
 * It will only do this if it's in the air
 *
 */
function leftFlip() {
  this.logger('RollingSpider#leftFlip');
  if (this.status.flying) {
    this.writeTo(
      'fa0b',
      new Buffer([0x02, ++this.steps.fa0b & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00])
      );
  } else {
    this.logger('Calling RollingSpider#leftFlip when it\'s not in the air isn\'t going to do anything');
  }
}

/**
 * Instructs the drone to start moving upward at speed
 *
 * @param {float} speed at which the drive should occur
 * @param {float} steps the length of steps (time) the drive should happen
 */
function up(options) {
  this.logger('RollingSpider#up');
  if (this.status.flying) {
    options = options || {};
    var speed = options.speed || 50;
    var steps = options.steps || 50;
    if (!validSpeed(speed)) {
      this.logger('RollingSpider#up was called with an invalid speed: ' + speed);
    } else {
      this.drive(0, 0, 0, speed, steps);
    }
  } else {
    this.logger('RollingSpider#up when when it\'s not in the air isn\'t going to do anything');
  }

}

/**
 * Instructs the drone to start moving downward at speed
 *
 * @param {float} speed at which the drive should occur
 * @param {float} steps the length of steps (time) the drive should happen
 */

function down(options) {
  this.logger('RollingSpider#down');
  if (this.status.flying) {
    options = options || {};
    var speed = options.speed || 50;
    var steps = options.steps || 50;
    if (!validSpeed(speed)) {
      this.logger('RollingSpider#down was called with an invalid speed: ' + speed);
    } else {
      this.drive(0, 0, 0, speed * -1, steps);
    }
  } else {
    this.logger('RollingSpider#down when when it\'s not in the air isn\'t going to do anything');
  }

}
/**
 * Instructs the drone to start moving forward at speed
 *
 * @param {float} speed at which the drive should occur. 0-100 values.
 * @param {float} steps the length of steps (time) the drive should happen
 */
function forward(options) {
  this.logger('RollingSpider#forward');
  if (this.status.flying) {
    options = options || {};
    var speed = options.speed || 50;
    var steps = options.steps || 50;
    if (!validSpeed(speed)) {
      this.logger('RollingSpider#forward was called with an invalid speed: ' + speed);
    } else {
      this.drive(0, speed, 0, 0, steps);
    }
  } else {
    this.logger('RollingSpider#forward when it\'s not in the air isn\'t going to do anything');
  }

}

/**
 * Instructs the drone to start moving backward at speed
 *
 * @param {float} speed at which the drive should occur
 * @param {float} steps the length of steps (time) the drive should happen
 */
function backward(options) {
  this.logger('RollingSpider#backward');
  if (this.status.flying) {
    options = options || {};
    var speed = options.speed || 50;
    var steps = options.steps || 50;
    if (!validSpeed(speed)) {
      this.logger('RollingSpider#backward was called with an invalid speed: ' + speed);
    } else {
      this.drive(0, speed * -1, 0, 0, steps);
    }
  } else {
    this.logger('RollingSpider#up when it\'s not in the air isn\'t going to do anything');
  }

}


/**
 * Instructs the drone to start spinning clockwise at speed
 *
 * @param {float} speed at which the rotation should occur
 * @param {float} steps the length of steps (time) the turning should happen
 */

function turnRight(options) {
  this.logger('RollingSpider#turnRight');
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;
  if (!validSpeed(speed)) {
    this.logger('RollingSpider#turnRight was called with an invalid speed: ' + speed);
  } else {
    this.drive(0, 0, speed, 0, steps);
  }
}

/**
 * Instructs the drone to start spinning counter-clockwise at speed
 *
 * @param {float} speed at which the rotation should occur
 * @param {float} steps the length of steps (time) the turning should happen
 */
function turnLeft(options) {
  this.logger('RollingSpider#turnLeft');
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;
  if (!validSpeed(speed)) {
    this.logger('RollingSpider#turnLeft was called with an invalid speed: ' + speed);
  } else {
    this.drive(0, 0, speed * -1, 0, steps);
  }
}


/**
 * Instructs the drone to start moving right at speed
 *
 * @param {float} speed at which the rotation should occur
 * @param {float} steps the length of steps (time) the turning should happen
 */
function tiltRight(options) {
  this.logger('RollingSpider#tiltRight');
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;
  if (!validSpeed(speed)) {
    this.logger('RollingSpider#tiltRight was called with an invalid speed: ' + speed);
  } else {

    this.drive(speed, 0, 0, 0, steps);
  }
}


/**
 * Instructs the drone to start moving left at speed
 *
 * @param {float} speed at which the rotation should occur
 * @param {float} steps the length of steps (time) the turning should happen
 */
function tiltLeft(options) {
  this.logger('RollingSpider#tiltLeft');
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  if (!validSpeed(speed)) {
    this.logger('RollingSpider#tiltLeft was called with an invalid speed: ' + speed);
  } else {
    this.drive(speed * -1, 0, 0, 0, steps);
  }
}

function hover() {
  this.logger('RollingSpider#hover');
  this.speeds.roll = 0;
  this.speeds.pitch = 0;
  this.speeds.yaw = 0;
  this.speeds.altitude = 0;
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


module.exports = Drone;

