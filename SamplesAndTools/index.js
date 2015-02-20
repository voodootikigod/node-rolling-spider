'use strict';

var Drone = require('./drone');
var temporal = require('temporal');



var d = new Drone(process.env.UUID);
d.connect(function () {
  d.setup(function () {
    temporal.queue([
      {
        delay: 0,
        task: function () {
          d.startPing();
          d.takeOff();
        }
      },
      {
        delay: 3000,
        task: function () {
          d.forward({steps: 100});
        }
      },
      {
        delay: 2000,
        task: function () {
          d.turnRight({steps: 300});
        }
      },
      {
        delay: 2000,
        task: function () {
          d.forward({steps: 100});
        }
      },
      {
        delay: 2000,
        task: function () {
          d.tiltLeft({steps: 30, speed: 100});
        }
      },
      {
        delay: 2000,
        task: function () {
          d.tiltRight({steps: 30, speed: 100});
        }
      },
      {
        delay: 2000,
        task: function () {
          d.frontFlip();
        }
      },
      {
        delay: 2000,
        task: function () {
          d.land();
        }
      },
      {
        delay: 5000,
        task: function () {
          process.exit(0);
        }
      }
    ]);

  });
});
