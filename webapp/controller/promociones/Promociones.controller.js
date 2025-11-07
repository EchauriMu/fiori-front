sap.ui.define([
    "com/invertions/sapfiorimodinv/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageToast) {
    "use strict";

    return BaseController.extend("com.invertions.sapfiorimodinv.controller.promociones.Promociones", {
        onInit: function () {
            // Initialize models or load data here if needed
            // Example:
            // this.getView().setModel(new JSONModel({
            //     promotions: []
            // }), "promotionsModel");
        },

        // Example of a custom function
        onAddPromotion: function () {
            MessageToast.show("Add Promotion button pressed!");
            // Implement logic to add a new promotion
        }
    });
});