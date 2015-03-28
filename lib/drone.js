'use strict';

var noble = require('noble');
var debug = require('debug');

var Drone = function(uuid) {
  this.uuid = uuid;
  this.connected = false;
  this.ble = noble;
  this.steps = {};
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

    if (peripheral.uuid === this.uuid) {
      this.peripheral = peripheral;
      this.peripheral.connect(onConnected);
    } else if ((typeof this.uuid) === 'undefined' &&
      peripheral.advertisement.localName &&
      peripheral.advertisement.localName.indexOf('RS_') === 0) {
      console.log('Found a rolling spider');
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

    this.writeTo(
        'fa0a',
        new Buffer([0x02,this.steps['fa0a'],0x02,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00])
        );
  }.bind(this), 50);
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
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x01,0x00,0x00,0x00])
      );
}

function rightFlip() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x02,0x00,0x00,0x00])
      );
}

function leftFlip() {
  this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

  this.writeTo(
      'fa0b',
      new Buffer([0x02,this.steps['fa0b'] & 0xFF,0x02,0x04,0x00,0x00,0x03,0x00,0x00,0x00])
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
