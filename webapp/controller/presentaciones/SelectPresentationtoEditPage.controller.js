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
            this.getOwnerComponent()
                .getRouter()
                .getRoute("RouteSelectPresentationToEdit")
                .attachPatternMatched(this._onRouteMatched, this);

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

        // ================= CARGA INICIAL =================
        _onRouteMatched: function (oEvent) {
            const sSKU = oEvent.getParameter("arguments").skuid;
            const oModel = this.getView().getModel("selectModel");
            oModel.setProperty("/skuid", sSKU);

            this._loadPresentations(sSKU);
        },

        _loadPresentations: async function (sSKU) {
            const oModel = this.getView().getModel("selectModel");

            oModel.setProperty("/loading", true);
            oModel.setProperty("/error", "");
            oModel.setProperty("/presentations", []);
            oModel.setProperty("/selectedIds", []);
            oModel.setProperty("/multiMode", false);

            try {
                const aPresentations = await this._callApi(
                    "/ztproducts-presentaciones/productsPresentacionesCRUD",
                    "POST",
                    {},
                    {
                        ProcessType: "GetBySKUID",
                        skuid: sSKU
                    }
                );

                if (Array.isArray(aPresentations)) {
                    const aWithSelection = aPresentations.map(function (p) {
                        return Object.assign({}, p, { selected: false });
                    });
                    oModel.setProperty("/presentations", aWithSelection);
                } else {
                    throw new Error("La respuesta de la API no es un array.");
                }
            } catch (err) {
                console.error(err);
                oModel.setProperty(
                    "/error",
                    err.message || "Error al cargar las presentaciones."
                );
            } finally {
                oModel.setProperty("/loading", false);
            }
        },

        // ================= NAVEGAR A EDITAR =================

        // Click en la tarjeta (solo en modo simple)
        onCardPress: function (oSrcControl, oEvent) {
            // Si el control que origina el evento es un botón, no hacemos nada.
            // Esto permite que los eventos 'press' de los botones (onEditPress, onOpenSingleDelete) se ejecuten.
            // También ignoramos los clics en el CheckBox.
            const sControlType = oSrcControl.getMetadata().getName();
            if (sControlType === "sap.m.Button" || sControlType === "sap.m.CheckBox") {
                return;
            }

            const oModel = this.getView().getModel("selectModel");
            if (oModel.getProperty("/multiMode")) {
                // En modo múltiple no navegamos al hacer click en la tarjeta
                return;
            }

            // El control que origina el evento es la tarjeta (f:Card), que tiene el contexto.
            const oCtx = oSrcControl.getBindingContext("selectModel");
            const sId = oCtx.getProperty("IdPresentaOK");
            const sSKU = oModel.getProperty("/skuid");

            this.getOwnerComponent().getRouter().navTo("RouteEditPresentation", {
                skuid: sSKU,
                presentationId: sId
            });
        },

        // Click en el ícono de editar
        onEditPress: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("selectModel");
            if (!oCtx) {
                console.error("onEditPress: sin bindingContext");
                return;
            }

            const sId = oCtx.getProperty("IdPresentaOK");
            const sSKU = this.getView().getModel("selectModel").getProperty("/skuid");

            this.getOwnerComponent().getRouter().navTo("RouteEditPresentation", {
                skuid: sSKU,
                presentationId: sId
            });
        },

        // ================= MODO MÚLTIPLE / CHECKBOXES =================

        onMultiModeChange: function (oEvent) {
            const bState = oEvent.getParameter("state");
            const oModel = this.getView().getModel("selectModel");

            oModel.setProperty("/multiMode", bState);

            if (!bState) {
                // Se desactiva modo múltiple → limpiar selecciones
                const aPres = oModel.getProperty("/presentations") || [];
                aPres.forEach(function (p) { p.selected = false; });
                oModel.setProperty("/presentations", aPres);
                oModel.setProperty("/selectedIds", []);
            }
        },

        onToggleOne: function (oEvent) {
            oEvent.stopPropagation(); // que no dispare el press de la tarjeta

            const oCheckBox = oEvent.getSource();
            const oCtx = oCheckBox.getBindingContext("selectModel");
            const sId = oCtx.getProperty("IdPresentaOK");
            const bSelected = oEvent.getParameter("selected");

            const oModel = this.getView().getModel("selectModel");
            oModel.setProperty(oCtx.getPath() + "/selected", bSelected);

            let aSelectedIds = oModel.getProperty("/selectedIds") || [];
            if (bSelected) {
                if (!aSelectedIds.includes(sId)) {
                    aSelectedIds.push(sId);
                }
            } else {
                aSelectedIds = aSelectedIds.filter(function (x) { return x !== sId; });
            }
            oModel.setProperty("/selectedIds", aSelectedIds);
        },

        onSelectAll: function (oEvent) {
            const bSelected = oEvent.getParameter("selected");
            const oModel = this.getView().getModel("selectModel");
            const aPres = oModel.getProperty("/presentations") || [];

            const aSelectedIds = [];

            aPres.forEach(function (p) {
                p.selected = bSelected;
                if (bSelected) {
                    aSelectedIds.push(p.IdPresentaOK);
                }
            });

            oModel.setProperty("/presentations", aPres);
            oModel.setProperty("/selectedIds", aSelectedIds);
        },

        // ================= ELIMINAR =================

        onOpenSingleDelete: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("selectModel");
            if (!oCtx) {
                console.error("onOpenSingleDelete: sin bindingContext");
                return;
            }

            const oPres = oCtx.getObject();

            MessageBox.confirm(
                `¿Seguro que deseas eliminar la presentación "${oPres.NOMBREPRESENTACION || oPres.IdPresentaOK}"?`,
                {
                    title: "Confirmar eliminación",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._deletePresentations([oPres.IdPresentaOK]);
                        }
                    }
                }
            );
        },

        onOpenBulkDelete: function () {
            const aIds = this.getView().getModel("selectModel").getProperty("/selectedIds") || [];
            if (!aIds.length) {
                return;
            }

            MessageBox.confirm(
                `¿Seguro que deseas eliminar ${aIds.length} presentación(es) seleccionada(s)?`,
                {
                    title: "Confirmar eliminación múltiple",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._deletePresentations(aIds);
                        }
                    }
                }
            );
        },

        _deletePresentations: async function (aIds) {
            if (!aIds || !aIds.length) {
                return;
            }

            const oModel = this.getView().getModel("selectModel");
            oModel.setProperty("/loading", true);

            const oAppViewModel = this.getOwnerComponent().getModel("appView");
            const sUser = oAppViewModel.getProperty("/currentUser/USERNAME") || "SYSTEM";

            // Creamos un array de promesas, una por cada llamada a la API
            const aDeletePromises = aIds.map(sId => {
                return this._callApi(
                    "/ztproducts-presentaciones/productsPresentacionesCRUD",
                    "POST",
                    null,
                    {
                        ProcessType: "DeleteHard",
                        MODUSER: sUser,
                        idpresentaok: sId // Enviamos un solo ID por llamada
                    }
                );
            });

            try {
                // Esperamos a que todas las promesas de borrado se completen
                await Promise.all(aDeletePromises);

                MessageToast.show(`${aIds.length} presentación(es) eliminada(s) correctamente.`);

                // Recargar lista con el mismo SKU
                const sSKU = oModel.getProperty("/skuid");
                await this._loadPresentations(sSKU);

            } catch (err) {
                console.error(err);
                MessageBox.error("Error al eliminar las presentaciones: " + (err.message || err));
                oModel.setProperty("/loading", false);
            }
        },

        // ================= NAVEGAR ATRÁS =================

        onNavBack: function () {
            const oHistory = History.getInstance();
            const sPrev = oHistory.getPreviousHash();

            if (sPrev !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteMain", {}, true);
            }
        },

        // ================= HELPER API =================

        _callApi: async function (sRelativeUrl, sMethod, oData = null, oParams = {}) {

            // DBServer si aplica
            const dbServer = sessionStorage.getItem("DBServer");
            if (dbServer === "CosmosDB") {
                oParams.DBServer = "CosmosDB";
            }

            const oAppViewModel = this.getOwnerComponent().getModel("appView");
            const loggedUser =
                oAppViewModel.getProperty("/currentUser/USERNAME") ||
                sessionStorage.getItem("LoggedUser");

            if (loggedUser && !oParams.LoggedUser) {
                oParams.LoggedUser = loggedUser;
            }

            const sQueryString = new URLSearchParams(oParams).toString();
            const sFullUrl = `${BASE_URL}${sRelativeUrl}?${sQueryString}`;

            const oFetchOptions = {
                method: sMethod || "POST",
                headers: { "Content-Type": "application/json" }
            };

            // Solo añadir el body si oData tiene contenido
            if (oData && Object.keys(oData).length > 0) {
                oFetchOptions.body = JSON.stringify(oData);
            }

            try {
                const oResponse = await fetch(sFullUrl, oFetchOptions);

                if (!oResponse.ok) {
                    let sErrorMessage = `Error ${oResponse.status}`;
                    try {
                        const oErrJson = await oResponse.json();
                        sErrorMessage = oErrJson.message || sErrorMessage;
                    } catch (ignore) { /* nada */ }
                    throw new Error(sErrorMessage);
                }

                const oJson = await oResponse.json();

                // Desenredar estructura anidada
                if (oJson && oJson.value && Array.isArray(oJson.value) && oJson.value.length > 0) {
                    const mainResponse = oJson.value[0];
                    if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                        const dataResponse = mainResponse.data[0];
                        if (dataResponse.dataRes !== undefined) {
                            return dataResponse.dataRes;
                        }
                    }
                }

                if (oJson && oJson.data && Array.isArray(oJson.data) && oJson.data.length > 0 && oJson.data[0].dataRes !== undefined) {
                    return oJson.data[0].dataRes;
                }

                return oJson;

            } catch (err) {
                console.error(`Error en la llamada ${sRelativeUrl}:`, err);
                throw new Error(`Error al procesar la solicitud: ${err.message || err}`);
            }
        }
    });
});
