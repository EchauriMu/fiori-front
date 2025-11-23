sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/invertions/sapfiorimodinv/model/models",
    "sap/ui/model/json/JSONModel"
], (UIComponent, models, JSONModel) => {
    "use strict";

    return UIComponent.extend("com.invertions.sapfiorimodinv.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            const oAppModel = new JSONModel({
                isLoggedIn: false,
                currentUser: {}
            });
            this.setModel(oAppModel, "appView");

            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        }
    });
});