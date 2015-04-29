
'use strict';


var noble = require('noble');
var debug = require('debug');

var Drone = function(uuid) {
  this.uuid = uuid;
  this.connected = false;
  this.ble = noble;
  this.steps = {};
  this.peripheral = null;

  this.driveStepsRemaining = 0;
  this.tilt = 0;
  this.horizontal = 0;
  this.turn = 0;
  this.lift = 0;
};

// create client helper function to match ar-drone
Drone.createClient = function (options) {
  return new Drone(options);
};


Drone.prototype.connect = function(callback) {
  this.ble.on('discover', function(peripheral) {

    var onConnected = function(error) {
      if (error) {
        console.error(error);
      }
      debug('Connected to: '+peripheral.advertisement.localName);
      this.connected = true;
      this.ble.stopScanning();
      callback();
    }.bind(this);

    if (this.uuid && (peripheral.uuid === this.uuid || peripheral.advertisement.localName === this.uuid)) {
      console.log("name match:", this.uuid);
      console.log("peri match:", peripheral.uuid);
      console.log("localname match:", peripheral.advertisement.localName);
      this.peripheral = peripheral;
      this.peripheral.connect(onConnected);
      this.uuid = peripheral.uuid;
      this.name = peripheral.advertisement.localName;
    } else if ((typeof this.uuid) === 'undefined' &&
      peripheral.advertisement.localName &&
      peripheral.advertisement.localName.indexOf('RS_') === 0) {
      console.log("fuzzy match");
      console.log(peripheral.advertisement.localName);
      this.uuid = peripheral.uuid;
      this.name = peripheral.advertisement.localName;
      //found a rolling spider
      this.peripheral = peripheral;
      this.peripheral.connect(onConnected);
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
  this.getCharacteristic('fd22').notify(true);
  this.getCharacteristic('fd23').notify(true);
  this.getCharacteristic('fd24').notify(true);
  this.getCharacteristic('fd52').notify(true);
  this.getCharacteristic('fd53').notify(true);
  this.getCharacteristic('fd54').notify(true);


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

    var buffer = new Buffer(19);
    buffer.fill(0);
    buffer.writeInt16LE(2, 0);
    buffer.writeInt16LE(this.steps['fa0a'], 1);
    buffer.writeInt16LE(2, 2);
    buffer.writeInt16LE(0, 3);
    buffer.writeInt16LE(2, 4);
    buffer.writeInt16LE(0, 5);
    buffer.writeInt16LE(( this.driveStepsRemaining ? 1 : 0 ), 6);

    buffer.writeInt16LE( this.tilt, 7);
    buffer.writeInt16LE( this.horizontal, 8);
    buffer.writeInt16LE( this.turn, 9);
    buffer.writeInt16LE( this.lift, 10);
    buffer.writeFloatLE(0, 11);

    this.writeTo('fa0a', buffer);
    if (this.driveStepsRemaining > 1) {
      this.driveStepsRemaining--;
    } else {
      // reset to hover states
      this.driveStepsRemaining = 0;
      this.tilt = 0;
      this.horizontal = 0;
      this.turn = 0;
      this.lift = 0;
    }
    // this.writeTo(
    //     'fa0a',
    //     new Buffer([0x02,this.steps['fa0a'],0x02,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00])
    //     );
  }.bind(this), 50);
};

Drone.prototype.signalStrength = function (callback) {
  if (this.connected) {
     this.peripheral.updateRssi(callback);
  } else {
    callback(new Error("Not connected to device"));
  }
}

//
// tilt [-100:100]
// forward [-100:100]
// turn [-100:100]
// up [-100:100]
//
Drone.prototype.drive = function(tilt, forward, turn, up, steps) {
  if (!this.driveStepsRemaining) {
    // only apply when not driving currently, this causes you to exactly move -- prevents fluid
    this.tilt= tilt;
    this.horizontal = forward;
    this.turn = turn;
    this.lift = up;
    this.driveStepsRemaining = steps;
    // inject into ping flow.
  }
};



// Operational Functions
// Multiple use cases provided to support initial build API as well as
// NodeCopter API and parity with the ar-drone library.

function takeOff() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;
  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x00,0x01,0x00])
      );
};

function land(){
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;
  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x00,0x03,0x00])
      );
}

function cutOff()  {
  this.steps['fa0c'] = (this.steps['fa0c'] || 0) + 1;
  this.writeTo(
      'fa0c',
      new Buffer([0x02,this.steps['fa0c'] & 0xFF,0x02,0x00,0x04,0x00])
      );
}

function flatTrim () {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;
  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x00,0x00,0x00])
      );
}

function frontFlip() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;
  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x00])
      );
}

function backFlip() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;
  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x01])
      );
}

function rightFlip() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x02])
      );
}

function leftFlip() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x03])
      );
}

function up(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, 0, speed, steps);
}

function down(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, 0, speed * -1, steps);
}
function forward(options) {
 options = options || {};
 var speed = options.speed || 50;
 var steps = options.steps || 50;

 this.drive(0, speed, 0, 0, steps);
}

function backward(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, speed * -1, 0, 0, steps);
}
function turnRight(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, speed, 0, steps);
}


function turnLeft(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, speed * -1, 0, steps);
}

function tiltRight(options) {
 options = options || {};
 var speed = options.speed || 50;
 var steps = options.steps || 50;

 this.drive(speed, 0, 0, 0, steps);
}


function tiltLeft(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(speed * -1, 0, 0, 0, steps);
}

// provide options for use case
Drone.prototype.takeoff = takeOff;
Drone.prototype.takeOff = takeOff;
Drone.prototype.land = land;
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


module.exports = Drone;
