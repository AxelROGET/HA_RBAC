/**
 * @typedef {Object} Entity_Data
 * @property {Array} aliases
 * @property {String} area_id
 * @property {unknown} capabilities
 * @property {String} config_entry_id
 * @property {unknown} device_class
 * @property {String} device_id
 * @property {unknown} disabled_by
 * @property {"config"|unknown} entity_category
 * @property {String} entity_id
 * @property {Boolean} has_entity_name
 * @property {unknown} hidden_by
 * @property {unknown} icon
 * @property {String} id
 * @property {String} name
 * @property {Object} options
 * @property {unknown} original_device_class
 * @property {unknown} original_icon
 * @property {String} original_name
 * @property {String} platform
 * @property {String} previous_unique_id
 * @property {Number} supported_features
 * @property {unknown} translation_key
 * @property {String} unique_id
 * @property {unknown} unit_of_measurement
 * 
 * 
 * 
 * @typedef {Object} Entities_File_Data
 * @property {Array} deleted_entities
 * @property {Entity_Data[]} entities
 * 
 * @typedef {Object} Entities_File
 * @property {Number} version
 * @property {Number} minor_version
 * @property {"core.entity_registry"} key
 * @property {Entities_File_Data} data
 */

/**
 * @type {Entities_File}
 */
let entity_registry;


$(() => {

    // ! If a config device is deleted
    $("#entities_configuration").on("click", ".btn-close", function() {
        console.log("Removing device from config");
        const device_id = $(this).parent().parent().attr("data-device-id");
        console.log(device_id);
        rbac.devices.find(d => d.id == device_id).deleteFromCustomConfig();
    })

});

// ! List-group : #entities_configuration

