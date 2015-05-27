# Rolling Spider for Node.js

An implementation of the networking protocols (Bluetooth LE) used by the
[Parrot MiniDrone - Rolling Spider](http://www.parrot.com/usa/products/rolling-spider/). This offers an off-the-shelf $99 USD drone that can be controlled by JS -- yay!

Install via Github to get the *latest* version:

```bash
npm install git://github.com/voodootikigod/node-rolling-spider.git
```

Or, if you're fine with missing some cutting edge stuff, go for npm:

```bash
npm install rolling-spider
```

## Status

Stable. Minor configuration settings have yet to be done, but otherwise this module is stablized and can perform great flight control.


## Getting Started

There is a few steps you should take when getting started with this. We're going to learn how to get there by building out a simple script that will take off, move forward a little, then land.


### Connecting

To connect you need to create a new `Drone` instance.

```javascript
var RollingSpider = require("rolling-spider");

var yourDrone = new RollingSpider();
```

After you've created an instance you now have access to all the functionality of the drone, but there is some stuff you need to do first, namely connecting, running the setup, and starting the ping to keep it connected.

```javascript
var RollingSpider = require("rolling-spider");

var yourDrone = new RollingSpider();

// NEW CODE BELOW HERE

yourDrone.connect(function() {
  yourDrone.setup(function() {
    yourDrone.startPing();
  });
});
```
### Taking off, moving, and landing

We're now going to create a function that takes a drone and then by using a sequence of `temporal` tasks creates a timed sequence of calls to actions on the drone.

We recommend using `temporal` over a series of `setTimeout` chained calls for your sanity. Please abide by this when playing with the drone and ESPECIALLY if filing a ticket.

```javascript
var RollingSpider = require("rolling-spider");
var temporal = require("temporal");

var yourDrone = new RollingSpider();

yourDrone.connect(function() {
  yourDrone.setup(function() {
    // NEW CODE
    temporal.queue([
      {
        delay: 0,
        task: function () {
          yourDrone.flatTrim();
          yourDrone.startPing();
          yourDrone.takeOff();
        }
      },
      {
        delay: 3000,
        task: function () {
          yourDrone.forward();
        }
      },
      {
        delay: 500,
        task: function () {
          yourDrone.land();
        }
      }]);
  });
});

```

### Done!

And there you have it, you can now control your drone.


### Flying Multiple MiniDrones

Previous versions of the `rolling-spider` library required you to specify the UUID for your drone through a discover process. This has been removed in favor of just using the first BLE device that broadcasts with "RS_" as its localname. ***If you are flying multiple minidrones or in a very populated BLE area***, you will want to use the discovery process in order to identify specifically the drone(s) you want to control. Use the [Discovery Tool](https://github.com/FluffyJack/node-rolling-spider/blob/master/eg/discover.js) to get the UUID of all nearby BLE devices.


### Client API

#### RollingSpider.createClient([options])

Returns a new `Client` object. `options` include:

* `uuid`: The uuid (Bluetooth UUID) or the Published Name (something like RS_XXXXXX) of the drone. Defaults to finding first announced.

#### client.on('battery', callback) 

Event that is emitted on battery change activity. Caution, battery drains pretty fast on this so this may create a high velocity of events.

#### client.takeoff(callback) __or__ client.takeOff(callback)

Sets the internal `fly` state to `true`, `callback` is invoked after the drone
reports that it is hovering.

#### client.land(callback)

Sets the internal `fly` state to `false`, `callback` is invoked after the drone
reports it has landed.

#### client.up([options]) / client.down([options])

Options

> * `speed` at which the drive should occur. 0-100 values.
> * `steps` the length of steps (time) the drive should happen. 0-100 values.
 
Makes the drone gain or reduce altitude. 

#### client.clockwise([options]) / client.counterClockwise([options]) __or__ client.turnRight([options]) / client.turnLeft([options])

Options

> * `speed` at which the rotation should occur
> * `steps` the length of steps (time) the turning should happen. 0-100 values.

Causes the drone to spin. 

#### client.forward([options]) / client.backward([optoins])

> * `speed` at which the drive should occur. 0-100 values.
> * `steps` the length of steps (time) the drive should happen. 0-100 values.

Controls the pitch.

#### client.left([options]) / client.right([options]) __or__ client.tiltLeft([options]) / client.tiltRight([options])

> * `speed` at which the drive should occur. 0-100 values.
> * `steps` the length of steps (time) the drive should happen. 0-100 values.

Controls the roll, which is a horizontal movement.

#### client.frontFlip()

Causes the drone to do an amazing front flip.

#### client.backFlip()

Causes the drone to do an amazing back flip.

#### client.leftFlip()

Causes the drone to do an amazing left flip. **DO NOT USE WITH WHEELS ON!!!**

#### client.rightFlip()

Causes the drone to do an amazing right flip. **DO NOT USE WITH WHEELS ON!!!**


#### client.calibrate() __or__ client.flatTrim()

Resets the trim so that your drone's flight is stable. It should always be
called before taking off.


#### client.signalStrength(function callback(err, rssi) {})

Obtains the signal strength as an RSSI value returned as the second parameter of the callback.

#### client.disconnect()

Disconnects from the drone if it is connected.


#### client.emergancy() __or__ client.emergency()

Causes the drone to shut off the motors "instantly" (sometimes has to wait for other commands ahead of it to complete... not fully safe yet)
