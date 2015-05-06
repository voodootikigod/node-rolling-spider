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
