# 1.4.0
* Unleash the swarm.... Swarm capability now added to the rolling spider library. (@voodootikigod)

# 1.3.1
* Fixes callback issue when callback not present. (@kevinold)

# 1.3.0
* Even more callback flushing for all events and protective execution. (Fix for #43)
* Gamepad support for logitech dual action controller as an example.

# 1.2.0
* Callback style for all functional components (@garetht)
* Readme fix
* Verified functional for io 2.x+ and node 0.10.x, 0.12.x

# 1.0.11
* `stateChange` is now reliable.
* Better instrumentation of disconnect handling.
* Better use of state management.

# 1.0.10
* `stateChange` notification in the RollingSpider.

# 1.0.10
* Remove disconnect from emergency to allow re-takeoff after emergency

# 1.0.4 - 1.0.8
* Minor fixes while using in production.
* Increased logging for bug trace down (@voodootikigod)
* All callbacks protected (@voodootikigod)
* Flush on emergency (@voodootikigod)
* Multiple UUID selection capability (@voodootikigod)
* Reconnect now works. (@voodootikigod)

# 1.0.3
* Allow waiting for settle (default) and forceConnect for assumed bluetooth settling (@voodootikigod)

# 1.0.2
* Proper display of battery and signal on the keyboard example. (@lynnaloo)

# 1.0.1
* Waits for adapter ready notification before attempting to scan for the drone. (@voodootikigod)

# 1.0.0
* Code Comments thanks to @christhebaron
* Merger of @christhebaron fork. (@voodootikigod)
* JSHint passes.

# 0.3.1
* Improvements to discover. (@sandeepmistry)
* Added battery and signal strength to `eg/keyboard.js`.  (@voodootikigod)
* Move to use `eg` directory instead of `SamplesAndTools`. (@voodootikigod)

# 0.3.0
* Merged in code changes from DroneWorks team (@droneworks)
* Refactored code base to use an inline and responsive ping with yaw, pitch, altitude, and roll commands. (@voodootikigod)
* Refactored drive to use ping (@droneworks/@voodootikigod)

# 0.1.2

* Parity with the client API of the [node-ar-drone](https://github.com/felixge/node-ar-drone#client-api) where appropriate. @voodootikigod
* Included `debug` library to output information about the system when needed. Requires further instrumentation, but its a start. @voodootikigod
* Removed unneeded dependency on temporal for just the module (not used yet, will eventually). @voodootikigod

# 0.1.1

* Removed the need for utilizing discover prior to use by simply choosing the first peripheral with 'RS_' in the localname. @voodootikigod
* Cleaned up directory structure and moved drone code into a lib directory. @voodootikigod
* Converted sample code to use temporal over chained setTimeout. @voodootikigod
* Added a keyboard control sample code. @voodootikigod
