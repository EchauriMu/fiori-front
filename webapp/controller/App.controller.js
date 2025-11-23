sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.App", {

        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            const oAppModel = this.getOwnerComponent().getModel("appView");
            const sLoggedUser = sessionStorage.getItem("LoggedUser");

            if (sLoggedUser) {
                // Si el usuario ya está logueado en la sesión, restauramos su estado
                const oUser = {
                    USERNAME: sLoggedUser,
                    EMAIL: sLoggedUser
               
                };
                oAppModel.setProperty("/isLoggedIn", true);
                oAppModel.setProperty("/currentUser", oUser);
                // No navegamos aquí para permitir que el enrutador maneje la URL actual.
                // Si la URL está vacía, el router por defecto irá al login, pero el onInit del login lo redirigirá.
            } else {
                // Si no hay sesión, nos aseguramos de que el estado sea "no logueado" y vamos al login
                oAppModel.setProperty("/isLoggedIn", false);
                oRouter.navTo("Login", {}, true);
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

            const isLoggedIn = this.getOwnerComponent().getModel("appView").getProperty("/isLoggedIn");

            if (!isLoggedIn) {
                MessageToast.show("Debe iniciar sesión para acceder");
                return;
            }

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
                case "config":
                    oRouter.navTo("RouteConfig");
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
                        that.getOwnerComponent().getRouter().navTo("Login", {}, true);
                    }
                }
            });
        }

    });
});
