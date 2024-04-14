"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var object_definition_exports = {};
__export(object_definition_exports, {
  stateAttrb: () => stateAttrb
});
module.exports = __toCommonJS(object_definition_exports);
const stateAttrb = {
  ip: {
    name: "IP Address",
    desc: "IP Address of the device",
    type: "string",
    role: "value",
    def: "",
    read: true,
    write: false
  },
  port: {
    name: "Port",
    desc: "Port of the device",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  powerOnBehavior: {
    name: "Power On Behavior",
    desc: "Power On Behavior of the device",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  powerOnBrightness: {
    name: "Power On Brightness",
    desc: "Power On Brightness of the device",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  powerOnTemperature: {
    name: "Power On Temperature",
    desc: "Power On Temperature of the device",
    type: "number",
    role: "value",
    def: 2900,
    read: true,
    write: false,
    unit: "K",
    states: {
      // von 2900 bis 7000 in 50er Schritten
      2900: "2900K",
      2950: "2950K",
      3e3: "3000K",
      3050: "3050K",
      3100: "3100K",
      3150: "3150K",
      3200: "3200K",
      3250: "3250K",
      3300: "3300K",
      3350: "3350K",
      3400: "3400K",
      3450: "3450K",
      3500: "3500K",
      3550: "3550K",
      3600: "3600K",
      3650: "3650K",
      3700: "3700K",
      3750: "3750K",
      3800: "3800K",
      3850: "3850K",
      3900: "3900K",
      3950: "3950K",
      4e3: "4000K",
      4050: "4050K",
      4100: "4100K",
      4150: "4150K",
      4200: "4200K",
      4250: "4250K",
      4300: "4300K",
      4350: "4350K",
      4400: "4400K",
      4450: "4450K",
      4500: "4500K",
      4550: "4550K",
      4600: "4600K",
      4650: "4650K",
      4700: "4700K",
      4750: "4750K",
      4800: "4800K",
      4850: "4850K",
      4900: "4900K",
      4950: "4950K",
      5e3: "5000K",
      5050: "5050K",
      5100: "5100K",
      5150: "5150K",
      5200: "5200K",
      5250: "5250K",
      5300: "5300K",
      5350: "5350K",
      5400: "5400K",
      5450: "5450K",
      5500: "5500K",
      5550: "5550K",
      5600: "5600K",
      5650: "5650K",
      5700: "5700K",
      5750: "5750K",
      5800: "5800K",
      5850: "5850K",
      5900: "5900K",
      5950: "5950K",
      6e3: "6000K",
      6050: "6050K",
      6100: "6100K",
      6150: "6150K",
      6200: "6200K",
      6250: "6250K",
      6300: "6300K",
      6350: "6350K",
      6400: "6400K",
      6450: "6450K",
      6500: "6500K",
      6550: "6550K",
      6600: "6600K",
      6650: "6650K",
      6700: "6700K",
      6750: "6750K",
      6800: "6800K",
      6850: "6850K",
      6900: "6900K",
      6950: "6950K",
      7e3: "7000K"
    }
  },
  switchOnDurationMs: {
    name: "Switch On Duration",
    desc: "Switch On Duration of the device",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  switchOffDurationMs: {
    name: "Switch Off Duration",
    desc: "Switch Off Duration of the device",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  colorChangeDurationMs: {
    name: "Color Change Duration",
    desc: "Color Change Duration of the device",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  enable: {
    name: "Enable",
    desc: "Enable Battery",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  minimumBatteryLevel: {
    name: "Minimum Battery Level",
    desc: "Minimum Battery Level",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  disableWifi: {
    name: "Disable Wifi",
    desc: "Disable Wifi",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  bypass: {
    name: "Bypass",
    desc: "Bypass",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  productName: {
    name: "Product Name",
    desc: "Product Name",
    type: "string",
    role: "value",
    def: "",
    read: true,
    write: false
  },
  hardwareBoardType: {
    name: "Hardware Board Type",
    desc: "Hardware Board Type",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  hardwareRevision: {
    name: "Hardware Revision",
    desc: "Hardware Revision",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  macAddress: {
    name: "MAC Address",
    desc: "MAC Address",
    type: "string",
    role: "value",
    def: "",
    read: true,
    write: false
  },
  firmwareBuildNumber: {
    name: "Firmware Build Number",
    desc: "Firmware Build Number",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  firmwareVersion: {
    name: "Firmware Version",
    desc: "Firmware Version",
    type: "string",
    role: "value",
    def: "",
    read: true,
    write: false
  },
  serialNumber: {
    name: "Serial Number",
    desc: "Serial Number",
    type: "string",
    role: "value",
    def: "",
    read: true,
    write: false
  },
  displayName: {
    name: "Display Name",
    desc: "Display Name",
    type: "string",
    role: "value",
    def: "",
    read: true,
    write: true
  },
  features: {
    name: "Features",
    desc: "Features",
    type: "string",
    role: "json",
    def: "",
    read: true,
    write: false
  },
  ssid: {
    name: "SSID",
    desc: "SSID",
    type: "string",
    role: "value",
    def: "",
    read: true,
    write: false
  },
  frequencyMHz: {
    name: "Frequency",
    desc: "Frequency in MHz",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  rssi: {
    name: "RSSI",
    desc: "RSSI in dBm",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false,
    unit: "dBm"
  },
  numberOfLights: {
    name: "Number of Lights",
    desc: "Number of Lights",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  on: {
    name: "On / Off",
    desc: "light on / off",
    type: "boolean",
    role: "switch",
    def: false,
    read: true,
    write: true
  },
  brightness: {
    name: "Brightness",
    desc: "Brightness of the light",
    type: "number",
    role: "level.dimmer",
    def: 3,
    min: 3,
    max: 100,
    unit: "%",
    read: true,
    write: true
  },
  adjustBrightness: {
    name: "Brightness",
    desc: "adjust Brightness of the light",
    type: "number",
    role: "level.dimmer",
    def: 0,
    min: 0,
    max: 100,
    unit: "%",
    read: true,
    write: false
  },
  temperature: {
    name: "Temperature",
    desc: "Temperature of the light",
    type: "number",
    role: "value.temperature",
    def: 2900,
    min: 2900,
    max: 7e3,
    step: 50,
    read: true,
    write: true,
    states: {
      // von 2900 bis 7000 in 50er Schritten
      2900: "2900K",
      2950: "2950K",
      3e3: "3000K",
      3050: "3050K",
      3100: "3100K",
      3150: "3150K",
      3200: "3200K",
      3250: "3250K",
      3300: "3300K",
      3350: "3350K",
      3400: "3400K",
      3450: "3450K",
      3500: "3500K",
      3550: "3550K",
      3600: "3600K",
      3650: "3650K",
      3700: "3700K",
      3750: "3750K",
      3800: "3800K",
      3850: "3850K",
      3900: "3900K",
      3950: "3950K",
      4e3: "4000K",
      4050: "4050K",
      4100: "4100K",
      4150: "4150K",
      4200: "4200K",
      4250: "4250K",
      4300: "4300K",
      4350: "4350K",
      4400: "4400K",
      4450: "4450K",
      4500: "4500K",
      4550: "4550K",
      4600: "4600K",
      4650: "4650K",
      4700: "4700K",
      4750: "4750K",
      4800: "4800K",
      4850: "4850K",
      4900: "4900K",
      4950: "4950K",
      5e3: "5000K",
      5050: "5050K",
      5100: "5100K",
      5150: "5150K",
      5200: "5200K",
      5250: "5250K",
      5300: "5300K",
      5350: "5350K",
      5400: "5400K",
      5450: "5450K",
      5500: "5500K",
      5550: "5550K",
      5600: "5600K",
      5650: "5650K",
      5700: "5700K",
      5750: "5750K",
      5800: "5800K",
      5850: "5850K",
      5900: "5900K",
      5950: "5950K",
      6e3: "6000K",
      6050: "6050K",
      6100: "6100K",
      6150: "6150K",
      6200: "6200K",
      6250: "6250K",
      6300: "6300K",
      6350: "6350K",
      6400: "6400K",
      6450: "6450K",
      6500: "6500K",
      6550: "6550K",
      6600: "6600K",
      6650: "6650K",
      6700: "6700K",
      6750: "6750K",
      6800: "6800K",
      6850: "6850K",
      6900: "6900K",
      6950: "6950K",
      7e3: "7000K"
    }
  },
  hue: {
    name: "Hue",
    desc: "Hue of the light",
    type: "number",
    role: "level.color.hue",
    def: 0,
    min: 0,
    max: 360,
    unit: "\xB0",
    read: true,
    write: true
  },
  saturation: {
    name: "Saturation",
    desc: "Saturation of the light",
    type: "number",
    role: "level.color.saturation",
    def: 0,
    min: 0,
    max: 100,
    unit: "%",
    read: true,
    write: true
  },
  hex: {
    name: "Hex",
    desc: "Hex color of the light",
    type: "string",
    role: "value.color.rgb",
    def: "#000000",
    read: true,
    write: true
  },
  rgb: {
    name: "RGB",
    desc: "RGB color of the light",
    type: "string",
    role: "text",
    def: "0,0,100",
    read: true,
    write: true
  },
  powerOnSaturation: {
    name: "Power On Saturation",
    desc: "Saturation of the light when power on",
    type: "number",
    role: "level.color.saturation",
    def: 0,
    min: 0,
    max: 100,
    read: true,
    write: false
  },
  powerOnHue: {
    name: "Power On Hue",
    desc: "Hue of the light when power on",
    type: "number",
    role: "level.color.hue",
    def: 0,
    min: 0,
    max: 360,
    read: true,
    write: false
  },
  powerSource: {
    name: "Power Source",
    desc: "Power Source of the light",
    type: "string",
    role: "text",
    def: "unknown",
    read: true,
    write: false
  },
  level: {
    name: "Battery Level",
    desc: "Battery Level of the light",
    type: "number",
    role: "value.battery",
    def: 0,
    min: 0,
    max: 100,
    unit: "%",
    read: true,
    write: false
  },
  status: {
    name: "Battery Status",
    desc: "Battery Status of the light",
    type: "number",
    role: "value",
    def: 0,
    read: true,
    write: false
  },
  currentBatteryVoltage: {
    name: "Current Battery Voltage",
    desc: "Current Battery Voltage of the light",
    type: "number",
    role: "value.voltage",
    def: 0,
    unit: "V",
    read: true,
    write: false
  },
  inputChargeVoltage: {
    name: "Input Charge Voltage",
    desc: "Input Charge Voltage of the light",
    type: "number",
    role: "value.voltage",
    unit: "V",
    def: 0,
    read: true,
    write: false
  },
  inputChargeCurrent: {
    name: "Input Charge Current",
    desc: "Input Charge Current of the light",
    type: "number",
    role: "value.current",
    def: 0,
    unit: "A",
    read: true,
    write: false
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  stateAttrb
});
//# sourceMappingURL=object_definition.js.map
