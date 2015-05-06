'use strict';

var noble = require('noble');
var knownDevices = [];

noble.startScanning();

noble.on('discover', function(peripheral) {
  var localName = peripheral.advertisement.localName;

  if (!localName || localName.indexOf('RS_') !== 0) {
    return; // not a rolling spider
  }

  var details = {
    name: localName,
    uuid: peripheral.uuid,
    rssi: peripheral.rssi
  };

  knownDevices.push(details);
  console.log(knownDevices.length + ': ' + details.name + ' (' + details.uuid + '), RSSI ' + details.rssi);
});
