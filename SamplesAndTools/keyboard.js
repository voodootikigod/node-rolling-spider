'use strict';

var keypress = require('keypress');
var Drone = require('../');
var multiple = process.argv[0] || 8;
var STEP_LENGTH = 20;
function cooldown() {
  ACTIVE = false;
  setTimeout(function () {
    ACTIVE = true;
  }, STEP_LENGTH * multiple);
}

var ACTIVE = true;
// make `process.stdin` begin emitting "keypress" events
keypress(process.stdin);

// listen for the "keypress" event


process.stdin.setRawMode(true);
process.stdin.resume();



var d = new Drone(process.env.UUID);
d.connect(function () {
  d.setup(function () {
    d.flatTrim();
    d.startPing();
    d.flatTrim();
    d.takeOff();
    d.flatTrim();
    process.stdin.on('keypress', function (ch, key) {
      if (ACTIVE && key) {
        console.log(key);
        if (key.name === 'w') {
          d.forward({steps: STEP_LENGTH});
          cooldown();
        } else if (key.name === 's') {
          d.backward({steps: STEP_LENGTH});
          cooldown();
        } else if (key.name === 'left') {
          d.turnLeft({steps: STEP_LENGTH});
          cooldown();
        } else if (key.name === 'a') {
          d.tiltLeft({steps: STEP_LENGTH});
          cooldown();
        } else if (key.name === 'd') {
          d.tiltRight({steps: STEP_LENGTH});
          cooldown();
        } else if (key.name === 'right') {
          d.turnRight({steps: STEP_LENGTH});
          cooldown();
        } else if (key.name === 'up') {
          d.up();
          cooldown();
        } else if (key.name === 'down') {
          d.down();
          cooldown();
        } else if (key.name === 'f') {
          d.frontFlip();
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
  });
});
