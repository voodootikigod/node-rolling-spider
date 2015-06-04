'use strict';
var noble = require('noble');
var Drone = require('./drone');
var debug = require('debug')('rollingspider-swarm');
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

  if (this.targets && !util.isArray(this.targets)) {
    this.targets = this.targets.split(',');
  }

  this.logger = options.logger || debug; //use debug instead of console.log
  this.discovering = false;
  this.members = [];


  // handle disconnect gracefully
  this.ble.on('warning', function(message) {
    this.onDisconnect();
  }.bind(this));
};

Swarm.prototype.isMember = function(peripheral) {
  if (!peripheral) {
    return false;
  }

  var localName = peripheral.advertisement.localName;
  var manufacturer = peripheral.advertisement.manufacturerData;
  if (this.targets.length === 0) {
    // handle "any" case
    var localNameMatch = localName && localName.indexOf('RS_') === 0;
    var manufacturerMatch = manufacturer && manufacturer.toString('hex') === '4300cf1900090100';

    // Is true for EITHER an "RS_" name OR manufacturer code.
    return localNameMatch || manufacturerMatch;
  } else {
    // in target list
    return (this.targets.indexOf(localName) >= 0 || this.targets.indexOf(peripheral.uuid) >= 0);
  }

};

Swarm.prototype.closeMembership = function(callback) {
  this.ble.stopScanning();
  if (callback) {
    callback();
  }
};

Swarm.prototype.assemble = function(callback) {
  this.logger('RollingSpider#assemble');
  if (this.targets) {
    this.logger('RollingSpider Swarm Assemble: ' + this.targets.join(', '));
  }

  var incr = 0;
  var onSetup = function () {
    if (incr === this.members.length) {
      if (this.discovering) {
        this.discovering = false;
        this.closeMembership();
        if (callback) {
          callback();
        }
      }
    }
  }.bind(this);

  this.ble.on('discover', function(peripheral) {
    this.logger('RollingSpider#assemble.on(discover)');


    // Is this peripheral a Parrot Rolling Spider?
    var isSwarmMember = this.isMember(peripheral);


    this.logger(peripheral.advertisement.localName + (isSwarmMember ? ' is a member' : ' is not a member'));
    if (isSwarmMember) {
      this.members.push(peripheral);

      var swarmMember = new Drone();
      swarmMember.ble = this.ble; // share the same noble instance
      swarmMember.connectPeripheral(peripheral, function() {
        this.logger(peripheral.advertisement.localName + ' is connected');
        swarmMember.setup(function() {
          this.logger(peripheral.advertisement.localName + ' is setup');
          onSetup();
        });
      });
    }
  });

  setTimeout(function () {
    if (this.discovering) {
      this.discovering = false;
      this.closeMembership();
      callback();
    }
  }.bind(this), 30000);      // timeout after 30s

  if (this.forceConnect || this.ble.state === 'poweredOn') {
    this.logger('RollingSpider.forceConnect');
    this.discovering = true;
    this.ble.startScanning();
  } else {
    this.logger('RollingSpider.on(stateChange)');
    this.ble.on('stateChange', function(state) {
      if (state === 'poweredOn') {
        this.logger('RollingSpider#poweredOn');
        this.discovering = true;
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

Swarm.prototype.run = function (fn, callback) {
  var max = this.members.length, count = 0;
  _.forEach(this.members, function (drone) {
    drone[fn]({}, function () {
      count += 1;
      if (count == max && callback) {
        callback();
      }
    });
  })
};

function takeOff(opts,callback) {
  this.run('takeOff',callback);
}
function land(opts,callback) {
  this.run('land',callback);
}

Swarm.prototype.takeoff = takeOff;
Swarm.prototype.takeOff = takeOff;
Swarm.prototype.onDisconnect = function() {
  // end of swarm
};


module.exports = Swarm;
