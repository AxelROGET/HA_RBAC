/**
 * @typedef {{id: String, group_ids: String[], is_active: Boolean, is_owner: Boolean, local_only: Boolean, name: String, system_generated: Boolean}} User_Data
 * 
 * 
 * @typedef {object} old_Policy
 * @property {{entity_ids: object}} entities // TODO key is entity_id, value is a boolean or an object with read and write boolean

 * @typedef {object} Group_Data
 * @property {String} id
 * @property {String} name
 * @property {old_Policy} [policy]
 * @typedef {{version: Number, minor_version: Number, key: String, data: {users: User_Data[], groups: Group_Data[], credentials: Array, refresh_tokens: Array}}} Auth_data
 

*/

/** @type {Device_File} */
let device_registry;

/** @type {RBAC} */
let rbac = null;


class RBAC {

    /**
     * 
     * @param {Auth_data} auth 
     * @param {Device_File} device_registry 
     * @param {Entities_File} entity_registry 
     */
    constructor(auth, device_registry, entity_registry) {

        if (!auth) throw new Error("Auth file is missing");
        if (!device_registry) throw new Error("Device registry file is missing");
        if (!entity_registry) throw new Error("Entity registry file is missing");

        this.files = {
            auth, device_registry, entity_registry
        }

        // ! Devices
        Device.init(this);
        /** @type {Array.<Device>} */
        this.devices = []

        // ! Entities
        /** @type {Array.<Entity>} */
        this.entities = []


        // ! Groups
        /** @type {Array.<Group>} */
        this.groups = []
        this.group_current_opened = null;

        Group.init(this);
 

        
        // ! Users
        // Not used for now
        /** @type {Array.<User>} */
        this.users = []

        User.init(this);

        // ! Droppable
        Group.droppable();


        // ! Areas

        /** @type {Array.<Area>} */
        this.areas = []

        Area.init(this);

        // ! User actions 
        // * If a device is deleted in the config panel
        /* $("#entities_configuration").on("click", ".btn-close", function() {

        }) */
        

    }

    publish() {

        $.ajax({
            url: "api/auth", 
            type: "POST",
            data: JSON.stringify(this.files.auth),
            contentType: "application/json",
            success: function(data) {
                console.log(data);
                $("#toastOK").toast("show");
            },
            error: function(err) {
                alert("An error occured while publishing the auth file");
                console.error(err);
            }
        })

    }
    

}


class Area {

    /**
     * @description Initialize the areas list in the RBAC object
     * @param {RBAC} rbac 
     */
    static init(rbac) {

        rbac.areas = [new Area(rbac, "unassigned")];

        // * Add all areas from the devices
        // * Add all devices to the areas
        rbac.files.device_registry.data.devices.forEach(device => {

            if (device.area_id) {
                
                let area = rbac.areas.find(area => area.id == device.area_id)
                
                if (!area) {
                    area = new Area(rbac, device.area_id)
                    rbac.areas.push(area);
                }
                
                const new_device = new Device(rbac, area, device);
                
                rbac.devices.push(new_device);
                area.devices.push(new_device);
            } else {

                const new_device = new Device(rbac, rbac.areas.find(area => area.id == "unassigned"), device)

                rbac.areas.find(area => area.id == "unassigned").devices.push(new_device);
                rbac.devices.push(new_device);
            
            }

        })

        // * Sort areas by name (unassigned last)
        rbac.areas.sort((a, b) => {
            if (a.id == "unassigned") return 1;
            if (b.id == "unassigned") return -1;
            return a.id.localeCompare(b.id);
        })


        // * Initialize entities
        Entity.init(rbac);


        // ! Listen to the click to configure an area
        $("#entities_configuration").on("click", `[data-type="area"] button`, function() {
            console.trace("Configuring area");
            console.warn("TODO")

            console.log($(this))

            /** @type {"not specified"|"deny"|"read only"|"write"|"delete"} */
            const permission = $(this).data("permission")

            switch(permission) {
                case "delete":
                    // * Delete the area from the left panel if it's existing
                    $(`#areas>li[data-area-id="${$(this).parent().parent().parent().parent().data("area-id")}"]`).remove();

                    // * Add the area to the left panel
                    rbac.areas.find(area => area.id == $(this).parent().parent().parent().parent().data("area-id")).addAreaToListWithDevices();

                    // * Delete the area from the config panel
                    $(this).parent().parent().parent().parent().remove();
                    break;

                default:
                    // * Configure the area
                    Area.configure($(this).parent().parent().parent().parent().data("area-id"), permission);
                
            }
        })



    }

    /**
     * 
     * @param {String} area_id 
     * @param {"not specified"|"write"|"read only"|"deny"} permission 
     * @returns 
     */
    static configure(area_id, permission) {
        console.log("Configuring area: " + area_id + " with " + permission);

        switch(permission) {
            case "not specified":
                delete auth.data.groups.find(g => g.id == Group.getOpened().id).policy.entities.area_ids[area_id];
                break;
            case "deny": 
                auth.data.groups.find(g => g.id == Group.getOpened().id).policy.entities.area_ids[area_id] = false;
                break;
            case "read only":
                auth.data.groups.find(g => g.id == Group.getOpened().id).policy.entities.area_ids[area_id] = {read: true};
                break;
            case "write":
                auth.data.groups.find(g => g.id == Group.getOpened().id).policy.entities.area_ids[area_id] = true;
                break;
            default:
                throw new Error("Permission not found");
        }

    }

    /**
     * @param {RBAC} rbac 
     * @param {String} area_id 
     */
    constructor(rbac, area_id) {
        this.rbac = rbac;

        /** @type {String|"unassigned"} */
        this.id = area_id;

        /** @type {Array.<Device>} */
        this.devices = [];
    }

    /**
     * @description Add device to the area in the config panel (at the left) in the DOM
     * @param {Device} device 
     * @deprecated
     */
    addDevice(device) {


        console.error("Deprecated function");

        this.addDeviceToList(device);
        

    }

