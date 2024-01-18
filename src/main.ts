// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
// Load your modules here, e.g.:
import 'source-map-support/register';
import { KeyLight, KeyLightInfo, KeyLightOptions } from './types/KeyLight';
import { stateAttrb } from './lib/object_definition';
import { LightStrip, LightStripOptions } from './types/LightStrip';
import { hexToHsb, hsbToHex, hsbToRgb, rgbToHsb } from './lib/color';
import axios from 'axios';
import sourceMapSupport from 'source-map-support';

sourceMapSupport.install();
// Global variables here

class ElgatoKeyLight extends utils.Adapter {
	private requestTimer: ioBroker.Timeout | null;
	private messageHandler: any[];
	private messageHandlerTimer: ioBroker.Timeout | null;
	private devices: KeyLight[];
	private interval: number;
	private requestObject: KeyLight[];

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'elgato-key-light',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
		this.requestTimer = null;
		this.messageHandlerTimer = null;
		this.messageHandler = [];
		this.devices = [];
		this.interval = 5000;
		this.requestObject = [];
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		// Initialize your adapter here
		this.messageHandler = [];
		this.devices = [];
		this.requestObject = [];
		// convert the interval to milliseconds
		this.interval = this.config.interval * 1000;
		// Reset the connection indicator during startup
		this.setState('info.connection', false, true);

		// collect all devices from the adapter objects
		const devices = await this.getDevicesAsync();
		if (devices.length !== 0) {
			for (const devicesKey in devices) {
				this.devices.push(devices[devicesKey].native.device);
				await this.createStates(devices[devicesKey].native.device);
			}
			this.writeLog(`[Adapter v.${this.version} onReady] all devices: ${this.devices.length}`, 'debug');
			// console.log('devices', this.devices);
		} else {
			this.writeLog(`[Adapter v.${this.version} onReady] no devices found`, 'debug');
			await this.setStateAsync('info.connections', { val: JSON.stringify([]), ack: true });
		}

