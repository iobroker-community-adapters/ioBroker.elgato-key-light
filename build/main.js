"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_register = require("source-map-support/register");
var import_object_definition = require("./lib/object_definition");
var import_color = require("./lib/color");
var import_axios = __toESM(require("axios"));
var import_source_map_support = __toESM(require("source-map-support"));
import_source_map_support.default.install();
class ElgatoKeyLight extends utils.Adapter {
  constructor(options = {}) {
    super({
      ...options,
      name: "elgato-key-light"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
    this.requestTimer = null;
    this.messageHandlerTimer = null;
    this.messageHandler = [];
    this.devices = [];
    this.interval = 5e3;
    this.requestObject = [];
  }
  async onReady() {
    this.messageHandler = [];
    this.devices = [];
    this.requestObject = [];
    this.interval = this.config.interval * 1e3;
    this.setState("info.connection", false, true);
    const devices = await this.getDevicesAsync();
    if (devices.length !== 0) {
      for (const devicesKey in devices) {
        this.devices.push(devices[devicesKey].native.device);
        await this.createStates(devices[devicesKey].native.device);
      }
      this.writeLog(`[Adapter v.${this.version} onReady] all devices: ${this.devices.length}`, "debug");
    } else {
      this.writeLog(`[Adapter v.${this.version} onReady] no devices found`, "debug");
      await this.setStateAsync("info.connections", { val: JSON.stringify([]), ack: true });
    }
    this.writeLog(`[Adapter v.${this.version} onReady] start requestData`, "debug");
    await this.requestData();
    this.setState("info.connection", true, true);
  }
  async requestData() {
    var _a;
    if (this.requestTimer)
      this.clearTimeout(this.requestTimer);
    this.requestObject = [];
    for (const device of this.devices) {
      const data = {
        ip: device.ip,
        port: device.port
      };
      this.writeLog(
        `[Adapter v.${this.version} requestData] request data for ${(_a = device.info) == null ? void 0 : _a.serialNumber}`,
        "debug"
      );
      await this.requestKeyLight(data);
    }
    this.requestTimer = this.setTimeout(() => {
      this.writeLog(`[Adapter v.${this.version} requestData] next request in ${this.interval} ms`, "debug");
      this.requestData();
    }, this.interval);
  }
  async writeState(device) {
    var _a, _b, _c, _d;
    if (!device)
      return;
    let deviceName = "";
    if (device.info) {
      this.writeLog(
        `[Adapter v.${this.version} writeState] write all info states for ${device.info.displayName}`,
        "debug"
      );
      deviceName = device.info.serialNumber;
      await this.setStateAsync(`${deviceName}.info.ip`, { val: device.ip, ack: true });
      await this.setStateAsync(`${deviceName}.info.port`, { val: device.port, ack: true });
      for (const [key, value] of Object.entries(device.info)) {
        if (key !== "wifi-info") {
          if (key === "features") {
            await this.setStateAsync(`${deviceName}.info.${key}`, {
              val: JSON.stringify(value),
              ack: true
            });
          } else if (key === "displayName") {
            const deviceConfig = this.devices.find(
              (element) => {
                var _a2, _b2;
                return ((_a2 = element.info) == null ? void 0 : _a2.serialNumber) === ((_b2 = device.info) == null ? void 0 : _b2.serialNumber);
              }
            );
            if (deviceConfig) {
              if (((_a = deviceConfig.info) == null ? void 0 : _a.displayName) !== value) {
                const index = this.devices.findIndex(
                  (element) => {
                    var _a2, _b2;
                    return ((_a2 = element.info) == null ? void 0 : _a2.serialNumber) === ((_b2 = device.info) == null ? void 0 : _b2.serialNumber);
                  }
                );
                if (index !== -1) {
                  this.devices[index].info.displayName = value;
                  this.writeLog(
                    `[Adapter v.${this.version} writeState] Change name of ${(_b = device.info) == null ? void 0 : _b.displayName} to ${value}`,
                    "debug"
                  );
                  await this.setStateAsync(`${deviceName}.info.${key}`, {
                    val: value,
                    ack: true
                  });
                  await this.createStates(device);
                }
              } else {
                this.writeLog(
                  `[Adapter v.${this.version} writeState] Name of ${(_c = device.info) == null ? void 0 : _c.displayName} is ${value}`,
                  "debug"
                );
                await this.setStateAsync(`${deviceName}.info.${key}`, { val: value, ack: true });
              }
            }
          } else {
            this.writeLog(
              `[Adapter v.${this.version} writeState] write state ${key} with value ${value}`,
              "debug"
            );
            await this.setStateAsync(`${deviceName}.info.${key}`, { val: value, ack: true });
          }
        } else {
          for (const [key2, value2] of Object.entries(value)) {
            this.writeLog(
              `[Adapter v.${this.version} writeState] write state ${key2} with value ${value2}`,
              "debug"
            );
            await this.setStateAsync(`${deviceName}.info.wifi-info.${key2}`, {
              val: value2,
              ack: true
            });
          }
        }
      }
    }
    if (device.battery) {
      this.writeLog(`[Adapter v.${this.version} writeState] write battery state`, "debug");
      for (const [key, value] of Object.entries(device.battery)) {
        if (key === "powerSource") {
          await this.setStateAsync(`${deviceName}.battery.${key}`, {
            val: value === 1 ? "power supplies" : value === 2 ? "battery" : "unknown",
            ack: true
          });
        } else if (key === "currentBatteryVoltage") {
          await this.setStateAsync(`${deviceName}.battery.${key}`, {
            val: value / 1e3,
            ack: true
          });
        } else if (key === "inputChargeVoltage") {
          await this.setStateAsync(`${deviceName}.battery.${key}`, {
            val: value / 1e3,
            ack: true
          });
        } else if (key === "inputChargeCurrent") {
          await this.setStateAsync(`${deviceName}.battery.${key}`, {
            val: value / 1e3,
            ack: true
          });
        } else if (key === "level") {
          await this.setStateAsync(`${deviceName}.battery.${key}`, {
            val: Math.round(value),
            ack: true
          });
        } else {
          await this.setStateAsync(`${deviceName}.battery.${key}`, { val: value, ack: true });
        }
      }
    }
    if (device.settings) {
      this.writeLog(`[Adapter v.${this.version} writeState] write settings state`, "debug");
      for (const [key, value] of Object.entries(device.settings)) {
        if (key !== `battery`) {
          if (key === "powerOnTemperature") {
            const temp = Math.round(1e6 / value);
            await this.setStateAsync(`${deviceName}.settings.${key}`, { val: temp, ack: true });
          } else {
            await this.setStateAsync(`${deviceName}.settings.${key}`, { val: value, ack: true });
          }
        } else {
          if (device.settings.battery) {
            for (const [key2, value2] of Object.entries(device.settings.battery)) {
              if (key2 !== `energySaving`) {
                await this.setStateAsync(`${deviceName}.settings.battery.${key2}`, {
                  val: value2,
                  ack: true
                });
              } else {
                for (const [key3, value3] of Object.entries(device.settings.battery.energySaving)) {
                  if (key3 !== `adjustBrightness`) {
                    await this.setStateAsync(
                      `${deviceName}.settings.battery.energySaving.${key3}`,
                      {
                        val: value3,
                        ack: true
                      }
                    );
                  } else {
                    for (const [key4, value4] of Object.entries(
                      device.settings.battery.energySaving.adjustBrightness
                    )) {
                      await this.setStateAsync(
                        `${deviceName}.settings.battery.energySaving.adjustBrightness.${key4}`,
                        {
                          val: value4,
                          ack: true
                        }
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (device.light) {
      this.writeLog(`[Adapter v.${this.version} writeState] write light state`, "debug");
      for (const [key, value] of Object.entries(device.light)) {
        if (key !== `lights`) {
          await this.setStateAsync(`${deviceName}.light.${key}`, { val: value, ack: true });
        } else {
          for (const [key2, value2] of Object.entries(device.light.lights)) {
            for (const [key3, value3] of Object.entries(value2)) {
              if (key3 === "brightness") {
                await this.setStateAsync(`${deviceName}.light.lights.${key2}.${key3}`, {
                  val: value3,
                  ack: true
                });
              }
              if (key3 === "saturation") {
                await this.setStateAsync(`${deviceName}.light.lights.${key2}.${key3}`, {
                  val: value3,
                  ack: true
                });
              }
              if (key3 === "on") {
                await this.setStateAsync(`${deviceName}.light.lights.${key2}.${key3}`, {
                  val: value3 === 1,
                  ack: true
                });
              }
              if (key3 === "temperature") {
                const kelvin = Math.round(1e6 / value3);
                await this.setStateAsync(`${deviceName}.light.lights.${key2}.${key3}`, {
                  val: kelvin,
                  ack: true
                });
              }
              if (key3 === "hue") {
                await this.setStateAsync(`${deviceName}.light.lights.${key2}.${key3}`, {
                  val: value3,
                  ack: true
                });
                if (((_d = device.info) == null ? void 0 : _d.productName) === "Elgato Light Strip") {
                  const stripDevice = device.light;
                  let hue = stripDevice.lights[0].hue;
                  let sat = stripDevice.lights[0].saturation;
                  let bri = stripDevice.lights[0].brightness;
                  if (!hue)
                    hue = 0;
                  if (!sat)
                    sat = 0;
                  if (!bri)
                    bri = 0;
                  const hex = (0, import_color.hsbToHex)(hue, sat, bri);
                  this.writeLog(
                    `[Adapter v.${this.version} writeState] convert hsb hue: ${hue}, sat: ${sat}, bri: ${bri} to hex: ${hex} for device: ${deviceName} and write to state `,
                    "debug"
                  );
                  const rgb = (0, import_color.hsbToRgb)(hue, sat, bri);
                  await this.setStateAsync(`${deviceName}.light.lights.${key2}.hex`, {
                    val: hex,
                    ack: true
                  });
                  await this.setStateAsync(`${deviceName}.light.lights.${key2}.rgb`, {
                    val: rgb,
                    ack: true
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  async createStates(device) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J;
    let deviceName = "";
    if (device.info) {
      deviceName = device.info.serialNumber;
      this.writeLog(
        `[Adapter v.${this.version} createStates] create info states for device: ${deviceName}`,
        "debug"
      );
      await this.extendObjectAsync(deviceName, {
        type: "device",
        common: {
          name: device.info.displayName || device.info.productName,
          statusStates: {
            onlineId: `${this.namespace}.${deviceName}.reachable`
          }
        },
        native: {
          ip: device.ip,
          port: device.port,
          device
        }
      });
      await this.extendObjectAsync(`${deviceName}.info`, {
        type: "channel",
        common: {
          name: `${(_a = device.info) == null ? void 0 : _a.displayName} / Info`,
          desc: "Information about the device"
        },
        native: {}
      });
      await this.extendObjectAsync(`${deviceName}.identify`, {
        type: "state",
        common: {
          name: `${device.info.displayName} / Identify`,
          desc: "Identify the device",
          type: "boolean",
          role: "button",
          def: true,
          read: true,
          write: true
        },
        native: {
          ip: device.ip,
          port: device.port,
          productName: device.info.productName
        }
      });
      this.subscribeStates(`${deviceName}.identify`);
      await this.extendObjectAsync(`${deviceName}.reachable`, {
        type: "state",
        common: {
          name: `${(_b = device.info) == null ? void 0 : _b.displayName} / Reachable`,
          desc: "Is the device reachable",
          type: "boolean",
          role: "indicator.reachable",
          def: false,
          read: true,
          write: false
        },
        native: {}
      });
      await this.extendObjectAsync(`${deviceName}.info.ip`, {
        type: "state",
        common: {
          name: `${(_c = device.info) == null ? void 0 : _c.displayName} / IP Address`,
          desc: "IP of the device",
          type: "string",
          role: "info.ip",
          read: true,
          write: false
        },
        native: {
          ip: device.ip,
          port: device.port,
          productName: device.info.productName
        }
      });
      await this.extendObjectAsync(`${deviceName}.info.port`, {
        type: "state",
        common: {
          name: `${(_d = device.info) == null ? void 0 : _d.displayName} / Port`,
          desc: "Port of the device",
          type: "number",
          role: "info.port",
          read: true,
          write: false
        },
        native: {
          ip: device.ip,
          port: device.port,
          productName: device.info.productName
        }
      });
      await this.extendObjectAsync(`info.connections`, {
        type: "state",
        common: {
          name: "Connections",
          desc: "Configured connections",
          type: "string",
          role: "json",
          read: true,
          write: false
        },
        native: {}
      });
      for (const [key] of Object.entries(device.info)) {
        if (key !== "wifi-info") {
          let common = { name: "", role: "", read: false, write: false };
          common = import_object_definition.stateAttrb[key];
          await this.extendObjectAsync(`${deviceName}.info.${key}`, {
            type: "state",
            common: {
              ...common,
              name: `${(_e = device.info) == null ? void 0 : _e.displayName} / ${common.name}`
            },
            native: {
              ip: device.ip,
              port: device.port,
              productName: device.info.productName
            }
          });
          if (common.write) {
            this.subscribeStates(`${deviceName}.info.${key}`);
          }
        } else {
          for (const [key2] of Object.entries(device.info["wifi-info"])) {
            await this.extendObjectAsync(`${deviceName}.info.${key}`, {
              type: "channel",
              common: {
                name: `${(_f = device.info) == null ? void 0 : _f.displayName} / wifi-info`,
                desc: "Information about the wifi"
              },
              native: {}
            });
            let common = { name: "", role: "", read: false, write: false };
            common = import_object_definition.stateAttrb[key2];
            await this.extendObjectAsync(`${deviceName}.info.${key}.${key2}`, {
              type: "state",
              common: {
                ...common,
                name: `${(_g = device.info) == null ? void 0 : _g.displayName} / ${common.name}`
              },
              native: {
                ip: device.ip,
                port: device.port,
                productName: device.info.productName
              }
            });
            if (common.write) {
              this.subscribeStates(`${deviceName}.info.${key}.${key2}`);
            }
          }
        }
      }
    }
    if (device.battery) {
      this.writeLog(`[Adapter v.${this.version} createStates] create battery states for ${deviceName}`, "debug");
      await this.extendObjectAsync(`${deviceName}.battery`, {
        type: "channel",
        common: {
          name: `${(_h = device.info) == null ? void 0 : _h.displayName} / battery Info`,
          desc: "battery info of the device"
        },
        native: {}
      });
      for (const [key] of Object.entries(device.battery)) {
        let common = { name: "", role: "", read: false, write: false };
        common = import_object_definition.stateAttrb[key];
        await this.extendObjectAsync(`${deviceName}.battery.${key}`, {
          type: "state",
          common: {
            ...common,
            name: `${(_i = device.info) == null ? void 0 : _i.displayName} / ${common.name}`
          },
          native: {
            ip: device.ip,
            port: device.port,
            productName: (_j = device.info) == null ? void 0 : _j.productName
          }
        });
      }
    }
    if (device.light) {
      this.writeLog(`[Adapter v.${this.version} createStates] create light states for ${deviceName}`, "debug");
      await this.extendObjectAsync(`${deviceName}.light`, {
        type: "channel",
        common: {
          name: `${(_k = device.info) == null ? void 0 : _k.displayName} / Light`,
          desc: "Light settings of the device"
        },
        native: {}
      });
      for (const [key] of Object.entries(device.light)) {
        await this.extendObjectAsync(`${deviceName}.light.${key}`, {
          type: "channel",
          common: {
            name: `${(_l = device.info) == null ? void 0 : _l.displayName} / lights`,
            desc: "Information about the lights"
          },
          native: {}
        });
        if (key !== `lights`) {
          let common = {
            name: "",
            role: "",
            read: false,
            write: false
          };
          common = import_object_definition.stateAttrb[key];
          await this.extendObjectAsync(`${deviceName}.light.${key}`, {
            type: "state",
            common: {
              ...common,
              name: `${(_m = device.info) == null ? void 0 : _m.displayName} / ${common.name}`
            },
            native: {
              ip: device.ip,
              port: device.port,
              productName: (_n = device.info) == null ? void 0 : _n.productName
            }
          });
          if (common.write) {
            this.subscribeStates(`${deviceName}.light.${key}`);
          }
        } else {
          for (const [key2, value2] of Object.entries(device.light.lights)) {
            await this.extendObjectAsync(`${deviceName}.light.${key}.${key2}`, {
              type: "channel",
              common: {
                name: `${(_o = device.info) == null ? void 0 : _o.displayName} / lights.${key2}`,
                desc: "Information about the lights"
              },
              native: {}
            });
            for (const [key3] of Object.entries(value2)) {
              let common = {
                name: "",
                role: "",
                read: false,
                write: false
              };
              if (key3 == "hue" || key3 == "saturation" || key3 == "brightness" || key3 == "temperature" || key3 == "on") {
                common = import_object_definition.stateAttrb[key3];
                await this.extendObjectAsync(`${deviceName}.light.${key}.${key2}.${key3}`, {
                  type: "state",
                  common: {
                    ...common,
                    name: `${(_p = device.info) == null ? void 0 : _p.displayName} / ${common.name}`
                  },
                  native: {
                    ip: device.ip,
                    port: device.port,
                    productName: (_q = device.info) == null ? void 0 : _q.productName
                  }
                });
                if (common.write) {
                  this.subscribeStates(`${deviceName}.light.${key}.${key2}.${key3}`);
                  this.subscribeStates(`${deviceName}.light.${key}.${key2}.hue`);
                  this.subscribeStates(`${deviceName}.light.${key}.${key2}.saturation`);
                }
                if (((_r = device.info) == null ? void 0 : _r.productName) === "Elgato Light Strip") {
                  const hex = import_object_definition.stateAttrb.hex;
                  await this.extendObjectAsync(`${deviceName}.light.${key}.${key2}.hex`, {
                    type: "state",
                    common: {
                      ...hex,
                      name: `${(_s = device.info) == null ? void 0 : _s.displayName} / ${hex.name}`
                    },
                    native: {
                      ip: device.ip,
                      port: device.port,
                      productName: (_t = device.info) == null ? void 0 : _t.productName
                    }
                  });
                  this.subscribeStates(`${deviceName}.light.${key}.${key2}.hex`);
                  const rgb = import_object_definition.stateAttrb.rgb;
                  await this.extendObjectAsync(`${deviceName}.light.${key}.${key2}.rgb`, {
                    type: "state",
                    common: {
                      ...rgb,
                      name: `${(_u = device.info) == null ? void 0 : _u.displayName} / ${rgb.name}`
                    },
                    native: {
                      ip: device.ip,
                      port: device.port,
                      productName: (_v = device.info) == null ? void 0 : _v.productName
                    }
                  });
                  this.subscribeStates(`${deviceName}.light.${key}.${key2}.rgb`);
                }
              }
            }
          }
        }
      }
    }
    if (device.settings) {
      this.writeLog(`[Adapter v.${this.version} createStates] create settings states for ${deviceName}`, "debug");
      await this.extendObjectAsync(`${deviceName}.settings`, {
        type: "channel",
        common: {
          name: `${(_w = device.info) == null ? void 0 : _w.displayName} / Settings`,
          desc: "Settings of the device"
        },
        native: {}
      });
      for (const [key] of Object.entries(device.settings)) {
        if (key !== `battery`) {
          let common = { name: "", role: "", read: false, write: false };
          common = import_object_definition.stateAttrb[key];
          await this.extendObjectAsync(`${deviceName}.settings.${key}`, {
            type: "state",
            common: {
              ...common,
              name: `${(_x = device.info) == null ? void 0 : _x.displayName} / ${common.name}`
            },
            native: {
              ip: device.ip,
              port: device.port,
              productName: (_y = device.info) == null ? void 0 : _y.productName
            }
          });
          if (common.write) {
            this.subscribeStates(`${deviceName}.settings.${key}`);
          }
        } else {
          if (device.settings.battery) {
            for (const [key2] of Object.entries(device.settings.battery)) {
              await this.extendObjectAsync(`${deviceName}.settings.${key}.${key2}`, {
                type: "channel",
                common: {
                  name: `${(_z = device.info) == null ? void 0 : _z.displayName} / Energy Saving`,
                  desc: "Information about the energy saving"
                },
                native: {}
              });
              if (key2 !== `energySaving`) {
                await this.extendObjectAsync(`${deviceName}.settings.${key}`, {
                  type: "channel",
                  common: {
                    name: `${(_A = device.info) == null ? void 0 : _A.displayName} / battery`,
                    desc: "Information about the battery"
                  },
                  native: {}
                });
                let common = { name: "", role: "", read: false, write: false };
                common = import_object_definition.stateAttrb[key2];
                await this.extendObjectAsync(`${deviceName}.settings.${key}.${key2}`, {
                  type: "state",
                  common: {
                    ...common,
                    name: `${(_B = device.info) == null ? void 0 : _B.displayName} / ${common.name}`
                  },
                  native: {
                    ip: device.ip,
                    port: device.port,
                    productName: (_C = device.info) == null ? void 0 : _C.productName
                  }
                });
                if (common.write) {
                  this.subscribeStates(`${deviceName}.settings.${key}.${key2}`);
                }
              } else {
                for (const [key3] of Object.entries(device.settings.battery.energySaving)) {
                  await this.extendObjectAsync(`${deviceName}.settings.${key}.${key2}.${key3}`, {
                    type: "channel",
                    common: {
                      name: `${(_D = device.info) == null ? void 0 : _D.displayName} / adjust Brightness`,
                      desc: "Information about the adjustBrightness"
                    },
                    native: {}
                  });
                  if (key3 !== `adjustBrightness`) {
                    let common = {
                      name: "",
                      role: "",
                      read: false,
                      write: false
                    };
                    common = import_object_definition.stateAttrb[key3];
                    await this.extendObjectAsync(`${deviceName}.settings.${key}.${key2}.${key3}`, {
                      type: "state",
                      common: {
                        ...common,
                        name: `${(_E = device.info) == null ? void 0 : _E.displayName} / ${common.name}`
                      },
                      native: {
                        ip: device.ip,
                        port: device.port,
                        productName: (_F = device.info) == null ? void 0 : _F.productName
                      }
                    });
                    if (common.write) {
                      this.subscribeStates(`${deviceName}.settings.${key}.${key2}.${key3}`);
                    }
                  } else {
                    for (const [key4] of Object.entries(
                      device.settings.battery.energySaving.adjustBrightness
                    )) {
                      if (key4 === `brightness`) {
                        let common = {
                          name: "",
                          role: "",
                          read: false,
                          write: false
                        };
                        common = import_object_definition.stateAttrb["adjustBrightness"];
                        await this.extendObjectAsync(
                          `${deviceName}.settings.${key}.${key2}.${key3}.${key4}`,
                          {
                            type: "state",
                            common: {
                              ...common,
                              name: `${(_G = device.info) == null ? void 0 : _G.displayName} / ${common.name}`
                            },
                            native: {
                              ip: device.ip,
                              port: device.port,
                              productName: (_H = device.info) == null ? void 0 : _H.productName
                            }
                          }
                        );
                      } else {
                        let common = {
                          name: "",
                          role: "",
                          read: false,
                          write: false
                        };
                        common = import_object_definition.stateAttrb[key4];
                        await this.extendObjectAsync(
                          `${deviceName}.settings.${key}.${key2}.${key3}.${key4}`,
                          {
                            type: "state",
                            common: {
                              ...common,
                              name: `${(_I = device.info) == null ? void 0 : _I.displayName} / ${common.name}`
                            },
                            native: {
                              ip: device.ip,
                              port: device.port,
                              productName: (_J = device.info) == null ? void 0 : _J.productName
                            }
                          }
                        );
                        if (common.write) {
                          this.subscribeStates(
                            `${deviceName}.settings.${key}.${key2}.${key3}.${key4}`
                          );
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    await this.setStateAsync(`${deviceName}.reachable`, true, true);
    await this.setStateAsync("info.connections", { val: JSON.stringify(this.devices), ack: true });
  }
  async addKeyLight(device) {
    var _a, _b, _c, _d, _e, _f, _g;
    try {
      const keyLight = device;
      const settingsCall = await import_axios.default.get(`http://${keyLight.ip}:${keyLight.port}/elgato/lights/settings`);
      keyLight.settings = settingsCall.data;
      const infoCall = await import_axios.default.get(`http://${keyLight.ip}:${keyLight.port}/elgato/accessory-info`);
      keyLight.info = infoCall.data;
      const optionsCall = await import_axios.default.get(`http://${keyLight.ip}:${keyLight.port}/elgato/lights`);
      keyLight.light = optionsCall.data;
      if ((_a = keyLight.info) == null ? void 0 : _a.productName.startsWith("Elgato Key Light Mini")) {
        const batteryCall = await import_axios.default.get(`http://${keyLight.ip}:${keyLight.port}/elgato/battery-info`);
        keyLight.battery = batteryCall.data;
      }
      if (this.devices.find((element) => {
        var _a2, _b2;
        return ((_a2 = element.info) == null ? void 0 : _a2.serialNumber) === ((_b2 = keyLight.info) == null ? void 0 : _b2.serialNumber);
      })) {
        this.writeLog(
          `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} addKeyLight] Device ${(_b = keyLight.info) == null ? void 0 : _b.serialNumber} already in exist`,
          "debug"
        );
      } else {
        this.writeLog(
          `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} addKeyLight] Device ${(_c = keyLight.info) == null ? void 0 : _c.serialNumber} not in exist - add it`,
          "debug"
        );
        this.writeLog(
          `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} addKeyLight] add new device: ${(_d = keyLight.info) == null ? void 0 : _d.serialNumber} => ${(_e = keyLight.info) == null ? void 0 : _e.displayName}`,
          "debug"
        );
        this.devices.push(keyLight);
        await this.createStates(keyLight);
      }
      this.writeLog(
        `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} addKeyLight] start createStates for ${(_f = keyLight.info) == null ? void 0 : _f.serialNumber}`,
        "debug"
      );
      this.writeLog(
        `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} addKeyLight] start writeState for ${(_g = keyLight.info) == null ? void 0 : _g.serialNumber}`,
        "debug"
      );
      await this.onReady();
      return {
        error: false,
        message: "success"
      };
    } catch (error) {
      this.writeLog(`[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} addKeyLight] ${error}`, "error");
      return {
        error: true,
        message: error
      };
    }
  }
  async requestKeyLight(device) {
    var _a, _b;
    try {
      const keyLight = device;
      const settingsCall = await import_axios.default.get(`http://${keyLight.ip}:${keyLight.port}/elgato/lights/settings`);
      keyLight.settings = settingsCall.data;
      const infoCall = await import_axios.default.get(`http://${keyLight.ip}:${keyLight.port}/elgato/accessory-info`);
      keyLight.info = infoCall.data;
      const optionsCall = await import_axios.default.get(`http://${keyLight.ip}:${keyLight.port}/elgato/lights`);
      keyLight.light = optionsCall.data;
      if ((_a = keyLight.info) == null ? void 0 : _a.productName.startsWith("Elgato Key Light Mini")) {
        const batteryCall = await import_axios.default.get(`http://${keyLight.ip}:${keyLight.port}/elgato/battery-info`);
        keyLight.battery = batteryCall.data;
      }
      this.writeLog(
        `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION}] requestKeyLight] start writeState for ${(_b = keyLight.info) == null ? void 0 : _b.serialNumber} with Data: ${JSON.stringify(keyLight)}`,
        "debug"
      );
      await this.writeState(keyLight);
      this.requestObject.push(keyLight);
    } catch (error) {
      if (error.response) {
        this.writeLog(
          `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} updateLightOptions] Error send for ${device.ip} ${error.message} >> message: ${JSON.stringify(error.response.data.errors)}`,
          "error"
        );
      } else {
        this.writeLog(
          `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} updateLightOptions] Error send for ${device.ip} ${error.message}`,
          "error"
        );
        return void 0;
      }
    }
  }
  writeLog(logText, logType) {
    if (logType === "warn" || logType === "error") {
      if (this.messageHandler.length > 0) {
        if (!this.messageHandler.find((message) => message.message === logText)) {
          this.messageHandler.push({
            severity: logType,
            clearTimer: false,
            message: logText
          });
          if (logType === "warn")
            this.log.warn(logText);
          if (logType === "error")
            this.log.error(logText);
          this.log.debug(
            `[Adapter v.${this.version} writeLog] messageHandler: ` + JSON.stringify(this.messageHandler)
          );
        } else {
          if (!this.messageHandler.find((message) => message.message === logText).clearTimer) {
            this.messageHandler.find((message) => message.message === logText).clearTimer = true;
            this.messageHandlerTimer = this.setTimeout(() => {
              this.messageHandler.find((message) => message.message === logText).clearTimer = false;
              this.messageHandler = this.messageHandler.filter((message) => message.message !== logText);
              this.log.debug(`[Adapter v.${this.version} writeLog] clear messageHandler for ${logText}`);
            }, 3e5);
          }
          this.log.debug(
            `[Adapter v.${this.version} writeLog] messageHandler: ` + JSON.stringify(this.messageHandler)
          );
        }
      } else {
        this.messageHandler.push({
          severity: logType,
          clearTimer: false,
          message: logText
        });
        if (logType === "warn")
          this.log.warn(logText);
        if (logType === "error")
          this.log.error(logText);
        this.log.debug(
          `[Adapter v.${this.version} writeLog] messageHandler: ` + JSON.stringify(this.messageHandler)
        );
      }
    } else {
      if (logType === "silly")
        this.log.silly(logText);
      if (logType === "info")
        this.log.info(logText);
      if (logType === "debug")
        this.log.debug(logText);
    }
  }
  async updateLightOptions(device, options) {
    try {
      const result = await import_axios.default.put(`http://${device.ip}:${device.port}/elgato/lights`, options);
      if (result.status === 200) {
        const resultData = result.data;
        this.writeLog(
          `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} updateLightOptions] on for ${device.ip} set to ${JSON.stringify(options)}`,
          "debug"
        );
        return resultData;
      }
      this.writeLog(
        `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} updateLightOptions] on for ${device.ip} set to ${JSON.stringify(options)}`,
        "debug"
      );
      return void 0;
    } catch (error) {
      if (error.response) {
        this.writeLog(
          `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} updateLightOptions] Error send for ${device.ip} ${error.message} >> message: ${JSON.stringify(error.response.data.errors)}`,
          "error"
        );
      } else {
        this.writeLog(
          `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} updateLightOptions] Error send for ${device.ip} ${error.message}`,
          "error"
        );
        return void 0;
      }
    }
  }
  async identify(device) {
    try {
      await import_axios.default.post(`http://${device.ip}:${device.port ? device.port : 9123}/elgato/identify`);
      this.writeLog(
        `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} onStateChange] identify the device`,
        "debug"
      );
    } catch (error) {
      this.writeLog(
        `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} onStateChange] identify was not successful: ${error}`,
        "error"
      );
      this.writeLog(`[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} onStateChange] ${error}`, "error");
    }
  }
  async updateLightInfo(device, options) {
    try {
      const result = await import_axios.default.put(`http://${device.ip}:${device.port}/elgato/accessory-info`, options);
      this.writeLog(
        `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} updateLightInfo] displayName for ${device.ip} set to ${options}`,
        "debug"
      );
      return result.data;
    } catch (error) {
      if (error.response) {
        this.writeLog(
          `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} updateLightInfo] Error send for ${device.ip} ${error.message} >> message: ${JSON.stringify(error.response.data.errors)}`,
          "error"
        );
      } else {
        this.writeLog(
          `[Adapter v.${this.version} Axios: ${import_axios.default.VERSION} updateLightInfo] Error send for ${device.ip} ${error.message}`,
          "error"
        );
        return void 0;
      }
    }
  }
  async onStateChange(id, state) {
    var _a;
    if (state && !state.ack) {
      if (state.from === "system.adapter." + this.namespace) {
        return;
      } else {
        this.writeLog(
          `[Adapter v.${this.version} onStateChange] state ${id} changed: ${state.val} (ack = ${state.ack})`,
          "debug"
        );
        const stateName = id.split(".").pop();
        const obj = await this.getForeignObjectAsync(id);
        if (obj) {
          const native = obj.native;
          if (stateName === "identify") {
            await this.identify(native);
          }
          if (stateName === "on") {
            this.writeLog(
              `[Adapter v.${this.version} onStateChange] on for ${native.ip} set to ${state.val}`,
              "debug"
            );
            const value = state.val ? 1 : 0;
            const options = {
              lights: [
                {
                  on: value
                }
              ]
            };
            const result = await this.updateLightOptions(native, options);
            if (result) {
              const on = result.lights[0].on;
              if (on === value) {
                const newOn = on === 1;
                await this.setStateAsync(id, newOn, true);
              } else {
                const newOn = on === 1;
                await this.setStateAsync(id, newOn, true);
              }
              await this.setStateAsync(id, result.lights[0].on === 1, true);
            }
          }
          if (stateName === "displayName") {
            this.writeLog(
              `[Adapter v.${this.version} onStateChange] displayName for ${native.ip} set to ${state.val}`,
              "debug"
            );
            const value = state.val;
            const options = {
              displayName: value
            };
            const result = await this.updateLightInfo(native, options);
            if (result) {
              const displayName = result.displayName;
              if (displayName === value) {
                await this.setStateAsync(id, value, true);
              } else {
                await this.setStateAsync(id, displayName, true);
              }
            }
          }
          if (stateName === "brightness") {
            const value = state.val;
            this.writeLog(
              `[Adapter v.${this.version} onStateChange] brightness for ${native.ip} set to ${state.val}`,
              "debug"
            );
            let options = {};
            if (native.productName === "Elgato Light Strip") {
              const requestObject = this.requestObject.find((obj2) => obj2.ip === native.ip);
              if (requestObject) {
                if ((_a = requestObject.light) == null ? void 0 : _a.lights[0].scene) {
                  options = {
                    lights: [
                      {
                        id: requestObject.light.lights[0].id,
                        name: requestObject.light.lights[0].name,
                        brightness: value,
                        numberOfSceneElements: requestObject.light.lights[0].numberOfSceneElements,
                        scene: requestObject.light.lights[0].scene
                      }
                    ]
                  };
                } else {
                  options = {
                    lights: [
                      {
                        brightness: value
                      }
                    ]
                  };
                }
              }
            } else {
              options = {
                lights: [
                  {
                    brightness: value
                  }
                ]
              };
            }
            const result = await this.updateLightOptions(native, options);
            if (result) {
              const brightness = result.lights[0].brightness;
              if (brightness === value) {
                await this.setStateAsync(id, value, true);
              } else {
                await this.setStateAsync(id, brightness, true);
              }
            }
          }
          if (stateName === "temperature") {
            this.writeLog(
              `[Adapter v.${this.version} onStateChange] temperature for ${native.ip} set to ${state.val}`,
              "debug"
            );
            const value = state.val;
            let mired = 143;
            if (value) {
              mired = 1e6 / value;
              mired = Math.round(mired);
              if (mired < 143)
                mired = 143;
              if (mired > 344)
                mired = 344;
            } else {
              mired = 143;
            }
            const options = {
              lights: [
                {
                  temperature: mired
                }
              ]
            };
            const result = await this.updateLightOptions(
              native,
              options
            );
            if (result) {
              const temperature = result.lights[0].temperature;
              if (temperature === mired) {
                await this.setStateAsync(id, value, true);
              } else {
                if (temperature) {
                  let newTemperature = 1e6 / temperature;
                  newTemperature = Math.round(newTemperature);
                  await this.setStateAsync(id, newTemperature, true);
                }
              }
            }
          }
          if (stateName === "hue") {
            this.writeLog(
              `[Adapter v.${this.version} onStateChange] hue for ${native.ip} set to ${state.val}`,
              "debug"
            );
            const value = state.val;
            const options = {
              lights: [
                {
                  hue: value
                }
              ]
            };
            const result = await this.updateLightOptions(
              native,
              options
            );
            if (result) {
              const hue = result.lights[0].hue;
              if (hue === value) {
                await this.setStateAsync(id, value, true);
              } else {
                await this.setStateAsync(id, hue, true);
              }
            }
          }
          if (stateName === "saturation") {
            this.writeLog(
              `[Adapter v.${this.version} onStateChange] saturation for ${native.ip} set to ${state.val}`,
              "debug"
            );
            const value = state.val;
            const options = {
              lights: [
                {
                  saturation: value
                }
              ]
            };
            const result = await this.updateLightOptions(
              native,
              options
            );
            if (result) {
              const saturation = result.lights[0].saturation;
              if (saturation === value) {
                await this.setStateAsync(id, value, true);
              } else {
                await this.setStateAsync(id, saturation, true);
              }
            }
          }
          if (stateName === "hex") {
            this.writeLog(
              `[Adapter v.${this.version} onStateChange] hex for ${native.ip} set to ${state.val}`,
              "debug"
            );
            const value = state.val;
            let hue = 0;
            let sat = 0;
            let bri = 0;
            const hsb = (0, import_color.hexToHsb)(value);
            hue = Math.round(hsb[0]);
            sat = Math.round(hsb[1]);
            bri = Math.round(hsb[2]);
            const options = {
              lights: [
                {
                  hue,
                  saturation: sat,
                  brightness: bri
                }
              ]
            };
            const result = await this.updateLightOptions(
              native,
              options
            );
            if (result) {
              const hex = (0, import_color.hsbToHex)(
                result.lights[0].hue,
                result.lights[0].saturation,
                result.lights[0].brightness
              );
              if (hex === value) {
                await this.setStateAsync(id, value, true);
              } else {
                await this.setStateAsync(id, hex, true);
              }
            }
          }
          if (stateName === "rgb") {
            this.writeLog(
              `[Adapter v.${this.version} onStateChange] rgb for ${native.ip} set to ${state.val}`,
              "debug"
            );
            const value = state.val;
            let hue = 0;
            let sat = 0;
            let bri = 0;
            const rgb = value.split(",");
            const hsb = (0, import_color.rgbToHsb)(parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2]));
            hue = Math.round(hsb[0]);
            sat = Math.round(hsb[1]);
            bri = Math.round(hsb[2]);
            const options = {
              lights: [
                {
                  hue,
                  saturation: sat,
                  brightness: bri
                }
              ]
            };
            const result = await this.updateLightOptions(
              native,
              options
            );
            if (result) {
              const rgb2 = (0, import_color.hsbToRgb)(
                result.lights[0].hue,
                result.lights[0].saturation,
                result.lights[0].brightness
              );
              if (rgb2 === value) {
                await this.setStateAsync(id, value, true);
              } else {
                await this.setStateAsync(id, rgb2, true);
              }
            }
          }
        }
      }
    } else {
      return;
    }
  }
  async onMessage(obj) {
    if (typeof obj === "object" && obj.message) {
      if (obj.command === "addKeyLight") {
        const device = obj.message;
        const data = {
          ip: device.ip,
          port: 9123
        };
        const result = await this.addKeyLight(data);
        if (result.message === "success") {
          this.sendTo(obj.from, obj.command, result, obj.callback);
        } else {
          this.sendTo(obj.from, obj.command, result, obj.callback);
        }
      }
      if (obj.command === "deleteKeyLight") {
        const device = obj.message;
        const index = this.devices.findIndex((d) => {
          var _a;
          return ((_a = d.info) == null ? void 0 : _a.serialNumber) === device.id;
        });
        if (index > -1) {
          this.devices.splice(index, 1);
          this.writeLog(`[Adapter v.${this.version} onMessage] delete device ${device.id}`, "debug");
          await this.delObjectAsync(`${this.namespace}.${device.id}`, { recursive: true });
          await this.onReady();
          this.sendTo(obj.from, obj.command, { message: "success" }, obj.callback);
        }
      }
    }
  }
  async onUnload(callback) {
    var _a;
    try {
      this.writeLog(`[Adapter v.${this.version} onUnload] Adapter stopped`, "debug");
      if (this.requestTimer)
        this.clearTimeout(this.requestTimer);
      if (this.messageHandlerTimer)
        this.clearTimeout(this.messageHandlerTimer);
      this.setState("info.connection", false, true);
      for (const devicesKey in this.devices) {
        this.setState(`${(_a = this.devices[devicesKey].info) == null ? void 0 : _a.serialNumber}.reachable`, false, true);
      }
      callback();
    } catch (e) {
      callback();
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new ElgatoKeyLight(options);
} else {
  (() => new ElgatoKeyLight())();
}
//# sourceMappingURL=main.js.map