    addAreaToListWithDevices() {

        this.devices.forEach(device => {
            this.addDeviceToList(device);
        })

    }

    /**
     * @description Add device to the area in the list panel (at the left) in the DOM
     * @param {Device} device 
     */
    addDeviceToList(device) {

        // * Check if area already exists
        if (!$(`#areas>li[data-area-id="${this.id}"]`).length) {
            let li = $(`<li>`)
                .addClass("list-group-item")
                .attr("data-area-id", this.id)
                .text(this.id)
                .append($("<ul>").addClass("list-group").addClass("collapse"));

            if (this.id === "unassigned") {
                $("#areas").append(li);
            } else {
                //$("<i>").addClass("bi bi-caret-right-square").css("float", "right").insertBefore(li.children().first());
                $(`#areas>li[data-area-id="unassigned"]`).before(li);
            }
        }

        let li = $("<li>")
            .addClass("list-group-item")
            .attr("data-device-id", device.id)
            .text(device.name)
            .append($("<i>").addClass("bi bi-caret-right-square").css("float", "right"));

        console.debug(li);
        console.debug(`#areas>li[data-area-id="${this.id}"]`);

        $(`#areas>li[data-area-id="${this.id}"]>ul`).append(li);

    }

    /**
     * 
     * @param {Device} device 
     * @description Add device to the area in the config panel (at the right) in the DOM
     */
    addDeviceToConfig(device) {
        
        this.findInConfig().children().filter("ul").append(device.htmlConfig());     

    }

    /**
     * @description Return the <li> element of the area in the config panel (at the right) in the DOM
     * @returns {JQuery}
     */
    findInConfig() {
        return $(`#entities_configuration li[data-area-id="${this.id}"]`);
    }

    /**
     * @description Return the <li> element for the area in the config panel (at the right)
     * This function doesn't append the li to the DOM, it just returns the element
     */
    htmlConfig() {
        let li = $("<li>")
            .addClass("list-group-item")
            .attr("data-area-id", this.id?this.id:"unassigned")
            
        let div = $("<div>")
            .addClass("d-flex")
            .addClass("justify-content-between")
            .addClass("align-items-center")
            .text(this.id?this.id:"unassigned")
            .appendTo(li);

        let dropdown = $("<div>")
            .addClass("dropdown")
            .addClass("d-flex")
            .addClass("justify-content-end")
            .addClass("align-items-center")
            .appendTo(div);
        
        $("<button>")
            .addClass("btn btn-secondary dropdown-toggle")
            .attr("type", "button")
            .attr("id", `dropdownMenuButton${this.id?this.id:"unassigned"}`)
            .attr("data-bs-toggle", "dropdown")
            .attr("aria-expanded", "false")
            .append($("<i>").addClass("bi bi-question-circle"))
            .appendTo(dropdown);

        generateDropdownMenu(this.id?this.id:"unassigned","area" ,true).appendTo(dropdown);

        let list = $("<ul>")
            .addClass("list-group")
            .addClass("mt-2")
            .appendTo(li);

        return li;
    }

    /**
     * 
     * @param {"not specified"|"deny"|"read only"|"write"} policy 
     */
    showPolicy(policy) {
        const dropdown = $(`#entities_configuration li[data-area-id="${this.id}"] > div > .dropdown > button`);
        const icon = dropdown.children().first();

        dropdown.removeClass("btn-secondary btn-success btn-warning btn-danger");
        icon.removeClass("bi-question-circle bi-check-circle bi-eye bi-ban");

        switch(policy) {
            case "not specified":
                dropdown.addClass("btn-secondary")
                icon.addClass("bi-question-circle")
                break;
            case "write":
                dropdown.addClass("btn-success")
                icon.addClass("bi-check-circle")
                break;
            case "read only":
                dropdown.addClass("btn-warning")
                icon.addClass("bi-eye")
                break;
            case "deny":
                dropdown.addClass("btn-danger")
                icon.addClass("bi-ban")
                break;
        }

    }


    /**
     * @returns {Boolean}
     */
    isInCustomConfig() {

        return $(`#entities_configuration li[data-area-id="${this.id}"]`).length?true:false;

    }

    moveToCustomConfig() {

        // ! NEW FUNCTION 
        // TODO 
        console.warn("TODO moveToCustomConfig");

    }
}

/**
 * 
 * @param {String} id Id of the dropdown (usually the id of the area, device or entity)
 * @param {"entity"|"device"|"area"} type What is the dropdown for
 * @param {Boolean} delete_button If the delete button should be displayed
 * @returns {JQuery}
 */
function generateDropdownMenu(id, type, delete_button=true) {

    if(type != "area" && type != "device" && type != "entity") {
        throw new Error(`Type ${type} not found. Must be "area", "device" or "entity"`);
    }

    return $(
            `
        <div class="dropdown-menu overflow-hidden" aria-labelledby="dropdownMenuButton${id}" data-type="${type}">
            <button class="btn btn-icon" data-permission="not specified"><i class="bi bi-question-circle"></i></button>
            <button class="btn btn-success btn-icon" data-permission="edit"><i class="bi bi-check-circle"></i></button>
            <button class="btn btn-warning btn-icon" data-permission="read only"><i class="bi bi-eye"></i></button>
            <button class="btn btn-danger btn-icon" data-permission="deny"><i class="bi bi-ban"></i></button>
            ${delete_button?`<button class="btn btn-icon" data-permission="delete"><i class="bi bi-trash3"></i></button>`:""} 
        </div>
        `
    )
}

function getEmoji(permission) {
    switch (permission) {
        case "not specified":
            return "bi-question-circle";
        case "edit":
            return "bi-check-circle";
        case "deny":
            return "bi-ban";
        case "read only":
            return "bi-eye";
        default:
            throw new Error("Permission not found")
    }
}

function buttonClass(permission) {
    switch (permission) {
        case "not specified":
            return "btn-secondary";
        case "edit":
            return "btn-success";
        case "deny":
            return "btn-danger";
        case "read only":
            return "btn-warning";
        default:
            throw new Error("Permission not found")
    }
}

