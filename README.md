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

### Create or edit a trigger

The trigger node can be used to create new triggers or modify properties for
existing ones.

Fill in the service, namespace and trigger name in the edit dialog. The node will
retrieve and display the current trigger properties from the OpenWhisk service.

Selecting the "Allow Edits" checkbox will allow you to modify these properties.

On deployment, the updated properties will be published to the OpenWhisk
provider.

### Invoke an action

The action node can be used to invoke an action and pass on the result in the flow.

The namespace and trigger can be configured in the node or, if left blank,
provided by `msg.namespace` and `msg.action` respectively.

`msg.payload` should be an object of key-value pairs to pass to the
action; any other type is ignored.

The output message contains the following properties:

  - `payload` is the result of the action
  - `data` is the complete response object

### Create or edit an action

The action node can be used to create new actions or modify properties for
existing ones.

Fill in the service, namespace and action name in the edit dialog. The node will
retrieve and display the current action source and properties from the OpenWhisk service.

Selecting the "Allow Edits" checkbox will allow you to modify these properties.

On deployment, the updated properties will be published to the OpenWhisk
provider.
