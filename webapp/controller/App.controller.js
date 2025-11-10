sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.App", {

        onInit: function () {
            // Redirige automáticamente a la vista principal al iniciar
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("Login");
        },


        onToggleSideNav: function () {
            const oToolPage = this.byId("mainToolPage");
            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        onItemSelect: function (oEvent) {
      // Implementa la navegación basada en la selección del elemento del menú
      var sKey = oEvent.getParameter("item").getKey();
      
      switch (sKey) {
        case "categories":
          this.getOwnerComponent().getRouter().navTo("RouteCategorias");
          break;
        case "priceLists":
          this.getOwnerComponent().getRouter().navTo("RouteListasPrecios");
          break;
        case "promociones":
          this.getOwnerComponent().getRouter().navTo("RoutePromociones");
          break;
        default:
          console.log("No se encontró ruta para:", sKey);
      }
    },

        logout: function () {
            // Limpia sessionStorage
            sessionStorage.clear();

            // Actualiza el modelo de la app
            var oAppModel = this.getOwnerComponent().getModel("appView");
            oAppModel.setProperty("/isLoggedIn", false);
            oAppModel.setProperty("/currentUser", null);

            // Redirige al login
            this.getOwnerComponent().getRouter().navTo("Login");
        },

        onLogoutPress: function () {
            var that = this;
            MessageBox.confirm("¿Deseas cerrar sesión?", {
                title: "Cerrar sesión",
                icon: MessageBox.Icon.WARNING,
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.YES) {
                        // Limpia sessionStorage y localStorage
                        sessionStorage.clear();
                        localStorage.clear();

                        // Limpia el modelo de la app
                        var oAppModel = that.getOwnerComponent().getModel("appView");
                        oAppModel.setProperty("/isLoggedIn", false);
                        oAppModel.setProperty("/currentUser", null);

                        // Redirige al login
                        that.getOwnerComponent().getRouter().navTo("Login");
                    }
                }
            });
        },

    });
});
