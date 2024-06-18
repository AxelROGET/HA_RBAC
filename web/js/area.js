/**
 * @typedef {Object} Device_Data
 * @property {String|null} area_id
 * @property {String[]} config_entries
 * @property {null} configuration_url
 * @property {Array} connections
 * @property {null} disabled_by
 * @property {"service"} entry_type
 * @property {null} hw_version
 * @property {String} id
 * @property {String[]} identifiers
 * @property {String} manufacturer
 * @property {String} model
 * @property {String} name
 * @property {String} name_by_user
 * @property {String} serial_number
 * @property {String} sw_version
 * @property {String} via_device_id
 * 
 * @typedef {Object} Device_File_Data
 * @property {Array} deleted_devices 
 * @property {Device_Data[]} devices
 * 
 * @typedef {Object} Device_File
 * @property {Number} version
 * @property {Number} minor_version
 * @property {String} key
 * @property {Device_File_Data} data
 */

