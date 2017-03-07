/**
 * Copyright 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var openwhisk = require('openwhisk');

    var http = require("follow-redirects").http;
    var https = require("follow-redirects").https;
    var urllib = require("url");
    var when = require('when');

    // API to retrieve OW Action source code at runtime.
    RED.httpAdmin.get('/openwhisk-action', function (req, res) {
      if (!req.query.id && !req.query.key) {
        return res.json("");
      }

      var client;

      if (req.query.id) {
        client = RED.nodes.getNode(req.query.id).client;
      } else {
        client = openwhisk({api: req.query.api, api_key: req.query.key});
      }

      client.actions.get({actionName: req.query.action, namespace: req.query.namespace})
        .then(function (result) { 
          console.log("action get result: " + JSON.stringify(result));
          if(result.exec.kind == "java"){
            delete result.exec.jar;
          }
          res.json(result) })
        .catch(function (err) { console.log("action get error: " + err); res.json({exec: {code: ""}});});
    });

    // API to retrieve OW Trigger definition at runtime.
    RED.httpAdmin.get('/openwhisk-trigger', function (req, res) {
      if (!req.query.id && !req.query.key) {
        return res.json("");
      }

      var client;

      if (req.query.id) {
        client = RED.nodes.getNode(req.query.id).client;
      } else {
        client = openwhisk({api: req.query.api, api_key: req.query.key});
      }

      client.triggers.get({triggerName: req.query.trigger, namespace: req.query.namespace})
        .then(function (result) { res.json(result) })
        .catch(function (err) { console.log(err); res.json({parameters: []});});
    });

    // API to retrieve OW Trigger definition at runtime.
    RED.httpAdmin.get('/openwhisk-namespace-list', function (req, res) {
      if (!req.query.id && !req.query.key) {
        return res.json("");
      }

      var client;

      if (req.query.id) {
        client = RED.nodes.getNode(req.query.id).client;
      } else {
        client = openwhisk({api: req.query.api, api_key: req.query.key});
      }

      client.namespaces.list()
        .then(function (result) { res.json(result) })
        .catch(function (err) { console.log(err); res.json({parameters: []});});
    });

    function OpenWhiskLocalClient(node, docker){
      this.docker = docker;

      var that = this;
      this.cleanup = function(){
          // return when.promise(function(resolve,reject) {
            var opts= { "filters": { "label": [ "node=" + node.id ] } };
            that.docker.listContainers(opts, function (err, containers) {
              console.log("listed containers: " + containers);
              if(containers.length > 0){
                containers.forEach(function (containerInfo) {
                  console.log("reduced with containerInfo " + JSON.stringify(containerInfo));
                  var container = that.docker.getContainer(containerInfo.Id);
                  console.log("got container " + JSON.stringify(container));
                  container.stop(function(data){
                      console.log("container stopped, data " + data);
                      container.remove(function(data){
                        console.log("container removed, data: " + data);
                      });
                  });
                }
              )}              
            });
          // });
        };

      this.invoke = function(container, params){
          return when.promise(function(resolve,reject) {
            console.log("in invoke on container with: " + JSON.stringify(container) + "/" + JSON.stringify(params));
            request("POST", {"value": params}, "http://" + container + ":8080/run").then(function(result){
              resolve({response: {result: result}});
            });
          });
        };

      // resolves container address
      this.create = function(req){
        return when.promise(function(resolve,reject) {

          // //protocol http vs https is automatically detected
          // var docker = new Docker({ host: req.docker, port: 2375});

          console.log("----------process.cwd(); " + process.cwd());
          console.log("docker: " + that.docker);

          var os = require("os");
          var redhostname = os.hostname();
          console.log("++++++++++++hostname: " + redhostname);

          // get node-red container info
          var container = that.docker.getContainer(redhostname);
          // console.log("++++++++++++NODERED container: " + JSON.stringify(container));

          container.inspect(function (err, containerInfo) {
              // console.log("+++++++++NODERED containerInfo: " +  JSON.stringify(containerInfo));

              // get network id
              var nwName;
              var nwid = Object.keys(containerInfo.NetworkSettings.Networks).map(function(key, index) {
                  nwName = key;
                  return containerInfo.NetworkSettings.Networks[key].NetworkID;
              })[0];

              var imageName = req.exec.kind + "action";
              console.log("----------getting docker image: " + JSON.stringify(imageName));
              var image = that.docker.getImage(imageName);
              console.log("------found docker image: " + JSON.stringify(image) + ", node.id: " + node.id);

              that.docker.createContainer({Image: imageName, Labels: {"action": req.actionName, "node": node.id}}, function (err, container) {
                  if(err){
                    console.log("err: " + err);
                    console.log("jErr: " + JSON.stringify(err));
                    reject(err);
                  }
                  var network = that.docker.getNetwork(nwid);
                  console.log("Attaching network " + JSON.stringify(network) + " to container " + container.id);
                  network.connect({Container: container.id}, function (err, data) {
                      console.log("Network connected: " + JSON.stringify(data));

                      console.log("Starting container");
                      container.start(function (err, data) {
                          console.log("Container started: " + JSON.stringify(data));

                          container.inspect(function (err, containerInfo) {
                              console.log("node.resolution: " + node.resolution);

                              //by default is by IP
                              var address = containerInfo.NetworkSettings.Networks[nwName].IPAddress;
                              if(node.resolution == "dns"){
                                  address = containerInfo.NetworkSettings.Networks[nwName].Aliases[0];
                              }

                              console.log(req.actionName + " address: " +  address);

                              var init = function(){
                                  var main = req.exec.main;
                                  var jar = req.exec.jar;
                                  request("POST", {value: { main: "Hello", jar: jar}}, "http://" + address + ":8080/init").then(function(result){
                                      console.log("init result: " + JSON.stringify(result));  //TODO: add validation that result is ok
                                      resolve(address);
                                  });
                              };
                              var waitToStart = function(){
                                  request("POST", {value: {x:1}}, "http://" + address + ":8080/run").then(function(result){
                                      console.log("result: " + result);
                                      if(JSON.stringify(result).indexOf("uninitialized") == -1){
                                        setTimeout(waitToStart, 100);
                                      }else{
                                        console.log("Container can be inited!");
                                        init();
                                      }
                                  }).catch(function (err) {
                                    console.log("error: " + err);
                                    setTimeout(waitToStart, 100);
                                  });
                              };

                              waitToStart();
                          });
                      });
                  });
              });
          });
        });
      };
    }

    function OpenWhiskService(n){
        RED.nodes.createNode(this,n);
        this.name = n.name;
        this.api = n.api;
        if (/\/$/.test(this.api)) {
            this.api = this.api.substring(this.api.length-1);
        }

        this.valid = /^https?:\/\/.*/.test(this.api) && this.credentials.key;
        if (!this.valid) {
            if (!this.credentials.key) {
                this.error("Missing api key");
            }
            if (!/^https?:\/\/.*/.test(this.api)) {
                this.error("Missing api url");
            }
        }

        this.client = openwhisk({api: this.api, api_key: this.credentials.key});
    }

    RED.nodes.registerType("openwhisk-service",OpenWhiskService,{
        credentials: {
            key: {type:"password"}
        }
    });

    function OpenWhiskLocalService(n){
        RED.nodes.createNode(this,n);
        this.name = n.name;
        this.dockerurl = n.dockerurl;
        var node = this;
        if (/\/$/.test(this.dockerurl)) {
            this.dockerurl = this.dockerurl.substring(this.dockerurl.length-1);
        }

        this.dockerPort = urllib.parse(node.dockerurl).port;

        if(!this.dockerurl || !this.dockerPort){
          node.error("Invalid docker url, example of valid url: http://mydockerhost:2375");
          return;
        }

        var Docker = require('dockerode');
        var docker = new Docker({ host: node.dockerurl, port: node.dockerPort});
        docker.version(function(err, res){
          if(err){
            node.status({fill:"red", shape:"dot", text:err.message});
            node.error(err.message, err.message);
            return;
          }else{
            node.client = new OpenWhiskLocalClient(node, docker);
            console.log("CLEANUP !!!");
            
            node.client.cleanup();
            console.log("CLEANUP Finished ????");
          }
        });
    }

    RED.nodes.registerType("openwhisk-localservice",OpenWhiskLocalService);

    function OpenWhiskTrigger(n){
        RED.nodes.createNode(this,n);
        this.namespace = n.namespace;
        this.trigger = n.trigger;
        this.service = RED.nodes.getNode(n.service);
        if (!this.service || !this.service.valid) {
            return;
        }
        var node = this;

        if (n.edit) {
          node.log('Deploying OpenWhisk Trigger: ' + n.namespace + '/' + n.trigger);
          node.status({fill:"yellow",shape:"dot",text:"deploying"});

          var params = n.params.filter(function (param) {
            return param.key && param.key !== '';
          })

          var trigger = { 
            parameters: params
          };

          this.service.client.triggers.update({triggerName: n.trigger, namespace: n.namespace, trigger: trigger})
            .then(function (res) {
              node.status({});
            })
            .catch(function (err) {
              node.status({fill:"red", shape:"dot", text:"deploy failed"});
              node.error(err.message, err.message);
            });
        }


        this.on('input', function(msg) {
            var namespace = node.namespace || msg.namespace;
            var trigger = node.trigger || msg.trigger;

            if (!namespace) {
                return node.error("No namespace provided",msg);
            } else if (!trigger) {
                return node.error("No trigger provided",msg);
            }
            node.status({fill:"yellow",shape:"dot",text:"invoking"});

            var params = msg.payload;
            if (typeof params !== "object") {
              params = {};
            }

            node.service.client.triggers.invoke({triggerName: trigger, namespace: namespace, params: params})
              .then(function (res) {
                node.status({});
              })
              .catch(function (err) {
                node.status({fill:"red", shape:"dot", text:"failed"});
                node.error(err.message, err.message);
              });
        })
    }

    RED.nodes.registerType("openwhisk-trigger",OpenWhiskTrigger);

    function OpenWhiskAction(n){
        RED.nodes.createNode(this,n);
        this.namespace = n.namespace;
        this.action = n.action;
        this.service = RED.nodes.getNode(n.service);
        this.localservice = RED.nodes.getNode(n.localservice);
        this.locally = n.locally;
        
        if (!this.service || !this.service.valid) {
            return;
        }

        var node = this;

        if (n.edit) {
          node.log('Deploying OpenWhisk Action: ' + n.namespace + '/' + n.action);
          node.status({fill:"yellow",shape:"dot",text:"deploying"});

          var params = n.params.filter(function (param) {
            return param.key && param.key !== '';
          })

          var action = { 
            exec: { kind: 'nodejs', code: n.func },
            parameters: params
          };

          this.service.client.actions.update({actionName: n.action, namespace: n.namespace, action: action})
            .then(function (res) {
              node.status({});
            })
            .catch(function (err) {
              node.status({fill:"red", shape:"dot", text:"deploy failed"});
              node.error(err.message, err.message);
            });
        }

        if(this.localservice && node.action && node.namespace && node.locally){
            console.log("Getting action: " + node.action);
            this.service.client.actions.get({actionName: node.action, namespace: node.namespace}).then(function (result) { 
              console.log("Got action: " + JSON.stringify(result));

              if(!node.localservice.client){
                throw new Error("local docker client not initilized");
              }

              node.localservice.client.create({actionName: node.action, exec: result.exec, docker: node.localservice.dockerurl})
                .then(function (result) {
                  console.log("container create result: " + result);
                  node.actioncontainer = result;
                  node.status({});
                })
                .catch(function (err) {
                  node.status({fill:"red", shape:"dot", text:err.message});
                  node.error(err.message, err.message);
                });
            })
            .catch(function (err) {
              node.status({fill:"red", shape:"dot", text:err.message});
              node.error(err.message, err.message);
            });
        }

        this.on('input', function(msg) {
            var namespace = node.namespace || msg.namespace;
            var action = node.action || msg.action;

            if (!namespace) {
                return node.error("No namespace provided",msg);
            } else if (!action) {
                return node.error("No action provided",msg);
            }

            node.status({fill:"yellow",shape:"dot",text:"running"});

            var params = msg.payload;
            if (typeof params !== "object") {
              params = {};
            }

            if(node.localservice && node.actioncontainer){
                node.localservice.client.invoke(node.actioncontainer, params)
                .then(function (res) {
                  msg.data = res;
                  msg.payload = res.response.result;
                  node.status({});
                  node.send(msg);
                })
                .catch(function (err) {
                  node.status({fill:"red", shape:"dot", text:"failed"});
                  node.error(err.message, err.message);
                });
            }else{
              node.service.client.actions.invoke({actionName: action, namespace: namespace, blocking: true, params: params})
                .then(function (res) {
                  msg.data = res;
                  msg.payload = res.response.result;
                  node.status({});
                  node.send(msg);
                })
                .catch(function (err) {
                  node.status({fill:"red", shape:"dot", text:"failed"});
                  node.error(err.message, err.message);
                });
            }
        })

    }
    RED.nodes.registerType("openwhisk-action",OpenWhiskAction);

    function request(method, payload, url) {
      var opts = urllib.parse(url);
      opts.method = method;
      opts.headers = {"Content-Type": "application/json"};

      return when.promise(function(resolve,reject) {
        var req = ((/^https/.test(url))?https:http).request(opts,function(res) {
          var result = "";
          res.on('data',function(chunk) {
            result += chunk;
          });

          res.on('end',function() {
            // try {
            //   result = JSON.parse(result);
            // }catch(e) { reject(e) }

            resolve(result);
          });
        });

        req.on('error',function(err) { reject(err) });

        console.log("++++++++++++++   sending payload: " + JSON.stringify(payload));
        req.end(JSON.stringify(payload));
      });
    }
}
