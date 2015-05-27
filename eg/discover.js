'use strict';

var noble = require('noble');
var knownDevices = [];

noble.startScanning();

noble.on('discover', function(peripheral) {
  var localName = peripheral.advertisement.localName;
  var manufacturerData = peripheral.advertisement.manufacturerData;

  var droneName = localName && localName.indexOf('RS_') === 0;
  var manufacturer = manufacturerData && manufacturerData.toString('hex') === '4300cf1900090100';
  if (!droneName && !manufacturer) {
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
