'use strict';

var noble = require('noble');
var knownDevices = [];

noble.startScanning();

noble.on('discover', function(peripheral) {
  var details = {
    name: peripheral.advertisement.localName,
    uuid: peripheral.uuid
  };

  knownDevices.push(details);
  console.log(knownDevices.length + ': ' + details.name + ' (' + details.uuid + ')');
});
