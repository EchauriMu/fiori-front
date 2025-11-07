sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
],
    function (JSONModel, Device) {
        "use strict";

        return {
            /**
             * Provides runtime information for the device the UI5 app is running on as a JSONModel.
             * @returns {sap.ui.model.json.JSONModel} The device model.
             */
            createDeviceModel: function () {
                var oModel = new JSONModel(Device);
                oModel.setDefaultBindingMode("OneWay");
                return oModel;
            },

            createRolesModel: function () {
                return new JSONModel({ value: [] }); // Para la lista de roles
            },

            createSelectedRoleModel: function () {
                return new JSONModel({}); // Para el rol seleccionado
            },

            createNewRoleModel: function () {
                return new JSONModel({
                    ROLEID: "",
                    ROLENAME: "",
                    DESCRIPTION: "",
                    NEW_PROCESSID: "",
                    NEW_PRIVILEGES: [],
                    PRIVILEGES: []
                });
            }
        };

    });