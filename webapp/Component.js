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
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // Modelo global para sesión y usuario
            const oAppModel = new JSONModel({
                isLoggedIn: false,
                currentUser: {}
            });
            this.setModel(oAppModel, "appView");

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
        }
    });
});