sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/Fragment",
    // Ya no es necesario importar AddProduct.controller aquí
], function (Controller, JSONModel, MessageToast, MessageBox, DateFormat, Fragment) {
    "use strict";

    // Constante de la URL base para la API
    const BASE_URL = "http://localhost:3033/api";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.Main", {

        // ====================================================================
        // CICLO DE VIDA (Añadido onExit para limpiar)
        // ====================================================================

        onInit: function () {
            // Lógica de onInit original
            const oUser = this.getOwnerComponent().getModel("appView").getProperty("/currentUser");
            console.log("Usuario recibido en Main:", oUser);

            // --- Lógica de la Tabla de Productos (NUEVO) ---
            const oViewModel = new JSONModel({
                products: [], 
                filteredProducts: [], 
                loading: true,
                error: "",
                searchTerm: "",
                selectedSKUIDs: [], 
                selectedProduct: null,
                activeCount: 0,
                totalCount: 0
            });
            this.getView().setModel(oViewModel, "view");

            // --- Modelo para la vista de detalle del producto (MODAL) ---
            const oDetailViewModel = new JSONModel({
                // --- Datos del Producto ---
                ...{}, // Se llenará al hacer clic

                // --- Presentaciones ---
                presentations: [],
                selectedPresentation: null,
                // ======================================================
                // INICIO DE LA CORRECCIÓN 1: Añadir nueva propiedad
                // ======================================================
                selectedPresentationKey: null, // Propiedad para el selectedKey del Select
                // ======================================================
                // FIN DE LA CORRECCIÓN 1
                // ======================================================
                loadingPresentations: false,
                errorPresentations: "",

                // --- Archivos de la presentación seleccionada ---
                files: [],
                imageFiles: [],
                pdfFiles: [],
                docFiles: [],
                videoFiles: [],
                otherFiles: [],
                loadingFiles: false,
                errorFiles: "",
                // --- Estado de Edición ---
                editing: false,
                saving: false,
                editableProduct: null // Copia del producto para edición
            });
            this.getView().setModel(oDetailViewModel, "detailView");

            // Cargar datos de productos
            this.loadProducts();
        },
        
        // ====================================================================
        // NAVEGACIÓN (Sin cambios)
        // ====================================================================

        onGoToInvertions: function () {
            this.getOwnerComponent().getRouter().navTo("RouteInvestments");
        },

        onGoToRoles: function () {
            this.getOwnerComponent().getRouter().navTo("RouteRoles");
        },

        onGoToUsers: function () {
            this.getOwnerComponent().getRouter().navTo("RouteUsersList");
        },
        
        onGoToCatalogs: function(){
            this.getOwnerComponent().getRouter().navTo("RouteCatalogs");
        },

        // ====================================================================
        // FUNCIÓN DE LLAMADA HTTP (Sin cambios)
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
                    method: 'POST', // Forzar siempre el método POST
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
                            console.log("Cantidad de productos:", dataResponse.dataRes.length);
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
        // LÓGICA DE CARGA DE PRODUCTOS (Sin cambios)
        // ====================================================================
        
        loadProducts: async function () {
            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/loading", true);
            oViewModel.setProperty("/error", "");
            oViewModel.setProperty("/selectedSKUIDs", []); 
            
            try {
                const aProductsList = await this._callApi('/ztproducts/crudProducts', 'POST', {}, { ProcessType: 'GetAll' });

                if (!Array.isArray(aProductsList)) {
                    throw new Error("La respuesta de la API no es un array de productos válido.");
                }

                const aNormalizedProducts = aProductsList.map(product => {
                    const firstHistory = (product.HISTORY && product.HISTORY[0]) || {};
                    return {
                        ...product,
                        REGDATE: product.REGDATE || firstHistory.date || null,
                        MODDATE: product.MODDATE || null,
                        HISTORY: product.HISTORY || [],
                        ACTIVED: product.ACTIVED !== undefined ? product.ACTIVED : true,
                        DELETED: product.DELETED !== undefined ? product.DELETED : false 
                    };
                });

                oViewModel.setProperty("/products", aNormalizedProducts);
                oViewModel.setProperty("/filteredProducts", aNormalizedProducts);

            } catch (oError) {
                console.error("Error completo:", oError);
                const sErrorMessage = oError.message || "Error al cargar productos desde la API";
                oViewModel.setProperty("/error", sErrorMessage);
                oViewModel.setProperty("/products", []);
                oViewModel.setProperty("/filteredProducts", []);
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
            const aProducts = oViewModel.getProperty("/products");
            const sLowerQuery = (sQuery || "").toLowerCase();

            let aFiltered;
            if (!sLowerQuery) {
                aFiltered = aProducts;
            } else {
                aFiltered = aProducts.filter(p =>
                    (p.PRODUCTNAME && p.PRODUCTNAME.toLowerCase().includes(sLowerQuery)) ||
                    (p.SKUID && p.SKUID.toLowerCase().includes(sLowerQuery)) ||
                    (p.MARCA && p.MARCA.toLowerCase().includes(sLowerQuery))
                );
            }
            
            oViewModel.setProperty("/filteredProducts", aFiltered);
        },
        
        _updateCounters: function() {
            const oViewModel = this.getView().getModel("view");
            const aProducts = oViewModel.getProperty("/products");
            const iActiveCount = aProducts.filter(p => p.ACTIVED === true && p.DELETED !== true).length;
            
            oViewModel.setProperty("/activeCount", iActiveCount);
            oViewModel.setProperty("/totalCount", aProducts.length);
        },
        
        // ====================================================================
        // MANEJADORES DE LA TABLA (Sin cambios)
        // ====================================================================
        
        onTableAction: async function (oEvent) {
             const sAction = oEvent.getSource().data("action");
             const oViewModel = this.getView().getModel("view");
             const aSelectedSKUIDs = oViewModel.getProperty("/selectedSKUIDs");
             const iSelectedCount = aSelectedSKUIDs.length;
             const sI18nKey = this.getOwnerComponent().getModel("i18n").getResourceBundle();
             
             if (sAction === "CREATE") {
                 this.getOwnerComponent().getRouter().navTo("RouteAddProduct"); // <-- NAVEGAR A LA NUEVA VISTA
                 return; // Salimos de la función aquí
             }
             
             if ((sAction === "DELETE" || sAction === "ACTIVATE") && iSelectedCount === 0) {
                 MessageBox.information(sI18nKey.getText("msgSelectOneProduct"));
                 return;
             }
             
             if (sAction === "EDIT") {
                 if (iSelectedCount !== 1) return;
                 MessageToast.show(`Simulando editar el producto: ${aSelectedSKUIDs[0]}`);
                 return;
             }

             MessageBox.confirm(
                 `¿Confirma realizar la acción '${sAction}' sobre ${iSelectedCount} producto(s)?`,
                 {
                     actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                     onClose: async (sResult) => {
                         if (sResult === MessageBox.Action.YES) {
                             await this._executeAction(sAction, aSelectedSKUIDs);
                         }
                     }
                 }
             );
        },

        _executeAction: async function(sAction, aSKUIDs) {
            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/loading", true);
            oViewModel.setProperty("/error", "");
            
            try {
                for (const sSKUID of aSKUIDs) {
                    if (sAction === "DELETE") {
                        await this._callApi('/ztproducts/crudProducts', 'DELETE', null, { ProcessType: 'DeleteLogic', skuid: sSKUID });
                    } else if (sAction === "ACTIVATE") {
                        await this._callApi('/ztproducts/crudProducts', 'PUT', null, { ProcessType: 'ActivateOne', skuid: sSKUID });
                    }
                }
                
                MessageToast.show(`${aSKUIDs.length} productos procesados exitosamente.`);
                
            } catch (oError) {
                oViewModel.setProperty("/error", `Error al ejecutar la acción '${sAction}'. Detalle: ${oError.message}`);
            } finally {
                await this.loadProducts(); // Recargar la tabla
                oViewModel.setProperty("/loading", false);
            }
        },

        onSelectAll: function (oEvent) {
            const bSelectAll = oEvent.getParameter("selected");
            const oViewModel = this.getView().getModel("view");
            const aFilteredProducts = oViewModel.getProperty("/filteredProducts");
            
            let aSelectedSKUIDs = bSelectAll 
                ? aFilteredProducts.map(p => p.SKUID).filter(id => id)
                : [];
            
            oViewModel.setProperty("/selectedSKUIDs", aSelectedSKUIDs);
        },

        onRowSelectChange: function (oEvent) {
            const oViewModel = this.getView().getModel("view");
            const bIsSelected = oEvent.getParameter("selected");
            const oContext = oEvent.getSource().getBindingContext("view");
            
            if (!oContext) return;
            
            const sSKUID = oContext.getProperty("SKUID");
            let aSelectedSKUIDs = oViewModel.getProperty("/selectedSKUIDs").slice(); 

            if (bIsSelected) {
                if (!aSelectedSKUIDs.includes(sSKUID)) {
                    aSelectedSKUIDs.push(sSKUID);
                }
            } else {
                aSelectedSKUIDs = aSelectedSKUIDs.filter(id => id !== sSKUID);
            }
            
            oViewModel.setProperty("/selectedSKUIDs", aSelectedSKUIDs);
        },
        
        onRowClick: async function (oEvent) {
            const oProductContext = oEvent.getSource().getBindingContext("view");
            if (oProductContext) {
                const oProduct = oProductContext.getObject();
                const oDetailModel = this.getView().getModel("detailView");

                // 1. Limpiar y establecer datos del producto principal
                const oCleanDetailData = { ...oProduct };
                oDetailModel.setData(oCleanDetailData); // Limpia el modelo con los datos del producto
                
                // Reiniciar explícitamente las propiedades del modal
                oDetailModel.setProperty("/presentations", []);
                oDetailModel.setProperty("/selectedPresentation", null);
                oDetailModel.setProperty("/selectedPresentationKey", null); // <-- CORRECCIÓN: Reiniciar la clave
                oDetailModel.setProperty("/files", []);
                oDetailModel.setProperty("/imageFiles", []);
                oDetailModel.setProperty("/pdfFiles", []);
                oDetailModel.setProperty("/docFiles", []);
                oDetailModel.setProperty("/videoFiles", []);
                oDetailModel.setProperty("/otherFiles", []);
                oDetailModel.setProperty("/loadingPresentations", false);
                oDetailModel.setProperty("/loadingFiles", false);
                oDetailModel.setProperty("/errorPresentations", "");
                oDetailModel.setProperty("/errorFiles", "");
                oDetailModel.setProperty("/editing", false);
                oDetailModel.setProperty("/saving", false);
                oDetailModel.setProperty("/editableProduct", null);


                // 2. Abrir el Dialog
                if (!this._oProductDetailDialog) {
                    this._oProductDetailDialog = await Fragment.load({
                        id: this.getView().getId(),
                        name: "com.invertions.sapfiorimodinv.view.fragments.modalProductos",
                        controller: this
                    });
                    this.getView().addDependent(this._oProductDetailDialog);
                }
                this._oProductDetailDialog.open();

                // 3. Cargar datos secundarios (presentaciones)
                this._loadProductPresentations(oProduct.SKUID);
            }
        },

        // ====================================================================
        // LÓGICA DEL MODAL DE DETALLE (CORREGIDO)
        // ====================================================================

        _loadProductPresentations: async function (sSKUID) {
            const oDetailModel = this.getView().getModel("detailView");
            oDetailModel.setProperty("/loadingPresentations", true);
            oDetailModel.setProperty("/errorPresentations", "");

            try {
                const aPresentations = await this._callApi('/ztproducts-presentaciones/productsPresentacionesCRUD', 'POST', {}, {
                    ProcessType: 'GetBySKUID',
                    skuid: sSKUID
                });

                if (!Array.isArray(aPresentations)) {
                    throw new Error("La respuesta de presentaciones no es un array.");
                }

                oDetailModel.setProperty("/presentations", aPresentations);

                if (aPresentations.length > 0) {
                    // ======================================================
                    // INICIO DE LA CORRECCIÓN 2: Sincronizar objeto y clave
                    // ======================================================
                    // Seleccionar la primera presentación por defecto
                    const oFirstPresentation = aPresentations[0];
                    const sFirstKey = oFirstPresentation.IdPresentaOK;

                    oDetailModel.setProperty("/selectedPresentation", oFirstPresentation);
                    oDetailModel.setProperty("/selectedPresentationKey", sFirstKey); // <-- Sincronizar la clave
                    
                    this._loadPresentationFiles(sFirstKey); // Usar la clave
                    // ======================================================
                    // FIN DE LA CORRECCIÓN 2
                    // ======================================================
                } else {
                    // Asegurarse de limpiar si no hay presentaciones
                    oDetailModel.setProperty("/selectedPresentation", null);
                    oDetailModel.setProperty("/selectedPresentationKey", null);
                }

            } catch (oError) {
                oDetailModel.setProperty("/errorPresentations", "Error al cargar presentaciones: " + oError.message);
            } finally {
                oDetailModel.setProperty("/loadingPresentations", false);
            }
        },

        _loadPresentationFiles: async function (sIdPresentaOK) {
            // Esta función ya estaba bien, recibe la clave (string)
            const oDetailModel = this.getView().getModel("detailView");
            oDetailModel.setProperty("/loadingFiles", true);
            oDetailModel.setProperty("/errorFiles", "");
            oDetailModel.setProperty("/files", []); // Limpiar archivos anteriores

            try {
                const aFiles = await this._callApi('/ztproducts-files/productsFilesCRUD', 'POST', {}, {
                    ProcessType: 'GetByIdPresentaOK',
                    idPresentaOK: sIdPresentaOK
                });

                if (!Array.isArray(aFiles)) {
                    throw new Error("La respuesta de archivos no es un array.");
                }

                // Clasificar archivos por tipo
                oDetailModel.setProperty("/files", aFiles);
                oDetailModel.setProperty("/imageFiles", aFiles.filter(f => f.FILETYPE === 'IMG'));
                oDetailModel.setProperty("/pdfFiles", aFiles.filter(f => f.FILETYPE === 'PDF'));
                oDetailModel.setProperty("/docFiles", aFiles.filter(f => f.FILETYPE === 'DOC'));
                oDetailModel.setProperty("/videoFiles", aFiles.filter(f => f.FILETYPE === 'VIDEO'));
                oDetailModel.setProperty("/otherFiles", aFiles.filter(f => f.FILETYPE === 'OTHER'));

            } catch (oError) {
                oDetailModel.setProperty("/errorFiles", "Error al cargar archivos: " + oError.message);
            } finally {
                oDetailModel.setProperty("/loadingFiles", false);
            }
        },

        onEditProduct: function () {
            const oDetailModel = this.getView().getModel("detailView");
            const oCurrentProduct = oDetailModel.getData();
            
            // Crear una copia profunda del producto para la edición
            const oProductCopy = JSON.parse(JSON.stringify(oCurrentProduct));

            oDetailModel.setProperty("/editableProduct", oProductCopy);
            oDetailModel.setProperty("/editing", true);
        },

        onCancelEditProduct: function () {
            const oDetailModel = this.getView().getModel("detailView");
            oDetailModel.setProperty("/editing", false);
            oDetailModel.setProperty("/editableProduct", null);
        },

        onSaveProduct: async function () {
            const oDetailModel = this.getView().getModel("detailView");
            const oEditableProduct = oDetailModel.getProperty("/editableProduct");

            if (!oEditableProduct) {
                MessageBox.error("No hay datos para guardar.");
                return;
            }

            oDetailModel.setProperty("/saving", true);

            try {
                // --- INICIO DE LA CORRECCIÓN ---
                // En lugar de eliminar propiedades, creamos un payload limpio solo con los campos necesarios.
                const payload = {
                    PRODUCTNAME: oEditableProduct.PRODUCTNAME,
                    DESSKU: oEditableProduct.DESSKU,
                    MARCA: oEditableProduct.MARCA,
                    CATEGORIAS: oEditableProduct.CATEGORIAS,
                    IDUNIDADMEDIDA: oEditableProduct.IDUNIDADMEDIDA,
                    BARCODE: oEditableProduct.BARCODE,
                    INFOAD: oEditableProduct.INFOAD
                };

                // Aseguramos que CATEGORIAS se envíe como un string JSON si es un array
                if (Array.isArray(payload.CATEGORIAS)) {
                    payload.CATEGORIAS = JSON.stringify(payload.CATEGORIAS);
                }
                // --- FIN DE LA CORRECCIÓN ---

                const oUpdatedProduct = await this._callApi('/ztproducts/crudProducts', 'POST', payload, {
                    ProcessType: 'UpdateOne',
                    skuid: oEditableProduct.SKUID
                });

                MessageToast.show("Producto actualizado correctamente.");

                // Actualizar el modelo principal y el del detalle
                await this.loadProducts();

                // Actualizamos el modelo del detalle con la información guardada.
                // Es mejor usar el objeto 'editableProduct' que contiene todos los campos,
                // no solo los del payload.
                const oCurrentDetailData = oDetailModel.getData();
                const oNewData = { ...oCurrentDetailData, ...oEditableProduct }; // Mezclamos la data editada
                oDetailModel.setData(oNewData);

                // Salir del modo edición
                oDetailModel.setProperty("/editing", false);
                oDetailModel.setProperty("/editableProduct", null);

            } catch (error) {
                MessageBox.error(`Error al guardar los cambios: ${error.message}`);
            } finally {
                oDetailModel.setProperty("/saving", false);
            }
        },

        // ====================================================================
        // INICIO DE LA CORRECCIÓN 3: Nueva lógica para onPresentationChange
        // ====================================================================
        onPresentationChange: function (oEvent) {
            // 1. Obtener la clave seleccionada
            // (El binding de dos vías en 'selectedPresentationKey' ya actualizó el modelo,
            // pero es más robusto leerlo del parámetro del evento).
            const sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            
            const oDetailModel = this.getView().getModel("detailView");
            const aPresentations = oDetailModel.getProperty("/presentations");
            
            // 2. Encontrar el objeto completo correspondiente a la clave
            const oSelectedPresentation = aPresentations.find(p => p.IdPresentaOK === sSelectedKey);

            if (oSelectedPresentation) {
                // 3. Sincronizar el objeto en el modelo
                oDetailModel.setProperty("/selectedPresentation", oSelectedPresentation);
                
                // 4. Cargar los archivos para la nueva presentación
                // (Ya no necesitamos la línea del "FIX" que tenías,
                // porque la clave y el objeto están desacoplados).
                this._loadPresentationFiles(sSelectedKey);
            }
        },
        // ====================================================================
        // FIN DE LA CORRECCIÓN 3
        // ====================================================================

        onCloseProductDetailDialog: function () {
            this._oProductDetailDialog.close();
        },

        onFilePress: function (oEvent) {
            const oFile = oEvent.getSource().getBindingContext("detailView").getObject();
            if (oFile && oFile.FILE) {
                sap.m.URLHelper.redirect(oFile.FILE, true);
            }
        },

        onToggleProductStatus: function (oEvent) {
            const bState = oEvent.getParameter("state");
            const oDetailModel = this.getView().getModel("detailView");
            const sSKUID = oDetailModel.getProperty("/SKUID");
            const sProductName = oDetailModel.getProperty("/PRODUCTNAME");

            if (!sSKUID) {
                MessageBox.error("No se ha podido identificar el producto (SKUID no encontrado).");
                // Revertir el switch si no hay SKUID
                oEvent.getSource().setState(!bState);
                return;
            }

            const sActionText = bState ? "activar" : "desactivar";
            const sProcessType = bState ? "ActivateOne" : "DeleteLogic";

            MessageBox.confirm(`¿Estás seguro de que deseas ${sActionText} el producto "${sProductName}"?`, {
                title: "Confirmar Cambio de Estado",
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        oDetailModel.setProperty("/loadingPresentations", true); // Reutilizamos el busy indicator
                        try {
                            await this._callApi('/ztproducts/crudProducts', 'POST', {}, {
                                ProcessType: sProcessType,
                                skuid: sSKUID
                            });
                            MessageToast.show(`Producto ${sActionText}do correctamente.`);
                            await this.loadProducts(); // Recargar la lista principal
                            oDetailModel.setProperty("/ACTIVED", bState); // Actualizar el estado en el modelo del diálogo
                        } catch (oError) {
                            MessageBox.error(`Error al ${sActionText} el producto: ${oError.message}`);
                            oEvent.getSource().setState(!bState); // Revertir en caso de error
                        } finally {
                            oDetailModel.setProperty("/loadingPresentations", false);
                        }
                    } else {
                        oEvent.getSource().setState(!bState); // Revertir si el usuario cancela
                    }
                }
            });
        },

        onAddPresentation: function () {
            MessageToast.show("Lógica para añadir presentación pendiente.");
        },

        onEditPresentation: function () {
            MessageToast.show("Lógica para editar presentación pendiente.");
        },

        onDeletePresentation: function () {
            const oDetailModel = this.getView().getModel("detailView");
            const sPresentationName = oDetailModel.getProperty("/selectedPresentation/NOMBREPRESENTACION");
            MessageBox.confirm(`¿Seguro que deseas eliminar la presentación "${sPresentationName}"?`);
        },

        // ====================================================================
        // FORMATTERS (Sin cambios)
        // ====================================================================
        
        formatterIsSelected: function(aSelectedSKUIDs, sSKUID) {
            if (!aSelectedSKUIDs || !sSKUID) {
                return false;
            }
            return aSelectedSKUIDs.indexOf(sSKUID) !== -1;
        },
        
        formatterProductStatusText: function (bActived, bDeleted) {
            let i18n;
            const oDefaultTexts = { deleted: "Eliminado", active: "Activo", inactive: "Inactivo", unknown: "Desconocido" };

            try {
                i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            } catch (e) {
                if (bDeleted === true) return oDefaultTexts.deleted;
                return bActived === true ? oDefaultTexts.active : (bActived === false ? oDefaultTexts.inactive : oDefaultTexts.unknown);
            }
            
            if (bDeleted === true) return i18n.getText("statusDeleted");
            if (bActived === true) return i18n.getText("statusActive");
            if (bActived === false) return i18n.getText("statusInactive");
            return i18n.getText("statusUnknown");
        },
        
        formatterProductStatusState: function (bActived, bDeleted) {
            if (bDeleted === true) return "Error";
            if (bActived === true) return "Success";
            if (bActived === false) return "Warning";
            return "None";
        },
        
        formatterLastActionText: function (aHistory) {
            let i18n;
            const sDefaultNA = "N/A";
            try {
                i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            } catch (e) {
                return sDefaultNA;
            }

            if (!aHistory || aHistory.length === 0) {
                return i18n.getText("statusNA");
            }
            const lastAction = aHistory[aHistory.length - 1];
            return lastAction.action || i18n.getText("statusNA");
        },
        
        formatterLastActionClass: function (aHistory) {
            if (!aHistory || aHistory.length === 0) {
                return "";
            }
            const lastAction = aHistory[aHistory.length - 1];
            return lastAction.action === 'CREATE' ? 'actionCreateTag' : 'actionUpdateTag';
        },
        
        formatterLastActionDetails: function (aHistory) {
            let i18n;
            const sDefaultNA = "N/A";
            try {
                i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            } catch (e) {
                if (!aHistory || aHistory.length === 0) return sDefaultNA;
                const lastAction = aHistory[aHistory.length - 1];
                const user = lastAction.user || sDefaultNA;
                const date = lastAction.date ? new Date(lastAction.date).toLocaleString() : sDefaultNA;
                return `${user} - ${date}`;
            }
            
            if (!aHistory || aHistory.length === 0) {
                return i18n.getText("statusNA") || sDefaultNA;
            }

            const lastAction = aHistory[aHistory.length - 1];
            const user = lastAction.user || i18n.getText("statusNA");
            
            let formattedDate = i18n.getText("statusNA");
            if (lastAction.date) {
                try {
                    const oFormat = DateFormat.getDateTimeInstance({ // CORREGIDO
                        pattern: "dd/MM/yyyy, HH:mm"
                    }); // CORREGIDO
                    formattedDate = oFormat.format(new Date(lastAction.date));
                } catch (e) {
                    formattedDate = lastAction.date || i18n.getText("statusNA") || sDefaultNA;
                }
            }
            
            return `${user} - ${formattedDate}`;
        },
        
        formatterProductStatus: function (bActived, bDeleted) {
            const i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            if (bDeleted === true) {
                return { state: "Error", text: i18n.getText("statusDeleted") };
            }
            if (bActived === true) {
                return { state: "Success", text: i18n.getText("statusActive") };
            }
            if (bActived === false) {
                return { state: "Warning", text: i18n.getText("statusInactive") };
            }
            return { state: "None", text: i18n.getText("statusUnknown") };
        },
        
        formatterCategories: function (aCategories) {
            try {
                const i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
                if (!aCategories || aCategories.length === 0) return i18n.getText("statusNoCategory") || "Sin categoría";
                return aCategories.join(', ');
            } catch (e) {
                if (!aCategories || aCategories.length === 0) return "Sin categoría";
                return aCategories.join(', ');
            }
        },

        formatterDate: function (sDateString) {
            if (!sDateString) {
                const sDefaultNA = "N/A";
                try {
                    return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("statusNA") || sDefaultNA;
                } catch (e) {
                    return sDefaultNA;
                }
            }
            try {
                const oFormat = DateFormat.getDateTimeInstance({
                    pattern: "dd/MM/yyyy, HH:mm" // CORREGIDO
                }); // CORREGIDO
                return oFormat.format(new Date(sDateString)) || sDateString; // CORREGIDO
            } catch (e) {
                return sDateString; // Devolver el string original si el formato falla
            }
        },

        formatterLastAction: function (aHistory) {
            let i18n;
            try {
                i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();
            } catch (e) {
                // Si falla, usar valores por defecto
                return { action: "N/A", user: "N/A", date: null, isCreate: false };
            }
            
            if (!aHistory || aHistory.length === 0) {
                return { action: i18n.getText("statusNA"), user: i18n.getText("statusNA"), date: null, isCreate: false };
            }
            const lastAction = aHistory[aHistory.length - 1];
            
            let formattedDate = null;
            if (lastAction.date) {
                try {
                    const oFormat = DateFormat.getDateTimeInstance({
                        pattern: "dd/MM/yyyy, HH:mm" // CORREGIDO
                    }); // CORREGIDO
                    formattedDate = oFormat.format(new Date(lastAction.date)); // CORREGIDO
                } catch (e) {
                    formattedDate = lastAction.date;
                }
            }
            
            return {
                action: lastAction.action || i18n.getText("statusNA"),
                user: lastAction.user || i18n.getText("statusNA"),
                date: formattedDate,
                isCreate: lastAction.action === 'CREATE'
            };
        }
    });
});