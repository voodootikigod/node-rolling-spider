/* global Buffer */
/*jslint node: true */
'use strict';


var noble = require('noble');
var debug = require('debug');
var EventEmitter = require('events');
var util = require('util');


var Drone = function (uuid) {
    EventEmitter.call(this);
    this.uuid = uuid;
    this.connected = false;
    this.ble = noble;
    this.peripheral = null;

    this.driveStepsRemaining = 0;
    this.speeds = {
        yaw: 0, // turn
        pitch: 0, // forward/backward
        roll: 0, // left/right
        altitude: 0 // up/down
    };

    this.steps = {
        fa0a: 0,
        fa0b: 0,
        fa0c: 0
    };
    
    this.status = {
        flying: false,
        battery: 100
    };
};


util.inherits(Drone, EventEmitter);


// create client helper function to match ar-drone
Drone.createClient = function (options) {
    return new Drone(options);
};


Drone.prototype.connect = function (callback) {
    this.ble.on('discover', function (peripheral) {

        var onConnected = function (error) {
            if (error) {
                console.error(error);
            }
            debug('Connected to: ' + peripheral.advertisement.localName);
            this.connected = true;
            this.ble.stopScanning();
            callback();
        }.bind(this);

        if (this.uuid && (peripheral.uuid === this.uuid || peripheral.advertisement.localName === this.uuid)) {
            debug("name match:", this.uuid);
            debug("peri match:", peripheral.uuid);
            debug("localname match:", peripheral.advertisement.localName);
            this.peripheral = peripheral;
            this.peripheral.connect(onConnected);
            this.uuid = peripheral.uuid;
            this.name = peripheral.advertisement.localName;
        } else if ((typeof this.uuid) === 'undefined' &&
            peripheral.advertisement.localName &&
            peripheral.advertisement.localName.indexOf('RS_') === 0) {
            debug("fuzzy match");
            debug(peripheral.advertisement.localName);
            this.uuid = peripheral.uuid;
            this.name = peripheral.advertisement.localName;
            //found a rolling spider
            debug('Found a rolling spider with uuid:', peripheral.uuid);
            this.peripheral = peripheral;
            this.peripheral.connect(onConnected);
        }
    }.bind(this));

    this.ble.startScanning();
};

Drone.prototype.setup = function (callback) {
    this.peripheral.discoverAllServicesAndCharacteristics(function (error, services, characteristics) {
        this.services = services;
        this.characteristics = characteristics;

        this.handshake(callback);
    }.bind(this));
};

Drone.prototype.handshake = function (callback) {
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


    this.getCharacteristic('fb0f').on('data', function (data, isNotification) {
        if (!isNotification) return;
        this.status.battery = data[data.length - 1];
        this.emit('battery');
        debug('Battery level:', this.status.battery + '%');
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
        if (!isNotification || !data[6]) return;

        if (data[6] === 5) {
            this.status.flying = false;
        }
    }.bind(this));


    setTimeout(function () {
        this.getCharacteristic('fa0b').write(
            new Buffer([0x04, ++this.steps['fa0b'], 0x00, 0x04, 0x01, 0x00, 0x32, 0x30, 0x31, 0x34, 0x2D, 0x31, 0x30, 0x2D, 0x32, 0x38, 0x00]),
            true,
            function (error) {
                setTimeout(function () {
                    callback();
                }, 100);
            }
            );
    }.bind(this), 100);
};

Drone.prototype.getCharacteristic = function (unique_uuid_segment) {
    var filtered = this.characteristics.filter(function (c) {
        return c.uuid.search(new RegExp(unique_uuid_segment)) !== -1;
    });

    return filtered[0];
};

Drone.prototype.writeTo = function (unique_uuid_segment, buffer) {
    this.getCharacteristic(unique_uuid_segment).write(buffer, true);
};

Drone.prototype.startPing = function () {
    setInterval(function () {
        this.steps['fa0a'] = (this.steps['fa0a'] || 0) + 1;
        var buffer = new Buffer(19);
        buffer.fill(0);
        buffer.writeInt16LE(2, 0);
        buffer.writeInt16LE(++this.steps['fa0a'], 1);
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
            this.speeds.roll = 0;
            this.speeds.pitch = 0;
            this.speeds.yaw = 0;
            this.speeds.altitude = 0;
        }

    }.bind(this), 50);
};




Drone.prototype.signalStrength = function (callback) {
    if (this.connected) {
        this.peripheral.updateRssi(callback);
    } else {
        callback(new Error("Not connected to device"));
    }
}

Drone.prototype.disconnect = function (callback) {
    if (this.connected) {
        this.peripheral.disconnect(function (error) {
            console.log('Disconnected from drone: ' + this.name);
            this.connected = false;
        }.bind(this));
    }
}

//
// tilt [-100:100]
// forward [-100:100]
// turn [-100:100]
// up [-100:100]
//
Drone.prototype.drive = function (tilt, forward, turn, up, steps) {
    if (!this.driveStepsRemaining) {
        // only apply when not driving currently, this causes you to exactly move -- prevents fluid

        this.driveStepsRemaining = steps || 1;
        this.speeds.roll = turn;
        this.speeds.pitch = forward;
        this.speeds.yaw = tilt;
        this.speeds.altitude = up;
        // inject into ping flow.
    }
};



// Operational Functions
// Multiple use cases provided to support initial build API as well as
// NodeCopter API and parity with the ar-drone library.

function takeOff() {
    if (this.status.battery < 10) console.log('!!! BATTERY LEVEL TOO LOW !!!');

    this.writeTo(
        'fa0b',
        new Buffer([0x02, ++this.steps['fa0b'] & 0xFF, 0x02, 0x00, 0x01, 0x00])
        );
    this.status.flying = true;
}

function wheelOn() {
    this.steps['fa0b']++;
    this.writeTo(
        'fa0b',
        new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x01, 0x02, 0x00, 0x01])
        );
}

function wheelOff() {
    this.steps['fa0b']++;
    this.writeTo(
        'fa0b',
        new Buffer([0x02, this.steps['fa0b'] & 0xFF, 0x02, 0x01, 0x02, 0x00, 0x00])
        );
}

function land() {
    this.writeTo(
        'fa0b',
        new Buffer([0x02, ++this.steps['fa0b'] & 0xFF, 0x02, 0x00, 0x03, 0x00])
        );
    this.status.flying = false;
}

function toggle() {
    if (this.status.flying) {
        this.land();
    } else {
        this.takeOff();
    }
}

function cutOff() {
    this.writeTo(
        'fa0c',
        new Buffer([0x02, ++this.steps['fa0c'] & 0xFF, 0x02, 0x00, 0x04, 0x00])
        );
    this.status.flying = false;
}

function flatTrim() {
    this.writeTo(
        'fa0b',
        new Buffer([0x02, ++this.steps['fa0b'] & 0xFF, 0x02, 0x00, 0x00, 0x00])
        );
}

function frontFlip() {
    this.writeTo(
        'fa0b',
        new Buffer([0x02, ++this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
        );
}

function backFlip() {
    this.writeTo(
        'fa0b',
        new Buffer([0x02, ++this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00])
        );
}

function rightFlip() {
    this.writeTo(
        'fa0b',
        new Buffer([0x02, ++this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00])
        );
}

function leftFlip() {
    this.writeTo(
        'fa0b',
        new Buffer([0x02, ++this.steps['fa0b'] & 0xFF, 0x02, 0x04, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00])
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


module.exports = Drone;
