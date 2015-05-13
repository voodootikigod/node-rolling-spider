'use strict';

var keypress = require('keypress');
var Drone = require('../');




var d = new Drone(process.env.UUID);




function launch() {
  d.connect(function () {
      console.log('Prepare for take off! ', d.name);
      d.flatTrim();
      setTimeout(function () {
        console.log('take off');
        d.takeOff();
        d.startPing();
      }, 1000);

      setTimeout(function () {
        console.log('land');
        d.land();
      }, 6000);


      setTimeout(function () {
        console.log('disconnect');
        d.disconnect();
      }, 10000);
  });
}




launch();


setTimeout(launch, 20000);



