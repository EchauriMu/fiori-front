sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("com.invertions.sapfiorimodinv.controller.Main", {

    onInit: function () {
      const oUser = this.getOwnerComponent().getModel("appView").getProperty("/currentUser");
      console.log("Usuario recibido en Main:", oUser);
    },

    onGoToInvertions: function () {
      this.getOwnerComponent().getRouter().navTo("RouteInvestments");
    },

    onGoToRoles: function () {
      this.getOwnerComponent().getRouter().navTo("RouteRoles");
    },

    onGoToUsers: function () {
      this.getOwnerComponent().getRouter().navTo("RouteUsersList");
    },
    
    onGoToCatalogs: function(){
      this.getOwnerComponent().getRouter().navTo("RouteCatalogs");
    },

  });
});
