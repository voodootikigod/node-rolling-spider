#import <Foundation/Foundation.h>

#include <node_buffer.h>

#include "XpcConnection.h"
#include <nan.h>

using namespace v8;
using v8::FunctionTemplate;


static v8::Persistent<v8::FunctionTemplate> s_ct;

class XpcEventData {
public:
  XpcConnection *xpcConnnection;
  xpc_object_t event;
};


void XpcConnection::Init(v8::Handle<v8::Object> target) {
  NanScope();

  v8::Local<v8::FunctionTemplate> t = NanNew<v8::FunctionTemplate>(XpcConnection::New);

  NanAssignPersistent(s_ct, t);

  NanNew(s_ct)->SetClassName(NanNew("XpcConnection"));

  NanNew(s_ct)->InstanceTemplate()->SetInternalFieldCount(1);

  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "setup", XpcConnection::Setup);
  NODE_SET_PROTOTYPE_METHOD(NanNew(s_ct), "sendMessage", XpcConnection::SendMessage);



  target->Set(NanNew("XpcConnection"), NanNew(s_ct)->GetFunction());
}

XpcConnection::XpcConnection(std::string serviceName) :
  node::ObjectWrap(),
  serviceName(serviceName) {
}

XpcConnection::~XpcConnection() {
}

void XpcConnection::setup() {
  this->dispatchQueue = dispatch_queue_create(this->serviceName.c_str(), 0);
  this->xpcConnnection = xpc_connection_create_mach_service(this->serviceName.c_str(), this->dispatchQueue, XPC_CONNECTION_MACH_SERVICE_PRIVILEGED);

  xpc_connection_set_event_handler(this->xpcConnnection, ^(xpc_object_t event) {
    xpc_retain(event);
    this->handleEvent(event);
  });

  xpc_connection_resume(this->xpcConnnection);
}

void XpcConnection::sendMessage(xpc_object_t message) {
  xpc_connection_send_message(this->xpcConnnection, message);
}

void XpcConnection::handleEvent(xpc_object_t event) {
  uv_work_t *req = new uv_work_t();

  XpcEventData* data = new XpcEventData;

  data->xpcConnnection = this;
  data->event = event;

  req->data = data;

  uv_queue_work(uv_default_loop(), req, XpcConnection::HandleEvent, (uv_after_work_cb)XpcConnection::HandleEventAfter);
}

NAN_METHOD(XpcConnection::New) {
  NanScope();
  std::string serviceName = "";

  if (args.Length() > 0) {
    v8::Handle<v8::Value> arg0 = args[0];
    if (arg0->IsString()) {
      v8::Handle<v8::String> arg0String = arg0->ToString();
      NanAsciiString arg0StringValue(arg0String);

      serviceName = *arg0StringValue;
    }
  }

  class XpcConnection* p = new class XpcConnection(serviceName);
  p->Wrap(args.This());
  NanAssignPersistent(p->This, args.This());
  NanReturnValue(args.This());

}


NAN_METHOD(XpcConnection::Setup) {
  NanScope();
  XpcConnection* p = node::ObjectWrap::Unwrap<XpcConnection>(args.This());

  p->setup();

  NanReturnValue (NanUndefined());
}

xpc_object_t XpcConnection::ValueToXpcObject(v8::Handle<v8::Value> value) {
  xpc_object_t xpcObject = NULL;

  if (value->IsInt32() || value->IsUint32()) {
    xpcObject = xpc_int64_create(value->IntegerValue());
  } else if (value->IsString()) {
    v8::Handle<v8::String> valueString = value->ToString();
    NanAsciiString valueStringValue(valueString);

    xpcObject = xpc_string_create(*valueStringValue);
  } else if (value->IsArray()) {
    v8::Handle<v8::Array> valueArray = v8::Handle<v8::Array>::Cast(value);

    xpcObject = XpcConnection::ArrayToXpcObject(valueArray);
  } else if (node::Buffer::HasInstance(value)) {
    v8::Handle<v8::Object> valueObject = value->ToObject();

    if (valueObject->HasRealNamedProperty(NanNew<String>("isUuid"))) {
      uuid_t *uuid = (uuid_t *)node::Buffer::Data(valueObject);

      xpcObject = xpc_uuid_create(*uuid);
    } else {
      xpcObject = xpc_data_create(node::Buffer::Data(valueObject), node::Buffer::Length(valueObject));
    }
  } else if (value->IsObject()) {
    v8::Handle<v8::Object> valueObject = value->ToObject();

    xpcObject = XpcConnection::ObjectToXpcObject(valueObject);
  } else {
  }

  return xpcObject;
}