class Device {

    /**
     * 
     * @param {RBAC} rbac 
     */
    static init(rbac) {

       


        // ! Listen to the click to unfold a device (show entities)
        $("#entities_configuration").on("click", ".list-group-item .toggle-fold", function() {
            $(this).parent().parent().children().filter("ul .collapse").collapse("toggle");
        })

        // ! Listen to the click to configure a device
        $("#entities_configuration").on("click", `[data-type="device"] button`, function() {
            console.trace("Configuring device");
            console.warn("TODO")

            console.log($(this))
            
            /** @type {"not specified"|"deny"|"read only"|"write"|"delete"} */
            const permission = $(this).data("permission");

            // * Configure the device
            rbac.devices.find(d => d.id == $(this).parent().parent().parent().data("device-id")).configure(permission);
           

        })
    }

    /**
     * 
     * @param {RBAC} rbac 
     * @param {Area} area 
     * @param {Device_Data} device 
     */
    constructor(rbac, area, device) {
        this.rbac = rbac;

        this.area = area;

        this.area_id = null;
        this.config_entries = null;
        this.configuration_url = null;
        this.connections = null;
        this.disabled_by = null;
        this.entry_type = null;
        this.hw_version = null;
        this.id = null;
        this.identifiers = null;
        this.manufacturer = null;
        this.model = null;
        this.name_by_user = null;
        this.name = null;
        this.serial_number = null;
        this.sw_version = null;
        this.via_device_id = null;



        // * Copy device data
        Object.keys(device).forEach(key => {
            this[key] = device[key];
        })

        // * Entities
        /** @type {Array.<Entity>} */
        this.entities = [];
    

    }

    /**
     * @description Configure the device in the group policy in the auth file
     * @param {"not specified"|"deny"|"read only"|"write"|"delete"} auth_level 
     */
    configure(auth_level) {

        // TODO

        console.trace(`Configuring device : ${this.id} with ${auth_level}`);

        let permission = null;
        switch(auth_level) {
            case "delete":
                delete auth.data.groups.find(g => g.id == Group.getOpened().id).policy.entities.device_ids[this.id];
                this.entities.forEach(entity =>{
                    delete auth.data.groups.find(g => g.id == Group.getOpened().id).policy.entities.entity_ids[entity.entity_id];
                })
                this.deleteFromCustomConfig();
                return;
            case "write":
                permission = true;
                break;
            case "read only":
                permission = {read: true};
                break;
            case "deny":
                permission = false;
                break;
            case "not specified":
                delete auth.data.groups.find(g => g.id == Group.getOpened().id).policy.entities.device_ids[this.id];
                return;
        }

        auth.data.groups.find(g => g.id == Group.getOpened().id).policy.entities.device_ids[this.id] = permission;

    }


    htmlConfig(called_li=null, current_permission="not specified") {
        let header = $("<div>")
            .attr("data-device-id", this.id)
            .addClass("d-flex")
            .addClass("justify-content-between")
            .addClass("align-items-center")

        $("<div>").text(this.name).addClass("toggle-fold").appendTo(header);

        let dropdown = $("<div>")
            .addClass("dropdown")

        
        

        $("<button>")
            .addClass(`btn ${buttonClass(current_permission)} dropdown-toggle`)
            .attr("type", "button")
            .attr("id", `dropdownMenuButton${this.id}`)
            .attr("data-bs-toggle", "dropdown")
            .attr("aria-expanded", "false")
            .append($("<i>").addClass(`bi ${getEmoji(current_permission)}`))
            .appendTo(dropdown);

        generateDropdownMenu(this.id, "device").appendTo(dropdown);

        dropdown.appendTo(header);

        let li = $("<li>").addClass("list-group-item").append(header);


        let collapse = $("<ul>")
            .addClass("collapse")
            .addClass("list-group")
            .addClass("mt-2")



        this.entities.forEach(entity => {
            $("<li>")
                .addClass("list-group-item")
                .append(entity.htmlConfig())
                .appendTo(collapse);
        })

        collapse.appendTo(li);



        

        return li

    }

