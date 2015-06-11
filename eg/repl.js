'use strict';

var Drone = require('../');
var repl = require('repl');

if (process.env.UUID) {
  var d = new Drone(process.env.UUID);
  d.connect(function() {
    d.setup(function() {
      d.startPing();

      var replServer = repl.start({
        prompt: 'Drone (' + d.uuid + ') > '
      });

      replServer.context.drone = d;

      replServer.on('exit', function() {
        d.land();
        process.exit();
      });
    });
  });
}
