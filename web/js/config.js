$(async () => {

    auth = await $.ajax({
        url: "api/auth",
        type: "GET",
        dataType: "json",
    });

    device_registry = await $.ajax({
        url: "api/device_registry",
        type: "GET",
        dataType: "json",
    });

    entity_registry = await $.ajax({
        url: "api/entity_registry",
        type: "GET",
        dataType: "json",
    });

    if (auth && device_registry && entity_registry) {

        console.log("RBAC initialized");
        rbac_init();
        
    } else {
        console.log("RBAC not initialized");
    }


})