    /**
     * @description Move the device from the list (left) to the config panel (right) in the DOM and add all entities to the config panel
     */
    moveToCustomConfig() {

        // * If the area is unassigned, add the device directly to the config panel
        // * If the area isn't in the config panel, add the area to the config panel
        // * If the area is already in the config panel, add the device to the area
        

        console.log("Adding device to config: " + this.id);

        // * Add area in the config panel if it doesn't exist
        console.debug("Area found: ");

        let area = rbac.areas.find(area => area.id == this.area_id)

        // * Add the device directly to the config panel if the area is unassigned
        if (!area) {

            console.log("Adding device to config: " + this.id);

            this.htmlConfig().appendTo("#entities_configuration");

        }


        // * Add the area to the config panel if it doesn't exist
        else if (!$(`#entities_configuration li[data-area-id="${this.area_id?this.area_id:"unassigned"}"]`).length) {

            
            console.log("Adding area to config: " + area.id);
            area.htmlConfig().appendTo("#entities_configuration");


        } 

        // * If the area is empty, add the list-group
        if(!$(`#entities_configuration li[data-area-id="${this.area_id?this.area_id:"unassigned"}"] ul`).length) {
            console.warn("AREA EMPTY");
            console.log($(`#entities_configuration li[data-area-id="${this.area_id?this.area_id:"unassigned"}"] ul`))
            $("<ul>")
                .addClass("list-group")
                .addClass("collapse")
                .addClass("mt-2")
                .appendTo($(`#entities_configuration li[data-area-id="${this.area_id?this.area_id:"unassigned"}]`));
        }

        // * Add the device to the area in the config panel
        if (area) {
            area.addDeviceToConfig(this);
        }

        // * Delete device from the list
        $(`#areas li[data-device-id="${this.id}"]`).remove();

        // * Delete area if empty
        if(!$(`#areas li[data-area-id="${this.area_id?this.area_id:"unassigned"}"] li[data-device-id]`).length) {
            $(`#areas li[data-area-id="${this.area_id?this.area_id:"unassigned"}"]`).remove();
        }

        // * Add device to config
        let li = $("<li>")
            .addClass("list-group-item")
            .attr("data-device-id", this.id);

        
        return

        // Add buttons
        const buttons = $(`<div class="btn-group float-end" style="margin-left: auto;">

            <input type="radio" class="btn-check" name="${this.id}" id="${this.id}-0" autocomplete="off" data-type=device data-permission=edit>
            <label class="btn btn-outline-secondary" for="${this.id}-0"><i class="bi bi-pencil"></i></label>

            <input type="radio" class="btn-check" name="${this.id}" id="${this.id}-1" autocomplete="off" data-type=device data-permission=deny>
            <label class="btn btn-outline-danger" for="${this.id}-1"><i class="bi bi-ban"></i></label>
            
            <input type="radio" class="btn-check" name="${this.id}" id="${this.id}-2" autocomplete="off" data-type=device data-permission="read only">
            <label class="btn btn-outline-warning" for="${this.id}-2"><i class="bi bi-eye"></i></label>
            
            <input type="radio" class="btn-check" name="${this.id}" id="${this.id}-3" autocomplete="off" data-type=device data-permission=write>
            <label class="btn btn-outline-success" for="${this.id}-3"><i class="bi bi-check-circle"></i></label>

            <input type="radio" class="btn-check" name="${this.id}" id="${this.id}-4" autocomplete="off" data-type=device data-permission=delete>
            <label class="btn btn-outline-dark" for="${this.id}-4"><i class="bi bi-trash3"></i></label>
        </div>`)
        
        $("<h5>")
        .addClass("mb-2") 
        .addClass("card-title")
        .text(this.name)
        .append(buttons.addClass("float-end").attr("data-type", "device"))
        .appendTo(li);

        $("<br>").appendTo(li);

        li.appendTo("#entities_configuration");

        // ! Add entities to config panel and check if all permissions are the same
        // TODO probably need to review the following code
        let permissions = new Set();
        rbac.devices.find(d => d.id == this.id).entities.forEach(entity => {
            entity.addToCustomConfig();
            
            const permission = rbac.files.auth.data.groups.find(g => g.id == Group.getOpened().id).policy?.entities?.entity_ids[entity.entity_id];

            switch(permission) {
                case true:
                    permissions.add("write");
                    break;
                case false:
                    permissions.add("deny");
                    break;
                case undefined:
                    permissions.add("not specified");
                    break;
                default:
                    if(permission?.read) {
                        permissions.add("read only");
                    }
            }

        })

        console.warn(permissions);
        if(permissions.size == 1) {
            const elem = $(`#entities_configuration li[data-device-id="${this.id}"] input[data-permission="${Array.from(permissions)[0]}"]`)
            
            elem.prop("checked", true);

            elem.parent().parent().parent().children().filter(".entity-element").removeClass("d-flex").hide();
            
        } else {
            $(`#entities_configuration li[data-device-id="${this.id}"] input[data-permission="edit"]`).prop("checked", true);
        }
        
    }

    /**
     * @description Delete the device from the config panel (right) in the DOM and place it back in the list (left). Also delete the entities in the auth file
     */
    deleteFromCustomConfig() {

        console.log(`Removing device from config: ${this.id}`);

        const list_group = $(`#entities_configuration div[data-device-id="${this.id}"]`).parent().parent();

        // * Delete device from the config panel
        $(`#entities_configuration div[data-device-id="${this.id}"]`).parent().remove();
        // If the area is empty, remove the list-group from the area
        if(!list_group.children().length) {
            console.warn("Removing list-group from config");
            list_group.remove();
        }

        // TODO can't put the device back after being removed from the config panel

        // * Add device to list
        this.area.addDeviceToList(this);

        // * Remove all entities from the group policy 
        this.entities.forEach(entity => {

            // TODO change
            delete Group.getOpened().policy.entities.entity_ids[entity.entity_id]

        });



    }


    /**
     * @description Check if the device is in the custom config panel (right) in the DOM
     * @returns {Boolean}
     */
    isInCustomConfig() {

        return $(`#entities_configuration div[data-device-id="${this.id}"]`).length?true:false;

    }

    config(auth_level) {
        console.log("Configuring device: " + this.id + " with " + auth_level);
    }


    /**
     * 
     * @param {"deny"|"read only"|"write"} policy 
     */
    showPolicy(policy) {

        const dropdown = $(`#entities_configuration div[data-device-id="${this.id}"] .dropdown > button`);
        const icon = dropdown.children().first();

        dropdown.removeClass("btn-secondary btn-success btn-warning btn-danger");
        icon.removeClass("bi-question-circle bi-check-circle bi-eye bi-ban");

        switch(policy) {
            case "not specified":
                dropdown.addClass("btn-secondary")
                icon.addClass("bi-question-circle")
                break;
            case "write":
                dropdown.addClass("btn-success")
                icon.addClass("bi-check-circle")
                break;
            case "read only":
                dropdown.addClass("btn-warning")
                icon.addClass("bi-eye")
                break;
            case "deny":
                dropdown.addClass("btn-danger")
                icon.addClass("bi-ban")
                break;
        }

    }

}

class Entity {

    /**
     * @description Initialize the entities list in the RBAC object
     * @param {RBAC} rbac 
     */
    static init(rbac) {
        rbac.files.entity_registry.data.entities.forEach(entity => {

            rbac.areas.forEach(area => {

                area.devices.forEach(device => {

                    if (device.id == entity.device_id) {
                        const new_entity = new Entity(rbac, device, entity);
                        device.entities.push(new_entity);
                        rbac.entities.push(new_entity);
                    }

                })

            })

        })


        // ! Listen to the click to configure an entity
        $("#entities_configuration").on("click", `[data-type="entity"] button`, function() {
            console.trace("Configuring entity");

            console.log($(this))

            /** @type {"not specified"|"deny"|"read only"|"write"} */
            const permission = $(this).data("permission")

            const entity_id = $(this).parent().parent().parent().data("device-id");

            console.warn(permission, entity_id);
            
            // * Configure the entity
            Entity.configure(entity_id, permission);
 
        })
    }


