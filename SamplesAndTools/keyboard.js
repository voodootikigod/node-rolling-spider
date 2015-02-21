'use strict';

var keypress = require('keypress');
var Drone = require('../');



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
    d.takeOff();
    process.stdin.on('keypress', function (ch, key) {
      if (key) {
        if (key.name === 'w') {
          d.forward({steps: 100});
        } else if (key.name === 's') {
          d.backward({steps: 100});
        } else if (key.name === 'a') {
          d.turnLeft({steps: 20});
        } else if (key.name === 'd') {
          d.turnRight({steps: 20});
        } else if (key.name === 'up') {
          d.up();
        } else if (key.name === 'down') {
          d.down();
        } else if (key.name === 'f') {
          d.frontFlip();
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
