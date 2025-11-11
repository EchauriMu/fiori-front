sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast"
], function (Controller, MessageToast) {
    "use strict";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.App", {

        onInit: function () {
            // Intenta restaurar la sesión desde localStorage
            const sUser = localStorage.getItem("currentUser");
            const oRouter = this.getOwnerComponent().getRouter();
            const oAppModel = this.getOwnerComponent().getModel("appView");

            if (sUser) {
                const oUser = JSON.parse(sUser);
                oAppModel.setProperty("/isLoggedIn", true);
                oAppModel.setProperty("/currentUser", oUser);
                // Si hay sesión, no es necesario ir al login, podrías ir a la ruta principal directamente
                // o dejar que el router maneje la ruta inicial.
            } else {
                oRouter.navTo("Login");
            }
        },


        onToggleSideNav: function () {
            const oToolPage = this.byId("mainToolPage");
            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        onItemSelect: function (oEvent) {
            const sKey = oEvent.getParameter("item").getKey();
            const oRouter = this.getOwnerComponent().getRouter();
            const isLoggedIn = this.getOwnerComponent().getModel("appView").getProperty("/isLoggedIn");

            if (!isLoggedIn) {
                MessageToast.show("Debe iniciar sesión para acceder");
                return;
            }

            switch (sKey) {
                case "roles":
                    oRouter.navTo("RouteRoles");
                    break;
                case "users":
                    oRouter.navTo("RouteUsersList");
                    break;
                case "catalogs":
                    oRouter.navTo("RouteCatalogs");
                    break;
                case "investments":
                    oRouter.navTo("RouteInvestments");
                    break;
                case "listasprecios":
                    oRouter.navTo("RouteListasPrecios");
                    break;
                case "promociones":
                    oRouter.navTo("RoutePromociones");
                    break;
                case "categorias":
                    oRouter.navTo("RouteCategorias");
                    break;
                default:
                    oRouter.navTo("RouteMain");
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
            sap.m.MessageBox.confirm("¿Deseas cerrar sesión?", {
                title: "Cerrar sesión",
                icon: sap.m.MessageBox.Icon.WARNING,
                actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                onClose: function (oAction) {
                    if (oAction === sap.m.MessageBox.Action.YES) {
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
