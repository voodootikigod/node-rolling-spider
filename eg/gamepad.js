'use strict';


/*
  For use with the Logitech Dual Action Controller F310
  Button Mapping

  X => 1
  A => 2
  B => 3
  Y => 4

*/



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
};

function variance(val) {
  return ((val >= -5 && val <= 5) ? 0 : val);
}

controller.on('1:release', function () {
  d.leftFlip();
});

controller.on('2:release', function () {
  d.backFlip();
});

controller.on('3:release', function () {
  d.rightFlip();
});


controller.on('4:release', function () {
  d.frontFlip();
});


controller.on('9:release', function () {
  d.flatTrim();
});

controller.on('10:release', function () {
  d.toggle();   // take off or land
});

controller.on('left:move', function (data) {
  console.log('left');
  state.up = variance(data.y);
  state.turn = variance(data.x);
  d.drive(state, -1);
});

controller.on('right:move', function (data) {
  state.forward = variance(data.y);
  state.tilt = variance(data.x);
  d.drive(state, -1);
});