		// start the requestData timer
		this.writeLog(`[Adapter v.${this.version} onReady] start requestData`, 'debug');
		await this.requestData();
		this.setState('info.connection', true, true);
	}

	private async requestData(): Promise<void> {
		// Request data from all Key Lights every 5 minutes
		if (this.requestTimer) this.clearTimeout(this.requestTimer);
		// query all key lights
		this.requestObject = [];
		for (const device of this.devices) {
			const data: KeyLight = {
				ip: device.ip,
				port: device.port,
			};
			this.writeLog(
				`[Adapter v.${this.version} requestData] request data for ${device.info?.serialNumber}`,
				'debug',
			);
			await this.requestKeyLight(data);
		}

		this.requestTimer = this.setTimeout(() => {
			this.writeLog(`[Adapter v.${this.version} requestData] next request in ${this.interval} ms`, 'debug');
			this.requestData();
		}, this.interval);
	}

	private async writeState(device: KeyLight): Promise<void> {
		if (!device) return;
		let deviceName = '';
		// write the state of the Key Light
		if (device.info) {
			this.writeLog(
				`[Adapter v.${this.version} writeState] write all info states for ${device.info.displayName}`,
				'debug',
			);
			deviceName = device.info.serialNumber;
			await this.setStateAsync(`${deviceName}.info.ip`, { val: device.ip, ack: true });
			await this.setStateAsync(`${deviceName}.info.port`, { val: device.port, ack: true });
			for (const [key, value] of Object.entries(device.info)) {
				if (key !== 'wifi-info') {
					if (key === 'features') {
						await this.setStateAsync(`${deviceName}.info.${key}`, {
							val: JSON.stringify(value),
							ack: true,
						});
					} else if (key === 'displayName') {
						// find the configuration of the device and the index
						const deviceConfig = this.devices.find(
							(element) => element.info?.serialNumber === device.info?.serialNumber,
						);

						if (deviceConfig) {
							// if the name was changed then write the new name into the configuration
							if (deviceConfig.info?.displayName !== value) {
								// find the index of the device
								const index = this.devices.findIndex(
									(element) => element.info?.serialNumber === device.info?.serialNumber,
								);
								if (index !== -1) {
									this.devices[index].info!.displayName = value as string;
									this.writeLog(
										`[Adapter v.${this.version} writeState] Change name of ${device.info?.displayName} to ${value}`,
										'debug',
									);
									await this.setStateAsync(`${deviceName}.info.${key}`, {
										val: value,
										ack: true,
									});
									await this.createStates(device);
								}
							} else {
								this.writeLog(
									`[Adapter v.${this.version} writeState] Name of ${device.info?.displayName} is ${value}`,
									'debug',
								);
								await this.setStateAsync(`${deviceName}.info.${key}`, { val: value, ack: true });
							}
						}
					} else {
						this.writeLog(
							`[Adapter v.${this.version} writeState] write state ${key} with value ${value}`,
							'debug',
						);
						await this.setStateAsync(`${deviceName}.info.${key}`, { val: value, ack: true });
					}
				} else {
					for (const [key2, value2] of Object.entries(value)) {
						this.writeLog(
							`[Adapter v.${this.version} writeState] write state ${key2} with value ${value2}`,
							'debug',
						);
						await this.setStateAsync(`${deviceName}.info.wifi-info.${key2}`, {
							val: value2 as any,
							ack: true,
						});
					}
				}
			}
		}
		if (device.battery) {
			this.writeLog(`[Adapter v.${this.version} writeState] write battery state`, 'debug');
			for (const [key, value] of Object.entries(device.battery)) {
				if (key === 'powerSource') {
					await this.setStateAsync(`${deviceName}.battery.${key}`, {
						val: value === 1 ? 'power supplies' : value === 2 ? 'battery' : 'unknown',
						ack: true,
					});
				} else if (key === 'currentBatteryVoltage') {
					await this.setStateAsync(`${deviceName}.battery.${key}`, {
						val: value / 1000,
						ack: true,
					});
				} else if (key === 'inputChargeVoltage') {
					await this.setStateAsync(`${deviceName}.battery.${key}`, {
						val: value / 1000,
						ack: true,
					});
				} else if (key === 'inputChargeCurrent') {
					await this.setStateAsync(`${deviceName}.battery.${key}`, {
						val: value / 1000,
						ack: true,
					});
				} else if (key === 'level') {
					await this.setStateAsync(`${deviceName}.battery.${key}`, {
						val: Math.round(value),
						ack: true,
					});
				} else {
					await this.setStateAsync(`${deviceName}.battery.${key}`, { val: value, ack: true });
				}
			}
		}
		if (device.settings) {
			this.writeLog(`[Adapter v.${this.version} writeState] write settings state`, 'debug');
			for (const [key, value] of Object.entries(device.settings)) {
				if (key !== `battery`) {
					if (key === 'powerOnTemperature') {
						// convert the temperature from mired to Kelvin
						const temp = Math.round(1000000 / value);
						await this.setStateAsync(`${deviceName}.settings.${key}`, { val: temp, ack: true });
					} else {
						await this.setStateAsync(`${deviceName}.settings.${key}`, { val: value, ack: true });
					}
				} else {
					if (device.settings.battery) {
						for (const [key2, value2] of Object.entries(device.settings.battery)) {
							if (key2 !== `energySaving`) {
								await this.setStateAsync(`${deviceName}.settings.battery.${key2}`, {
									val: value2 as any,
									ack: true,
								});
							} else {
								for (const [key3, value3] of Object.entries(device.settings.battery.energySaving)) {
									if (key3 !== `adjustBrightness`) {
										await this.setStateAsync(
											`${deviceName}.settings.battery.energySaving.${key3}`,
											{
												val: value3 as any,
												ack: true,
											},
										);
									} else {
										for (const [key4, value4] of Object.entries(
											device.settings.battery.energySaving.adjustBrightness,
										)) {
											await this.setStateAsync(
												`${deviceName}.settings.battery.energySaving.adjustBrightness.${key4}`,
												{
													val: value4 as any,
													ack: true,
												},
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
			this.writeLog(`[Adapter v.${this.version} writeState] write light state`, 'debug');
			for (const [key, value] of Object.entries(device.light)) {
				if (key !== `lights`) {
					await this.setStateAsync(`${deviceName}.light.${key}`, { val: value, ack: true });
				} else {
					for (const [key2, value2] of Object.entries(device.light.lights)) {
						for (const [key3, value3] of Object.entries(value2)) {
							if (key3 === 'brightness') {
								await this.setStateAsync(`${deviceName}.light.lights.${key2}.${key3}`, {
									val: value3 as number,
									ack: true,
								});
							}
							if (key3 === 'saturation') {
								await this.setStateAsync(`${deviceName}.light.lights.${key2}.${key3}`, {
									val: value3 as number,
									ack: true,
								});
							}
							if (key3 === 'on') {
								await this.setStateAsync(`${deviceName}.light.lights.${key2}.${key3}`, {
									val: value3 === 1,
									ack: true,
								});
							}
							if (key3 === 'temperature') {
								// convert the temperature from mired to Kelvin
								const kelvin = Math.round(1000000 / value3);
								await this.setStateAsync(`${deviceName}.light.lights.${key2}.${key3}`, {
									val: kelvin,
									ack: true,
								});
							}
							if (key3 === 'hue') {
								await this.setStateAsync(`${deviceName}.light.lights.${key2}.${key3}`, {
									val: value3 as number,
									ack: true,
								});

								if (device.info?.productName === 'Elgato Light Strip') {
									const stripDevice = device.light as LightStripOptions;
									let hue = stripDevice.lights[0].hue;
									let sat = stripDevice.lights[0].saturation;
									let bri = stripDevice.lights[0].brightness;

									if (!hue) hue = 0;
									if (!sat) sat = 0;
									if (!bri) bri = 0;

									const hex = hsbToHex(hue, sat, bri);
									this.writeLog(
										`[Adapter v.${this.version} writeState] convert hsb hue: ${hue}, sat: ${sat}, bri: ${bri} to hex: ${hex} for device: ${deviceName} and write to state `,
										'debug',
									);
									const rgb = hsbToRgb(hue, sat, bri);

									await this.setStateAsync(`${deviceName}.light.lights.${key2}.hex`, {
										val: hex,
										ack: true,
									});
									await this.setStateAsync(`${deviceName}.light.lights.${key2}.rgb`, {
										val: rgb,
										ack: true,
									});
								}
							}
						}
					}
				}
			}
		}
	}

	private async createStates(device: KeyLight): Promise<void> {
		let deviceName = '';
		// check if the info is available in device
		if (device.info) {
			deviceName = device.info.serialNumber;
			this.writeLog(
				`[Adapter v.${this.version} createStates] create info states for device: ${deviceName}`,
				'debug',
			);
			// create the device
			await this.extendObjectAsync(deviceName, {
				type: 'device',
				common: {
					name: device.info.displayName || device.info.productName,
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					statusStates: {
						onlineId: `${this.namespace}.${deviceName}.reachable`,
					},
				},
				native: {
					ip: device.ip,
					port: device.port,
					device: device,
				},
			});

			// create the channel for the states
			await this.extendObjectAsync(`${deviceName}.info`, {
				type: 'channel',
				common: {
					name: `${device.info?.displayName} / Info`,
					desc: 'Information about the device',
				},
				native: {},
			});

			await this.extendObjectAsync(`${deviceName}.identify`, {
				type: 'state',
				common: {
					name: `${device.info.displayName} / Identify`,
					desc: 'Identify the device',
					type: 'boolean',
					role: 'button',
					def: true,
					read: true,
					write: true,
				},
				native: {
					ip: device.ip,
					port: device.port,
					productName: device.info.productName,
				},
			});
			this.subscribeStates(`${deviceName}.identify`);

			await this.extendObjectAsync(`${deviceName}.reachable`, {
				type: 'state',
				common: {
					name: `${device.info?.displayName} / Reachable`,
					desc: 'Is the device reachable',
					type: 'boolean',
					role: 'indicator.reachable',
					def: false,
					read: true,
					write: false,
				},
				native: {},
			});

			await this.extendObjectAsync(`${deviceName}.info.ip`, {
				type: 'state',
				common: {
					name: `${device.info?.displayName} / IP Address`,
					desc: 'IP of the device',
					type: 'string',
					role: 'info.ip',
					read: true,
					write: false,
				},
				native: {
					ip: device.ip,
					port: device.port,
					productName: device.info.productName,
				},
			});
			await this.extendObjectAsync(`${deviceName}.info.port`, {
				type: 'state',
				common: {
					name: `${device.info?.displayName} / Port`,
					desc: 'Port of the device',
					type: 'number',
					role: 'info.port',
					read: true,
					write: false,
				},
				native: {
					ip: device.ip,
					port: device.port,
					productName: device.info.productName,
				},
			});
			await this.extendObjectAsync(`info.connections`, {
				type: 'state',
				common: {
					name: 'Connections',
					desc: 'Configured connections',
					type: 'string',
					role: 'json',
					read: true,
					write: false,
				},
				native: {},
			});

			for (const [key] of Object.entries(device.info)) {
				if (key !== 'wifi-info') {
					let common: ioBroker.StateCommon = { name: '', role: '', read: false, write: false };
					common = stateAttrb[key as keyof typeof stateAttrb];

					await this.extendObjectAsync(`${deviceName}.info.${key}`, {
						type: 'state',
						common: {
							...common,
							name: `${device.info?.displayName} / ${common.name}`,
						},
						native: {
							ip: device.ip,
							port: device.port,
							productName: device.info.productName,
						},
					});
					// check if the state is writable
					if (common.write) {
						this.subscribeStates(`${deviceName}.info.${key}`);
					}
				} else {
					for (const [key2] of Object.entries(device.info['wifi-info'])) {
						// console.log(`${deviceName}.info.wifi-info.${key2}`);
						await this.extendObjectAsync(`${deviceName}.info.${key}`, {
							type: 'channel',
							common: {
								name: `${device.info?.displayName} / wifi-info`,
								desc: 'Information about the wifi',
							},
							native: {},
						});
						let common: ioBroker.StateCommon = { name: '', role: '', read: false, write: false };
						common = stateAttrb[key2 as keyof typeof stateAttrb];

						await this.extendObjectAsync(`${deviceName}.info.${key}.${key2}`, {
							type: 'state',
							common: {
								...common,
								name: `${device.info?.displayName} / ${common.name}`,
							},
							native: {
								ip: device.ip,
								port: device.port,
								productName: device.info.productName,
							},
						});
						//  check if the state is writable
						if (common.write) {
							this.subscribeStates(`${deviceName}.info.${key}.${key2}`);
						}
					}
				}
			}
			// end of info
		}
		if (device.battery) {
			this.writeLog(`[Adapter v.${this.version} createStates] create battery states for ${deviceName}`, 'debug');
			await this.extendObjectAsync(`${deviceName}.battery`, {
				type: 'channel',
				common: {
					name: `${device.info?.displayName} / battery Info`,
					desc: 'battery info of the device',
				},
				native: {},
			});
			for (const [key] of Object.entries(device.battery)) {
				let common: ioBroker.StateCommon = { name: '', role: '', read: false, write: false };
				common = stateAttrb[key as keyof typeof stateAttrb];
				await this.extendObjectAsync(`${deviceName}.battery.${key}`, {
					type: 'state',
					common: {
						...common,
						name: `${device.info?.displayName} / ${common.name}`,
					},
					native: {
						ip: device.ip,
						port: device.port,
						productName: device.info?.productName,
					},
				});
			}
		}
		// create the states on the key of device.light
		if (device.light) {
			this.writeLog(`[Adapter v.${this.version} createStates] create light states for ${deviceName}`, 'debug');
			await this.extendObjectAsync(`${deviceName}.light`, {
				type: 'channel',
				common: {
					name: `${device.info?.displayName} / Light`,
					desc: 'Light settings of the device',
				},
				native: {},
			});

			for (const [key] of Object.entries(device.light)) {
				await this.extendObjectAsync(`${deviceName}.light.${key}`, {
					type: 'channel',
					common: {
						name: `${device.info?.displayName} / lights`,
						desc: 'Information about the lights',
					},
					native: {},
				});
				if (key !== `lights`) {
					let common: ioBroker.StateCommon = {
						name: '',
						role: '',
						read: false,
						write: false,
					};
					common = stateAttrb[key as keyof typeof stateAttrb];

					await this.extendObjectAsync(`${deviceName}.light.${key}`, {
						type: 'state',
						common: {
							...common,
							name: `${device.info?.displayName} / ${common.name}`,
						},
						native: {
							ip: device.ip,
							port: device.port,
							productName: device.info?.productName,
						},
					});
					// check if the state is writable
					if (common.write) {
						this.subscribeStates(`${deviceName}.light.${key}`);
					}
				} else {
					// create the states on the key of device.light.lights
					for (const [key2, value2] of Object.entries(device.light.lights)) {
						await this.extendObjectAsync(`${deviceName}.light.${key}.${key2}`, {
							type: 'channel',
							common: {
								name: `${device.info?.displayName} / lights.${key2}`,
								desc: 'Information about the lights',
							},
							native: {},
						});
						for (const [key3] of Object.entries(value2)) {
							let common: ioBroker.StateCommon = {
								name: '',
								role: '',
								read: false,
								write: false,
							};
							if (
								key3 == 'hue' ||
								key3 == 'saturation' ||
								key3 == 'brightness' ||
								key3 == 'temperature' ||
								key3 == 'on'
							) {
								common = stateAttrb[key3 as keyof typeof stateAttrb];

								await this.extendObjectAsync(`${deviceName}.light.${key}.${key2}.${key3}`, {
									type: 'state',
									common: {
										...common,
										name: `${device.info?.displayName} / ${common.name}`,
									},
									native: {
										ip: device.ip,
										port: device.port,
										productName: device.info?.productName,
									},
								});
								// check if the state is writable
								if (common.write) {
									this.subscribeStates(`${deviceName}.light.${key}.${key2}.${key3}`);
									this.subscribeStates(`${deviceName}.light.${key}.${key2}.hue`);
									this.subscribeStates(`${deviceName}.light.${key}.${key2}.saturation`);
								}

								if (device.info?.productName === 'Elgato Light Strip') {
									const hex = stateAttrb.hex;
									await this.extendObjectAsync(`${deviceName}.light.${key}.${key2}.hex`, {
										type: 'state',
										common: {
											...hex,
											name: `${device.info?.displayName} / ${hex.name}`,
										},
										native: {
											ip: device.ip,
											port: device.port,
											productName: device.info?.productName,
										},
									});
									this.subscribeStates(`${deviceName}.light.${key}.${key2}.hex`);
									const rgb = stateAttrb.rgb;
									await this.extendObjectAsync(`${deviceName}.light.${key}.${key2}.rgb`, {
										type: 'state',
										common: {
											...rgb,
											name: `${device.info?.displayName} / ${rgb.name}`,
										},
										native: {
											ip: device.ip,
											port: device.port,
											productName: device.info?.productName,
										},
									});
									this.subscribeStates(`${deviceName}.light.${key}.${key2}.rgb`);
								}
							}
						}
					}
				}
			}
		}
		// create the states on the key of device.settings
		if (device.settings) {
			this.writeLog(`[Adapter v.${this.version} createStates] create settings states for ${deviceName}`, 'debug');
			await this.extendObjectAsync(`${deviceName}.settings`, {
				type: 'channel',
				common: {
					name: `${device.info?.displayName} / Settings`,
					desc: 'Settings of the device',
				},
				native: {},
			});

			for (const [key] of Object.entries(device.settings)) {
				if (key !== `battery`) {
					let common: ioBroker.StateCommon = { name: '', role: '', read: false, write: false };
					common = stateAttrb[key as keyof typeof stateAttrb];

					await this.extendObjectAsync(`${deviceName}.settings.${key}`, {
						type: 'state',
						common: {
							...common,
							name: `${device.info?.displayName} / ${common.name}`,
						},
						native: {
							ip: device.ip,
							port: device.port,
							productName: device.info?.productName,
						},
					});
					// check if the state is writable
					if (common.write) {
						this.subscribeStates(`${deviceName}.settings.${key}`);
					}
					// end of settings
				} else {
					if (device.settings.battery) {
						// create the states on the key of device.settings.battery
						for (const [key2] of Object.entries(device.settings.battery)) {
							await this.extendObjectAsync(`${deviceName}.settings.${key}.${key2}`, {
								type: 'channel',
								common: {
									name: `${device.info?.displayName} / Energy Saving`,
									desc: 'Information about the energy saving',
								},
								native: {},
							});
							if (key2 !== `energySaving`) {
								await this.extendObjectAsync(`${deviceName}.settings.${key}`, {
									type: 'channel',
									common: {
										name: `${device.info?.displayName} / battery`,
										desc: 'Information about the battery',
									},
									native: {},
								});
								let common: ioBroker.StateCommon = { name: '', role: '', read: false, write: false };
								common = stateAttrb[key2 as keyof typeof stateAttrb];

								await this.extendObjectAsync(`${deviceName}.settings.${key}.${key2}`, {
									type: 'state',
									common: {
										...common,
										name: `${device.info?.displayName} / ${common.name}`,
									},
									native: {
										ip: device.ip,
										port: device.port,
										productName: device.info?.productName,
									},
								});
								// check if the state is writable
								if (common.write) {
									this.subscribeStates(`${deviceName}.settings.${key}.${key2}`);
								}
								// end of battery
							} else {
								// energySaving
								for (const [key3] of Object.entries(device.settings.battery.energySaving)) {
									await this.extendObjectAsync(`${deviceName}.settings.${key}.${key2}.${key3}`, {
										type: 'channel',
										common: {
											name: `${device.info?.displayName} / adjust Brightness`,
											desc: 'Information about the adjustBrightness',
										},
										native: {},
									});
									if (key3 !== `adjustBrightness`) {
										let common: ioBroker.StateCommon = {
											name: '',
											role: '',
											read: false,
											write: false,
										};
										common = stateAttrb[key3 as keyof typeof stateAttrb];

										await this.extendObjectAsync(`${deviceName}.settings.${key}.${key2}.${key3}`, {
											type: 'state',
											common: {
												...common,
												name: `${device.info?.displayName} / ${common.name}`,
											},
											native: {
												ip: device.ip,
												port: device.port,
												productName: device.info?.productName,
											},
										});
										// check if the state is writable
										if (common.write) {
											this.subscribeStates(`${deviceName}.settings.${key}.${key2}.${key3}`);
										}
									} else {
										// adjustBrightness
										for (const [key4] of Object.entries(
											device.settings.battery.energySaving.adjustBrightness,
										)) {
											if (key4 === `brightness`) {
												let common: ioBroker.StateCommon = {
													name: '',
													role: '',
													read: false,
													write: false,
												};
												common = stateAttrb['adjustBrightness' as keyof typeof stateAttrb];

												await this.extendObjectAsync(
													`${deviceName}.settings.${key}.${key2}.${key3}.${key4}`,
													{
														type: 'state',
														common: {
															...common,
															name: `${device.info?.displayName} / ${common.name}`,
														},
														native: {
															ip: device.ip,
															port: device.port,
															productName: device.info?.productName,
														},
													},
												);
											} else {
												let common: ioBroker.StateCommon = {
													name: '',
													role: '',
													read: false,
													write: false,
												};
												common = stateAttrb[key4 as keyof typeof stateAttrb];

												await this.extendObjectAsync(
													`${deviceName}.settings.${key}.${key2}.${key3}.${key4}`,
													{
														type: 'state',
														common: {
															...common,
															name: `${device.info?.displayName} / ${common.name}`,
														},
														native: {
															ip: device.ip,
															port: device.port,
															productName: device.info?.productName,
														},
													},
												);
												// check if the state is writable
												if (common.write) {
													this.subscribeStates(
														`${deviceName}.settings.${key}.${key2}.${key3}.${key4}`,
													);
												}
											}
											// end of adjustBrightness
										}
									}
									// end of energySaving
								}
							}
						}
					}
				}
				// end of settings
			}
		}
		// create the states on the key of device.battery

		await this.setStateAsync(`${deviceName}.reachable`, true, true);
		await this.setStateAsync('info.connections', { val: JSON.stringify(this.devices), ack: true });
	}

	private async addKeyLight(device: KeyLight): Promise<{
		error: boolean;
		message: Error | string;
	}> {
		try {
			const keyLight: KeyLight = device;
			//Grab our Key Light's settings, info, and current options
			const settingsCall = await axios.get(`http://${keyLight.ip}:${keyLight.port}/elgato/lights/settings`);
			keyLight.settings = settingsCall.data;

			const infoCall = await axios.get(`http://${keyLight.ip}:${keyLight.port}/elgato/accessory-info`);
			keyLight.info = infoCall.data;

			const optionsCall = await axios.get(`http://${keyLight.ip}:${keyLight.port}/elgato/lights`);
			keyLight.light = optionsCall.data;

			if (keyLight.info?.productName.startsWith('Elgato Key Light Mini')) {
				const batteryCall = await axios.get(`http://${keyLight.ip}:${keyLight.port}/elgato/battery-info`);
				keyLight.battery = batteryCall.data;
			}

			// check if the device is already in the list
			if (this.devices.find((element) => element.info?.serialNumber === keyLight.info?.serialNumber)) {
				this.writeLog(
					`[Adapter v.${this.version} Axios: ${axios.VERSION} addKeyLight] Device ${keyLight.info?.serialNumber} already in exist`,
					'debug',
				);
				// console.log(`Device ${newKeyLight.info?.serialNumber} already in exist`);
			} else {
				// if not in the list then create a new device
				this.writeLog(
					`[Adapter v.${this.version} Axios: ${axios.VERSION} addKeyLight] Device ${keyLight.info?.serialNumber} not in exist - add it`,
					'debug',
				);
				this.writeLog(
					`[Adapter v.${this.version} Axios: ${axios.VERSION} addKeyLight] add new device: ${keyLight.info?.serialNumber} => ${keyLight.info?.displayName}`,
					'debug',
				);
				this.devices.push(keyLight);
				await this.createStates(keyLight);
			}
			this.writeLog(
				`[Adapter v.${this.version} Axios: ${axios.VERSION} addKeyLight] start createStates for ${keyLight.info?.serialNumber}`,
				'debug',
			);

			this.writeLog(
				`[Adapter v.${this.version} Axios: ${axios.VERSION} addKeyLight] start writeState for ${keyLight.info?.serialNumber}`,
				'debug',
			);
			await this.onReady();
			return {
				error: false,
				message: 'success',
			};
		} catch (error) {
			this.writeLog(`[Adapter v.${this.version} Axios: ${axios.VERSION} addKeyLight] ${error}`, 'error');
			return {
				error: true,
				message: error,
			};
		}
	}

	private async requestKeyLight(device: KeyLight): Promise<void> {
		try {
			const keyLight: KeyLight = device;
			//Grab our Key Light's settings, info, and current options
			const settingsCall = await axios.get(`http://${keyLight.ip}:${keyLight.port}/elgato/lights/settings`);
			keyLight.settings = settingsCall.data;

			const infoCall = await axios.get(`http://${keyLight.ip}:${keyLight.port}/elgato/accessory-info`);
			keyLight.info = infoCall.data;

			const optionsCall = await axios.get(`http://${keyLight.ip}:${keyLight.port}/elgato/lights`);
			keyLight.light = optionsCall.data;

			if (keyLight.info?.productName.startsWith('Elgato Key Light Mini')) {
				const batteryCall = await axios.get(`http://${keyLight.ip}:${keyLight.port}/elgato/battery-info`);
				keyLight.battery = batteryCall.data;
			}

			this.writeLog(
				`[Adapter v.${this.version} Axios: ${axios.VERSION}] requestKeyLight] start writeState for ${
					keyLight.info?.serialNumber
				} with Data: ${JSON.stringify(keyLight)}`,
				'debug',
			);

			await this.writeState(keyLight);
			this.requestObject.push(keyLight);
		} catch (error) {
			if (error.response) {
				this.writeLog(
					`[Adapter v.${this.version} Axios: ${axios.VERSION} updateLightOptions] Error send for ${
						device.ip
					} ${error.message} >> message: ${JSON.stringify(error.response.data.errors)}`,
					'error',
				);
			} else {
				this.writeLog(
					`[Adapter v.${this.version} Axios: ${axios.VERSION} updateLightOptions] Error send for ${device.ip} ${error.message}`,
					'error',
				);
				return undefined;
			}
		}
	}

	/**
	 * @description a function for log output
	 */
	private writeLog(logText: string, logType: 'silly' | 'info' | 'debug' | 'warn' | 'error'): void {
		if (logType === 'warn' || logType === 'error') {
			if (this.messageHandler.length > 0) {
				// check if the logText is not in the messageHandler
				if (!this.messageHandler.find((message) => message.message === logText)) {
					// push the logText to the messageHandler
					this.messageHandler.push({
						severity: logType,
						clearTimer: false,
						message: logText,
					});
					if (logType === 'warn') this.log.warn(logText);
					if (logType === 'error') this.log.error(logText);
					this.log.debug(
						`[Adapter v.${this.version} writeLog] messageHandler: ` + JSON.stringify(this.messageHandler),
					);
				} else {
					if (!this.messageHandler.find((message) => message.message === logText).clearTimer) {
						// set the clearTimer to true
						this.messageHandler.find((message) => message.message === logText).clearTimer = true;
						// set the clearTimer to false and clear the messageHandler for the logText after 5 min
						this.messageHandlerTimer = this.setTimeout(() => {
							this.messageHandler.find((message) => message.message === logText).clearTimer = false;
							this.messageHandler = this.messageHandler.filter((message) => message.message !== logText);
							this.log.debug(`[Adapter v.${this.version} writeLog] clear messageHandler for ${logText}`);
						}, 300000);
					}
					this.log.debug(
						`[Adapter v.${this.version} writeLog] messageHandler: ` + JSON.stringify(this.messageHandler),
					);
				}
			} else {
				// push the logText to the messageHandler
				this.messageHandler.push({
					severity: logType,
					clearTimer: false,
					message: logText,
				});
				if (logType === 'warn') this.log.warn(logText);
				if (logType === 'error') this.log.error(logText);
				this.log.debug(
					`[Adapter v.${this.version} writeLog] messageHandler: ` + JSON.stringify(this.messageHandler),
				);
			}
		} else {
			if (logType === 'silly') this.log.silly(logText);
			if (logType === 'info') this.log.info(logText);
			if (logType === 'debug') this.log.debug(logText);
		}
	}

	public async updateLightOptions(
		device: KeyLight,
		options: KeyLightOptions | LightStripOptions,
	): Promise<KeyLightOptions | LightStripOptions | undefined> {
		try {
			const result = await axios.put(`http://${device.ip}:${device.port}/elgato/lights`, options);
			if (result.status === 200) {
				const resultData = result.data as KeyLightOptions;
				// console.log(resultData);
				this.writeLog(
					`[Adapter v.${this.version} Axios: ${axios.VERSION} updateLightOptions] on for ${
						device.ip
					} set to ${JSON.stringify(options)}`,
					'debug',
				);
				return resultData;
			}
			// console.log(
			// 	`[Axios: ${axios.VERSION} updateLightOptions] on for ${device.ip} set to ${JSON.stringify(options)}`,
			// );
			this.writeLog(
				`[Adapter v.${this.version} Axios: ${axios.VERSION} updateLightOptions] on for ${
					device.ip
				} set to ${JSON.stringify(options)}`,
				'debug',
			);
			return undefined;
		} catch (error) {
			if (error.response) {
				this.writeLog(
					`[Adapter v.${this.version} Axios: ${axios.VERSION} updateLightOptions] Error send for ${
						device.ip
					} ${error.message} >> message: ${JSON.stringify(error.response.data.errors)}`,
					'error',
				);
			} else {
				this.writeLog(
					`[Adapter v.${this.version} Axios: ${axios.VERSION} updateLightOptions] Error send for ${device.ip} ${error.message}`,
					'error',
				);
				return undefined;
			}
		}
	}

	public async identify(device: KeyLight): Promise<void> {
		try {
			await axios.post(`http://${device.ip}:${device.port ? device.port : 9123}/elgato/identify`);
			this.writeLog(
				`[Adapter v.${this.version} Axios: ${axios.VERSION} onStateChange] identify the device`,
				'debug',
			);
		} catch (error) {
			this.writeLog(
				`[Adapter v.${this.version} Axios: ${axios.VERSION} onStateChange] identify was not successful: ${error}`,
				'error',
			);
			this.writeLog(`[Adapter v.${this.version} Axios: ${axios.VERSION} onStateChange] ${error}`, 'error');
		}
	}

	public async updateLightInfo(device: KeyLight, options: KeyLightInfo): Promise<KeyLightInfo | undefined> {
		try {
			const result = await axios.put(`http://${device.ip}:${device.port}/elgato/accessory-info`, options);
			// console.log(
			// 	`[Adapter v.${this.version} Axios: ${axios.VERSION} updateLightInfo] displayName for ${device.ip} set to ${options}`,
			// );
			this.writeLog(
				`[Adapter v.${this.version} Axios: ${axios.VERSION} updateLightInfo] displayName for ${device.ip} set to ${options}`,
				'debug',
			);
			return result.data as KeyLightInfo;
		} catch (error) {
			if (error.response) {
				this.writeLog(
					`[Adapter v.${this.version} Axios: ${axios.VERSION} updateLightInfo] Error send for ${device.ip} ${
						error.message
					} >> message: ${JSON.stringify(error.response.data.errors)}`,
					'error',
				);
			} else {
				this.writeLog(
					`[Adapter v.${this.version} Axios: ${axios.VERSION} updateLightInfo] Error send for ${device.ip} ${error.message}`,
					'error',
				);
				return undefined;
			}
		}
	}

	/**
	 * Is called if a subscribed state changes
	 */
	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (state && !state.ack) {
			if (state.from === 'system.adapter.' + this.namespace) {
				// ignore the state change from the adapter itself
				return;
			} else {
				this.writeLog(
					`[Adapter v.${this.version} onStateChange] state ${id} changed: ${state.val} (ack = ${state.ack})`,
					'debug',
				);
				const stateName = id.split('.').pop();
				const obj = await this.getForeignObjectAsync(id);

				if (obj) {
					const native = obj.native;
					if (stateName === 'identify') {
						await this.identify(native as KeyLight);
					}
					if (stateName === 'on') {
						this.writeLog(
							`[Adapter v.${this.version} onStateChange] on for ${native.ip} set to ${state.val}`,
							'debug',
						);
						const value = state.val ? 1 : 0;
						const options = {
							lights: [
								{
									on: value,
								},
							],
						};
						const result = await this.updateLightOptions(native as KeyLight, options as KeyLightOptions);

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
					if (stateName === 'displayName') {
						this.writeLog(
							`[Adapter v.${this.version} onStateChange] displayName for ${native.ip} set to ${state.val}`,
							'debug',
						);
						const value = state.val;
						const options = {
							displayName: value,
						};
						const result = await this.updateLightInfo(native as KeyLight, options as KeyLightInfo);
						if (result) {
							const displayName = result.displayName;
							if (displayName === value) {
								await this.setStateAsync(id, value, true);
							} else {
								await this.setStateAsync(id, displayName, true);
							}
						}
					}
					if (stateName === 'brightness') {
						const value = state.val as number;
						this.writeLog(
							`[Adapter v.${this.version} onStateChange] brightness for ${native.ip} set to ${state.val}`,
							'debug',
						);
						let options = {};
						if (native.productName === 'Elgato Light Strip') {
							// search in this.requestObjects for the matching object
							const requestObject = this.requestObject.find((obj) => obj.ip === native.ip) as LightStrip;
							if (requestObject) {
								// check if in requestObject.light.lights[0] the property scene is present
								if (requestObject.light?.lights[0].scene) {
									options = {
										lights: [
											{
												id: requestObject.light.lights[0].id,
												name: requestObject.light.lights[0].name,
												brightness: value,
												numberOfSceneElements:
													requestObject.light.lights[0].numberOfSceneElements,
												scene: requestObject.light.lights[0].scene,
											},
										],
									};
									// console.log(`scene Mode`);
								} else {
									options = {
										lights: [
											{
												brightness: value,
											},
										],
									};
									// console.log(`brightness Mode`);
								}
							}
						} else {
							options = {
								lights: [
									{
										brightness: value,
									},
								],
							};
						}
						const result = await this.updateLightOptions(native as KeyLight, options as KeyLightOptions);
						if (result) {
							const brightness = result.lights[0].brightness;
							if (brightness === value) {
								await this.setStateAsync(id, value, true);
							} else {
								await this.setStateAsync(id, brightness as number, true);
							}
						}
					}
					if (stateName === 'temperature') {
						this.writeLog(
							`[Adapter v.${this.version} onStateChange] temperature for ${native.ip} set to ${state.val}`,
							'debug',
						);
						const value = state.val as number;

						let mired = 143;
						// convert the temperature from kelvin to mired
						if (value) {
							mired = 1000000 / value;
							// round off to 0 decimal places
							mired = Math.round(mired);
							// check if the value is within the range
							if (mired < 143) mired = 143;
							if (mired > 344) mired = 344;
						} else {
							mired = 143;
						}

						const options = {
							lights: [
								{
									temperature: mired,
								},
							],
						};
						const result: KeyLightOptions | undefined = await this.updateLightOptions(
							native as KeyLight,
							options as KeyLightOptions,
						);

						if (result) {
							const temperature = result.lights[0].temperature;
							if (temperature === mired) {
								await this.setStateAsync(id, value, true);
							} else {
								if (temperature) {
									// convert the temperature from mired to kelvin
									let newTemperature = 1000000 / temperature;
									// round off to 0 decimal places
									newTemperature = Math.round(newTemperature);
									await this.setStateAsync(id, newTemperature as number, true);
								}
							}
						}
					}
					if (stateName === 'hue') {
						this.writeLog(
							`[Adapter v.${this.version} onStateChange] hue for ${native.ip} set to ${state.val}`,
							'debug',
						);
						const value = state.val as number;
						const options = {
							lights: [
								{
									hue: value,
								},
							],
						};
						const result: undefined | LightStripOptions = await this.updateLightOptions(
							native as KeyLight,
							options as LightStripOptions,
						);
						if (result) {
							const hue = result.lights[0].hue;
							if (hue === value) {
								await this.setStateAsync(id, value, true);
							} else {
								await this.setStateAsync(id, hue as number, true);
							}
						}
					}
					if (stateName === 'saturation') {
						this.writeLog(
							`[Adapter v.${this.version} onStateChange] saturation for ${native.ip} set to ${state.val}`,
							'debug',
						);
						const value = state.val as number;
						const options = {
							lights: [
								{
									saturation: value,
								},
							],
						};
						const result: undefined | LightStripOptions = await this.updateLightOptions(
							native as KeyLight,
							options as LightStripOptions,
						);
						if (result) {
							const saturation = result.lights[0].saturation;
							if (saturation === value) {
								await this.setStateAsync(id, value, true);
							} else {
								await this.setStateAsync(id, saturation as number, true);
							}
						}
					}
					if (stateName === 'hex') {
						this.writeLog(
							`[Adapter v.${this.version} onStateChange] hex for ${native.ip} set to ${state.val}`,
							'debug',
						);
						const value = state.val as string;

						let hue = 0;
						let sat = 0;
						let bri = 0;

						const hsb = hexToHsb(value);
						hue = Math.round(hsb[0]);
						sat = Math.round(hsb[1]);
						bri = Math.round(hsb[2]);

						const options = {
							lights: [
								{
									hue: hue,
									saturation: sat,
									brightness: bri,
								},
							],
						};

						const result: undefined | LightStripOptions = await this.updateLightOptions(
							native as KeyLight,
							options as LightStripOptions,
						);
						if (result) {
							const hex = hsbToHex(
								result.lights[0].hue as number,
								result.lights[0].saturation as number,
								result.lights[0].brightness as number,
							);
							if (hex === value) {
								await this.setStateAsync(id, value, true);
							} else {
								await this.setStateAsync(id, hex, true);
							}
						}
					}
					if (stateName === 'rgb') {
						this.writeLog(
							`[Adapter v.${this.version} onStateChange] rgb for ${native.ip} set to ${state.val}`,
							'debug',
						);
						const value = state.val as string;

						let hue = 0;
						let sat = 0;
						let bri = 0;

						const rgb = value.split(',');
						const hsb = rgbToHsb(parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2]));
						hue = Math.round(hsb[0]);
						sat = Math.round(hsb[1]);
						bri = Math.round(hsb[2]);

						const options = {
							lights: [
								{
									hue: hue,
									saturation: sat,
									brightness: bri,
								},
							],
						};
						const result: undefined | LightStripOptions = await this.updateLightOptions(
							native as KeyLight,
							options as LightStripOptions,
						);
						if (result) {
							const rgb = hsbToRgb(
								result.lights[0].hue as number,
								result.lights[0].saturation as number,
								result.lights[0].brightness as number,
							);
							if (rgb === value) {
								await this.setStateAsync(id, value, true);
							} else {
								await this.setStateAsync(id, rgb, true);
							}
						}
					}
				}
			}
		} else {
			return;
		}
	}

	private async onMessage(obj: ioBroker.Message): Promise<void> {
		if (typeof obj === 'object' && obj.message) {
			if (obj.command === 'addKeyLight') {
				const device = obj.message as KeyLight;
				const data: KeyLight = {
					ip: device.ip,
					port: 9123,
				};
				const result = await this.addKeyLight(data);

				if (result.message === 'success') {
					this.sendTo(obj.from, obj.command, result, obj.callback);
				} else {
					this.sendTo(obj.from, obj.command, result, obj.callback);
				}
			}
			if (obj.command === 'deleteKeyLight') {
				const device = obj.message as { id: string };
				const index = this.devices.findIndex((d) => d.info?.serialNumber === device.id);
				if (index > -1) {
					this.devices.splice(index, 1);
					this.writeLog(`[Adapter v.${this.version} onMessage] delete device ${device.id}`, 'debug');
					await this.delObjectAsync(`${this.namespace}.${device.id}`, { recursive: true });
					await this.onReady();
					this.sendTo(obj.from, obj.command, { message: 'success' }, obj.callback);
				}
			}
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private async onUnload(callback: () => void): Promise<void> {
		try {
			this.writeLog(`[Adapter v.${this.version} onUnload] Adapter stopped`, 'debug');
			// Here you must clear all timeouts or intervals that may still be active
			if (this.requestTimer) this.clearTimeout(this.requestTimer);
			if (this.messageHandlerTimer) this.clearTimeout(this.messageHandlerTimer);
			this.setState('info.connection', false, true);
			for (const devicesKey in this.devices) {
				this.setState(`${this.devices[devicesKey].info?.serialNumber}.reachable`, false, true);
			}

			callback();
		} catch (e) {
			callback();
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new ElgatoKeyLight(options);
} else {
	// otherwise start the instance directly
	(() => new ElgatoKeyLight())();
}
