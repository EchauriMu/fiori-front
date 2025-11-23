sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.Config", {

        onInit: function () {
            const oViewModel = new JSONModel({
                selectedDb: "mongo" // Valor por defecto
            });
            this.getView().setModel(oViewModel, "configView");

            // Leer el valor guardado y establecerlo en el modelo
            const sDbServer = sessionStorage.getItem("DBServer");
            if (sDbServer === "CosmosDB") {
                oViewModel.setProperty("/selectedDb", "cosmo");
            } else {
                oViewModel.setProperty("/selectedDb", "mongo");
            }
        },

        onDbServerChange: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const oRadioButtonGroup = oEvent.getSource();
            const sSelectedKey = oSelectedItem.getKey();
            const sCurrentDbValue = sessionStorage.getItem("DBServer") || "MongoDB";
            let sNewDb, sNewDbName;

            if (sSelectedKey === "cosmo") {
                sNewDb = "CosmosDB";
                sNewDbName = "Cosmos DB";
            } else {
                sNewDb = "MongoDB";
                sNewDbName = "Mongo DB";
            }

            // No hacer nada si el valor no ha cambiado
            if (sNewDb === sCurrentDbValue) {
                return;
            }

            MessageBox.confirm(`Se cambiará el servidor a ${sNewDbName}. La aplicación se reiniciará para aplicar los cambios. ¿Desea continuar?`, {
                title: "Confirmar Cambio de Servidor",
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        sessionStorage.setItem("DBServer", sNewDb);
                        location.reload();
                    } else {
                        // Si el usuario cancela, revertimos la selección en la UI
                        const iSelectedIndex = sCurrentDbValue === "CosmosDB" ? 1 : 0;
                        oRadioButtonGroup.setSelectedIndex(iSelectedIndex);
                    }
                }
            });
        }
    });
});