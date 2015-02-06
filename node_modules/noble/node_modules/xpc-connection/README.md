node-xpc-connection
===================

[![Analytics](https://ga-beacon.appspot.com/UA-56089547-1/sandeepmistry/node-xpc-connection?pixel)](https://github.com/igrigorik/ga-beacon)

Connection binding for node.js

Supported data types
==================

 * int32/uint32
 * string
 * array
 * buffer
 * uuid
 * object

Example
=======

```
var XpcConnection = require('xpc-connection');

var xpcConnection = new XpcConnection('<Mach service name>');

xpcConnection.on('error', function(message) {
    ...
});

xpcConnection.on('event', function(event) {
    ...
});

xpcConnection.setup();

var mesage = {
    ... 
};

xpcConnection.sendMessage(mesage);

```

Build Errors
============
Before creating a new issue for build errors, please set your path to the following:

```
/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/X11/bin
```

MacPorts and other similiar tools might be adding an incompatible compiler to your PATH (see issue #2) for more details.

