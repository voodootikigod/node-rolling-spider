#ifndef ___XPC_CONNECTION_H___
#define ___XPC_CONNECTION_H___

#include <node.h>

#include <string>
#include <vector>

#include <dispatch/dispatch.h>
#include <xpc/xpc.h>
#include <nan.h>


class XpcConnection : public node::ObjectWrap {

public:
  static void Init(v8::Handle<v8::Object> target);

  static NAN_METHOD(New);
  static NAN_METHOD(Setup);
  static NAN_METHOD(SendMessage);

private:
  XpcConnection(std::string serviceName);
  ~XpcConnection();

  static xpc_object_t ValueToXpcObject(v8::Handle<v8::Value> object);
  static xpc_object_t ObjectToXpcObject(v8::Handle<v8::Object> object);
  static xpc_object_t ArrayToXpcObject(v8::Handle<v8::Array> array);

  static v8::Handle<v8::Value> XpcObjectToValue(xpc_object_t xpcObject);
  static v8::Handle<v8::Object> XpcDictionaryToObject(xpc_object_t xpcDictionary);
  static v8::Handle<v8::Array> XpcArrayToArray(xpc_object_t xpcArray);

  static void HandleEvent(uv_work_t* req);
#if UV_VERSION_MINOR > 8
  static void HandleEventAfter(uv_work_t* req, int status);
#else
  static void HandleEventAfter(uv_work_t* req);
#endif

  void setup();
  void sendMessage(xpc_object_t message);
  void handleEvent(xpc_object_t event);

private:
  std::string serviceName;
  dispatch_queue_t dispatchQueue;
  xpc_connection_t xpcConnnection;

  v8::Persistent<v8::Object> This;
};

#endif