    /**
     * 
     * @param {String} entity_id 
     * @param {"edit"|"read only"|"deny"|"not specified"} permission 
     */
    static configure(entity_id, permission) {
        console.log("Configuring entity: " + entity_id + " with " + permission);

        switch (permission) {

            case "edit":
                permission = true;
                break;
            case "read only":
                permission = {read: true};
                break;
            case "deny":
                permission = false;
                break;
            case "not specified":
                delete auth.data.groups.find(g => g.id == Group.getOpened().id).policy.entities.entity_ids[entity_id];
                return;
        }

        auth.data.groups.find(g => g.id == Group.getOpened().id).policy.entities.entity_ids[entity_id] = permission;

    }
    
    /**
     * 
     * @param {RBAC} rbac 
     * @param {Device} device 
     * @param {Entity_Data} entity 
     */
    constructor(rbac, device, entity) {
        this.rbac = rbac;

        this.device = device;

        this.aliases = null;
        this.area_id = null;
        this.capabilities = null;
        this.config_entry_id = null;
        this.device_class = null;
        this.device_id = null;
        this.disabled_by = null;
        this.entity_category = null;
        this.entity_id = null;
        this.has_entity_name = null;
        this.hidden_by = null;
        this.icon = null;
        this.id = null;
        this.name = null;
        this.options = null;
        this.original_device_class = null;
        this.original_icon = null;
        this.original_name = null;
        this.platform = null;
        this.previous_unique_id = null;
        this.supported_features = null;
        this.translation_key = null;
        this.unique_id = null;
        this.unit_of_measurement = null;

        // * Copy entity data
        Object.keys(entity).forEach(key => {
            this[key] = entity[key];
        })
    }


    /**
     * @description Configure the entity in the group policy in the auth file
     * @param {Group} group 
     * @param {"not specified"|"deny"|"read only"|"write"} auth_level 
     */
    config(group, auth_level) {

        console.log(group)
        console.log(auth_level)

        console.trace(`Configuring entity : ${group.id}/${this.device_id}/${this.entity_id} with ${auth_level}`);

        let group_auth = this.rbac.files.auth.data.groups.find(g => g.id == group.id);

        if(!group_auth.policy) group_auth.policy = {entities: {entity_ids: {}}}

        switch(auth_level) {

            case "not specified":
                // * Remove the entity from the group policy 
                if(group_auth.policy.entities.entity_ids[this.entity_id]) {
                    delete group_auth.policy.entities.entity_ids[this.entity_id];
                }  
                break;

            case "deny":
                // * Add the entity to the group policy to false
                group_auth.policy.entities.entity_ids[this.entity_id] = false;
                break;

            case "read only":
                // * Add the entity to the group policy to {read: true}
                group_auth.policy.entities.entity_ids[this.entity_id] = {read: true};
                break;

            case "write":
                // * Add the entity to the group policy to true
                group_auth.policy.entities.entity_ids[this.entity_id] = true;
                break;

            default:
                throw new Error("Policy not found")

        }

    }


    /**
     * @description Change the value of the radio buttons in the custom config panel (at the right) in the DOM
     * @param {"not specified"|"deny"|"read only"|"write"} policy 
     */
    showPolicy(policy) {
        
        const dropdown = $(`#entities_configuration div[data-device-id="${this.entity_id}"] .dropdown > button`)
            .removeClass("btn-secondary btn-success btn-warning btn-danger");
        const icon = dropdown.children().first().removeClass("bi-question-circle bi-check-circle bi-eye bi-ban");

        console.log(dropdown)
        // console.log(icon)

        switch(policy) {
            case "not specified":
                dropdown.addClass("btn-secondary")
                icon.addClass("bi-question-circle")
                break;
            case "write":
                dropdown.addClass("btn-success")
                icon.addClass("bi-check-circle")
                break;
            case "read only":
                dropdown.addClass("btn-warning")
                icon.addClass("bi-eye")
                break;
            case "deny":
                dropdown.addClass("btn-danger")
                icon.addClass("bi-ban")
                break;       
                
        }

        
    }


    /**
     * @description Add entity to a device in the config panel (at the right) in the DOM
     */
    addToCustomConfig() {

        console.error("Deprecated function");

        // * Add entity to the config panel

        $(`#entities_configuration>li[data-device-id="${this.device_id}"]`).append(`

            <div class="mb-1 d-flex entity-element" style="justify-content: space-between; align-items: center;">

                ${this.original_name??this.entity_id}
                <div class="btn-group" style="margin-left: auto;" data-type="entity">

                    <input type="radio" class="btn-check" name="${this.entity_id}" id="${this.entity_id}-0" autocomplete="off" checked data-type=entity>
                    <label class="btn btn-outline-secondary" for="${this.entity_id}-0"><i class="bi bi-question-lg"></i></label>

                    <input type="radio" class="btn-check" name="${this.entity_id}" id="${this.entity_id}-1" autocomplete="off" data-type=entity>
                    <label class="btn btn-outline-danger" for="${this.entity_id}-1"><i class="bi bi-ban"></i></label>
                    
                    <input type="radio" class="btn-check" name="${this.entity_id}" id="${this.entity_id}-2" autocomplete="off" data-type=entity>
                    <label class="btn btn-outline-warning" for="${this.entity_id}-2"><i class="bi bi-eye"></i></label>
                    
                    <input type="radio" class="btn-check" name="${this.entity_id}" id="${this.entity_id}-3" autocomplete="off" data-type=entity>
                    <label class="btn btn-outline-success" for="${this.entity_id}-3"><i class="bi bi-check-circle"></i></label>
                </div>

            </div>

        `);
        
        const policy = this.rbac.files.auth.data.groups.find(g => g.id == Group.getOpened().id).policy?.entities?.entity_ids[this.entity_id]

        // * Restore entity configuration 
        if(policy == true) {
            this.showPolicy("write");
        } else if (policy == false) {
            this.showPolicy("deny");
        } else if (policy?.read == true) {
            this.showPolicy("read only");
        } else if (policy == undefined) {
            this.showPolicy("not specified");
        } else {
            throw new Error(`Policy "${JSON.stringify(policy)}" not found`);
        }
        

    }


