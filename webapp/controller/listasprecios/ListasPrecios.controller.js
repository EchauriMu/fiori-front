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
                totalCount: 0,
                expandedRows: {},
                statusButtonText: "Activar"
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
                editableLista: null,
                activeTab: "config",
                // Nuevas propiedades para productos con presentaciones
                productosLista: [],
                presentacionesPorSKU: {},
                archivosPorSKU: {},
                expandedProducts: {},
                expandedPresentaciones: {},
                loadingProductos: false,
                errorProductos: "",
                searchSKU: ""
            });
            this.getView().setModel(oDetailViewModel, "detailView");

            // Inicializar variable de seguimiento
            this._currentEditingListaID = null;
            this._oListaDetailDialogNew = null;
            this._oProductosListaDialogNew = null;

            // Cargar el modal al inicializar
            this._loadModalFragment();
            this._loadProductosModalFragment();

            // Cargar datos de listas
            this.loadListas();
        },

        _loadModalFragment: function () {
            const that = this;
            if (that._oListaDetailDialogNew) {
                console.log("Modal ya cargado");
                return;
            }
            
            Fragment.load({
                id: this.getView().getId(),
                name: "com.invertions.sapfiorimodinv.view.listasprecios.fragments.modalListas",
                controller: this
            }).then((oDialog) => {
                console.log("Modal fragment cargado exitosamente");
                that._oListaDetailDialogNew = oDialog;
                that.getView().addDependent(that._oListaDetailDialogNew);
            }).catch((error) => {
                console.error("Error cargando modal fragment:", error);
                MessageBox.error("Error al cargar el modal: " + (error.message || error));
            });
        },

        _loadProductosModalFragment: function () {
            const that = this;
            if (that._oProductosListaDialogNew) {
                console.log("Modal de productos ya cargado");
                return;
            }
            
            Fragment.load({
                id: this.getView().getId(),
                name: "com.invertions.sapfiorimodinv.view.listasprecios.fragments.modalProductosLista",
                controller: this
            }).then((oDialog) => {
                console.log("Modal de productos cargado exitosamente");
                that._oProductosListaDialogNew = oDialog;
                that.getView().addDependent(that._oProductosListaDialogNew);
            }).catch((error) => {
                console.error("Error cargando modal de productos:", error);
                MessageBox.error("Error al cargar el modal de productos: " + (error.message || error));
            });
        },

        _openProductosListaDialog: function () {
            if (this._oProductosListaDialogNew) {
                console.log("Abriendo modal de productos");
                this._oProductosListaDialogNew.open();
            } else {
                console.error("Modal de productos no está cargado aún");
                MessageBox.error("Error: No se pudo abrir el modal de productos. Intenta de nuevo.");
            }
        },

        onCloseProductosDialog: function () {
            if (this._oProductosListaDialogNew) {
                this._oProductosListaDialogNew.close();
            }
        },

        onSearchProductos: function (oEvent) {
            const sSearchTerm = oEvent.getParameter("value") || "";
            const oDetailModel = this.getView().getModel("detailView");
            const aProductosLista = oDetailModel.getProperty("/productosLista") || [];
            
            if (!sSearchTerm) {
                oDetailModel.setProperty("/searchSKU", sSearchTerm);
                return;
            }

            const sLowerSearch = sSearchTerm.toLowerCase();
            const aFiltered = aProductosLista.filter(oProducto => 
                (oProducto.SKUID && oProducto.SKUID.toLowerCase().includes(sLowerSearch)) ||
                (oProducto.PRODUCTNAME && oProducto.PRODUCTNAME.toLowerCase().includes(sLowerSearch)) ||
                (oProducto.MARCA && oProducto.MARCA.toLowerCase().includes(sLowerSearch))
            );

            oDetailModel.setProperty("/searchSKU", sSearchTerm);
            oDetailModel.setProperty("/productosListaFiltered", aFiltered);
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
            const oCBCheckBox = oEvent.getSource();
            const bSelectAll = oCBCheckBox.getSelected();
            const oViewModel = this.getView().getModel("view");
            const aFilteredListas = oViewModel.getProperty("/filteredListas");
            
            let aSelectedListaIDs = bSelectAll 
                ? aFilteredListas.map(l => l.IDLISTAOK).filter(id => id)
                : [];
            
            oViewModel.setProperty("/selectedListaIDs", aSelectedListaIDs);
            this.onTableSelectionChange();
        },

        onRowSelectChange: function (oEvent) {
            const oViewModel = this.getView().getModel("view");
            const oCBCheckBox = oEvent.getSource();
            const bSelected = oCBCheckBox.getSelected();
            const oContext = oCBCheckBox.getBindingContext("view");
            
            if (!oContext) return;
            
            const sListaID = oContext.getProperty("IDLISTAOK");
            let aSelectedListaIDs = oViewModel.getProperty("/selectedListaIDs").slice();

            if (bSelected) {
                if (!aSelectedListaIDs.includes(sListaID)) {
                    aSelectedListaIDs.push(sListaID);
                }
            } else {
                aSelectedListaIDs = aSelectedListaIDs.filter(id => id !== sListaID);
            }
            
            oViewModel.setProperty("/selectedListaIDs", aSelectedListaIDs);
            this.onTableSelectionChange();
        },

        onTableSelectionChange: function () {
            const oViewModel = this.getView().getModel("view");
            const aSelectedListaIDs = oViewModel.getProperty("/selectedListaIDs");

            if (aSelectedListaIDs.length === 0) {
                oViewModel.setProperty("/statusButtonText", "Activar");
                return;
            }

            // Determine if we should show "Activar" or "Desactivar" based on majority state
            const aListas = oViewModel.getProperty("/listas");
            const aSelectedListas = aSelectedListaIDs.map(id => aListas.find(l => l.IDLISTAOK === id)).filter(l => l);

            const iActiveCount = aSelectedListas.filter(l => l && l.ACTIVED === true).length;
            const bActivate = iActiveCount <= aSelectedListas.length / 2; // Activate if less than half are active

            const sButtonText = bActivate ? "Activar" : "Desactivar";
            oViewModel.setProperty("/statusButtonText", sButtonText);
        },

        onToggleRowExpansion: function (oEvent) {
            const oViewModel = this.getView().getModel("view");
            const oContext = oEvent.getSource().getBindingContext("view");
            
            if (!oContext) return;
            
            const sListaID = oContext.getProperty("IDLISTAOK");
            const oExpandedRows = oViewModel.getProperty("/expandedRows") || {};
            
            // Toggle expansion state
            oExpandedRows[sListaID] = !oExpandedRows[sListaID];
            oViewModel.setProperty("/expandedRows", oExpandedRows);
            
            // Actualizar la propiedad expanded en el objeto de lista
            const aFilteredListas = oViewModel.getProperty("/filteredListas");
            const oLista = aFilteredListas.find(l => l.IDLISTAOK === sListaID);
            if (oLista) {
                oLista.expanded = oExpandedRows[sListaID];
                oViewModel.refresh(true);
            }
        },

        onRowClick: function (oEvent) {
            const oSource = oEvent.getSource();
            const oListaContext = oSource.getBindingContext("view");
            
            if (!oListaContext) {
                console.error("No context found");
                MessageBox.error("Error: No se pudo obtener los datos de la lista");
                return;
            }
            
            const oLista = oListaContext.getObject();
            console.log("onRowClick: Abriendo lista", oLista);
            
            const oDetailModel = this.getView().getModel("detailView");

            // Configurar para modo lectura (no edición)
            const newData = {
                ...oLista,
                availableProducts: [],
                editing: false,
                saving: false,
                editableLista: null,
                activeTab: "config",
                productosLista: [],
                presentacionesPorSKU: {},
                archivosPorSKU: {},
                expandedProducts: {},
                searchSKU: "",
                productosListaFiltered: []
            };
            
            oDetailModel.setData(newData);
            console.log("Modelo actualizado:", oDetailModel.getData());

            this._currentEditingListaID = oLista.IDLISTAOK;
            this._loadAvailableProducts();
            // Cargar productos y luego abrir el modal
            this._loadProductosListaAndOpen();
        },

        _loadProductosListaAndOpen: async function () {
            // Cargar los productos
            console.error("⏳⏳⏳ ANTES de _loadProductosLista");
            console.error("⏳⏳⏳ SKUSIDS:", this.getView().getModel("detailView").getProperty("/SKUSIDS"));
            await this._loadProductosLista();
            // Luego abrir el modal
            console.log("✓ Productos cargados, abriendo modal");
            this._openProductosListaDialog();
        },

        _openListaDialogNew: function () {
            if (this._oListaDetailDialogNew) {
                console.log("Abriendo modal dialog");
                this._oListaDetailDialogNew.open();
            } else {
                console.error("Modal dialog no está cargado aún");
                MessageBox.error("Error: No se pudo abrir el modal. Intenta de nuevo.");
            }
        },

        // Nuevo método: Editar desde botón
        onEditLista: function () {
            const oViewModel = this.getView().getModel("view");
            const aSelectedListaIDs = oViewModel.getProperty("/selectedListaIDs") || [];
            
            if (aSelectedListaIDs.length === 0) {
                MessageBox.warning("Por favor selecciona una lista para editar.");
                return;
            }
            
            if (aSelectedListaIDs.length > 1) {
                MessageBox.warning("Por favor selecciona solo una lista para editar.");
                return;
            }
            
            const aListas = oViewModel.getProperty("/filteredListas") || [];
            const oLista = aListas.find(l => l.IDLISTAOK === aSelectedListaIDs[0]);
            
            if (!oLista) {
                MessageBox.error("No se pudo encontrar la lista seleccionada.");
                return;
            }
            
            const oDetailModel = this.getView().getModel("detailView");
            
            // Deep copy para evitar modificar el original
            const oListaCopy = JSON.parse(JSON.stringify(oLista));
            
            oDetailModel.setData({
                ...oLista,
                availableProducts: [],
                editing: true,
                saving: false,
                editableLista: oListaCopy,
                activeTab: "config"
            });
            
            this._currentEditingListaID = oLista.IDLISTAOK;
            this._loadAvailableProducts();
            this._openListaDialogEdit();
        },

        _openListaDialogEdit: function () {
            if (!this._oListaDetailDialogNew) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.invertions.sapfiorimodinv.view.listasprecios.fragments.modalListas",
                    controller: this
                }).then((oDialog) => {
                    this._oListaDetailDialogNew = oDialog;
                    this.getView().addDependent(this._oListaDetailDialogNew);
                    this._oListaDetailDialogNew.open();
                });
            } else {
                this._oListaDetailDialogNew.open();
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

            // Crear nueva lista en modo edición
            const oNewLista = {
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
                DELETED: false
            };

            oDetailModel.setData({
                ...oNewLista,
                availableProducts: [],
                editing: true,
                saving: false,
                editableLista: oNewLista,
                activeTab: "config"
            });

            this._currentEditingListaID = null;
            this._loadAvailableProducts();

            if (!this._oListaDetailDialogNew) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.invertions.sapfiorimodinv.view.listasprecios.fragments.modalListas",
                    controller: this
                }).then((oDialog) => {
                    this._oListaDetailDialogNew = oDialog;
                    this.getView().addDependent(this._oListaDetailDialogNew);
                    this._oListaDetailDialogNew.open();
                });
            } else {
                this._oListaDetailDialogNew.open();
            }
        },

        onCloseListaDialog: function () {
            if (this._oListaDetailDialog) {
                this._oListaDetailDialog.close();
            }
        },

        onCancelEditLista: function () {
            const oDetailModel = this.getView().getModel("detailView");
            oDetailModel.setProperty("/editing", false);
            oDetailModel.setProperty("/editableLista", null);
        },

        onSaveLista: async function () {
            const oDetailModel = this.getView().getModel("detailView");
            const oEditableLista = oDetailModel.getProperty("/editableLista");
            const i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();

            if (!oEditableLista) {
                MessageBox.error(i18n.getText("listasLoadErrorMessage"));
                return;
            }

            // Validar campos requeridos
            if (!oEditableLista.DESLISTA || !oEditableLista.DESLISTA.trim()) {
                MessageBox.error("La descripción de la lista es requerida.");
                return;
            }

            if (!oEditableLista.IDINSTITUTOOK || !oEditableLista.IDINSTITUTOOK.trim()) {
                MessageBox.error("El instituto es requerido.");
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

                const bIsNewLista = !this._currentEditingListaID;
                const oUpdatedLista = await this._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', payload, {
                    ProcessType: bIsNewLista ? 'AddOne' : 'UpdateOne',
                    IDLISTAOK: oEditableLista.IDLISTAOK
                });

                const sMessage = bIsNewLista ? 
                    "Lista de precios creada correctamente" : 
                    "Lista de precios actualizada correctamente";
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
                this._currentEditingListaID = null;
                this.onCloseListaDialogNew();

            } catch (error) {
                const i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                MessageBox.error("Error al guardar: " + (error.message || i18n.getText("listasLoadErrorMessage")));
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
                this.onCloseListaDialogNew();
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
            const oDetailModel = this.getView().getModel("detailView");
            const aSelectedItems = oEvent.getParameter("selectedItems");
            
            if (aSelectedItems && aSelectedItems.length > 0) {
                const aSelectedSkuIds = aSelectedItems.map(item => item.getKey());
                oDetailModel.setProperty("/editableLista/SKUSIDS", aSelectedSkuIds);
            } else {
                oDetailModel.setProperty("/editableLista/SKUSIDS", []);
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
                            this.onCloseListaDialogNew();
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

        onToggleSelectedListasStatus: function () {
            const oViewModel = this.getView().getModel("view");
            const aSelectedListaIDs = oViewModel.getProperty("/selectedListaIDs");
            
            if (aSelectedListaIDs.length === 0) {
                MessageBox.warning("Por favor selecciona al menos una lista de precios.");
                return;
            }
            
            // Obtener los objetos de las listas seleccionadas
            const aListas = oViewModel.getProperty("/listas");
            const aSelectedListas = aSelectedListaIDs.map(id => aListas.find(l => l.IDLISTAOK === id)).filter(l => l);
            
            // Contar cuántas están activas
            const iActiveCount = aSelectedListas.filter(l => l.ACTIVED === true).length;
            const bActivate = iActiveCount <= aSelectedListas.length / 2; // Activar si menos de la mitad están activas
            
            const sMessage = bActivate 
                ? "¿Activar " + aSelectedListaIDs.length + " lista(s)?"
                : "¿Desactivar " + aSelectedListaIDs.length + " lista(s)?";
            
            const that = this;
            MessageBox.confirm(sMessage, {
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._updateStatusForListas(aSelectedListas, bActivate);
                    }
                }
            });
        },

        _updateStatusForListas: function(aListas, bActivate) {
            const that = this;
            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/loading", true);
            
            let iUpdated = 0;
            const updateNext = function() {
                if (iUpdated >= aListas.length) {
                    oViewModel.setProperty("/loading", false);
                    MessageToast.show("Estado actualizado correctamente");
                    oViewModel.setProperty("/selectedListaIDs", []);
                    that.loadListas();
                    return;
                }
                
                const oLista = aListas[iUpdated];
                const sProcessType = bActivate ? 'ActivateOne' : 'DeactivateOne';
                
                // Preparar el payload completo con todos los campos necesarios
                const payload = {
                    IDLISTAOK: oLista.IDLISTAOK,
                    SKUSIDS: JSON.stringify(Array.isArray(oLista.SKUSIDS) ? oLista.SKUSIDS : []),
                    IDINSTITUTOOK: oLista.IDINSTITUTOOK || "",
                    IDLISTABK: oLista.IDLISTABK || "",
                    DESLISTA: oLista.DESLISTA || "",
                    FECHAEXPIRAINI: oLista.FECHAEXPIRAINI || null,
                    FECHAEXPIRAFIN: oLista.FECHAEXPIRAFIN || null,
                    IDTIPOLISTAOK: oLista.IDTIPOLISTAOK || "",
                    IDTIPOGENERALISTAOK: oLista.IDTIPOGENERALISTAOK || "ESPECIFICA",
                    IDTIPOFORMULAOK: oLista.IDTIPOFORMULAOK || "FIJO",
                    REGUSER: oLista.REGUSER || "SYSTEM",
                    ACTIVED: bActivate,
                    DELETED: false
                };
                
                that._callApi('/ztprecios-listas/preciosListasCRUD', 'POST', payload, {
                    ProcessType: sProcessType,
                    IDLISTAOK: oLista.IDLISTAOK
                })
                    .then(function() {
                        iUpdated++;
                        updateNext();
                    })
                    .catch(function(error) {
                        oViewModel.setProperty("/loading", false);
                        MessageBox.error("Error al actualizar estado de " + oLista.IDLISTAOK + ": " + error.message);
                    });
            };
            
            updateNext();
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
                        ProcessType: 'DeleteHard',
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

        formatterFirstSKU: function (aSkuIds) {
            if (!aSkuIds || aSkuIds.length === 0) return "";
            return aSkuIds[0];
        },

        formatterAllSKUs: function (aSkuIds) {
            if (!aSkuIds || aSkuIds.length === 0) return "Sin SKUs";
            return aSkuIds.join(", ");
        },

        formatterSKUCount: function (aSkuIds) {
            if (!aSkuIds || aSkuIds.length <= 1) return "";
            return `+ ${aSkuIds.length - 1} más`;
        },

        formatterIsListaSelected: function(aSelectedListaIDs, sListaID) {
            if (!aSelectedListaIDs || !sListaID) return false;
            return aSelectedListaIDs.indexOf(sListaID) !== -1;
        },

        formatterListCount: function(aListas) {
            if (!aListas) return "0 listas encontradas";
            return aListas.length + " lista" + (aListas.length !== 1 ? "s" : "") + " encontrada(s)";
        },

        // ====================================================================
        // MÉTODOS NUEVOS PARA EL MODAL MEJORADO
        // ====================================================================

        onTabSelect: function(oEvent) {
            const oDetailModel = this.getView().getModel("detailView");
            const sSelectedKey = oEvent.getParameter("selectedKey");
            oDetailModel.setProperty("/activeTab", sSelectedKey);
        },

        onCloseListaDialogNew: function () {
            if (this._oListaDetailDialogNew) {
                this._oListaDetailDialogNew.close();
            }
        },

        /**
         * Carga los productos registrados en la lista actual con sus presentaciones
         */
        _loadProductosLista: async function () {
            const oDetailModel = this.getView().getModel("detailView");
            const aSkusList = oDetailModel.getProperty("/SKUSIDS") || [];
            
            if (!Array.isArray(aSkusList) || aSkusList.length === 0) {
                console.warn("No hay SKUs para cargar");
                oDetailModel.setProperty("/productosLista", []);
                oDetailModel.setProperty("/loadingProductos", false);
                return Promise.resolve([]);
            }

            oDetailModel.setProperty("/loadingProductos", true);
            oDetailModel.setProperty("/errorProductos", "");

            try {
                const aProductosConPresentaciones = [];

                // Cargar TODOS los productos de una vez
                const aAllProducts = await this._callApi('/ztproducts/crudProducts', 'POST', {}, { 
                    ProcessType: 'GetAll'
                });

                if (!Array.isArray(aAllProducts) || aAllProducts.length === 0) {
                    console.warn("No se encontraron productos");
                    oDetailModel.setProperty("/productosLista", []);
                    oDetailModel.setProperty("/loadingProductos", false);
                    return [];
                }

                // Crear un mapa de productos por SKUID
                const oProductosMap = {};
                aAllProducts.forEach(oProduct => {
                    if (oProduct.SKUID) {
                        oProductosMap[oProduct.SKUID] = oProduct;
                    }
                });

                // Procesar cada SKU y cargar presentaciones individualmente
                for (const sSKUID of aSkusList) {
                    const oProducto = oProductosMap[sSKUID];
                    
                    if (!oProducto) {
                        console.warn(`No se encontró producto para SKU: ${sSKUID}`);
                        continue;
                    }

                    let aPresentaciones = [];
                    try {
                        const oPresentacionesResponse = await this._callApi(
                            '/ztproducts-presentaciones/productsPresentacionesCRUD', 
                            'POST', 
                            {}, 
                            { 
                                ProcessType: 'GetBySKUID',
                                skuid: sSKUID
                            }
                        );
                        
                        // Extraer presentaciones de la respuesta
                        if (oPresentacionesResponse && oPresentacionesResponse.value && Array.isArray(oPresentacionesResponse.value) && oPresentacionesResponse.value.length > 0) {
                            const mainResponse = oPresentacionesResponse.value[0];
                            if (mainResponse.data && Array.isArray(mainResponse.data) && mainResponse.data.length > 0) {
                                const dataResponse = mainResponse.data[0];
                                if (dataResponse.dataRes && Array.isArray(dataResponse.dataRes)) {
                                    aPresentaciones = dataResponse.dataRes;
                                }
                            }
                        } else if (Array.isArray(oPresentacionesResponse)) {
                            aPresentaciones = oPresentacionesResponse;
                        }
                        
                    } catch (error) {
                        console.error(`Error cargando presentaciones para ${sSKUID}:`, error.message);
                        aPresentaciones = [];
                    }

                    const oProductoCompleto = {
                        ...oProducto,
                        presentaciones: aPresentaciones,
                        expanded: false
                    };
                    
                    aProductosConPresentaciones.push(oProductoCompleto);
                }

                oDetailModel.setProperty("/productosLista", aProductosConPresentaciones);
                
                return aProductosConPresentaciones;

            } catch (error) {
                console.error("Error al cargar lista de productos:", error);
                oDetailModel.setProperty("/errorProductos", error.message);
                oDetailModel.setProperty("/productosLista", []);
                return [];
            } finally {
                oDetailModel.setProperty("/loadingProductos", false);
            }
        },

        /**
         * Maneja la expansión/colapso de productos
         */
        onToggleProductExpanded: function (oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("detailView");
            
            if (!oContext) return;
            
            const sSKUID = oContext.getProperty("SKUID");
            const oDetailModel = this.getView().getModel("detailView");
            const oExpandedProducts = oDetailModel.getProperty("/expandedProducts") || {};
            
            oExpandedProducts[sSKUID] = !oExpandedProducts[sSKUID];
            oDetailModel.setProperty("/expandedProducts", oExpandedProducts);
            
            // Si se está expandiendo, cargar imágenes del producto
            if (oExpandedProducts[sSKUID]) {
                this._loadProductImages(sSKUID);
            }
            
            oDetailModel.refresh(true);
        },

        /**
         * Carga las imágenes del producto
         */
        _loadProductImages: async function (sSKUID) {
            const oDetailModel = this.getView().getModel("detailView");
            const aProductosLista = oDetailModel.getProperty("/productosLista") || [];
            const oProducto = aProductosLista.find(p => p.SKUID === sSKUID);
            
            if (!oProducto) return;
            
            try {
                const aFiles = await this._callApi('/ztproducts-files/productsFilesCRUD', 'POST', {}, {
                    ProcessType: 'GetBySKUID',
                    skuid: sSKUID
                });

                if (!Array.isArray(aFiles)) {
                    oProducto.imageFiles = [];
                    oDetailModel.refresh(true);
                    return;
                }

                // Filtrar solo imágenes (IMG o IMAGE)
                const aImageFiles = aFiles.filter(f => f.FILETYPE === 'IMG' || f.FILETYPE === 'IMAGE');
                
                // Asignar al producto
                oProducto.imageFiles = aImageFiles && aImageFiles.length > 0 ? aImageFiles : [];
                
                console.log(`Imágenes cargadas para ${sSKUID}:`, oProducto.imageFiles.length);
                oDetailModel.refresh(true);
                
            } catch (error) {
                console.error(`Error cargando imágenes para ${sSKUID}:`, error);
                oProducto.imageFiles = [];
                oDetailModel.refresh(true);
            }
        },

        /**
         * Maneja la expansión/colapso de presentaciones
         */
        onTogglePresentacionExpanded: function (oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("detailView");
            
            if (!oContext) return;
            
            const sIdPresentaOK = oContext.getProperty("IdPresentaOK");
            const oDetailModel = this.getView().getModel("detailView");
            const oExpandedPresentaciones = oDetailModel.getProperty("/expandedPresentaciones") || {};
            
            oExpandedPresentaciones[sIdPresentaOK] = !oExpandedPresentaciones[sIdPresentaOK];
            oDetailModel.setProperty("/expandedPresentaciones", oExpandedPresentaciones);
            oDetailModel.refresh(true);
        },

        /**
         * Formatea un número como moneda
         */
        formatterCurrency: function (nValue) {
            if (!nValue && nValue !== 0) return "N/A";
            return "$" + nValue.toLocaleString('es-MX', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },

        /**
         * Guarda los precios de los productos
         */
        onGuardarPrecios: function () {
            const oDetailModel = this.getView().getModel("detailView");
            MessageToast.show("Funcionalidad de guardar precios en desarrollo");
            console.log("Guardar precios llamado");
        }
    });
});

