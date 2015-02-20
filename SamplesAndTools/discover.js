"use strict";

var noble = require("noble");
var knownDevices = [];

noble.startScanning();

noble.on("discover", function(peripheral) {
  console.log(peripheral.advertisement.manufacturerData.toString('utf-8'));
  var details = {
    name: peripheral.advertisement.localName,
    uuid: peripheral.uuid
  };

  knownDevices.push(details);
  console.log(knownDevices.length + ": " + details.name + " (" + details.uuid + ")");
});
