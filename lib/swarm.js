'use strict';
var noble = require('noble');
var Drone = require('./drone');
var debug = require('debug')('rollingspider');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var _ = require('lodash');


/**
 * Constructs a new RollingSpider Swarm
 *
 * @param {Object} options to construct the drone with:
 *  - {String} A comma seperated list (as a string) of UUIDs or names to connect to. This could also be an array of the same items.  If this is omitted then it will add any device with the manufacturer data value for Parrot..
 *  - logger function to call if/when errors occur. If omitted then uses console#log
 * @constructor
 */
var Swarm = function(options) {
  this.ble = noble;

  var membership = (typeof options === 'string' ? options : undefined);
  options = options || {};

  this.targets = membership || options.membership;

  this.peripherals = [];
  this.members = [];
  this.timeout = (options.timeout || 30) * 1000; // in seconds

  //define membership
  if (this.targets && !util.isArray(this.targets)) {
    this.targets = this.targets.split(',');
  } else {
    this.targets = [];
  }

  this.logger = options.logger || debug; //use debug instead of console.log
  this.discovering = false;

  this.active = false;

  // handle disconnect gracefully
  this.ble.on('warning', function(message) {
    this.onDisconnect();
  }.bind(this));

  return this;
};

util.inherits(Swarm, EventEmitter);


Swarm.prototype.at = function (id, callback) {
  this.logger('RollingSpider.Swarm#at');
  var found = null;
  this.members.forEach(function (member) {
    if (member.name === id) {
      found = member;
    }
  });
  if (typeof callback === 'function') {
    callback(found);
  } else {
    return found;
  }
};

Swarm.prototype.isMember = function(peripheral) {
  this.logger('RollingSpider.Swarm#isMember');
  if (!peripheral) {
    return false;
  }

  var localName = peripheral.advertisement.localName;
  var manufacturer = peripheral.advertisement.manufacturerData;
  if (this.targets.length === 0) {
    // handle "any" case
    var localNameMatch = localName
      && (localName.indexOf('RS_') === 0 || localName.indexOf('Mars_') === 0 || localName.indexOf('Travis_') === 0  || localName.indexOf('Maclan_')=== 0);
    var manufacturerMatch = manufacturer
      && (['4300cf1900090100', '4300cf1909090100', '4300cf1907090100'].indexOf(manufacturer) >= 0);

    // Is true for EITHER an "RS_" name OR manufacturer code.
    return localNameMatch || manufacturerMatch;
  } else {
    // console.log(this.targets, localName);
    // console.log(this.targets, peripheral.uuid);
    // in target list
    return (this.targets.indexOf(localName) >= 0 || this.targets.indexOf(peripheral.uuid) >= 0);
  }

};

Swarm.prototype.closeMembership = function(callback) {
  this.logger('RollingSpider.Swarm#closeMembership');
  this.ble.stopScanning();
  this.discovering = false;
  this.active = true;
  if (callback) {
    callback();
  }
};

