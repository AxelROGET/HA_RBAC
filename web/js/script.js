

/** @type {Auth_data} */
var auth;



$("#modal_create_group .btn-primary").on("click", function() {
    console.log("Creating group");
    let group_id = $("#modal_create_group [name='group-id']").val();
    let group_name = $("#modal_create_group [name='group-name']").val();

    //old_rbac.groups.create(group_id, group_name);
    const group = new Group(rbac, {id: group_id, name: group_name});

    group.appendToAuth();
    
    $(group.toHTML()).insertBefore($("#groups").children().last())

    $("#modal_create_group").modal("hide");

    Group.droppable();
})

// If enter is pressed
$("#modal_create_group [name='group-name']").on("keypress", function(e) {
    if (e.key === "Enter") {
        $("#modal_create_group .btn-primary").trigger("click");
    }
})