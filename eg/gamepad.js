'use strict';

// Create a new one
var Controller = require('logitech-dual-action-controller');

var controller = new Controller();



var Drone = require('../');

var ACTIVE = true;
var STEPS = 2;


function cooldown() {
  ACTIVE = false;
  setTimeout(function () {
    ACTIVE = true;
  }, STEPS * 12);
}


if (process.env.UUID) {
  console.log('Searching for ', process.env.UUID);
}

var d = new Drone(process.env.UUID);


d.connect(function () {
  d.setup(function () {
    console.log('Configured for Rolling Spider! ', d.name);
    d.flatTrim();
    d.startPing();
    d.flatTrim();

    // d.on('battery', function () {
    //   console.log('Battery: ' + d.status.battery + '%');
    //   d.signalStrength(function (err, val) {
    //     console.log('Signal: ' + val + 'dBm');
    //   });

    // });

    // d.on('stateChange', function () {
    //   console.log(d.status.flying ? "-- flying" : "-- down");
    // })
    setTimeout(function () {
      console.log('Ready for Flight');
      ACTIVE = true;
    }, 1000);
  });
});


var state = {
  tilt: 0,
  forward: 0,
  turn: 0,
  up: 0
}


controller.on('9:release', function () {
  console.log('Flat Trim');
  d.flatTrim();
});

controller.on('10:release', function () {
  console.log('Toggle');
  d.toggle();   // take off or land
});

controller.on('left:move', function (data) {
  state.up = data.y;
  state.turn = data.x;
  console.log(state);
  d.drive(state, -1);
});

controller.on('right:move', function (data) {
  state.forward = data.y;
  state.tilt = data.x;
  console.log(state);
  d.drive(state, -1);
});
