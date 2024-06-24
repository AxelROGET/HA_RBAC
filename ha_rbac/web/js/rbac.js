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
        $("#entities_configuration").on("click", ".btn-close", function() {

        })
        

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
     */
    addDevice(device) {

        // * Check if area exists
        if (!$(`#areas>li[data-area-id="${this.id}"]`).length) {

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
                    $(`#areas>li[data-area-id="unassigned"]`).before(li);
                }
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

}

class Device {

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
     * @description Move the device from the list (left) to the config panel (right) in the DOM and add all entities to the config panel
     */
    moveToCustomConfig() {

        console.log("Adding device to config: " + this.id);

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

        // * Delete device from the config panel
        $(`#entities_configuration li[data-device-id="${this.id}"]`).remove();

        // * Add device to list
        this.area.addDevice(this);

        // * Remove all entities from the group policy 
        this.entities.forEach(entity => {

            delete Group.getOpened().policy.entities.entity_ids[entity.entity_id]

        });



    }


    /**
     * @description Check if the device is in the custom config panel (right) in the DOM
     * @returns {Boolean}
     */
    isInCustomConfig() {

        let r=false;

        $("#entities_configuration").children().each((index, d) => {
            if($(d).data('deviceId') == this.id) {
                r = true;
            }
        })
    
        return r?true:false

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

        console.log(`Configuring entity : ${group.id}/${this.device_id}/${this.entity_id} with ${auth_level}`);

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
        
        switch (policy) {

            case "not specified":
                $(`input[name="${this.entity_id}"]`)[0].checked = true
                break;
            case "write":
                $(`input[name="${this.entity_id}"]`)[3].checked = true
                break;
            case "read only":
                $(`input[name="${this.entity_id}"]`)[2].checked = true
                break;
            case "deny":
                $(`input[name="${this.entity_id}"]`)[1].checked = true
                break;
            default:
                throw new Error("Policy not found")

        }

    }


    /**
     * @description Add entity to a device in the config panel (at the right) in the DOM
     */
    addToCustomConfig() {

        // * Add entity to the config panel

        $(`#entities_configuration>li[data-device-id="${this.device_id}"]`).append(`

            <div class="mb-1 d-flex entity-element" style="justify-content: space-between; align-items: center;">

                ${this.original_name??this.entity_id}
                <div class="btn-group" style="margin-left: auto;" data-type=entity>

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




        device_registry.data.devices.forEach(device_data => {
            //old_rbac.groups.areas.devices.add(device.area_id??null, device);
            
            let area_id = device_data.area_id??"unassigned";

            let area = rbac.areas.find(area => area.id == area_id);
            
            let device = rbac.devices.find(device => device.id == device_data.id);

            console.log(area_id);
            console.log(area);
            console.log(device);


            area.addDevice(device);

        })

        // * Delete config devices from the list and add them to the config
        console.debug(this.policy);
        Object.keys(this.policy?.entities?.entity_ids).forEach((entity_id, index) => {

                // * Add entity to the config panel

                const entity = rbac.entities.find(entity => entity.entity_id == entity_id);

                console.log(`Adding entity to config: ${entity_id}`);
                console.debug(entity);

                const device = rbac.devices.find(d => d.id == entity.device_id);

                if (!device.isInCustomConfig()) {
                    device.moveToCustomConfig();
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
    $("#entities_configuration").on("click", "input[type=radio][data-type=entity]", function() {
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
}