var Drone = require('../');
var should = require('should');

describe('Drone.isDronePeripheral', function() {

  it('returns false if no peripheral record', function(done) {
    should.equal(Drone.isDronePeripheral(), false);
    done();
  });

  it('returns true if peripheral.advertisement.localName begins with "RS_"', function(done) {
    var peripheral = {
      advertisement: {
        localName: 'RS_whatever'
      }
    };
    should.equal(Drone.isDronePeripheral(peripheral), true);
    done();
  });

    it('returns true if peripheral.advertisement.localName begins with "Mambo_"', function(done) {
    var peripheral = {
      advertisement: {
        localName: 'Mambo_whatever'
      }
    };
    should.equal(Drone.isDronePeripheral(peripheral), true);
    done();
  });

  it('returns true if peripheral.advertisement.manufacturerData is correct', function(done) {
    var peripheral = {
      advertisement: {
        manufacturerData: new Buffer([0x43, 0x00, 0xcf, 0x19, 0x00, 0x09, 0x01, 0x00])
      }
    };
    should.equal(Drone.isDronePeripheral(peripheral), true);
    done();
  });

  it('returns true if custom name, but peripheral.advertisement.manufacturerData is correct', function(done) {
    var peripheral = {
      advertisement: {
        localName: 'ArachnaBot',
        manufacturerData: new Buffer([0x43, 0x00, 0xcf, 0x19, 0x00, 0x09, 0x01, 0x00])
      }
    };
    should.equal(Drone.isDronePeripheral(peripheral), true);
    done();
  });
});
