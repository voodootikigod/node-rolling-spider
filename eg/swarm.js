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




var swarm = new Swarm({
  membership: [
    'RS_B127274',
    'RS_R094107',
    'RS_W178602'
    ]
});

swarm.assemble(function (memberCount) {
  console.log('assembled');
  swarm.takeoff(function () {
    console.log('takeoff');
    ACTIVE= true;
  });

});






process.stdin.on('keypress', function (ch, key) {
  if (ACTIVE && key) {
    if (key.name === 'm') {
      swarm.emergency();
      setTimeout(function () {
        process.exit();
      }, 3000);
    } else if (key.name === 't') {
      console.log('takeoff');
      swarm.takeOff();

    } else if (key.name === 'w') {
      swarm.forward({ steps: STEPS });
      cooldown();
    } else if (key.name === 's') {
      swarm.backward({ steps: STEPS });
      cooldown();
    } else if (key.name === 'left') {
      swarm.turnLeft({ steps: STEPS });
      cooldown();
    } else if (key.name === 'a') {
      swarm.tiltLeft({ steps: STEPS });
      cooldown();
    } else if (key.name === 'd') {
      swarm.tiltRight({ steps: STEPS });
      cooldown();
    } else if (key.name === 'right') {
      swarm.turnRight({ steps: STEPS });
      cooldown();
    } else if (key.name === 'up') {
      swarm.up({ steps: STEPS * 2.5 });
      cooldown();
    } else if (key.name === 'down') {
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
