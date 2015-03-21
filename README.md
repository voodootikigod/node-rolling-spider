# Rolling Spider for Node.js
This module is used to send data and commands to a [Parrot MiniDrone - Rolling Spider](http://www.parrot.com/usa/products/rolling-spider/).

It is based off a [similar module](https://github.com/FluffyJack/node-rolling-spider) that is better suited for sending a queue of commands to the drone. This one is hopefully more suited for responding to incoming data such as a joystick being moved around.
## Install 
Just run the following command to install the module.
```bash
npm install parrot-rolling-spider
```
## Status
This module is at state where it can just about be used to fly the drone around. Hopefully in the near future I will be able to develop it further.
## Warning
As this module deals with physical things flying around, I would recommend just being extra careful when using it. Although personally I have not managed to injure anyone with it, yet.
## Getting Started
There is a few steps you should take when getting started with this. We're going to learn how to get there by building out a simple script that will take off, move forward a little, then land.
### Connecting
To connect you need to create a new `Drone` instance and call the `connect` function with a callback parameter.
``` javascript
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
```
### Done!
And there you have it, you can now control your drone.
### Flying Multiple MiniDrones
This module will use the first BLE device that broadcasts with 'RS_' as its localname. ***If you are flying multiple minidrones or in a very populated BLE area***, you will want to use the discovery process in order to identify specifically the drone(s) you want to control. Use the Discovery Tool (`lib/discovery.js`) to get the UUID of all nearby BLE devices.
### Client API
#### client.takeOff()
Instructs the drone to take off. Please make sure to call `client.trim()` beforehand to ensure the drone takes off correctly.
#### client.land()
Instructs the drone to do a soft landing. This can take a few seconds so please be patient.
#### client.up(speed) / client.down(speed)
Instructs the drone to gain or reduce altitude. `speed` can be a value from `0` to `100`.
#### client.clockwise(speed) / client.counterClockwise(speed) 
Instructs the drone to spin. `speed` can be a value from `0` to `100`.
#### client.forward(speed) / client.backward(speed)
Instructs the drone to pitch. `speed` can be a value from `0` to `100`.
#### client.left(speed) / client.right(speed)
Instructs the drone to roll, `speed` can be a value from `0` to `100`.
#### client.hover()
Instructs the drone to hover.
#### client.frontFlip()
Causes the drone to do an amazing front flip.
#### client.backFlip()
Causes the drone to do an amazing back flip.
#### client.leftFlip() 
**This has not been confirmed as working.**

Causes the drone to do an amazing left flip. 

**DO NOT USE WITH THE WHEELS ON.**
#### client.rightFlip()
**This has not been confirmed as working.**

Causes the drone to do an amazing right flip. 

**DO NOT USE WITH THE WHEELS ON.**
#### client.trim()
Resets the trim so that your drone's flight is stable. It should always be
called before taking off.
#### client.emergencyLand()
Instructs the drone to cut off power to the motors, landing immediately.
### Roadmap (TODO)
 - Get flips tested
 - Add unit-testing for current functionality
 - Add media capture functionality
	- Add transfer captured media functionality
 - Get battery information
 - Get ultrasound information if possible
	- Use ultrasound to verify things like taking off/ landing
	
### Release History
1.0.5 - Made backflip work

1.0.4 - Actually fixed issue with drone not responding

1.0.3 - Still trying to fix issue with drone not responding

1.0.2 - Fixed issue with drone not responding

1.0.1 - Fixed issue with disconnect not calling callback function

1.0.0 - Added a lot of comments. Changed signature of construct function to accept a logging function. Added hover() which stops all movement, not tested yet. Added a ping to maintain connection to the drone. Added restriction on OS in package.json

0.1.0 - Able to take off, land, and drift around. Flips not tested yet
## License
Copyright (c) 2015 Chris Taylor. See `LICENSE` for more details
