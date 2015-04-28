'use strict';

var keypress = require('keypress');
var Drone = require('../');

var ACTIVE = false;
var STEPS = 2;


function cooldown() {
  ACTIVE = false;
  setTimeout(function () {
    ACTIVE = true;
  }, STEPS*12);
}

// make `process.stdin` begin emitting "keypress" events
keypress(process.stdin);

// listen for the "keypress" event


process.stdin.setRawMode(true);
process.stdin.resume();

if (process.env.UUID) {
  console.log("Searching for ", process.env.UUID);
}

var d = new Drone(process.env.UUID);

function launch () {
  d.connect(function () {
    d.setup(function () {
     console.log("Prepare for take off! ", d.name);
      d.flatTrim();
      d.startPing();
      d.flatTrim();
      setTimeout(function () {
        d.takeOff();
        ACTIVE=true;
      }, 1000);

    });
  });

}

process.stdin.on('keypress', function (ch, key) {
  if (ACTIVE && key) {
    console.log(key.name);
    if (key.name === 'm') {
      d.emergency();
      setTimeout(function () {
        process.exit();
      }, 3000);
    } else if (key.name == 't') {
      d = new Drone(process.env.UUID);
      launch();
    } else if (key.name === 'w') {
      d.forward({steps: STEPS});
      cooldown();
    } else if (key.name === 's') {
      d.backward({steps: STEPS});
      cooldown();
    } else if (key.name === 'left') {
      d.turnLeft({steps: STEPS});
      cooldown();
    } else if (key.name === 'a') {
      d.tiltLeft({steps: STEPS});
      cooldown();
    } else if (key.name === 'd') {
      d.tiltRight({steps: STEPS});
      cooldown();
    } else if (key.name === 'right') {
      d.turnRight({steps: STEPS});
      cooldown();
    } else if (key.name === 'up') {
      console.log(d)
      d.up({steps: STEPS*2.5});
      cooldown();
    } else if (key.name === 'down') {
      d.down({steps: STEPS*2.5});
      cooldown();
    } else if (key.name === 'f') {
      d.frontFlip({steps: STEPS});
      cooldown();
    } else if (key.name === 'q') {
      d.land();
      setTimeout(function () {
        process.exit();
      }, 3000);
    } else if ( key.ctrl && key.name === 'c') {
      process.stdin.pause();
      process.exit();
    }
  }
});




launch();