    /**
     * @description div content for the entity to be added to the li in the device of the config panel
     */
    htmlConfig(current_permission="not specified") {

        return `
        
        <div class="d-flex justify-content-between align-items-center" data-device-id="${this.entity_id}">

            ${this.original_name??this.entity_id}
        
            <div class="dropdown">
                <button class="btn btn-secondary dropdown-toggle" type="button" id="dropdownMenuButton${this.entity_id}" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-question-circle"></i>
                </button>

                ${generateDropdownMenu(this.entity_id, "entity", false).prop("outerHTML")}
            </div>
        
        </div>
        
        

        `

    }    


    
    
}




class Group {

    /**
     * @description Initialize the groups list in the DOM and in the RBAC object
     * @param {RBAC} rbac 
     */
    static init(rbac) {
        this.empty();

        rbac.files.auth.data.groups.forEach(group => {

            const new_group = new Group(rbac, group)
            rbac.groups.push(new_group);
            $("#groups").append(new_group.toHTML());

        })

        this.group_constructor().appendTo("#groups");
    }

    /**
     * @description Empty the groups list in the DOM
     */
    static empty() {
        $("#groups").empty();
    }

    /**
     * @description Returns a group card clickable to create a new group
     * @returns {JQuery}
     */
    static group_constructor() {
        return $(`   
        <div class="col">
            <div class="card h-100" data-id="create-group">
                <div class="card-body text-center">
                    <span class="display-1 text-secondary">+</span>
                </div>
            </div> 
        </div> 
        `)
        .css("cursor", "pointer")
        .on("click", function() {
            // Open the modal to create a group
            $("#modal_create_group").modal("show");
        })
    }

    /**
     * @param {RBAC} rbac
     * @description Makes user cards droppable in group cards
     * @description Call this function after the groups and users are loaded to the DOM
     */
    static droppable(rbac) {
        $("#groups .card").droppable({
            drop: function(event, ui) {
                let user_id = ui.draggable.attr("data-bs-original-title");
                let group_id = $(this).attr("data-id");

                let user = auth.data.users.find(user => user.id == user_id);
                let group = auth.data.groups.find(group => group.id == group_id);
                
                if(!user.group_ids.includes(group_id) && group_id != "create-group") {
                    user.group_ids.push(group_id);
                    console.log("Added user to group")
                    console.log(user)
                    // $(this).find(".list-group").append(old_rbac.users.generate(user, true));
                    $(this).find(".list-group").append(new User(rbac, user).toHTML(true));
                }
            }
        })
    }

    /**
     * 
     * @param {RBAC} rbac 
     * @param {Group_Data} group 
     */
    constructor(rbac, group) {

        if (!rbac) throw new Error("RBAC object is missing");

        this.rbac = rbac;
        
        // * Group data
        this.id = group.id;
        this.name = group.name;
        this.policy = group.policy?group.policy:{entities: {entity_ids: {}}}

    }

    toHTML() {
        return `
                <div class="col">
                    <div class="card h-100" data-id="${this.id}">
                        <div class="card-body">
                            <h5 class="card-title">${this.name}</h5>
                            <ul class="list-group">

                            </ul>
                        </div>
                        ${(() => {
                            if(!["system-admin", "system-users", "system-read-only"].includes(this.id)){
                                return `
                                <div class="card-footer">
                                    <button class="btn btn-primary">Edit rights</button>
                                </div>
                                `
                            } else return "";
                        })()}
                        
                    </div> 
                </div> 
            `
    }

    /**
     * @description Append the group to the RBAC auth file
     */
    appendToAuth() {

        this.rbac.files.auth.data.groups.push({
            id: this.id,
            name: this.name,
            policy: this.policy

        })
        
    }


    /**
     * @description Delete this group from the RBAC auth file, from the RBAC object and from the DOM and remove all users from the group
     */
    delete() {

        if (this.id === "system-admin" || this.id === "system-users" || this.id === "system-read-only") {
            throw new Error("Cannot delete system groups");
        }

        // * Remove the group from the auth file
        this.rbac.files.auth.data.groups = this.rbac.files.auth.data.groups.filter(group => group.id != this.id);

        // * Remove the group from the RBAC object
        this.rbac.groups = this.rbac.groups.filter(group => group.id != this.id);

        // * Remove the group from the DOM
        $(`#groups .card[data-id="${this.id}"]`).parent().remove();

        // * Remove all users from the group 
        this.rbac.files.auth.data.users.forEach(user => {
            user.group_ids = user.group_ids.filter(group_id => group_id != this.id);
        })


    }

    /**
     * @description Get the group opened
     * @returns {Group}
     * TODO set data-group-id to null when a group is closed
     */
    static getOpened() {
        return rbac.groups.find(g => g.id == ($("#modal_rights_configuration").attr("data-group-id")));
    }


