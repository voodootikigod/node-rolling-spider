# Rolling Spider for NodeJS

A simple library that deals with all the horrible BLE calls. **INCOMPLETE AND HIGHLY EXPERIMENTAL**

## Warning

This is meant to work with hardware. If you use this you agree that by using it you assume all repsponsibility. If you use it and your drone smashes into your ceiling fan, that's your fault. By using this code you assume all responsiblity for your usage of it. I'm not liable for anything you do with this code.

## Getting Started

There is a few steps you should take when getting started with this. We're going to learn how to get there by building out a simple script that will take off, move forward a little, then land.

### Connecting

To connect you need to create a new `Drone` instance with a UUID you want to connect to (use the [Discovery Tool](https://github.com/FluffyJack/node-rolling-spider/blob/master/SamplesAndTools/discover.js) to get your UUID).

```javascript
var RollingSpider = require("rolling-spider");

var yourDrone = new RollingSpider("<INSERT UUID HERE>");
```

After you've created an instance you now have access to all the functionality of the drone, but there is some stuff you need to do first, namely connecting, running the setup, and starting the ping to keep it connected.

```javascript
var RollingSpider = require("rolling-spider");

var yourDrone = new RollingSpider("<INSERT UUID HERE>");

// NEW CODE BELOW HERE

yourDrone.connect(function() {
  yourDrone.setup(function() {
    yourDrone.startPing();
  });
});
```
### Taking off, moving, and landing

We're now going to create a function that takes a drone and then by using `setTimeout` creates a timed sequence of calls to actions on the drone.

It's important that you use `setTimeout` between calls to make sure you give it enough time to complete the previous action, sometimes it freaks it out if you don't wait.

```javascript
var RollingSpider = require("rolling-spider");

var yourDrone = new RollingSpider("<INSERT UUID HERE>");

yourDrone.connect(function() {
  yourDrone.setup(function() {
    yourDrone.startPing();

    // function call to our movement sequence
    runDroneSequence(yourDrone);

  });
});

// NEW CODE

function runDroneSequence(drone) {
  drone.flatTrim(); // you should do this before take off when the wheels are on
  drone.takeOff();

  // you have to wait about 3 seconds for it to take off
  setTimeout(function() {
    drone.forward();

    // wait till it has finished moving forward
    setTimeout(function() {

      // land
      drone.land();
    }, 500);
  }, 3000);
}
```

### Done!

And there you have it, you can now control your drone.

## Drone Commands

* `flatTrim` - resets the trim so that your drone's flight is stable, should always be called before taking off
* `takeOff` - take off then hover
* `land` - floats down and lands
* `emergancy` - shuts off the motors "instantly" (sometimes has to wait for other commands ahead of it to complete... not fully safe yet)
* `up` - move up
* `down` - move down
* `forward` - tilt forward and so therefore move forward
* `backward` - tilt backward and so therefore move backward
* `tiltLeft` - tilt left and so therefore move left (not turn left)
* `tiltRight` - tilt right and so therefore move right (not turn right)
* `turnLeft` - rotate the drone left on the spot
* `turnRight` - rotate the drone right on the spot
* `frontFlip` - do a front flip
* `backFlip` - do a back flip (seems to still do a front flip currently...?)
* `rightFlip` - do a right flip **DO NOT USE WITH WHEELS ON!!!**
* `leftFlip` - do a left flip **DO NOT USE WITH WHEELS ON!!!**
