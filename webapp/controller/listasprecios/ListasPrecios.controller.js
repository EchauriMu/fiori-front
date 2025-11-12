sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/Fragment",
    "sap/ui/core/routing/History"
], function (Controller, JSONModel, MessageToast, MessageBox, DateFormat, Fragment, History) {
    "use strict";

    // Constante de la URL base para la API
    const BASE_URL = "http://localhost:3033/api";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.listasprecios.ListasPrecios", {

        // ====================================================================
        // CICLO DE VIDA
        // ====================================================================

        onInit: function () {
            // Obtener usuario actual
            const oUser = this.getOwnerComponent().getModel("appView").getProperty("/currentUser");
            console.log("Usuario recibido en ListasPrecios:", oUser);

            // --- Modelo de vista para la tabla de listas de precios ---
            const oViewModel = new JSONModel({
                listas: [],
                filteredListas: [],
                loading: true,
                error: "",
                searchTerm: "",
                selectedListaIDs: [],
                selectedLista: null,
                activeCount: 0,
                deletedCount: 0,
                totalCount: 0
            });
            this.getView().setModel(oViewModel, "view");

            // --- Modelo para el detalle/modal de lista de precios ---
            const oDetailViewModel = new JSONModel({
                IDLISTAOK: "",
                SKUSIDS: [],
                IDINSTITUTOOK: "",
                IDLISTABK: "",
                DESLISTA: "",
                FECHAEXPIRAINI: this._formatDateForInput(new Date()),
                FECHAEXPIRAFIN: this._formatDateForInput(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
                IDTIPOLISTAOK: "",
                IDTIPOGENERALISTAOK: "ESPECIFICA",
                IDTIPOFORMULAOK: "FIJO",
                REGUSER: oUser?.USERNAME || "SYSTEM",
                REGDATE: null,
                MODUSER: null,
                MODDATE: null,
                ACTIVED: true,
                DELETED: false,
                availableProducts: [],
                editing: false,
                saving: false,
                editableLista: null
            });
            this.getView().setModel(oDetailViewModel, "detailView");

            // Cargar datos de listas
            this.loadListas();
        },

        // ====================================================================
        // NAVEGACIÓN
        // ====================================================================

        onNavBack: function () {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("RouteMain", {}, true);
            }
        },

        // ====================================================================
        // FUNCIÓN DE LLAMADA HTTP
        // ====================================================================

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
            
            console.log("URL completa:", sFullUrl);
            console.log("Datos enviados:", oData);
            
            try {
                const oResponse = await fetch(sFullUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(oData || {})
                });

                if (!oResponse.ok) {
                    const oErrorJson = await oResponse.json();
                    const sErrorMessage = oErrorJson.message || `Error ${oResponse.status}`;
                    throw new Error(sErrorMessage);
                }

                const oJson = await oResponse.json();
                console.log("Respuesta JSON completa:", oJson);
                
                if (oJson && oJson.value && Array.isArray(oJson.value) && oJson.value.length > 0) {
                    const mainResponse = oJson.value[0];
                    console.log("Main Response:", mainResponse);
                    
                    if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                        const dataResponse = mainResponse.data[0];
                        console.log("Data Response:", dataResponse);
                        
                        if (dataResponse.dataRes && Array.isArray(dataResponse.dataRes)) {
                            console.log("DataRes encontrado:", dataResponse.dataRes);
                            console.log("Cantidad de listas:", dataResponse.dataRes.length);
                            return dataResponse.dataRes;
                        }
                    }
                }
                
                console.warn("Estructura de respuesta no esperada, devolviendo JSON completo");
                return oJson; 
                
            } catch (error) {
                console.error(`Error en la llamada ${sRelativeUrl}:`, error);
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        },

        // ====================================================================
        // LÓGICA DE CARGA DE LISTAS
        // ====================================================================

        loadListas: async function () {
            const oViewModel = this.getView().getModel("view");
            const i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            oViewModel.setProperty("/loading", true);
            oViewModel.setProperty("/error", "");
            oViewModel.setProperty("/selectedListaIDs", []);
            
            try {
                const aListasList = await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', {}, { ProcessType: 'GetAll' });

                if (!Array.isArray(aListasList)) {
                    throw new Error(i18n.getText("listasNoDataMessage"));
                }

                const aNormalizedListas = aListasList.map(lista => {
                    return {
                        ...lista,
                        SKUSIDS: Array.isArray(lista.SKUSIDS) 
                            ? lista.SKUSIDS 
                            : (typeof lista.SKUSIDS === 'string' ? JSON.parse(lista.SKUSIDS) : []),
                        REGDATE: lista.REGDATE || null,
                        MODDATE: lista.MODDATE || null,
                        ACTIVED: lista.ACTIVED !== undefined ? lista.ACTIVED : true,
                        DELETED: lista.DELETED !== undefined ? lista.DELETED : false
                    };
                });

                oViewModel.setProperty("/listas", aNormalizedListas);
                oViewModel.setProperty("/filteredListas", aNormalizedListas);

            } catch (oError) {
                console.error("Error completo:", oError);
                const sErrorMessage = oError.message || i18n.getText("listasLoadErrorMessage");
                oViewModel.setProperty("/error", sErrorMessage);
                oViewModel.setProperty("/listas", []);
                oViewModel.setProperty("/filteredListas", []);
            } finally {
                oViewModel.setProperty("/loading", false);
                this._updateCounters();
            }
        },

        onSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            this._applyFilter(sQuery);
        },

        _applyFilter: function (sQuery) {
            const oViewModel = this.getView().getModel("view");
            const aListas = oViewModel.getProperty("/listas");
            const sLowerQuery = (sQuery || "").toLowerCase();

            let aFiltered;
            if (!sLowerQuery) {
                aFiltered = aListas;
            } else {
                aFiltered = aListas.filter(l =>
                    (l.DESLISTA && l.DESLISTA.toLowerCase().includes(sLowerQuery)) ||
                    (l.IDLISTAOK && l.IDLISTAOK.toLowerCase().includes(sLowerQuery)) ||
                    (l.IDINSTITUTOOK && l.IDINSTITUTOOK.toLowerCase().includes(sLowerQuery))
                );
            }
            
            oViewModel.setProperty("/filteredListas", aFiltered);
        },

        _updateCounters: function() {
            const oViewModel = this.getView().getModel("view");
            const aListas = oViewModel.getProperty("/listas");
            const iActiveCount = aListas.filter(l => l.ACTIVED === true && l.DELETED !== true).length;
            const iDeletedCount = aListas.filter(l => l.DELETED === true).length;
            
            oViewModel.setProperty("/activeCount", iActiveCount);
            oViewModel.setProperty("/deletedCount", iDeletedCount);
            oViewModel.setProperty("/totalCount", aListas.length);
        },

        // ====================================================================
        // MANEJADORES DE LA TABLA
        // ====================================================================

        onSelectAll: function (oEvent) {
            const bSelectAll = oEvent.getParameter("selected");
            const oViewModel = this.getView().getModel("view");
            const aFilteredListas = oViewModel.getProperty("/filteredListas");
            
            let aSelectedListaIDs = bSelectAll 
                ? aFilteredListas.map(l => l.IDLISTAOK).filter(id => id)
                : [];
            
            oViewModel.setProperty("/selectedListaIDs", aSelectedListaIDs);
        },

        onRowSelectChange: function (oEvent) {
            const oViewModel = this.getView().getModel("view");
            const bIsSelected = oEvent.getParameter("selected");
            const oContext = oEvent.getSource().getBindingContext("view");
            
            if (!oContext) return;
            
            const sListaID = oContext.getProperty("IDLISTAOK");
            let aSelectedListaIDs = oViewModel.getProperty("/selectedListaIDs").slice();

            if (bIsSelected) {
                if (!aSelectedListaIDs.includes(sListaID)) {
                    aSelectedListaIDs.push(sListaID);
                }
            } else {
                aSelectedListaIDs = aSelectedListaIDs.filter(id => id !== sListaID);
            }
            
            oViewModel.setProperty("/selectedListaIDs", aSelectedListaIDs);
        },

        onRowClick: async function (oEvent) {
            const oListaContext = oEvent.getSource().getBindingContext("view");
            if (oListaContext) {
                const oLista = oListaContext.getObject();
                const oDetailModel = this.getView().getModel("detailView");

                // Limpiar y establecer datos de la lista
                const oCleanDetailData = { ...oLista };
                oDetailModel.setData(oCleanDetailData);
                
                // Reiniciar explícitamente las propiedades del modal
                oDetailModel.setProperty("/editing", false);
                oDetailModel.setProperty("/saving", false);
                oDetailModel.setProperty("/editableLista", null);

                // Cargar productos disponibles
                this._loadAvailableProducts();

                // Abrir el Dialog
                if (!this._oListaDetailDialog) {
                    this._oListaDetailDialog = await Fragment.load({
                        id: this.getView().getId(),
                        name: "com.invertions.sapfiorimodinv.view.listasprecios.fragments.modalListas",
                        controller: this
                    });
                    this.getView().addDependent(this._oListaDetailDialog);
                }
                this._oListaDetailDialog.open();
            }
        },

        // ====================================================================
        // LÓGICA DE MODAL
        // ====================================================================

        _loadAvailableProducts: async function () {
            const oDetailModel = this.getView().getModel("detailView");
            
            try {
                const aProductsList = await this._callApi('/ztproducts/crudProducts', 'POST', {}, { ProcessType: 'GetAll' });
                
                if (!Array.isArray(aProductsList)) {
                    throw new Error("No se pudieron cargar los productos.");
                }

                oDetailModel.setProperty("/availableProducts", aProductsList);
            } catch (error) {
                console.error("Error al cargar productos:", error);
                oDetailModel.setProperty("/availableProducts", []);
            }
        },

        onOpenListaDialog: function () {
            const oDetailModel = this.getView().getModel("detailView");
            const oUser = this.getOwnerComponent().getModel("appView").getProperty("/currentUser");

            // Limpiar para crear nueva lista
            oDetailModel.setData({
                IDLISTAOK: "",
                SKUSIDS: [],
                IDINSTITUTOOK: "",
                IDLISTABK: "",
                DESLISTA: "",
                FECHAEXPIRAINI: this._formatDateForInput(new Date()),
                FECHAEXPIRAFIN: this._formatDateForInput(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
                IDTIPOLISTAOK: "",
                IDTIPOGENERALISTAOK: "ESPECIFICA",
                IDTIPOFORMULAOK: "FIJO",
                REGUSER: oUser?.USERNAME || "SYSTEM",
                REGDATE: null,
                MODUSER: null,
                MODDATE: null,
                ACTIVED: true,
                DELETED: false,
                availableProducts: [],
                editing: false,
                saving: false,
                editableLista: null
            });

            this._loadAvailableProducts();

            if (!this._oListaDetailDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.invertions.sapfiorimodinv.view.listasprecios.fragments.modalListas",
                    controller: this
                }).then((oDialog) => {
                    this._oListaDetailDialog = oDialog;
                    this.getView().addDependent(this._oListaDetailDialog);
                    this._oListaDetailDialog.open();
                });
            } else {
                this._oListaDetailDialog.open();
            }
        },

        onCloseListaDialog: function () {
            if (this._oListaDetailDialog) {
                this._oListaDetailDialog.close();
            }
        },

        onEditLista: function () {
            const oDetailModel = this.getView().getModel("detailView");
            const oCurrentLista = oDetailModel.getData();
            
            // Crear una copia profunda para la edición
            const oListaCopy = JSON.parse(JSON.stringify(oCurrentLista));

            oDetailModel.setProperty("/editableLista", oListaCopy);
            oDetailModel.setProperty("/editing", true);
        },

        onCancelEditLista: function () {
            const oDetailModel = this.getView().getModel("detailView");
            oDetailModel.setProperty("/editing", false);
            oDetailModel.setProperty("/editableLista", null);
        },

        onSaveLista: async function () {
            const oDetailModel = this.getView().getModel("detailView");
            const oEditableLista = oDetailModel.getProperty("/editableLista");

            if (!oEditableLista) {
                MessageBox.error("No hay datos para guardar.");
                return;
            }

            oDetailModel.setProperty("/saving", true);

            try {
                // Preparar payload
                const payload = {
                    IDLISTAOK: oEditableLista.IDLISTAOK || `LIS-${Date.now()}`,
                    SKUSIDS: JSON.stringify(Array.isArray(oEditableLista.SKUSIDS) ? oEditableLista.SKUSIDS : []),
                    IDINSTITUTOOK: oEditableLista.IDINSTITUTOOK,
                    IDLISTABK: oEditableLista.IDLISTABK,
                    DESLISTA: oEditableLista.DESLISTA,
                    FECHAEXPIRAINI: oEditableLista.FECHAEXPIRAINI || null,
                    FECHAEXPIRAFIN: oEditableLista.FECHAEXPIRAFIN || null,
                    IDTIPOLISTAOK: oEditableLista.IDTIPOLISTAOK,
                    IDTIPOGENERALISTAOK: oEditableLista.IDTIPOGENERALISTAOK,
                    IDTIPOFORMULAOK: oEditableLista.IDTIPOFORMULAOK,
                    REGUSER: oEditableLista.REGUSER,
                    ACTIVED: Boolean(oEditableLista.ACTIVED),
                    DELETED: Boolean(oEditableLista.DELETED)
                };

                const oUpdatedLista = await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', payload, {
                    ProcessType: oEditableLista.IDLISTAOK ? 'UpdateOne' : 'AddOne',
                    IDLISTAOK: oEditableLista.IDLISTAOK
                });

                const i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                const sMessage = oEditableLista.IDLISTAOK ? 
                    i18n.getText("listasLoadSuccessMessage") : 
                    i18n.getText("listasLoadSuccessMessage");
                MessageToast.show(sMessage);

                // Recargar datos
                await this.loadListas();

                // Actualizar el modelo del detalle
                const oCurrentDetailData = oDetailModel.getData();
                const oNewData = { ...oCurrentDetailData, ...oEditableLista };
                oDetailModel.setData(oNewData);

                // Salir del modo edición
                oDetailModel.setProperty("/editing", false);
                oDetailModel.setProperty("/editableLista", null);

            } catch (error) {
                const i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                MessageBox.error(i18n.getText("listasLoadErrorMessage"));
            } finally {
                oDetailModel.setProperty("/saving", false);
            }
        },

        // Método delegador para el botón principal (Guardar/Editar)
        onListaButtonPress: function () {
            const oDetailModel = this.getView().getModel("detailView");
            const bEditing = oDetailModel.getProperty("/editing");

            if (bEditing) {
                this.onSaveLista();
            } else {
                this.onEditLista();
            }
        },

        // Método delegador para el botón secundario (Cancelar/Cerrar)
        onListaCancelPress: function () {
            const oDetailModel = this.getView().getModel("detailView");
            const bEditing = oDetailModel.getProperty("/editing");

            if (bEditing) {
                this.onCancelEditLista();
            } else {
                this.onCloseListaDialog();
            }
        },

        onToggleListaStatus: function (oEvent) {
            const bState = oEvent.getParameter("state");
            const oDetailModel = this.getView().getModel("detailView");
            const sListaID = oDetailModel.getProperty("/IDLISTAOK");
            const sListaDesc = oDetailModel.getProperty("/DESLISTA");

            if (!sListaID) {
                MessageBox.error("No se ha podido identificar la lista (ID no encontrado).");
                oEvent.getSource().setState(!bState);
                return;
            }

            const sActionText = bState ? "activar" : "desactivar";
            const sProcessType = bState ? "ActivateOne" : "DeleteLogic";

            MessageBox.confirm(`¿Estás seguro de que deseas ${sActionText} la lista "${sListaDesc}"?`, {
                title: "Confirmar Cambio de Estado",
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        oDetailModel.setProperty("/saving", true);
                        try {
                            await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', {}, {
                                ProcessType: sProcessType,
                                IDLISTAOK: sListaID
                            });
                            MessageToast.show(`Lista ${sActionText}da correctamente.`);
                            await this.loadListas();
                            oDetailModel.setProperty("/ACTIVED", bState);
                        } catch (oError) {
                            MessageBox.error(`Error al ${sActionText} la lista: ${oError.message}`);
                            oEvent.getSource().setState(!bState);
                        } finally {
                            oDetailModel.setProperty("/saving", false);
                        }
                    } else {
                        oEvent.getSource().setState(!bState);
                    }
                }
            });
        },

        onSKUSIDsChange: function (oEvent) {
            const aSelectedItems = oEvent.getParameter("items");
            const oDetailModel = this.getView().getModel("detailView");
            
            if (oEvent.getParameter("selectedItems")) {
                const aSelectedSkuIds = oEvent.getParameter("selectedItems").map(item => item.getKey());
                oDetailModel.setProperty("/SKUSIDS", aSelectedSkuIds);
            }
        },

        onDeleteLista: async function () {
            const oDetailModel = this.getView().getModel("detailView");
            const i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            const sListaID = oDetailModel.getProperty("/IDLISTAOK");
            const sListaDesc = oDetailModel.getProperty("/DESLISTA");

            if (!sListaID) {
                MessageBox.error(i18n.getText("listasLoadErrorMessage"));
                return;
            }

            MessageBox.confirm(i18n.getText("listasDeleteConfirmMessage", [sListaDesc]), {
                title: i18n.getText("listasDeleteConfirmTitle"),
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        oDetailModel.setProperty("/saving", true);
                        try {
                            await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', {}, {
                                ProcessType: 'DeleteLogic',
                                IDLISTAOK: sListaID
                            });
                            MessageToast.show(i18n.getText("listasDeleteSuccessMessage", [sListaDesc]));
                            await this.loadListas();
                            this.onCloseListaDialog();
                        } catch (oError) {
                            MessageBox.error(i18n.getText("listasDeleteErrorMessage"));
                        } finally {
                            oDetailModel.setProperty("/saving", false);
                        }
                    }
                }
            });
        },

        // ====================================================================
        // ACCIONES EN LOTE
        // ====================================================================

        onToggleSelectedListasStatus: async function () {
            const oViewModel = this.getView().getModel("view");
            const aSelectedListaIDs = oViewModel.getProperty("/selectedListaIDs");
            
            if (aSelectedListaIDs.length === 0) {
                MessageBox.information("Selecciona al menos una lista de precios.");
                return;
            }

            const aListas = oViewModel.getProperty("/listas");
            const listasArray = aSelectedListaIDs.map(id => aListas.find(l => l.IDLISTAOK === id)).filter(l => l);
            const activasCount = listasArray.filter(l => l && l.ACTIVED === true).length;
            const inactivasCount = listasArray.filter(l => l && (l.ACTIVED === false || l.DELETED === true)).length;
            
            const shouldActivate = inactivasCount > activasCount;
            const action = shouldActivate ? 'activar' : 'desactivar';
            
            if (!window.confirm(`¿Está seguro que desea ${action} ${aSelectedListaIDs.length} lista(s)?`)) {
                return;
            }

            oViewModel.setProperty("/loading", true);
            try {
                for (const sListaID of aSelectedListaIDs) {
                    const sProcessType = shouldActivate ? 'ActivateOne' : 'DeleteLogic';
                    await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', {}, {
                        ProcessType: sProcessType,
                        IDLISTAOK: sListaID
                    });
                }
                MessageToast.show(`${aSelectedListaIDs.length} lista(s) ${action}da(s) correctamente.`);
                await this.loadListas();
            } catch (oError) {
                MessageBox.error(`Error al ${action} listas: ${oError.message}`);
            } finally {
                oViewModel.setProperty("/loading", false);
            }
        },

        onDeleteSelectedListas: async function () {
            const oViewModel = this.getView().getModel("view");
            const aSelectedListaIDs = oViewModel.getProperty("/selectedListaIDs");
            
            if (aSelectedListaIDs.length === 0) {
                MessageBox.information("Selecciona al menos una lista de precios.");
                return;
            }

            if (!window.confirm(`¿Está seguro que desea eliminar permanentemente ${aSelectedListaIDs.length} lista(s)? Esta acción no se puede deshacer.`)) {
                return;
            }

            oViewModel.setProperty("/loading", true);
            try {
                for (const sListaID of aSelectedListaIDs) {
                    await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', {}, {
                        ProcessType: 'DeleteLogic',
                        IDLISTAOK: sListaID
                    });
                }
                MessageToast.show(`${aSelectedListaIDs.length} lista(s) eliminada(s) correctamente.`);
                await this.loadListas();
            } catch (oError) {
                MessageBox.error(`Error al eliminar listas: ${oError.message}`);
            } finally {
                oViewModel.setProperty("/loading", false);
            }
        },

        // ====================================================================
        // UTILIDADES
        // ====================================================================

        _formatDateForInput: function (date) {
            if (!date) return '';
            const d = new Date(date);
            const year = d.getUTCFullYear();
            const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
            const day = `${d.getUTCDate()}`.padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        formatterListaStatus: function (bActived, bDeleted) {
            if (bDeleted === true) return "Error";
            if (bActived === true) return "Success";
            if (bActived === false) return "Warning";
            return "None";
        },

        formatterListaStatusText: function (bActived, bDeleted) {
            if (bDeleted === true) return "Eliminada";
            if (bActived === true) return "Activa";
            if (bActived === false) return "Inactiva";
            return "Desconocido";
        },

        formatterDate: function (sDateString) {
            if (!sDateString) return "N/A";
            try {
                const oFormat = DateFormat.getDateTimeInstance({
                    pattern: "dd/MM/yyyy, HH:mm"
                });
                return oFormat.format(new Date(sDateString)) || sDateString;
            } catch (e) {
                return sDateString;
            }
        },

        formatterSKUList: function (aSkuIds) {
            if (!aSkuIds || aSkuIds.length === 0) return "Sin SKUs";
            return aSkuIds.slice(0, 3).join(", ") + (aSkuIds.length > 3 ? `... (+${aSkuIds.length - 3})` : "");
        },

        formatterIsListaSelected: function(aSelectedListaIDs, sListaID) {
            if (!aSelectedListaIDs || !sListaID) return false;
            return aSelectedListaIDs.indexOf(sListaID) !== -1;
        },

        formatterListCount: function(aListas) {
            if (!aListas) return "0 listas encontradas";
            return aListas.length + " lista" + (aListas.length !== 1 ? "s" : "") + " encontrada(s)";
        }
    });
});