    /**
     * @description Open the rights configuration modal for this group
     */
    open_rights() {

        $("#modal_rights_configuration .modal-title").html(`<strong>${this.name}</strong> configuration`);
        $("#modal_rights_configuration").modal("show");
        $("#modal_rights_configuration").attr("data-group-id", this.id);

        // * Refresh areas, devices and entities
        $("#areas").empty();
        $("#entities_configuration").empty();

        // * Add a search bar to areas
        $("<li>")
            .addClass("list-group-item")
            .append(
                $(`<input type="text">`)
                    .addClass("form-control")
                    .attr("placeholder", "Search for a device")
                    .css("border", "none")
                    .css("padding", "0 0 0 0")
                    .on("input", function() {
                        let search = $(this).val().toLowerCase();

                        if (search == "") {
                            // * Fold all areas
                            $("#areas li ul").collapse("hide");
                        }

                        $("#areas li").each((index, li) => {

                            if (index == 0) return;

                            if($(li).text().toLowerCase().includes(search)) {
                                $(li).show();
                            } else {
                                $(li).hide();
                            }
                        })

                        if(search != "") {
                            // * Unfold all areas
                            $("#areas li ul").collapse("show");
                        }
                    
                    })
                ).appendTo("#areas");



        // * Add devices to the areas
        device_registry.data.devices.forEach(device_data => {
            //old_rbac.groups.areas.devices.add(device.area_id??null, device);
            
            let area_id = device_data.area_id??"unassigned";

            let area = rbac.areas.find(area => area.id == area_id);
            
            let device = rbac.devices.find(device => device.id == device_data.id);

            console.log(area_id);
            console.log(area);
            console.log(device);


            area.addDeviceToList(device);

        })

        // * Delete config devices from the list and add them to the config
        console.debug(this.policy);
        Object.keys(this.policy?.entities?.entity_ids??{}).forEach((entity_id, index) => {

                // * Add entity to the config panel

                const entity = rbac.entities.find(entity => entity.entity_id == entity_id);

                console.log(`Adding entity to config: ${entity_id}`);
                console.debug(entity);

                const device = rbac.devices.find(d => d.id == entity.device_id);

                // TODO maybe put those instructions in the entity class
                if (!device.isInCustomConfig()) {
                    device.moveToCustomConfig();
                }

                // TODO configure entity 
                let policy = this.policy.entities.entity_ids[entity_id];
                if (policy == true) policy = "write";
                else if (policy == false) policy = "deny";
                else if (policy?.read) policy = "read only";
                else throw new Error(`Policy not found: ${policy}`);
                entity.showPolicy(policy);
        
        });

        Object.keys(this.policy?.entities?.device_ids??{}).forEach((device_id, index) => {

            const device = rbac.devices.find(d => d.id == device_id); 
            let permission = this.policy.entities.device_ids[device_id];

            if (permission == true) permission = "write";
            else if (permission == false) permission = "deny";
            else if (permission?.read) permission = "read only";
            else throw new Error(`Permission not found: ${permission}`);
            // else permission = "not specified";
            console.warn(`Adding device to config: ${device_id} with permission ${permission}`);

            if (!device.isInCustomConfig()) {
                device.moveToCustomConfig();
            }

            // configure device
            device.showPolicy(permission);
        })


        Object.keys(this.policy?.entities?.area_ids??{}).forEach((area_id, index) => {

            const area = rbac.areas.find(a => a.id == area_id);
            let permission = this.policy.entities.area_ids[area_id];

            if (permission == true) permission = "write";
            else if (permission == false) permission = "deny";
            else if (permission?.read) permission = "read only";
            else throw new Error(`Permission not found: ${permission}`);

            console.warn(`Adding area to config: ${area_id} with permission ${permission}`);

            if (!area.isInCustomConfig()) {
                
            }

        });

    }

}

class User {

    /**
     * @description Initialize the users list in the DOM and in the RBAC object
     * @param {RBAC} rbac 
     */
    static init(rbac) {

        this.empty();

        $("<li>")
            .addClass("list-group-item")
            .addClass("list-group-item-primary")
            .text("Users")
            .appendTo("#users");

        rbac.files.auth.data.users.forEach(u => {
            if (u.system_generated) return;

            const user = new User(rbac, u);

            $("#users").append(user.toHTML());

            u.group_ids.forEach(group_id => {
                
                /* $("#groups .card[data-id=\""+group_id+"\"] .list-group").append(old_rbac.users.generate(u, true)); */

                let group = rbac.files.auth.data.groups.find(group => group.id == group_id);
                if(group) {
                    let group_card = $("#groups .card[data-id=\""+group_id+"\"]");
                    if(group_card.length) {
                        group_card.find(".list-group").append(user.toHTML(true));
                    }
                } 
            })

        })

    }

    static empty() {
        $("#users").empty();
    }

    /**
     * 
     * @param {RBAC} rbac 
     * @param {User_Data} user 
     */
    constructor(rbac, user) {
        this.rbac = rbac;

        this.id = user.id;
        this.group_ids = user.group_ids;
        this.is_active = user.is_active;
        this.is_owner = user.is_owner;
        this.local_only = user.local_only;
        this.name = user.name;
        this.system_generated = user.system_generated;
 

    }

    toHTML(for_group = false) {
        
        const user = this;

        /** @type {JQuery} */
        let user_li = $("<li>")
        .addClass("list-group-item")
        .text(user.name)
        .attr("data-bs-toggle", "tooltip")
        .attr("data-bs-placement", "top")
        .attr("data-bs-original-title", `${user.id}`)
        .attr("data-id", `${user.id}`)
        .tooltip()
        .on("click", function(){
            navigator.clipboard.writeText(user.id);
            $(this).attr("data-bs-original-title", "ID copied").tooltip("show");
            setTimeout(() => {
                $(this).attr("data-bs-original-title", `${user.id}`).tooltip("hide");
            }, 1000);
        });



        if(for_group) {
            if(user.is_owner) {
                user_li.addClass("list-group-item-dark");
            } else {
                $("<button>")
                    .addClass("btn-close float-end")
                    .attr("aria-label", "Close")
                    .on("click", function(){
                        let group_id = $(this).closest(".card").attr("data-id");
                        let user_id = user_li.attr("data-id");

                        // Remove the group from the user
                        let user = auth.data.users.find(u => u.id === user_id);
                        if (user) {
                            user.group_ids = user.group_ids.filter(id => id !== group_id);
                        }

                        user_li.tooltip("hide").remove();
                    })
                    .appendTo(user_li);
            }
        } else {
            if(user.is_owner || !user.is_active) {
                user_li.addClass("list-group-item-dark");
            } else {
                user_li.css("cursor", "move").draggable({revert: true, helper: "clone", zIndex: 1000});
            }
        }

        return user_li;
    }

}



