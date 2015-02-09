"use strict";

var Drone = require("./drone");

if (process.env.UUID) {
  var d = new Drone(process.env.UUID);
  d.connect(function() {
    d.setup(function() {
      d.startPing();
      d.takeOff();

      setTimeout(function() {
        d.forward({steps: 100});
        setTimeout(function() {
          d.turnRight({steps: 300});
          setTimeout(function() {
            d.forward({steps: 100});
            setTimeout(function() {
              d.tiltLeft({steps: 30, speed: 100});
              setTimeout(function() {
                d.tiltRight({steps: 30, speed: 100});
                setTimeout(function() {
                  d.frontFlip();
                  setTimeout(function() {
                    d.land();
                  }, 2000);
                }, 2000);
              }, 2000);
            }, 2000);
          }, 2000);
        }, 2000);
      }, 3000);
    });
  });
}
