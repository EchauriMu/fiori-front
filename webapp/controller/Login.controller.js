sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
// @ts-ignore
], function (Controller, JSONModel, MessageToast) {
  "use strict";

  return Controller.extend("com.invertions.sapfiorimodinv.controller.Login", {
    onInit: function () {
      this.getView().setModel(new JSONModel({
        email: "",
        password: ""
      }), "loginModel");
    },

    onLoginPress: function () {
      const oLoginModel = this.getView().getModel("loginModel");
      const sUsername = oLoginModel.getProperty("/email");

      if (!sUsername) {
        MessageToast.show("Por favor, introduce un nombre de usuario.");
        return;
      }

      // Guarda el nombre de usuario en sessionStorage
      sessionStorage.setItem("LoggedUser", sUsername);
      localStorage.setItem("currentUser", JSON.stringify({ USERNAME: sUsername, EMAIL: sUsername }));

      // Crea un objeto de usuario simulado
      const oUser = {
        USERNAME: sUsername,
        EMAIL: sUsername
      };
      
      // Actualiza el modelo de la aplicación para reflejar el inicio de sesión
      const oAppModel = this.getOwnerComponent().getModel("appView");
      oAppModel.setProperty("/isLoggedIn", true);
      oAppModel.setProperty("/currentUser", oUser);

      MessageToast.show(`Bienvenido, ${sUsername}`);

      // Navega a la vista principal
      this.getOwnerComponent().getRouter().navTo("RouteMain");
    },    //Funcion para el ojito
    onVerContraseña: function () {
      const oInput = this.byId("passwordInput");
      const bCurrentType = oInput.getType() === "Text";
      oInput.setType(bCurrentType ? "Password" : "Text");
      this.byId("showPasswordButton").setIcon(bCurrentType ? "sap-icon://show" : "sap-icon://hide");
    }
  });
});