let old_rbac = {

    devices: {
        /**
         * @param {String} id
         * @returns {Device_Data} 
         */
        get: (id) => {
            return device_registry.data.devices.find(device => device.id == id);
        }
    },

    groups: {

        current_opened_id: null,

        /**
         * @description Get a group by its id
         * @param {String} id 
         */
        get: (id) => {

            alert("Deprecated function");

            if(!id) return null;
            /** @type {Group_Data} */
            let group = auth.data.groups.find(group => group.id == id);

            return {
                id: group.id,
                name: group.name,
                policy: group.policy,

                /**
                 * @typedef {Entity_Data&{config: (auth_level: "not specified"|"deny"|"read only"|"write") => void}} EntityExtended
                 * @param {String} id 
                 * @returns {Device_Data&{entity: (id: String) => EntityExtended}}
                 */
                device: function(id) {
                    let device = old_rbac.devices.get(id);

                    /**
                     * 
                     * @param {String} id
                     * @returns {EntityExtended}
                     */
                    device.entity = function(id) {
                        let entity = entity_registry.data.entities.find(entity => entity.entity_id == id);

                        /**
                         * 
                         * @param {"not specified"|"deny"|"read only"|"write"} auth_level 
                         * @returns {void}
                         * @deprecated
                         */
                        entity.config = function(auth_level) {

                            console.warn("Deprecated function")

                            console.log(`Configuring entity : ${group.id}/${device.id}/${entity.entity_id} with ${auth_level}`);

                            console.log("Before");
                            console.log(group);

                            if(!group.policy) group.policy = {entities: {entity_ids: {}}}

                            switch(auth_level) {
                            
                                case "not specified":
                                    // * Remove the entity from the group policy 
                                    if(group.policy.entities.entity_ids[entity.entity_id]) {
                                        delete group.policy.entities.entity_ids[entity.entity_id];
                                    }  
                                    break;

                                case "deny":
                                    // * Add the entity to the group policy to false
                                    group.policy.entities.entity_ids[entity.entity_id] = false;
                                    break;
                                
                                case "read only":
                                    // * Add the entity to the group policy to {read: true}
                                    group.policy.entities.entity_ids[entity.entity_id] = {read: true};
                                    break;
                                
                                case "write":
                                    // * Add the entity to the group policy to true
                                    group.policy.entities.entity_ids[entity.entity_id] = true;
                                    break;
                            }

                            console.log("After");
                            console.log(group);

                        }

                        return entity;
                    }

                    return device;
                }
            }
        },

    },



};


function rbac_init() {

    rbac = new RBAC(auth, device_registry, entity_registry);

    $("#groups").on("click", ".card-footer>.btn-primary", function() {
        rbac.groups.find(group => group.id == $(this).closest(".card").attr("data-id")).open_rights();
    })

    $("#export_auth").on("click", function() {
        rbac.publish();
    }); 


    /**
     * ! Click on a device
     */
    $("#areas").on("click", "li[data-device-id]", function () {
        const device_id = $(this).attr("data-device-id");
        // addDeviceToConfig(old_rbac.devices.get(device_id));
        rbac.devices.find(d => d.id == device_id).moveToCustomConfig();
    })

    /**
     * ! Click on an area
     */
    $("#areas").on("click", "li[data-area-id]", function(e) {
        if($(e.target).is("li[data-area-id]")) $(this).find("ul").collapse("toggle");
    })


    


    /**
     * ! Rights configuration
     */
    $("#entities_configuration").on("click", `input[type=radio][data-type="entity"]`, function() {
        let group_id = $("#modal_rights_configuration").attr("data-group-id");
        let device_id = $(this).closest("li").attr("data-device-id");
        let entity_id = $(this).attr("name");

        let auth_level = null;

        switch($(this).attr("id").split("-")[1]) {
            case "0":
                console.log("Not specified");
                auth_level = "not specified";
                break;
            case "1":
                console.log("Deny");
                auth_level = "deny";
                break;
            case "2":
                console.log("Read only");
                auth_level = "read only";
                break;
            case "3":
                console.log("Read and write");
                auth_level = "write";
                break;
        }

        // old_rbac.groups.get(group_id).device(device_id).entity(entity_id).config(auth_level);
        
        const group = rbac.groups.find(group => group.id == group_id);
        

        rbac.entities.find(entity => entity.device_id == device_id && entity.entity_id == entity_id).config(group, auth_level);
        

    })




    // ! Devices configuration
    $("#entities_configuration").on("click", "input[type=radio][data-type=device]", function() {
        let device_id = $(this).closest("li").attr("data-device-id");

        /** @type {"edit"|"deny"|"read only"|"write"|"delete"} */
        let permission = $(this).attr("data-permission");

        switch (permission) {

            case "delete":
                rbac.devices.find(d => d.id == device_id).deleteFromCustomConfig();
                break;
            case "deny":
            case "read only":
            case "write":
                rbac.devices.find(d => d.id == device_id).entities.forEach(entity => {
                    entity.config(Group.getOpened(), permission);
                    entity.showPolicy(permission);
                });
                // Fold entities 
                console.log($(this))
                $(this).parent().parent().parent().children().filter(".entity-element").animate({height: "hide"}, 200).promise().done((elem) => elem.removeClass("d-flex"))
                break;
            case "edit":
                // Unfold entities
                $(this).parent().parent().parent().children().filter(".entity-element").addClass("d-flex").animate({height: "show"}, 200)
                break;

        }
        

    })

    // ! Listen to the click on the dropdown buttons to change the icon and the color
    $("#entities_configuration").on("click", ".list-group-item button", function() {
        const perm = $(this).attr("data-permission");

        if (perm == "delete") {
            return;
        }

        if(perm) {
            // * Change button icon 
            $(this).parent().parent().children().filter("button").children().first().attr("class", `bi ${getEmoji(perm)}`);

            // * Change button color
            $(this).parent().parent().children().filter("button").removeClass("btn-success btn-warning btn-danger btn-secondary").addClass(buttonClass(perm));
        }

        

    })
}