sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
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
            const oItem = oEvent.getParameter("item");
            const sKey = oItem.getKey();
            const oRouter = this.getOwnerComponent().getRouter();

            switch (sKey) {
                case "main":
                    oRouter.navTo("RouteMain");
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
                    // Opcional: Navegar a una vista de "no encontrado" o mostrar un mensaje
                    MessageToast.show("Ruta no implementada: " + sKey);
                    break;
            }
        },

        logout: function () {
            const that = this;
            MessageBox.confirm("¿Deseas cerrar sesión?", {
                title: "Cerrar sesión",
                icon: MessageBox.Icon.WARNING,
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.NO,
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.YES) {
                        // Limpia sessionStorage y localStorage
                        sessionStorage.clear();
                        localStorage.clear();

                        // Limpia el modelo de la app
                        const oAppModel = that.getOwnerComponent().getModel("appView");
                        oAppModel.setProperty("/isLoggedIn", false);
                        oAppModel.setProperty("/currentUser", null);

                        // Redirige al login
                        that.getOwnerComponent().getRouter().navTo("Login");
                    }
                }
            });
        }

    });
});