xpc_object_t XpcConnection::ObjectToXpcObject(v8::Handle<v8::Object> object) {
  xpc_object_t xpcObject = xpc_dictionary_create(NULL, NULL, 0);

  v8::Handle<v8::Array> propertyNames = object->GetPropertyNames();

  for(uint32_t i = 0; i < propertyNames->Length(); i++) {
    v8::Handle<v8::Value> propertyName = propertyNames->Get(i);

    if (propertyName->IsString()) {
      v8::Handle<v8::String> propertyNameString = propertyName->ToString();
      NanAsciiString propertyNameStringValue(propertyNameString);
      v8::Handle<v8::Value> propertyValue = object->GetRealNamedProperty(propertyNameString);

      xpc_object_t xpcValue = XpcConnection::ValueToXpcObject(propertyValue);
      xpc_dictionary_set_value(xpcObject, *propertyNameStringValue, xpcValue);
      if (xpcValue) {
        xpc_release(xpcValue);
      }
    }
  }

  return xpcObject;
}

xpc_object_t XpcConnection::ArrayToXpcObject(v8::Handle<v8::Array> array) {
  xpc_object_t xpcArray = xpc_array_create(NULL, 0);

  for(uint32_t i = 0; i < array->Length(); i++) {
    v8::Handle<v8::Value> value = array->Get(i);

    xpc_object_t xpcValue = XpcConnection::ValueToXpcObject(value);
    xpc_array_append_value(xpcArray, xpcValue);
    if (xpcValue) {
      xpc_release(xpcValue);
    }
  }

  return xpcArray;
}

v8::Handle<v8::Value> XpcConnection::XpcObjectToValue(xpc_object_t xpcObject) {
  v8::Handle<v8::Value> value;

  xpc_type_t valueType = xpc_get_type(xpcObject);

  if (valueType == XPC_TYPE_INT64) {
    value = NanNew<Integer>(xpc_int64_get_value(xpcObject));
  } else if(valueType == XPC_TYPE_STRING) {
    value = NanNew<String>(xpc_string_get_string_ptr(xpcObject));
  } else if(valueType == XPC_TYPE_DICTIONARY) {
    value = XpcConnection::XpcDictionaryToObject(xpcObject);
  } else if(valueType == XPC_TYPE_ARRAY) {
    value = XpcConnection::XpcArrayToArray(xpcObject);
  } else if(valueType == XPC_TYPE_DATA) {


    Local<Object> slowBuffer = NanNewBufferHandle((char *)xpc_data_get_bytes_ptr(xpcObject), xpc_data_get_length(xpcObject));
    v8::Handle<v8::Object> globalObj = NanGetCurrentContext()->Global(); //v8::Context::GetCurrent()->Global();
    v8::Handle<v8::Function> bufferConstructor = v8::Local<v8::Function>::Cast(globalObj->Get(NanNew<String>("Buffer")));

    v8::Handle<v8::Value> constructorArgs[3] = {
      slowBuffer,
      NanNew<Integer>(xpc_data_get_length(xpcObject)),
      NanNew<Integer>(0)
    };

    value = bufferConstructor->NewInstance(3, constructorArgs);
  } else if(valueType == XPC_TYPE_UUID) {
    Local<Object> slowBuffer = NanNewBufferHandle((char *)xpc_uuid_get_bytes(xpcObject), sizeof(uuid_t));

    v8::Handle<v8::Object> globalObj = NanGetCurrentContext()->Global(); //v8::Context::GetCurrent()->Global();
    v8::Handle<v8::Function> bufferConstructor = v8::Local<v8::Function>::Cast(globalObj->Get(NanNew<String>("Buffer")));

    v8::Handle<v8::Value> constructorArgs[3] = {
      slowBuffer,
      NanNew<Integer>(sizeof(uuid_t)),
      NanNew<Integer>(0)
    };

    value = bufferConstructor->NewInstance(3, constructorArgs);
  } else {
    NSLog(@"XpcObjectToValue: Could not convert to value!, %@", xpcObject);
  }

  return value;
}

