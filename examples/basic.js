var RollingSpider = require("parrot-rolling-spider");

var yourDrone = new RollingSpider();

yourDrone.connect(function () {

	yourDrone.trim();
	yourDrone.takeOff();

	setTimeout(function () {

		yourDrone.forward(50);

		setTimeout(function () {

			yourDrone.land();

		}, 500);

	}, 3000);

});
