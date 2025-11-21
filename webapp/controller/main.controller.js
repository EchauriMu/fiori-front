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
                totalCount: 0,
                // --- INICIO DE LA CORRECCIÓN: Propiedades para estado de botones ---
                canActivate: false,
                canDeactivate: false,
                isMixedState: false,
                statusButtonText: "Desactivar" // Texto dinámico para el botón activar/desactivar
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
                editableProduct: null, // Copia del producto para edición
                // --- INICIO DE LA CORRECCIÓN: Estado para el Switch de Activo/Inactivo ---
                statusSubmitting: false
                ,
                presentationStatusSubmitting: false, // <-- NUEVO: para el switch de presentación
                 // --- Lista completa de categorías para el MultiComboBox ---
                allCategories: []
            });
            this.getView().setModel(oDetailViewModel, "detailView");

            // Cargar datos de productos
            this.loadProducts();
            // --- INICIO DE LA CORRECCIÓN: Llamar a la carga de categorías ---
            this._loadAllCategories();
            // --- FIN DE LA CORRECCIÓN ---
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
                // --- INICIO DE LA CORRECCIÓN: Adaptar _callApi para la respuesta de categorías ---
                // La API de categorías devuelve los datos en: oJson.data[0].dataRes
                if (oJson && oJson.data && Array.isArray(oJson.data) && oJson.data.length > 0) {
                    const mainResponse = oJson.data[0];
                    if (mainResponse.dataRes && Array.isArray(mainResponse.dataRes)) {
                        console.log("DataRes encontrado en oJson.data[0].dataRes:", mainResponse.dataRes);
                        return mainResponse.dataRes;
                    }
                }
                // --- FIN DE LA CORRECCIÓN ---
                
                console.warn("Estructura de respuesta no esperada, devolviendo JSON completo");
                return oJson; 
                
            } catch (error) {
                console.error(`Error en la llamada ${sRelativeUrl}:`, error);
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        },

        // ====================================================================
        // LÓGICA DE CARGA DE DATOS
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
        
        // --- INICIO DE LA CORRECCIÓN: Cargar categorías ---
        _loadAllCategories: async function () {
            const oDetailModel = this.getView().getModel("detailView");
            console.log("Iniciando carga de categorías...");
            try {
                const aCategories = await this._callApi('/ztcategorias/categoriasCRUD', 'POST', {}, { ProcessType: 'GetAll' });
                console.log("Respuesta de la API de categorías recibida:", aCategories);

                if (!Array.isArray(aCategories)) {
                    console.error("La respuesta de la API de categorías no es un array. Respuesta:", aCategories);
                    throw new Error("La respuesta de la API de categorías no es un array válido.");
                }

                oDetailModel.setProperty("/allCategories", aCategories);
                console.log(`Carga exitosa. Se han asignado ${aCategories.length} categorías al modelo 'detailView>/allCategories'.`);
            } catch (error) {
                // No mostramos un MessageBox para no interrumpir al usuario, solo registramos el error.
                console.error("Error al cargar categorías para el modal de detalle: ", error.message);
            }
        },
        // --- FIN DE LA CORRECCIÓN ---


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
                this.getOwnerComponent().getRouter().navTo("RouteAddProduct");
                return;
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

            let sConfirmText;
            if (sAction === "DELETE") {
                sConfirmText = `¿Estás seguro de que deseas eliminar permanentemente ${iSelectedCount} producto(s)? Esta acción no se puede deshacer.`;
            } else if (sAction === "TOGGLE_ACTIVE") {
                // Usar el texto dinámico del botón para mostrar la acción correcta
                const sButtonText = oViewModel.getProperty("/statusButtonText");
                let sToggleAction = "activar/desactivar";
                if (sButtonText === "Activar") {
                    sToggleAction = "activar";
                } else if (sButtonText === "Desactivar") {
                    sToggleAction = "desactivar";
                }
                sConfirmText = `¿Estás seguro de que deseas ${sToggleAction} ${iSelectedCount} producto(s)?`;
            }

            MessageBox.confirm(sConfirmText, {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: async (sResult) => {
                    if (sResult === MessageBox.Action.OK) {
                        await this._executeAction(sAction, aSelectedSKUIDs);
                    }
                }
            });
        },

        _executeAction: async function(sAction, aSKUIDs) {
            const oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/loading", true);
            oViewModel.setProperty("/error", "");
            
            try {
                for (const sSKUID of aSKUIDs) {
                    if (sAction === "DELETE") { // Borrado físico
                        await this._callApi('/ztproducts/crudProducts', 'POST', null, { ProcessType: 'DeleteHard', skuid: sSKUID });
                    } else if (sAction === "TOGGLE_ACTIVE") {
                        const bCanActivate = oViewModel.getProperty("/canActivate");
                        if (bCanActivate) { // Activar
                            await this._callApi('/ztproducts/crudProducts', 'POST', null, { ProcessType: 'ActivateOne', skuid: sSKUID });
                        } else { // Desactivar (borrado lógico)
                            await this._callApi('/ztproducts/crudProducts', 'POST', null, { ProcessType: 'DeleteLogic', skuid: sSKUID });
                        }
                    }
                }
                
                const sSuccessMessage = sAction === "DELETE" ? "eliminado(s)" : "procesado(s)";
                MessageToast.show(`${aSKUIDs.length} producto(s) ${sSuccessMessage} exitosamente.`);
                
            } catch (oError) {
                oViewModel.setProperty("/error", `Error al ejecutar la acción '${sAction}'. Detalle: ${oError.message}`);
            } finally {
                await this.loadProducts(); // Recargar la tabla
                oViewModel.setProperty("/loading", false);
            }
        },

        onSelectionChange: function (oEvent) {
            const oTable = oEvent.getSource();
            const aSelectedItems = oTable.getSelectedItems();
            const oViewModel = this.getView().getModel("view");

            // Obtenemos los SKUIDs de los items seleccionados
            const aSelectedSKUIDs = aSelectedItems.map(oItem => {
                const oContext = oItem.getBindingContext("view");
                return oContext ? oContext.getProperty("SKUID") : null;
            }).filter(sSKUID => sSKUID !== null);

            oViewModel.setProperty("/selectedSKUIDs", aSelectedSKUIDs);
            this._updateButtonStates();
        },


        // --- INICIO DE LA CORRECCIÓN: Nueva función para actualizar estado de botones ---
        _updateButtonStates: function() {
            const oViewModel = this.getView().getModel("view");
            const aSelectedSKUIDs = oViewModel.getProperty("/selectedSKUIDs");
            const aAllProducts = oViewModel.getProperty("/products");

            if (aSelectedSKUIDs.length === 0) {
                oViewModel.setProperty("/canActivate", false);
                oViewModel.setProperty("/canDeactivate", false);
                oViewModel.setProperty("/isMixedState", false);
                oViewModel.setProperty("/statusButtonText", "Desactivar");
                return;
            }

            // Selecciona todos los productos (incluyendo eliminados)
            const aSelectedProducts = aAllProducts.filter(p => aSelectedSKUIDs.includes(p.SKUID));
            const iCount = aSelectedProducts.length;
            const iActiveCount = aSelectedProducts.filter(p => p.ACTIVED === true && p.DELETED !== true).length;
            const iInactiveCount = aSelectedProducts.filter(p => p.ACTIVED === false && p.DELETED !== true).length;
            const iDeletedCount = aSelectedProducts.filter(p => p.DELETED === true).length;

            let bCanActivate = false;
            let bCanDeactivate = false;
            let bIsMixedState = false;
            let sButtonText = "Desactivar";

            if (iCount === 1) {
                // Si solo hay un producto seleccionado
                const prod = aSelectedProducts[0];
                if (prod.DELETED === true) {
                    bCanActivate = true;
                    bCanDeactivate = false;
                    bIsMixedState = false;
                    sButtonText = "Activar";
                } else if (prod.ACTIVED === false) {
                    bCanActivate = true;
                    bCanDeactivate = false;
                    bIsMixedState = false;
                    sButtonText = "Activar";
                } else {
                    bCanActivate = false;
                    bCanDeactivate = true;
                    bIsMixedState = false;
                    sButtonText = "Desactivar";
                }
            } else if (iCount > 1) {
                if (iDeletedCount === iCount) {
                    // Todos eliminados
                    bCanActivate = true;
                    bCanDeactivate = false;
                    bIsMixedState = false;
                    sButtonText = "Activar";
                } else if (iActiveCount === iCount) {
                    // Todos activos (no eliminados)
                    bCanDeactivate = true;
                    sButtonText = "Desactivar";
                } else if (iInactiveCount === iCount) {
                    // Todos inactivos (no eliminados)
                    bCanActivate = true;
                    sButtonText = "Activar";
                } else {
                    // Mezcla
                    bIsMixedState = true;
                    sButtonText = "Activar/Desactivar";
                }
            }

            oViewModel.setProperty("/canActivate", bCanActivate);
            oViewModel.setProperty("/canDeactivate", bCanDeactivate);
            oViewModel.setProperty("/isMixedState", bIsMixedState);
            oViewModel.setProperty("/statusButtonText", sButtonText);
        },
        
        onRowClick: async function (oEvent) {
            const oProductContext = oEvent.getSource().getBindingContext("view");
            if (!oProductContext) return;
            // La única responsabilidad de onRowClick es abrir el modal.
            this._openDetailModal(oProductContext);
        },

        // Función auxiliar para mantener onRowClick más limpio
        _openDetailModal: async function(oProductContext) {
            const oProduct = oProductContext.getObject();
            const oDetailModel = this.getView().getModel("detailView");

            if (oProduct) {

            // --- INICIO DE LA CORRECCIÓN: No usar setData para no borrar 'allCategories' ---
            // 1. Limpiar y establecer datos del producto principal usando setProperty
            console.log("onRowClick: Abriendo modal para el producto:", oProduct);
            console.log("onRowClick: 'allCategories' ANTES de actualizar el modelo:", oDetailModel.getProperty("/allCategories").length, "categorías.");

            // Copiamos las propiedades del producto al modelo una por una
            for (const key in oProduct) {
                if (Object.prototype.hasOwnProperty.call(oProduct, key)) {
                    oDetailModel.setProperty(`/${key}`, oProduct[key]);
                }
            }
            // --- FIN DE LA CORRECCIÓN ---
                
            // 2. Reiniciar explícitamente las propiedades del modal
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

                console.log("onRowClick: 'allCategories' DESPUÉS de actualizar el modelo:", oDetailModel.getProperty("/allCategories").length, "categorías.");


                // 3. Abrir el Dialog
                if (!this._oProductDetailDialog) {
                    this._oProductDetailDialog = await Fragment.load({
                        id: this.getView().getId(),
                        name: "com.invertions.sapfiorimodinv.view.fragments.modalProductos",
                        controller: this
                    });
                    this.getView().addDependent(this._oProductDetailDialog);
                }
                this._oProductDetailDialog.open();

                // 4. Cargar datos secundarios (presentaciones)
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
            console.log("onEditProduct: Producto actual antes de editar:", oCurrentProduct);
            
            // Crear una copia profunda del producto para la edición.
            const oProductCopy = JSON.parse(JSON.stringify(oCurrentProduct));

            // --- INICIO DE LA CORRECCIÓN: Asegurar que CATEGORIAS sea un array ---
            // El MultiComboBox espera un array de strings para 'selectedKeys'.
            // La data del producto puede tener CATEGORIAS como un string JSON "[]" o "[\"CAT1\", \"CAT2\"]".
            // Forzamos la conversión si es un string, sin importar si está vacío o no.
            console.log(`onEditProduct: Tipo de 'CATEGORIAS' es '${typeof oProductCopy.CATEGORIAS}'. Valor:`, oProductCopy.CATEGORIAS);
            if (typeof oProductCopy.CATEGORIAS === 'string') {
                try {
                    oProductCopy.CATEGORIAS = JSON.parse(oProductCopy.CATEGORIAS);
                    console.log("onEditProduct: 'CATEGORIAS' parseado a array:", oProductCopy.CATEGORIAS);
                } catch (e) {
                    console.warn("onEditProduct: No se pudo parsear 'CATEGORIAS' como JSON. Se usará un array vacío. Valor original:", oProductCopy.CATEGORIAS);
                    oProductCopy.CATEGORIAS = []; // Fallback a un array vacío si el parseo falla
                }
            } else if (!Array.isArray(oProductCopy.CATEGORIAS)) {
                console.warn("onEditProduct: 'CATEGORIAS' no es un string ni un array. Se establecerá como array vacío. Valor original:", oProductCopy.CATEGORIAS);
                oProductCopy.CATEGORIAS = []; // Si no es string ni array, lo inicializamos vacío.
            }
            // --- FIN DE LA CORRECCIÓN ---

            oDetailModel.setProperty("/editableProduct", oProductCopy);
            console.log("onEditProduct: 'editableProduct' establecido en el modelo:", oProductCopy);
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

            // --- INICIO DE LA CORRECCIÓN: Bloquear el Switch durante la llamada ---
            oDetailModel.setProperty("/statusSubmitting", true);
            // --- FIN DE LA CORRECCIÓN ---

            MessageBox.confirm(`¿Estás seguro de que deseas ${sActionText} el producto "${sProductName}"?`, {
                title: "Confirmar Cambio de Estado",
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
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
                            // --- INICIO DE LA CORRECCIÓN: Desbloquear el Switch ---
                            oDetailModel.setProperty("/statusSubmitting", false);
                        }
                    } else {
                        oEvent.getSource().setState(!bState); // Revertir si el usuario cancela
                    }
                }
            });
        },

        onTogglePresentationStatus: function (oEvent) {
            const bState = oEvent.getParameter("state");
            const oDetailModel = this.getView().getModel("detailView");
            const oPresentation = oDetailModel.getProperty("/selectedPresentation");

            if (!oPresentation || !oPresentation.IdPresentaOK) {
                MessageBox.error("No se ha podido identificar la presentación seleccionada.");
                oEvent.getSource().setState(!bState); // Revertir el switch
                return;
            }

            const sPresentationId = oPresentation.IdPresentaOK;
            const sPresentationName = oPresentation.NOMBREPRESENTACION;
            const sActionText = bState ? "activar" : "desactivar";
            
            // CORRECCIÓN FINAL: El backend no tiene 'DeactivateOne'.
            // Para activar, usamos 'ActivateOne'.
            // Para desactivar, usamos 'UpdateOne' y enviamos el nuevo estado en el cuerpo (payload).
            // Esto evita usar 'DeleteLogic', que oculta la presentación.
            const sProcessType = bState ? "ActivateOne" : "UpdateOne";

            oDetailModel.setProperty("/presentationStatusSubmitting", true); // Bloquear switch

            MessageBox.confirm(`¿Estás seguro de que deseas ${sActionText} la presentación "${sPresentationName}"?`, {
                title: "Confirmar Cambio de Estado",
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        try {
                            // Si estamos desactivando, preparamos el payload. Si activamos, el cuerpo va vacío.
                            const payload = bState ? {} : { ACTIVED: false };

                            await this._callApi('/ztproducts-presentaciones/productsPresentacionesCRUD', 'POST', payload, {
                                ProcessType: sProcessType,
                                // El parámetro debe ser 'idpresentaok' en minúsculas, como en otras llamadas a esta API.
                                idpresentaok: sPresentationId
                            });

                            MessageToast.show(`Presentación ${sActionText}da correctamente.`);
                            
                            // 1. Actualizar el estado en el modelo del diálogo para reflejar el cambio inmediato.
                            oDetailModel.setProperty("/selectedPresentation/ACTIVED", bState);
                            // Si se activa, nos aseguramos que DELETED sea false.
                            // Si se desactiva, nos aseguramos que DELETED sea false también, para que no se oculte.
                            if (bState) {
                                oDetailModel.setProperty("/selectedPresentation/DELETED", false);
                            } else {
                                oDetailModel.setProperty("/selectedPresentation/DELETED", false);
                            }

                            // 2. Recargar las presentaciones para asegurar que la lista está sincronizada con el backend.
                            const sSKUID = oDetailModel.getProperty("/SKUID");
                            this._loadProductPresentations(sSKUID);

                        } catch (oError) {
                            MessageBox.error(`Error al ${sActionText} la presentación: ${oError.message}`);
                            oEvent.getSource().setState(!bState); // Revertir en caso de error
                        } finally {
                            oDetailModel.setProperty("/presentationStatusSubmitting", false); // Desbloquear switch
                        }
                    } else {
                        oEvent.getSource().setState(!bState); // Revertir si el usuario cancela
                        oDetailModel.setProperty("/presentationStatusSubmitting", false); // Desbloquear switch
                    }
                }
            });
        },

        onAddPresentation: function (oEvent) {
            console.log("onAddPresentation: Botón 'Insertar' presionado.");

            const oDetailModel = this.getView().getModel("detailView");
            console.log("onAddPresentation: Modelo 'detailView' obtenido:", oDetailModel.getData());

            const sSKUID = oDetailModel.getProperty("/SKUID");
            console.log("onAddPresentation: SKUID obtenido del modelo:", sSKUID);

            if (sSKUID) {
                console.log("onAddPresentation: SKUID válido encontrado. Navegando a 'RouteAddPresentation' con skuid:", sSKUID);
                // Cerramos el diálogo actual y navegamos a la nueva vista
                this.onCloseProductDetailDialog();
                this.getOwnerComponent().getRouter().navTo("RouteAddPresentation", { skuid: sSKUID });
            } else {
                console.error("onAddPresentation: No se encontró un SKUID válido en el modelo 'detailView'. No se puede navegar.");
                MessageToast.show("Error: No se pudo obtener el SKUID del producto para añadir la presentación.");
            }
        },

        onEditPresentation: function (oEvent) {
            const oDetailModel = this.getView().getModel("detailView");
            const sSKU = oDetailModel.getProperty("/SKUID");
            // Usamos 'selectedPresentationKey' que ya está bindeado al Select
            const sPresentationId = oDetailModel.getProperty("/selectedPresentationKey");

            if (!sSKU || !sPresentationId) {
                MessageToast.show("Por favor, seleccione una presentación para poder editarla.");
                return;
            }

            // Navegar a la nueva ruta de edición, pasando los parámetros
            this.getOwnerComponent().getRouter().navTo("RouteEditPresentation", {
                skuid: sSKU,
                presentationId: sPresentationId
            });

            // Cerramos el diálogo de detalles después de navegar para una mejor experiencia de usuario
            if (this._oProductDetailDialog) {
                this._oProductDetailDialog.close();
            }
        },

        onDeletePresentation: function (oEvent) {
            const oDetailModel = this.getView().getModel("detailView");
            const sSKUID = oDetailModel.getProperty("/SKUID");
            const sPresentationId = oDetailModel.getProperty("/selectedPresentationKey");
            const sPresentationName = oDetailModel.getProperty("/selectedPresentation/NOMBREPRESENTACION");

            if (!sPresentationId) {
                MessageToast.show("Por favor, seleccione una presentación para eliminar.");
                return;
            }

            MessageBox.confirm(`¿Seguro que deseas eliminar la presentación "${sPresentationName || sPresentationId}"?`, {
                title: "Confirmar Eliminación",
                onClose: async (sAction) => {
                    if (sAction === MessageBox.Action.OK) {
                        oDetailModel.setProperty("/loadingPresentations", true);
                        try {
                            // CORRECCIÓN: Usar el ProcessType para borrado individual ('DeleteHard')
                            // y pasar el ID como parámetro, no en el cuerpo de la petición.
                            await this._callApi('/ztproducts-presentaciones/productsPresentacionesCRUD', 'POST', 
                            {}, // El cuerpo de la petición va vacío para un borrado individual
                            {
                                ProcessType: 'DeleteHard',
                                idpresentaok: sPresentationId
                            });

                            MessageToast.show("Presentación eliminada correctamente.");
                            // Recargar las presentaciones del producto actual
                            this._loadProductPresentations(sSKUID);

                        } catch (error) {
                            MessageBox.error("Error al eliminar la presentación: " + error.message);
                        } finally {
                            oDetailModel.setProperty("/loadingPresentations", false);
                        }
                    }
                }
            });
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
            if (bActived === false) return "Error"; // CORRECCIÓN: Cambiado de 'Warning' a 'Error' para que se vea rojo.
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