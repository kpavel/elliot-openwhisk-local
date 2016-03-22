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
    var request = require('request');

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
    }
    function sendRequest(service,endPoint,opts,done) {
        var url = service.api+endPoint;
        opts = opts || {};
        opts.headers = {
            "Content-type": "application/json",
            "Authorization": "Basic "+new Buffer(service.credentials.key).toString('base64')
        };
        if (typeof opts.body !== "object") {
            opts.body = {};
        }
        request(url,opts,function(err,resp,body) {
            if (err) {
                return done(err);
            } else if (resp.statusCode !== 200) {
                return done(new Error("Unexpected response: "+resp.statusCode));
            }
            return done(null,body);
        })
    }


    RED.nodes.registerType("openwhisk-service",OpenWhiskService,{
        credentials: {
            key: {type:"password"}
        }
    });

    function OpenWhiskTrigger(n){
        RED.nodes.createNode(this,n);
        this.namespace = n.namespace;
        this.trigger = n.trigger;
        this.service = RED.nodes.getNode(n.service);
        if (!this.service || !this.service.valid) {
            return;
        }
        var node = this;
        this.on('input', function(msg) {
            var namespace = node.namespace || msg.namespace;
            var trigger = node.trigger || msg.trigger;

            if (!namespace) {
                return node.error("No namespace provided",msg);
            } else if (!action) {
                return node.error("No action provided",msg);
            }
            node.status({fill:"yellow",shape:"dot",text:"invoking"});
            sendRequest(this.service,"/namespaces/"+namespace+"/triggers/"+trigger,{method:"POST",body:msg.payload,json:true},function(err,res) {
                if (err) {
                    node.status({fill:"red",shape:"dot",text:"failed"});
                    return node.error(err,msg);
                } else if (res.error) {
                    node.status({fill:"red",shape:"dot",text:"failed"});
                    return node.error(res.error,msg);
                } else {
                    node.status({});
                }
            })
        })

    }
    RED.nodes.registerType("openwhisk-trigger",OpenWhiskTrigger);

    function OpenWhiskAction(n){
        RED.nodes.createNode(this,n);
        this.namespace = n.namespace;
        this.action = n.action;
        this.service = RED.nodes.getNode(n.service);
        if (!this.service || !this.service.valid) {
            return;
        }
        var node = this;
        this.on('input', function(msg) {
            var namespace = node.namespace || msg.namespace;
            var action = node.action || msg.action;

            if (!namespace) {
                return node.error("No namespace provided",msg);
            } else if (!action) {
                return node.error("No action provided",msg);
            }

            node.status({fill:"yellow",shape:"dot",text:"running"});
            sendRequest(this.service,"/namespaces/"+namespace+"/actions/"+action,{method:"POST",body:msg.payload,json:true,qs:{blocking:"true"}},function(err,res) {
                if (err) {
                    node.status({fill:"red",shape:"dot",text:"failed"});
                    return node.error(err,msg);
                } else if (res.error) {
                    node.status({fill:"red",shape:"dot",text:"failed"});
                    return node.error(res.error,msg);
                } else {
                    msg.data = res;
                    msg.payload = res.response.result;
                    node.status({});
                    node.send(msg);
                }
            })
        })

    }
    RED.nodes.registerType("openwhisk-action",OpenWhiskAction);
}
