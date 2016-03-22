node-red-node-openwhisk
=======================

A set of Node-RED nodes for interacting with IBM Bluemix OpenWhisk.

## Install

Run the following command in the user directory of your Node-RED install. This is
usually `~/.node-red`.

```
npm install node-red-node-openwhisk
```

## Usage

### Service configuration

The OpenWhisk Service configuration node allows you to provide your authentication
key for the service and share it with the other OpenWhisk nodes.

By default, the service node targets the IBM Bluemix OpenWhisk service, but the API
URL can be overridden for when running against another instance.

### Invoke a trigger

The trigger node can be used to invoke a trigger at the end of a flow.

The namespace and trigger can be configured in the node or, if left blank,
provided by `msg.namespace` and `msg.trigger` respectively.

`msg.payload` should be an object of key-value pairs to pass to the trigger;
any other type is ignored.

### Invoke an action

The action node can be used to invoke an action and pass on the result in the flow.

The namespace and trigger can be configured in the node or, if left blank,
provided by `msg.namespace` and `msg.action` respectively.

`msg.payload` should be an object of key-value pairs to pass to the
action; any other type is ignored.

The output message contains the following properties:

  - `payload` is the result of the action
  - `data` is the complete response object
