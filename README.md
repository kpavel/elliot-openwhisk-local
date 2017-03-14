elliot-openwhisk-local
======================

***WORK IN PROGRESS*** - DO NOT use this node except for experimentation.

A set of Node-RED nodes for interacting with Apache OpenWhisk (such as [IBM Bluemix OpenWhisk](https://console.ng.bluemix.net/openwhisk)).

Includes a 'local' mode, where Node-RED is using a local Docker API to provision and manage local instances of OpenWhisk action containers (retrieved from a remote OpenWhisk service on demand).

Currently Node-RED itself must run in a container managed by the same Docker endpoint (to simplify connectivity setup). Docker API can be accessible on a local socket (e.g., with `/var/run/docker.sock` mapped from the Docker host into Node-RED container), or via a remote API.

## Local Mode Setup
### Prereqs
You will need a Docker host, where the entire deployment will be hosted (both Node-RED and the action containers)
### Node-RED container
The easiest way to deploy a properly configured instance of Node-RED is by using docker-compose, using the following docker-compose.yml:
```yaml
version: '2'
services:
    node-red:
        image: nodered/node-red-docker
        user: root
        ports:
            - 8080:1880
        volumes:
            - /var/run/docker.sock:/var/run/docker.sock
            - /tmp/data:/data
```

### Base images for actions
OpenWhisk maintains in Docker hub a set of base images for native runtimes - e.g., `openwhisk/nodejs6action`, `openwhisk/pythonaction`, `openwhisk/javaaction`, etc. These (or equivalent) images must be present at the local Docker host, without the `openwhisk/` prefix (this way we can customize the local deployment as needed - e.g., building images for a different hardware architecture). For example:
```shell
$ docker pull openwhisk/nodejs6action
$ docker tag openwhisk/nodejs6action nodejs6action
```
These images will be used to spawn containers for 'native' actions (e.g., created with `--kind nodejs:6`). For docker/blackbox actions, the respective Docker hub image will be pulled on-demand (notice that at the moment there is no hook for replacing it with a customized image -- e.g., one that fits the target hardware architecture).
### Installing OpenWhisk nodes
In order to use OpenWhisk nodes in Node-RED, you need to install the required nodejs modules in the `/data` volume specified in `docker-compose.yml` above:
```
$ cd /tmp/data
$ npm install kpavel/elliot-openwhisk-local
```
### Run
Now you can start the Node-RED container:
```
$ docker-compose up
```
Then open the Node-RED editor at `http://<your-docker-host>:8080/`, and starting building the flow (alternatively, put your pre-designed `flows.json` in the data directory). In order to set up an OpenWhisk Action node to run locally, specify "service", "namespace" and "action" as with regular OpenWhisk Action node, then specify "Local" in the "Runtime" drop-down, and select "Docker engine on localhost" in "Docker" drop-down (the passthru of `/var/run/docker.sock`, as specified in the respective volume mapping in `docker-compose.yml`, ensures that Docker socket is available within the Node-RED container too).

That's it! Enjoy the local mode.

**Note:** the rest of this README does not reflect the specifics of the 'local' mode.

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
