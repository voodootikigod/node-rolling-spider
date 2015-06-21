'use strict';

var keypress = require('keypress');
var Swarm = require('../').Swarm;

var ACTIVE = true;
var STEPS = 2;


function cooldown() {
  ACTIVE = false;
  setTimeout(function () {
    ACTIVE = true;
  }, STEPS * 12);
}

// make `process.stdin` begin emitting 'keypress' events
keypress(process.stdin);

// listen for the 'keypress' event


process.stdin.setRawMode(true);
process.stdin.resume();




var swarm = new Swarm({timeout: 10});

swarm.assemble();

swarm.on('assembled', function () {
  ACTIVE = true;
});




process.stdin.on('keypress', function (ch, key) {
  if (ACTIVE && key) {
    if (key.name === 'm') {
      swarm.emergency();
      setTimeout(function () {
        process.exit();
      }, 3000);
    } else if (key.name === 't') {
      console.log('swarm#takeoff');
      swarm.takeOff();
    } else if (key.name === 'w') {
      console.log('swarm#forward');
      swarm.forward({ steps: STEPS });
      cooldown();
    } else if (key.name === 's') {
      console.log('swarm#backward');
      swarm.backward({ steps: STEPS });
      cooldown();
    } else if (key.name === 'left') {
      console.log('swarm#turnleft');
      swarm.turnLeft({ steps: STEPS });
      cooldown();
    } else if (key.name === 'a') {
      console.log('swarm#tiltleft');
      swarm.tiltLeft({ steps: STEPS });
      cooldown();
    } else if (key.name === 'd') {
      console.log('swarm#tiltright');
      swarm.tiltRight({ steps: STEPS });
      cooldown();
    } else if (key.name === 'right') {
      console.log('swarm#turnright');
      swarm.turnRight({ steps: STEPS });
      cooldown();
    } else if (key.name === 'up') {
      console.log('swarm#up');
      swarm.up({ steps: STEPS * 2.5 });
      cooldown();
    } else if (key.name === 'down') {
      console.log('swarm#down');
      swarm.down({ steps: STEPS * 2.5 });
      cooldown();
    } else if (key.name === 'i' || key.name === 'f') {
      swarm.frontFlip({ steps: STEPS });
      cooldown();
    } else if (key.name === 'j') {
      swarm.leftFlip({ steps: STEPS });
      cooldown();
    } else if (key.name === 'l') {
      swarm.rightFlip({ steps: STEPS });
      cooldown();
    } else if (key.name === 'k') {
      swarm.backFlip({ steps: STEPS });
      cooldown();
    } else if (key.name === 'q') {
      console.log('Initiated Landing Sequence...');
      swarm.land(function () {
        console.log('land');
        swarm.release( function () {
          console.log('release');
        });
      });

//      setTimeout(function () {
//        process.exit();
//      }, 3000);
    }
  }
  if (key && key.ctrl && key.name === 'c') {
    process.stdin.pause();
    process.exit();
  }
});