Swarm.prototype.assemble = function(callback) {
  this.logger('RollingSpider.Swarm#assemble');

  this.once('assembled', function () {
    //when assembled clean up
    if (this.TIMEOUT_HANDLER) {
      clearTimeout(this.TIMEOUT_HANDLER);
    }
    this.closeMembership();
  });


  if (this.targets) {
    this.logger('RollingSpider Swarm Assemble: ' + this.targets.join(', '));
  }

  var incr = 0;
  var onSetup = function () {
    incr++;
    this.logger(incr+'/'+ this.targets.length);
    if (this.targets.length > 0 && incr === this.targets.length) {
      this.emit('assembled');
    }
  }.bind(this);

  this.ble.on('discover', function(peripheral) {
    this.logger('RollingSpider.Swarm#assemble.on(discover)');


    // Is this peripheral a Parrot Rolling Spider?
    var isSwarmMember = this.isMember(peripheral);


    this.logger(peripheral.advertisement.localName + (isSwarmMember ? ' is a member' : ' is not a member'));
    if (isSwarmMember) {


      var swarmMember = new Drone();
      swarmMember.ble = this.ble; // share the same noble instance

      swarmMember.connectPeripheral(peripheral, function() {
        this.logger(peripheral.advertisement.localName + ' is connected');
        swarmMember.setup(function() {
          this.logger(peripheral.advertisement.localName + ' is setup');
          this.members.push(swarmMember);
          swarmMember.flatTrim();
          swarmMember.startPing();
          onSetup();
        }.bind(this));
      }.bind(this));
    }
  }.bind(this));

  this.TIMEOUT_HANDLER = setTimeout(function () {
    this.logger('Swarm#assemble.timeout');
    this.emit('assembled');
  }.bind(this), this.timeout);      // timeout after 30s

  if (this.forceConnect || this.ble.state === 'poweredOn') {
    this.logger('RollingSpider.Swarm.forceConnect');
    this.discovering = true;
    this.ble.startScanning();
  } else {
    this.logger('RollingSpider.on(stateChange)');
    this.ble.on('stateChange', function(state) {
      if (state === 'poweredOn') {
        this.logger('RollingSpider#poweredOn');
        this.discovering = true;
        this.ble.startScanning();
        if (typeof callback === 'function') {
          callback();
        }
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

function broadcast (fn) {

  return function (opts, callback) {
    this.logger('RollingSpider.Swarm#broadcast-'+fn);
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    var max = this.members.length, count = 0;
    _.forEach(this.members, function (drone) {
      try {
        drone[fn](opts || {}, function () {
          count++;
          this.logger(fn+': '+count+'/'+max);
          if (count === max && callback) {
            callback();
          }
        }.bind(this));
      } catch (e) {
        // handle quietly
      }
    }.bind(this));
  };
}

var takeOff = broadcast('takeOff');
var land = broadcast('land');

Swarm.prototype.release = function (callback) {
  var max = this.members.length, count = 0;
  _.forEach(this.members, function (drone) {
    drone.disconnect(function () {
      count++;
      if (count === max && callback) {
        this.members = [];
        callback();
      }
    });
  });

  if (max === 0 && callback) {
    callback();
  }
};

var cutOff = broadcast('emergency');
var flatTrim = broadcast('flatTrim');

// provide options for use case
Swarm.prototype.takeoff = takeOff;
Swarm.prototype.takeOff = takeOff;
Swarm.prototype.wheelOff = broadcast('wheelOff');
Swarm.prototype.wheelOn = broadcast('wheelOn');
Swarm.prototype.land = land;
Swarm.prototype.toggle = broadcast('toggle');
Swarm.prototype.emergency = cutOff;
Swarm.prototype.emergancy = cutOff;
Swarm.prototype.flatTrim = flatTrim;
Swarm.prototype.calibrate = flatTrim;
Swarm.prototype.up = broadcast('up');
Swarm.prototype.down = broadcast('down');
// animation
Swarm.prototype.frontFlip = broadcast('frontFlip');
Swarm.prototype.backFlip = broadcast('backFlip');
Swarm.prototype.rightFlip = broadcast('rightFlip');
Swarm.prototype.leftFlip = broadcast('leftFlip');

// rotational
Swarm.prototype.turnRight = broadcast('turnRight');
Swarm.prototype.clockwise = broadcast('turnRight');
Swarm.prototype.turnLeft = broadcast('turnLeft');
Swarm.prototype.counterClockwise = broadcast('turnLeft');

// directional
Swarm.prototype.forward = broadcast('forward');
Swarm.prototype.backward = broadcast('backward');
Swarm.prototype.tiltRight = broadcast('tiltRight');
Swarm.prototype.tiltLeft = broadcast('tiltLeft');
Swarm.prototype.right = broadcast('tiltRight');
Swarm.prototype.left = broadcast('tiltLeft');

Swarm.prototype.hover = broadcast('hover');





Swarm.prototype.onDisconnect = function() {
  // end of swarm
};


module.exports = Swarm;
