sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, History, MessageBox, MessageToast) {
    "use strict";

    const BASE_URL = "http://localhost:3033/api";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.presentaciones.SelectPresentationtoEditPage", {

        onInit: function () {
            this.getOwnerComponent().getRouter().getRoute("RouteSelectPresentationToEdit").attachPatternMatched(this._onRouteMatched, this);

            const oSelectModel = new JSONModel({
                skuid: null,
                presentations: [],
                loading: true,
                error: "",
                multiMode: false,
                selectedIds: []
            });
            this.getView().setModel(oSelectModel, "selectModel");
        },

        _onRouteMatched: async function (oEvent) {
            const sSKU = oEvent.getParameter("arguments").skuid;
            const oModel = this.getView().getModel("selectModel");

            oModel.setProperty("/skuid", sSKU);
            oModel.setProperty("/loading", true);
            oModel.setProperty("/error", "");
            oModel.setProperty("/presentations", []);
            oModel.setProperty("/selectedIds", []);
            oModel.setProperty("/multiMode", false);

            try {
                const aPresentations = await this._callApi(
                    '/ztproducts-presentaciones/productsPresentacionesCRUD',
                    'POST', {}, { // <-- Payload is empty
                        ProcessType: 'GetBySKUID',
                        skuid: sSKU
                    }
                );

                if (Array.isArray(aPresentations)) {
                    // Añadir la propiedad 'selected' para el binding del CheckBox
                    const aPresentationsWithSelection = aPresentations.map(p => ({ ...p, selected: false }));
                    oModel.setProperty("/presentations", aPresentationsWithSelection);
                } else {
                    throw new Error("La respuesta de la API no es un array.");
                }

            } catch (error) {
                oModel.setProperty("/error", error.message || "Error al cargar las presentaciones.");
            } finally {
                oModel.setProperty("/loading", false);
            }
        },

        onCardPress: function (oEvent) {
            const oBindingContext = oEvent.getSource().getBindingContext("selectModel");
            const sPresentationId = oBindingContext.getProperty("IdPresentaOK");
            const sSKU = this.getView().getModel("selectModel").getProperty("/skuid");

            this.getOwnerComponent().getRouter().navTo("RouteEditPresentation", {
                skuid: sSKU,
                presentationId: sPresentationId
            });
        },

        onEditPress: function (oEvent) {
            // Detener la propagación para que no se active onCardPress
            oEvent.stopPropagation();
            this.onCardPress(oEvent); // Reutilizar la misma lógica
        },

        onMultiModeChange: function (oEvent) {
            const bState = oEvent.getParameter("state");
            if (!bState) {
                // Si se desactiva el modo múltiple, deseleccionar todo
                const oModel = this.getView().getModel("selectModel");
                const aPresentations = oModel.getProperty("/presentations");
                aPresentations.forEach(p => p.selected = false);
                oModel.setProperty("/presentations", aPresentations);
                oModel.setProperty("/selectedIds", []);
            }
        },

        onToggleOne: function (oEvent) {
            oEvent.stopPropagation(); // Evitar que se dispare el press de la tarjeta
            const oCheckBox = oEvent.getSource();
            const oContext = oCheckBox.getBindingContext("selectModel");
            const sId = oContext.getProperty("IdPresentaOK");
            const bSelected = oEvent.getParameter("selected");

            const oModel = this.getView().getModel("selectModel");
            oModel.setProperty(oContext.getPath() + "/selected", bSelected);

            let aSelectedIds = oModel.getProperty("/selectedIds");
            if (bSelected) {
                aSelectedIds.push(sId);
            } else {
                aSelectedIds = aSelectedIds.filter(id => id !== sId);
            }
            oModel.setProperty("/selectedIds", aSelectedIds);
        },

        onSelectAll: function (oEvent) {
            const bSelected = oEvent.getParameter("selected");
            const oModel = this.getView().getModel("selectModel");
            const aPresentations = oModel.getProperty("/presentations");

            let aSelectedIds = [];
            aPresentations.forEach(p => {
                p.selected = bSelected;
                if (bSelected) {
                    aSelectedIds.push(p.IdPresentaOK);
                }
            });

            oModel.setProperty("/presentations", aPresentations);
            oModel.setProperty("/selectedIds", aSelectedIds);
        },

        onOpenSingleDelete: function (oEvent) {
            oEvent.stopPropagation();
            const oContext = oEvent.getSource().getBindingContext("selectModel");
            const oPresentation = oContext.getObject();

            MessageBox.confirm(`¿Seguro que deseas eliminar la presentación "${oPresentation.NOMBREPRESENTACION || oPresentation.IdPresentaOK}"?`, {
                title: "Confirmar Eliminación",
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        this._deletePresentations([oPresentation.IdPresentaOK]);
                    }
                }
            });
        },

        onOpenBulkDelete: function () {
            const aSelectedIds = this.getView().getModel("selectModel").getProperty("/selectedIds");
            MessageBox.confirm(`¿Seguro que deseas eliminar ${aSelectedIds.length} presentaciones seleccionadas?`, {
                title: "Confirmar Eliminación Múltiple",
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        this._deletePresentations(aSelectedIds);
                    }
                }
            });
        },

        _deletePresentations: async function (aIdsToDelete) {
            const oModel = this.getView().getModel("selectModel");
            oModel.setProperty("/loading", true);

            try {
                // Replicating React's bulk delete logic: iterate and call delete for each ID.
                const deletePromises = aIdsToDelete.map(id => {
                    return this._callApi('/ztproducts-presentaciones/productsPresentacionesCRUD', 'POST', {}, {
                        ProcessType: 'DeleteHard', // Matching React service's default
                        idpresentaok: id
                });

                await Promise.all(deletePromises);

                MessageToast.show(`${aIdsToDelete.length} presentación(es) eliminada(s) correctamente.`);
                this._onRouteMatched({ getParameter: () => ({ arguments: { skuid: oModel.getProperty("/skuid") } }) }); // Recargar

            } catch (error) {
                MessageBox.error("Error al eliminar las presentaciones: " + error.message);
                oModel.setProperty("/loading", false);
            }
        },

        onNavBack: function () {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteMain", {}, true);
            }
        },

       _callApi: async function (sRelativeUrl, sMethod, oData = null, oParams = {}) {
            // 1. Añadir parámetros globales (DBServer, LoggedUser)
            const dbServer = sessionStorage.getItem('DBServer');
            if (dbServer === 'CosmosDB') {
                oParams.DBServer = 'CosmosDB';
            }

            const oAppViewModel = this.getOwnerComponent().getModel("appView");
            const loggedUser = oAppViewModel.getProperty("/currentUser/USERNAME") || sessionStorage.getItem('LoggedUser');
            
            if (loggedUser && !oParams.LoggedUser) {
                oParams.LoggedUser = loggedUser;
            }

            // 2. Construir URL con query parameters
            const sQueryString = new URLSearchParams(oParams).toString();
            const sFullUrl = `${BASE_URL}${sRelativeUrl}?${sQueryString}`;
            
            try {
                const oResponse = await fetch(sFullUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(oData || {})
                });

                if (!oResponse.ok) {
                    const oErrorJson = await oResponse.json();
                    const sErrorMessage = oErrorJson.message || `Error ${oResponse.status}`;
                    throw new Error(sErrorMessage);
                }

                const oJson = await oResponse.json();
                
                // Lógica para desenvolver la respuesta anidada de la API
                if (oJson && oJson.value && Array.isArray(oJson.value) && oJson.value.length > 0) {
                    const mainResponse = oJson.value[0];
                    if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                        const dataResponse = mainResponse.data[0];
                        if (dataResponse.dataRes) { // No necesita ser siempre un array
                            return dataResponse.dataRes;
                        }
                    }
                }
                // Estructura alternativa vista en otros controladores
                if (oJson && oJson.data && Array.isArray(oJson.data) && oJson.data.length > 0 && oJson.data[0].dataRes) {
                    return oJson.data[0].dataRes;
                }
                
                // Devolver el JSON si no tiene la estructura anidada (para otras llamadas)
                return oJson; 
                
            } catch (error) {
                console.error(`Error en la llamada ${sRelativeUrl}:`, error);
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        }
    });
});