v8::Handle<v8::Object> XpcConnection::XpcDictionaryToObject(xpc_object_t xpcDictionary) {
  v8::Handle<v8::Object> object = NanNew<Object>();

  xpc_dictionary_apply(xpcDictionary, ^bool(const char *key, xpc_object_t value) {
    object->Set(NanNew<String>(key), XpcConnection::XpcObjectToValue(value));

    return true;
  });

  return object;
}

v8::Handle<v8::Array> XpcConnection::XpcArrayToArray(xpc_object_t xpcArray) {
  v8::Handle<v8::Array> array = NanNew<Array>();

  xpc_array_apply(xpcArray, ^bool(size_t index, xpc_object_t value) {
    array->Set(NanNew<Number>(index), XpcConnection::XpcObjectToValue(value));

    return true;
  });

  return array;
}

void XpcConnection::HandleEvent(uv_work_t* req) {
  // no-op
}

#if UV_VERSION_MINOR > 8
void XpcConnection::HandleEventAfter(uv_work_t* req, int status) {
#else
void XpcConnection::HandleEventAfter(uv_work_t* req) {
#endif
  NanScope();
  XpcEventData* data = static_cast<XpcEventData*>(req->data);
  XpcConnection::XpcConnection *xpcConnnection = data->xpcConnnection;
  xpc_object_t event = data->event;

  xpc_type_t eventType = xpc_get_type(event);
  if (eventType == XPC_TYPE_ERROR) {
    const char* message = "unknown";

    if (event == XPC_ERROR_CONNECTION_INTERRUPTED) {
      message = "connection interrupted";
    } else if (event == XPC_ERROR_CONNECTION_INVALID) {
      message = "connection invalid";
    }

    v8::Handle<v8::Value> argv[2] = {
      NanNew<String>("error"),
      NanNew<String>(message)
    };

    NanMakeCallback(NanNew<v8::Object>(xpcConnnection->This), NanNew("emit"), 2, argv);
  } else if (eventType == XPC_TYPE_DICTIONARY) {
    v8::Handle<v8::Object> eventObject = XpcConnection::XpcDictionaryToObject(event);

    v8::Handle<v8::Value> argv[2] = {
      NanNew<String>("event"),
      eventObject
    };
    // Same situation as line 297.
    NanMakeCallback(NanNew<v8::Object>(xpcConnnection->This), NanNew("emit"), 2, argv);
  }

  xpc_release(event);
  delete data;
  delete req;
}

NAN_METHOD(XpcConnection::SendMessage) {
  NanScope();
  XpcConnection* p = node::ObjectWrap::Unwrap<XpcConnection>(args.This());

  if (args.Length() > 0) {
    v8::Handle<v8::Value> arg0 = args[0];
    if (arg0->IsObject()) {
      v8::Handle<v8::Object> object = v8::Handle<v8::Object>::Cast(arg0);

      xpc_object_t message = XpcConnection::ObjectToXpcObject(object);
      p->sendMessage(message);
      xpc_release(message);
    }
  }

  NanReturnValue (NanUndefined());
}

extern "C" {

  static void init (v8::Handle<v8::Object> target) {
    XpcConnection::Init(target);
  }

  NODE_MODULE(binding, init);
}
