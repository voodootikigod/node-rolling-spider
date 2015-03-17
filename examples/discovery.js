'use strict';

var noble = require('noble');

noble.startScanning();

noble.on('discover', function (peripheral) {

	console.log(peripheral.advertisement.localName + ' (' + peripheral.uuid + ')');

});
