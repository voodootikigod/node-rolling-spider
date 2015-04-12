'use strict';

var keypress = require('keypress');
var Drone = require('../');

var ACTIVE = true;
var STEPS = 20;


function cooldown() {
  ACTIVE = false;
  setTimeout(function () {
    ACTIVE = true;
  }, STEPS*8);
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

d.connect(function () {
  d.setup(function () {
    d.flatTrim();
    d.startPing();
    d.flatTrim();
    d.takeOff();
    d.flatTrim();
    
  });
});


process.stdin.on('keypress', function (ch, key) {
  if (ACTIVE && key) {
    console.log(key);
    if (key.name === 'w') {
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
    }
  }
});