/**
 * @fileOverview Controlador para crear nuevas promociones
 * @author LAURA PANIAGUA
 * @author ALBERTO PARDO
 */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/core/format/DateFormat"
], function (Controller, JSONModel, MessageBox, MessageToast, Fragment, DateFormat) {
    "use strict";

    const BASE_URL = "http://localhost:3033/api";

    return Controller.extend("com.invertions.sapfiorimodinv.controller.promociones.CrearPromocion", {

        /* ================================================================================
         * LIFECYCLE METHODS
         * Métodos del ciclo de vida del controlador
         * @author LAURA PANIAGUA
         * @author ALBERTO PARDO
         * ================================================================================ */

        onInit: function () {
            this._initializeModel();
            
            this.getOwnerComponent().getRouter().getRoute("RouteCrearPromocion")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        /* -------------------------------------------------------------------------------- */

        _onRouteMatched: function(oEvent) {
            this._cleanupFilterModelState();
            this._initializeModel();
            this._initializeNavContainer();
        },

        /* -------------------------------------------------------------------------------- */

        _initializeNavContainer: function() {
            const oNavContainer = this.getView().byId("stepNavContainer");
            const oFirstPage = this.getView().byId("InfoStepPage");
            
            if (oNavContainer && oFirstPage) {
                oNavContainer.removeAllPages();
                oNavContainer.addPage(oFirstPage);
                oNavContainer.addPage(this.getView().byId("ProductsStepPage"));
                oNavContainer.addPage(this.getView().byId("ReviewStepPage"));
                oNavContainer.to(oFirstPage);
            }
        },

        /* -------------------------------------------------------------------------------- */

        onNavBack: function () {
            this._cleanupFilterModelState();
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RoutePromociones", {}, true);
        },

        /* -------------------------------------------------------------------------------- */

        _cleanupFilterModelState: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            if (oFilterModel) {
                oFilterModel.setProperty("/addedPresentaciones", {});
                oFilterModel.setProperty("/selectedPresentaciones", {});
                oFilterModel.setProperty("/hasTemporarySelections", false);
                oFilterModel.setProperty("/currentPage", 1);
                oFilterModel.setProperty("/totalPages", 1);
            }
            
            const oCreatePromo = this.getView().getModel("createPromo");
            if (oCreatePromo) {
                oCreatePromo.setProperty("/selectedPresentaciones", []);
                oCreatePromo.setProperty("/groupedSelectedProducts", []);
                oCreatePromo.setProperty("/paginatedGroupedProducts", []);
                oCreatePromo.setProperty("/groupedPagination", {
                    currentPage: 1,
                    itemsPerPage: 5,
                    totalPages: 1,
                    totalItems: 0
                });
            }
        },

        /* -------------------------------------------------------------------------------- */

        _initializeModel: function () {
            const today = new Date();
            const oneMonthLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
            
            const oInitialData = {
                // Información general
                plantilla: "",
                titulo: "",
                descripcion: "",
                fechaInicio: this._formatDateForInput(today),
                fechaFin: this._formatDateForInput(oneMonthLater),
                
                // Descuento
                tipoDescuento: "PORCENTAJE",
                descuentoPorcentaje: 10,
                descuentoMonto: 0,
                
                // Reglas
                permiteAcumulacion: false,
                limiteUsos: null,
                
                // Productos/Presentaciones
                selectedPresentaciones: [],
                groupedSelectedProducts: [],
                paginatedGroupedProducts: [],
                
                // Navegación de pasos
                currentStep: 1,
                currentStepTitle: "Información General y Descuento",
                progressPercent: 33,
                
                // Paginación de productos agrupados
                groupedPagination: {
                    currentPage: 1,
                    itemsPerPage: 5,
                    totalPages: 1,
                    totalItems: 0
                },
                
                // Paginación de productos seleccionados (paso 4)
                paginationSelected: {
                    currentPage: 1,
                    itemsPerPage: 5,
                    totalPages: 1,
                    totalItems: 0
                },
                
                // Estado
                errors: {}
            };

            const oModel = new JSONModel(JSON.parse(JSON.stringify(oInitialData)));
            this.getView().setModel(oModel, "createPromo");
        },

        /* ================================================================================
         * API METHODS - CRUD OPERATIONS
         * Métodos para llamadas a la API y operaciones CRUD
         * @author LAURA PANIAGUA
         * @author ALBERTO PARDO
         * ================================================================================ */

        _callApi: async function (sRelativeUrl, sMethod, oData = null, oParams = {}) {
            const dbServer = sessionStorage.getItem('DBServer');
            if (dbServer === 'CosmosDB') {
                oParams.DBServer = 'CosmosDB';
            }

            const oAppViewModel = this.getOwnerComponent().getModel("appView");
            const loggedUser = oAppViewModel.getProperty("/currentUser/USERNAME") || sessionStorage.getItem('LoggedUser');
            
            if (loggedUser && !oParams.LoggedUser) {
                oParams.LoggedUser = loggedUser;
            }

            const sQueryString = new URLSearchParams(oParams).toString();
            const sFullUrl = `${BASE_URL}${sRelativeUrl}?${sQueryString}`;
            
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
                return oJson;
                
            } catch (error) {
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        },

        /* ================================================================================
         * FORMATTERS & HELPERS
         * Formateadores y funciones auxiliares
         * @author LAURA PANIAGUA
         * @author ALBERTO PARDO
         * ================================================================================ */

        _formatDateForInput: function(oDate) {
            const year = oDate.getFullYear();
            const month = String(oDate.getMonth() + 1).padStart(2, '0');
            const day = String(oDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        /* -------------------------------------------------------------------------------- */

        formatDate: function(sDate) {
            if (!sDate) return "N/A";
            try {
                const oDate = new Date(sDate);
                const oDateFormat = DateFormat.getDateInstance({
                    pattern: "dd/MM/yyyy"
                });
                return oDateFormat.format(oDate);
            } catch (e) {
                return "Fecha inválida";
            }
        },

        /* ================================================================================
         * UI EVENT HANDLERS
         * Manejadores de eventos de la interfaz de usuario
         * @author LAURA PANIAGUA
         * @author ALBERTO PARDO
         * ================================================================================ */

        onPlantillaChange: function(oEvent) {
            const sPlantilla = oEvent.getParameter("selectedItem").getKey();
            const oModel = this.getView().getModel("createPromo");
            
            // Plantillas predefinidas
            const oPlantillas = {
                "black-friday": {
                    titulo: "Black Friday 2025 - Ofertas Especiales",
                    descripcion: "Descuentos increíbles por tiempo limitado. ¡No te lo pierdas!",
                    descuentoPorcentaje: 25
                },
                "navidad": {
                    titulo: "Promoción Navideña 2025",
                    descripcion: "Regalos perfectos con precios especiales para esta Navidad.",
                    descuentoPorcentaje: 20
                },
                "flash-sale": {
                    titulo: "Flash Sale - 24 Horas",
                    descripcion: "Ofertas relámpago por tiempo muy limitado.",
                    descuentoPorcentaje: 30
                },
                "lanzamiento": {
                    titulo: "Promoción de Lanzamiento",
                    descripcion: "Celebra el lanzamiento de nuevos productos con ofertas especiales.",
                    descuentoPorcentaje: 15
                }
            };

            if (sPlantilla && oPlantillas[sPlantilla]) {
                const oPlantillaData = oPlantillas[sPlantilla];
                oModel.setProperty("/titulo", oPlantillaData.titulo);
                oModel.setProperty("/descripcion", oPlantillaData.descripcion);
                oModel.setProperty("/descuentoPorcentaje", oPlantillaData.descuentoPorcentaje);
            }
        },

        onTipoDescuentoChange: function(oEvent) {
            const oModel = this.getView().getModel("createPromo");
            oModel.setProperty("/errors/descuentoPorcentaje", null);
            oModel.setProperty("/errors/descuentoMonto", null);
        },

        onPromoInputChange: function(oEvent) {
            const oInput = oEvent.getSource();
            let sFieldId;
            
            if (oInput.getId().includes("tituloInput")) {
                sFieldId = "titulo";
            } else {
                const sPath = oInput.getBindingPath("value");
                if (sPath) {
                    sFieldId = sPath.replace("createPromo>/", "").replace("/", "");
                }
            }
            
            if (sFieldId) {
                const oModel = this.getView().getModel("createPromo");
                if (oModel.getProperty(`/errors/${sFieldId}`)) {
                    oModel.setProperty(`/errors/${sFieldId}`, null);
                }
            }
        },

        onRemovePresentacion: function(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem.getBindingContext("createPromo");
            const oPresentacion = oContext.getObject();

            const oModel = this.getView().getModel("createPromo");
            const aPresentaciones = oModel.getProperty("/selectedPresentaciones");
            
            // Encontrar y eliminar la presentación
            const iIndex = aPresentaciones.findIndex(p => p.IdPresentaOK === oPresentacion.IdPresentaOK);
            if (iIndex > -1) {
                aPresentaciones.splice(iIndex, 1);
                oModel.setProperty("/selectedPresentaciones", aPresentaciones);
                
                // Actualizar agrupación
                this._updateGroupedSelectedProducts();
            }
        },

        /* ================================================================================
         * WIZARD NAVIGATION & STEP VALIDATION
         * Navegación del asistente y validación de pasos
         * @author LAURA PANIAGUA
         * @author ALBERTO PARDO
         * ================================================================================ */

        onNextStep: async function() {
            const oModel = this.getView().getModel("createPromo");
            const currentStep = oModel.getProperty("/currentStep");
            
            // Validar el paso actual antes de avanzar
            let isValid = false;
            if (currentStep === 1) {
                isValid = this._validateStep1() && this._validateStep2();
            } else if (currentStep === 2) {
                isValid = this._validateStep3();
            }
            
            if (!isValid) {
                return; // No avanzar si la validación falla
            }
            
            if (currentStep >= 3) return; // Ya estamos en el último paso
            
            const oNavContainer = this.getView().byId("stepNavContainer");
            let nextPage;
            let stepTitle;
            let progressPercent;
            
            if (currentStep === 1) {
                // Inicializar filterModel antes de ir al paso 2
                this._initializeFilterModel();
                await this._loadProductsForDialog();
                
                nextPage = this.getView().byId("ProductsStepPage");
                stepTitle = "Productos y Presentaciones";
                progressPercent = 66;
            } else if (currentStep === 2) {
                // Transferir presentaciones agregadas al modelo createPromo
                this._transferAddedPresentationsToModel();
                
                nextPage = this.getView().byId("ReviewStepPage");
                stepTitle = "Revisión Final";
                progressPercent = 100;
            }
            
            if (nextPage && oNavContainer) {
                oNavContainer.to(nextPage);
                oModel.setProperty("/currentStep", currentStep + 1);
                oModel.setProperty("/currentStepTitle", stepTitle);
                oModel.setProperty("/progressPercent", progressPercent);
                oModel.refresh(true); // Force refresh del modelo
            }
        },

        onPreviousStep: function() {
            const oModel = this.getView().getModel("createPromo");
            const currentStep = oModel.getProperty("/currentStep");
            
            if (currentStep <= 1) return;
            
            const oNavContainer = this.getView().byId("stepNavContainer");
            let prevPage;
            let stepTitle;
            let progressPercent;
            
            if (currentStep === 2) {
                prevPage = this.getView().byId("InfoStepPage");
                stepTitle = "Información General y Descuento";
                progressPercent = 33;
            } else if (currentStep === 3) {
                prevPage = this.getView().byId("ProductsStepPage");
                stepTitle = "Productos y Presentaciones";
                progressPercent = 66;
            }
            
            if (prevPage && oNavContainer) {
                oNavContainer.backToPage(prevPage);
                oModel.setProperty("/currentStep", currentStep - 1);
                oModel.setProperty("/currentStepTitle", stepTitle);
                oModel.setProperty("/progressPercent", progressPercent);
                oModel.refresh(true); // Force refresh del modelo
            }
        },



        _validateStep1: function() {
            const oModel = this.getView().getModel("createPromo");
            const oData = oModel.getProperty("/");
            const oErrors = {};
            let bIsValid = true;

            if (!oData.titulo || oData.titulo.trim() === "") { 
                oErrors.titulo = "Error"; 
                bIsValid = false; 
            }
            if (!oData.descripcion || oData.descripcion.trim() === "") { 
                oErrors.descripcion = "Error"; 
                bIsValid = false; 
            }
            if (!oData.fechaInicio) { 
                oErrors.fechaInicio = "Error"; 
                bIsValid = false; 
            }
            if (!oData.fechaFin) { 
                oErrors.fechaFin = "Error"; 
                bIsValid = false; 
            }

            // Validar que la fecha de fin sea posterior a la de inicio
            if (oData.fechaInicio && oData.fechaFin) {
                const dInicio = new Date(oData.fechaInicio);
                const dFin = new Date(oData.fechaFin);
                if (dFin <= dInicio) {
                    oErrors.fechaFin = "Error";
                    bIsValid = false;
                }
            }

            oModel.setProperty("/errors", oErrors);
            return bIsValid;
        },

        _validateStep2: function() {
            const oModel = this.getView().getModel("createPromo");
            const oData = oModel.getProperty("/");
            const oErrors = {};
            let bIsValid = true;

            if (oData.tipoDescuento === "PORCENTAJE") {
                if (!oData.descuentoPorcentaje || oData.descuentoPorcentaje <= 0 || oData.descuentoPorcentaje > 100) {
                    oErrors.descuentoPorcentaje = "Error";
                    bIsValid = false;
                }
            } else if (oData.tipoDescuento === "MONTO_FIJO") {
                if (!oData.descuentoMonto || oData.descuentoMonto <= 0) {
                    oErrors.descuentoMonto = "Error";
                    bIsValid = false;
                }
            }

            oModel.setProperty("/errors", oErrors);
            return bIsValid;
        },

        _validateStep3: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            
            if (Object.keys(oAddedPresentaciones).length === 0) {
                MessageBox.error("Debe agregar al menos una presentación para la promoción. Selecciona presentaciones y haz clic en 'Agregar'.");
                return false;
            }
            
            return true;
        },

        onToggleGroupedProduct: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("createPromo");
            const sPath = oContext.getPath();
            const oCreatePromo = this.getView().getModel("createPromo");
            const bExpanded = oCreatePromo.getProperty(sPath + "/expanded");
            
            oCreatePromo.setProperty(sPath + "/expanded", !bExpanded);
        },

        onSelectedItemsPerPageChange: function(oEvent) {
            const oCreatePromo = this.getView().getModel("createPromo");
            const itemsPerPage = parseInt(oEvent.getParameter("selectedItem").getKey());
            
            oCreatePromo.setProperty("/paginationSelected/itemsPerPage", itemsPerPage);
            oCreatePromo.setProperty("/paginationSelected/currentPage", 1);
            
            this._updateSelectedPagination();
        },

        onSelectedPreviousPage: function() {
            const oCreatePromo = this.getView().getModel("createPromo");
            const currentPage = oCreatePromo.getProperty("/paginationSelected/currentPage");
            
            if (currentPage > 1) {
                oCreatePromo.setProperty("/paginationSelected/currentPage", currentPage - 1);
                this._updateSelectedPagination();
            }
        },

        onSelectedNextPage: function() {
            const oCreatePromo = this.getView().getModel("createPromo");
            const currentPage = oCreatePromo.getProperty("/paginationSelected/currentPage");
            const totalPages = oCreatePromo.getProperty("/paginationSelected/totalPages");
            
            if (currentPage < totalPages) {
                oCreatePromo.setProperty("/paginationSelected/currentPage", currentPage + 1);
                this._updateSelectedPagination();
            }
        },

        onSavePromotion: async function () {
            // Validar todos los pasos
            if (!this._validateStep1()) {
                this.getView().byId("createPromoWizard").goToStep(this.getView().byId("InfoStep"));
                return;
            }

            if (!this._validateStep2()) {
                this.getView().byId("createPromoWizard").goToStep(this.getView().byId("DiscountStep"));
                return;
            }

            if (!this._validateStep3()) {
                this.getView().byId("createPromoWizard").goToStep(this.getView().byId("ProductsStep"));
                return;
            }

            const oModel = this.getView().getModel("createPromo");
            const oData = oModel.getProperty("/");

            // Generar ID único para la promoción
            const timestamp = Date.now();
            const shortId = timestamp.toString().slice(-6);
            const idPromoOK = `PROMO-${shortId}`;

            // Preparar presentaciones aplicables
            const presentacionesAplicables = oData.selectedPresentaciones
                .filter(presentacion => presentacion && presentacion.IdPresentaOK)
                .map(presentacion => ({
                    IdPresentaOK: presentacion.IdPresentaOK,
                    SKUID: presentacion.producto?.SKUID || presentacion.SKUID || '',
                    NombreProducto: presentacion.producto?.PRODUCTNAME || '',
                    NombrePresentacion: presentacion.NOMBREPRESENTACION || '',
                    PrecioOriginal: presentacion.Precio || 0
                }));

            // Preparar payload
            const oPromoPayload = {
                IdPromoOK: idPromoOK,
                Titulo: oData.titulo,
                Descripcion: oData.descripcion,
                FechaIni: new Date(oData.fechaInicio).toISOString(),
                FechaFin: new Date(oData.fechaFin).toISOString(),
                ProductosAplicables: presentacionesAplicables,
                TipoDescuento: oData.tipoDescuento,
                DescuentoPorcentaje: oData.tipoDescuento === 'PORCENTAJE' ? oData.descuentoPorcentaje : 0,
                DescuentoMonto: oData.tipoDescuento === 'MONTO_FIJO' ? oData.descuentoMonto : 0,
                PermiteAcumulacion: oData.permiteAcumulacion || false,
                LimiteUsos: oData.limiteUsos || null,
                ACTIVED: true,
                DELETED: false
            };

            try {
                const oResponse = await this._callApi('/ztpromociones/crudPromociones', 'POST', oPromoPayload, {
                    ProcessType: 'AddOne',
                    DBServer: 'MongoDB'
                });
                
                // Establecer flag para que Promociones recargue datos
                const oAppView = this.getOwnerComponent().getModel("appView");
                if (oAppView) {
                    oAppView.setProperty("/needsPromotionsReload", true);
                }
                
                MessageBox.success(`Promoción "${oData.titulo}" creada exitosamente.`, {
                    onClose: () => this.onNavBack()
                });
            } catch (error) {
                MessageBox.error("Error al crear la promoción: " + error.message);
            }
        },

        /* ================================================================================
         * BUSINESS LOGIC - DATA PROCESSING & FILTERS
         * Lógica de negocio, procesamiento de datos y filtros
         * @author LAURA PANIAGUA
         * @author ALBERTO PARDO
         * ================================================================================ */

        _transferAddedPresentationsToModel: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oCreatePromo = this.getView().getModel("createPromo");
            const addedPresentaciones = oFilterModel.getProperty("/addedPresentaciones");
            const allProducts = oFilterModel.getProperty("/allProducts");
            const productPresentaciones = oFilterModel.getProperty("/productPresentaciones");
            
            const selectedPresentaciones = [];
            
            Object.keys(addedPresentaciones).forEach(presId => {
                // Buscar en qué producto está esta presentación
                for (const skuid in productPresentaciones) {
                    const presentacionesArray = productPresentaciones[skuid] || [];
                    const presentacion = presentacionesArray.find(p => p.IdPresentaOK === presId);
                    
                    if (presentacion) {
                        const product = allProducts.find(p => p.SKUID === skuid);
                        selectedPresentaciones.push({
                            IdPresentaOK: presentacion.IdPresentaOK,
                            SKUID: skuid,
                            NOMBREPRESENTACION: presentacion.NOMBREPRESENTACION,
                            Precio: presentacion.Precio,
                            NombreProducto: product ? product.PRODUCTNAME : ""
                        });
                        break;
                    }
                }
            });
            
            oCreatePromo.setProperty("/selectedPresentaciones", selectedPresentaciones);
            this._updateGroupedSelectedProducts();
        },

        _updateGroupedSelectedProducts: function() {
            const oCreatePromo = this.getView().getModel("createPromo");
            const selectedPresentaciones = oCreatePromo.getProperty("/selectedPresentaciones");
            
            const grouped = new Map();
            
            selectedPresentaciones.forEach(presentacion => {
                if (!grouped.has(presentacion.SKUID)) {
                    grouped.set(presentacion.SKUID, {
                        SKUID: presentacion.SKUID,
                        PRODUCTNAME: presentacion.NombreProducto,
                        NombreProducto: presentacion.NombreProducto,
                        presentaciones: [],
                        expanded: false
                    });
                }
                grouped.get(presentacion.SKUID).presentaciones.push({
                    IdPresentaOK: presentacion.IdPresentaOK,
                    NOMBREPRESENTACION: presentacion.NOMBREPRESENTACION,
                    Precio: presentacion.Precio
                });
            });
            
            const groupedArray = Array.from(grouped.values());
            oCreatePromo.setProperty("/groupedSelectedProducts", groupedArray);
            this._updateSelectedPagination();
        },

        _updateSelectedPagination: function() {
            const oCreatePromo = this.getView().getModel("createPromo");
            const groupedProducts = oCreatePromo.getProperty("/groupedSelectedProducts");
            const pagination = oCreatePromo.getProperty("/paginationSelected");
            const itemsPerPage = pagination.itemsPerPage;
            const currentPage = pagination.currentPage;
            
            const totalItems = groupedProducts.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
            
            // Obtener productos paginados manteniendo el estado expanded
            const currentPaginated = oCreatePromo.getProperty("/paginatedSelectedProducts") || [];
            const paginatedProducts = groupedProducts.slice(startIndex, endIndex).map(product => {
                const existing = currentPaginated.find(p => p.SKUID === product.SKUID);
                return {
                    ...product,
                    expanded: existing ? existing.expanded : false
                };
            });
            
            oCreatePromo.setProperty("/paginatedSelectedProducts", paginatedProducts);
            oCreatePromo.setProperty("/paginationSelected/totalItems", totalItems);
            oCreatePromo.setProperty("/paginationSelected/totalPages", totalPages);
            oCreatePromo.setProperty("/paginationSelected/currentPage", Math.min(currentPage, totalPages || 1));
        },

        _initializeFilterModel: function() {
            const existingModel = this.getView().getModel("filterModel");
            
            // Si existe, solo limpiar las selecciones pero mantener TODO el cache
            if (existingModel) {
                existingModel.setProperty("/selectedPresentaciones", {});
                existingModel.setProperty("/addedPresentaciones", {});
                existingModel.setProperty("/hasTemporarySelections", false);
                existingModel.setProperty("/showOnlyAdded", false);
                return; // Mantener el modelo existente con su cache
            }
            
            // Crear nuevo modelo solo si no existe
            this.getView().setModel(new JSONModel({
                allProducts: [],
                filteredProducts: [],
                paginatedProducts: [],
                selectedPresentaciones: {},
                addedPresentaciones: {},
                alreadyInPromotion: {},
                productPresentaciones: {},
                loading: false,
                errorMessage: "",
                categories: [],
                brands: [],
                searchTerm: "",
                filters: {
                    category: [],
                    brand: [],
                    minPrice: null,
                    maxPrice: null,
                    startDate: null,
                    endDate: null
                },
                pagination: {
                    currentPage: 1,
                    pageSize: 10,
                    totalPages: 1
                },
                sortBy: "default",
                showOnlyAdded: false,
                isManagingSelection: false,
                hasTemporarySelections: false,
                activeFiltersCount: 0,
                filteredProductsCount: 0,
                allPresentacionesLoaded: false
            }), "filterModel");
        },

        // Cargar productos para el diálogo de selección
        _loadProductsForDialog: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            if (!oFilterModel) return;
            
            // Si ya están cargados, no recargar
            const allProducts = oFilterModel.getProperty("/allProducts");
            if (allProducts && allProducts.length > 0) {
                return;
            }
            
            // Evitar llamadas simultáneas
            if (this._isLoadingProducts) {
                return;
            }
            
            this._isLoadingProducts = true;
            oFilterModel.setProperty("/loading", true);
            
            try {
                // Cargar productos
                const productData = await this._callApi('/ztproducts/crudProducts', 'POST', {}, {
                    ProcessType: 'GetAll'
                });
                
                let aProducts = [];
                
                if (productData?.data?.[0]?.dataRes) {
                    aProducts = productData.data[0].dataRes;
                } else if (productData?.value?.[0]?.data?.[0]?.dataRes) {
                    aProducts = productData.value[0].data[0].dataRes;
                } else if (Array.isArray(productData?.data)) {
                    aProducts = productData.data;
                } else if (Array.isArray(productData)) {
                    aProducts = productData;
                }
                
                // Filtrar solo activos
                aProducts = aProducts.filter(p => p.ACTIVED && !p.DELETED);
                
                // Cargar categorías
                const categoryData = await this._callApi('/ztcategorias/categoriasCRUD', 'POST', {}, {
                    ProcessType: 'GetAll',
                    DBServer: 'MongoDB'
                });
                
                let aCategories = [];
                
                if (categoryData?.data?.[0]?.dataRes) {
                    aCategories = categoryData.data[0].dataRes;
                } else if (categoryData?.value?.[0]?.data?.[0]?.dataRes) {
                    aCategories = categoryData.value[0].data[0].dataRes;
                } else if (Array.isArray(categoryData?.data)) {
                    aCategories = categoryData.data;
                }
                
                // Extraer marcas únicas
                const marcasSet = new Set();
                aProducts.forEach(p => {
                    if (p.MARCA) marcasSet.add(p.MARCA);
                });
                const aBrands = Array.from(marcasSet).map(marca => ({
                    id: marca,
                    name: marca
                }));
                
                oFilterModel.setProperty("/allProducts", aProducts);
                oFilterModel.setProperty("/categories", aCategories);
                oFilterModel.setProperty("/brands", aBrands);
                oFilterModel.setProperty("/productPresentaciones", {});
                
                setTimeout(async () => {
                    await this._applyFilters();
                    oFilterModel.setProperty("/loading", false);
                }, 100);
                
            } catch (error) {
                MessageToast.show("Error al cargar productos: " + error.message);
                oFilterModel.setProperty("/loading", false);
            } finally {
                this._isLoadingProducts = false;
            }
        },

        // Aplicar filtros a los productos
        _applyFilters: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            if (!oFilterModel) return;
            
            const aAllProducts = oFilterModel.getProperty("/allProducts") || [];
            const oFilters = oFilterModel.getProperty("/filters") || {};
            const sSearchTerm = oFilterModel.getProperty("/searchTerm") || '';
            const sSortBy = oFilterModel.getProperty("/sortBy") || "default";
            const bShowOnlyAdded = oFilterModel.getProperty("/showOnlyAdded") || false;
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const oProductPresentaciones = oFilterModel.getProperty("/productPresentaciones") || {};

            // Construir Set de productos agregados
            const addedProductsSet = new Set();
            Object.keys(oAddedPresentaciones).forEach(presId => {
                // Buscar en qué producto está esta presentación
                for (const skuid in oProductPresentaciones) {
                    const aPres = oProductPresentaciones[skuid] || [];
                    if (aPres.some(p => p.IdPresentaOK === presId)) {
                        addedProductsSet.add(skuid);
                        break;
                    }
                }
            });

            let aFiltered = aAllProducts.filter(product => {
                if (!product.ACTIVED || product.DELETED) return false;

                // Filtro de solo agregados
                if (bShowOnlyAdded) {
                    if (!addedProductsSet.has(product.SKUID)) return false;
                }

                if (sSearchTerm) {
                    const searchLower = sSearchTerm.toLowerCase();
                    const matchesSearch = 
                        (product.PRODUCTNAME && product.PRODUCTNAME.toLowerCase().includes(searchLower)) ||
                        (product.SKUID && product.SKUID.toLowerCase().includes(searchLower)) ||
                        (product.MARCA && product.MARCA.toLowerCase().includes(searchLower));
                    if (!matchesSearch) return false;
                }

                if (oFilters.marcas && oFilters.marcas.length > 0) {
                    if (!oFilters.marcas.includes(product.MARCA)) return false;
                }

                if (oFilters.categorias && oFilters.categorias.length > 0) {
                    if (product.CATEGORIAS && Array.isArray(product.CATEGORIAS)) {
                        const hasCategory = product.CATEGORIAS.some(cat => oFilters.categorias.includes(cat));
                        if (!hasCategory) return false;
                    } else {
                        return false;
                    }
                }

                if (oFilters.minPrice && product.PRECIO < parseFloat(oFilters.minPrice)) return false;
                if (oFilters.maxPrice && product.PRECIO > parseFloat(oFilters.maxPrice)) return false;

                if (oFilters.startDate) {
                    const fechaDesde = new Date(oFilters.startDate);
                    const fechaProducto = new Date(product.REGDATE);
                    if (fechaProducto < fechaDesde) return false;
                }
                if (oFilters.endDate) {
                    const fechaHasta = new Date(oFilters.endDate);
                    const fechaProducto = new Date(product.REGDATE);
                    if (fechaProducto > fechaHasta) return false;
                }

                return true;
            });

            // Aplicar ordenamiento
            switch (sSortBy) {
                case "addedFirst":
                    aFiltered.sort((a, b) => {
                        const aIsAdded = addedProductsSet.has(a.SKUID);
                        const bIsAdded = addedProductsSet.has(b.SKUID);
                        if (aIsAdded && !bIsAdded) return -1;
                        if (!aIsAdded && bIsAdded) return 1;
                        return 0;
                    });
                    break;
                case "notAddedFirst":
                    aFiltered.sort((a, b) => {
                        const aIsAdded = addedProductsSet.has(a.SKUID);
                        const bIsAdded = addedProductsSet.has(b.SKUID);
                        if (!aIsAdded && bIsAdded) return -1;
                        if (aIsAdded && !bIsAdded) return 1;
                        return 0;
                    });
                    break;
                case "nameAsc":
                    aFiltered.sort((a, b) => (a.PRODUCTNAME || "").localeCompare(b.PRODUCTNAME || ""));
                    break;
                case "nameDesc":
                    aFiltered.sort((a, b) => (b.PRODUCTNAME || "").localeCompare(a.PRODUCTNAME || ""));
                    break;
                case "default":
                default:
                    break;
            }

            let activeCount = 0;
            if (oFilters.categorias && oFilters.categorias.length > 0) activeCount++;
            if (oFilters.marcas && oFilters.marcas.length > 0) activeCount++;
            if (oFilters.minPrice) activeCount++;
            if (oFilters.maxPrice) activeCount++;
            if (oFilters.startDate) activeCount++;
            if (oFilters.endDate) activeCount++;
            if (sSearchTerm) activeCount++;

            oFilterModel.setProperty("/activeFiltersCount", activeCount);
            oFilterModel.setProperty("/filteredProducts", aFiltered);
            oFilterModel.setProperty("/filteredProductsCount", aFiltered.length);
            oFilterModel.setProperty("/pagination/currentPage", 1);

            await this._updateFilterPagination();
        },

        // Actualizar paginación
        _updateFilterPagination: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            if (!oFilterModel) return;
            
            const aFiltered = oFilterModel.getProperty("/filteredProducts") || [];
            const iCurrentPage = oFilterModel.getProperty("/pagination/currentPage") || 1;
            const iPageSize = 10;

            const iTotal = aFiltered.length;
            const iTotalPages = Math.ceil(iTotal / iPageSize);
            const iStartIndex = (iCurrentPage - 1) * iPageSize;
            const iEndIndex = Math.min(iStartIndex + iPageSize, iTotal);

            let aPaginated = aFiltered.slice(iStartIndex, iEndIndex);

            const oProductPresentaciones = oFilterModel.getProperty("/productPresentaciones") || {};
            
            // Cargar TODAS las presentaciones en una sola llamada si no están cargadas
            const allPresentacionesLoaded = oFilterModel.getProperty("/allPresentacionesLoaded");
            
            if (!allPresentacionesLoaded) {
                await this._loadAllPresentaciones();
            }

            const updatedPresentaciones = oFilterModel.getProperty("/productPresentaciones") || {};
            const oSelectedPresentaciones = oFilterModel.getProperty("/selectedPresentaciones") || {};
            
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            
            aPaginated = aPaginated.map(product => {
                const aPresentaciones = (updatedPresentaciones[product.SKUID] || []).map(pres => {
                    const isAdded = !!oAddedPresentaciones[pres.IdPresentaOK];
                    const isSelected = !!oSelectedPresentaciones[pres.IdPresentaOK];
                    const isLocked = isAdded && !bIsManaging;
                    
                    return {
                        ...pres,
                        selected: isLocked || isAdded || isSelected,
                        added: isAdded,
                        locked: isLocked,
                        alreadyInPromotion: false
                    };
                });
                
                const selectedCount = aPresentaciones.filter(p => p.selected).length;
                const allSelected = aPresentaciones.length > 0 && selectedCount === aPresentaciones.length;
                const hasAddedPresentations = aPresentaciones.some(p => p.added);
                
                // Bloquear producto si todas sus presentaciones están bloqueadas
                const totalPresentaciones = aPresentaciones.length;
                const lockedPresentaciones = aPresentaciones.filter(p => p.locked).length;
                const productLocked = totalPresentaciones > 0 && lockedPresentaciones === totalPresentaciones;

                return {
                    ...product,
                    PRODUCTNAME: product.PRODUCTNAME || product.Nombre || 'Sin nombre',
                    presentaciones: aPresentaciones,
                    presentacionesCount: aPresentaciones.length,
                    expanded: false,
                    allSelected: allSelected,
                    hasAddedPresentations: hasAddedPresentations,
                    alreadyInPromotionProduct: false,
                    locked: productLocked
                };
            });

            oFilterModel.setProperty("/paginatedProducts", aPaginated);
            oFilterModel.setProperty("/pagination", {
                currentPage: iCurrentPage,
                totalPages: iTotalPages,
                total: iTotal,
                startItem: iTotal === 0 ? 0 : iStartIndex + 1,
                endItem: iEndIndex,
                hasNext: iCurrentPage < iTotalPages,
                hasPrev: iCurrentPage > 1
            });
        },

        // Cargar presentaciones de un producto
        _loadAllPresentaciones: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            if (!oFilterModel) return;
            
            try {
                // Cargar TODAS las presentaciones en una sola llamada
                const oResponse = await this._callApi(
                    '/ztproducts-presentaciones/productsPresentacionesCRUD',
                    'POST',
                    {},
                    {
                        ProcessType: 'GetAll'
                    }
                );
                
                let aPresentaciones = [];
                
                // Extraer presentaciones de la respuesta
                if (Array.isArray(oResponse)) {
                    aPresentaciones = oResponse;
                } else if (oResponse?.data?.[0]?.dataRes) {
                    aPresentaciones = oResponse.data[0].dataRes;
                } else if (oResponse?.value?.[0]?.data?.[0]?.dataRes) {
                    aPresentaciones = oResponse.value[0].data[0].dataRes;
                } else if (Array.isArray(oResponse?.data)) {
                    aPresentaciones = oResponse.data;
                }
                
                // Filtrar solo presentaciones activas
                aPresentaciones = aPresentaciones.filter(p => p && p.ACTIVED && !p.DELETED);
                
                // Agrupar presentaciones por SKUID
                const oProductPresentaciones = {};
                aPresentaciones.forEach(pres => {
                    const skuid = pres.SKUID;
                    if (!oProductPresentaciones[skuid]) {
                        oProductPresentaciones[skuid] = [];
                    }
                    oProductPresentaciones[skuid].push(pres);
                });
                
                // Guardar en el modelo
                oFilterModel.setProperty("/productPresentaciones", oProductPresentaciones);
                oFilterModel.setProperty("/allPresentacionesLoaded", true);
                
            } catch (error) {
                MessageToast.show("Error al cargar presentaciones: " + error.message);
            }
        },

        // Funciones del fragmento AdvancedFilters
        onProductSelect: function(oEvent) {
            const bSelected = oEvent.getParameter("selected");
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const aPresentaciones = oFilterModel.getProperty(sPath + "/presentaciones") || [];
            const oSelectedPresentaciones = oFilterModel.getProperty("/selectedPresentaciones") || {};
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            
            let selectionChanged = false;
            let addedChanged = false;
            
            aPresentaciones.forEach((pres, index) => {
                const isAdded = !!oAddedPresentaciones[pres.IdPresentaOK];
                const isLocked = isAdded && !bIsManaging;
                
                // Modo gestión: trabajar con addedPresentaciones
                if (bIsManaging) {
                    if (bSelected) {
                        oAddedPresentaciones[pres.IdPresentaOK] = pres;
                        oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/selected", true);
                        oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/added", true);
                        oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/locked", false);
                        addedChanged = true;
                    } else {
                        delete oAddedPresentaciones[pres.IdPresentaOK];
                        oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/selected", false);
                        oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/added", false);
                        oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/locked", false);
                        addedChanged = true;
                    }
                }
                // Modo normal: solo si no está bloqueada
                else if (!isLocked) {
                    oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/selected", bSelected);
                    
                    if (bSelected) {
                        oSelectedPresentaciones[pres.IdPresentaOK] = pres;
                        selectionChanged = true;
                    } else {
                        delete oSelectedPresentaciones[pres.IdPresentaOK];
                        selectionChanged = true;
                    }
                }
            });
            
            if (selectionChanged) {
                oFilterModel.setProperty("/selectedPresentaciones", oSelectedPresentaciones);
                const hasSelections = Object.keys(oSelectedPresentaciones).length > 0;
                oFilterModel.setProperty("/hasTemporarySelections", hasSelections);
            }
            
            if (addedChanged) {
                oFilterModel.setProperty("/addedPresentaciones", oAddedPresentaciones);
                
                // Actualizar hasAddedPresentations del producto
                const hasAdded = aPresentaciones.some(p => !!oAddedPresentaciones[p.IdPresentaOK]);
                oFilterModel.setProperty(sPath + "/hasAddedPresentations", hasAdded);
            }
            
            oFilterModel.setProperty(sPath + "/allSelected", bSelected);
        },

        onPresentacionSelect: function(oEvent) {
            const bSelected = oEvent.getParameter("selected");
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const oSelectedPresentaciones = oFilterModel.getProperty("/selectedPresentaciones") || {};
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            
            const oPresentacion = oContext.getObject();
            
            // Modo gestión: trabajar con addedPresentaciones
            if (bIsManaging) {
                if (bSelected) {
                    // Agregar a agregados
                    oAddedPresentaciones[oPresentacion.IdPresentaOK] = oPresentacion;
                    oFilterModel.setProperty(sPath + "/added", true);
                    oFilterModel.setProperty(sPath + "/locked", false);
                } else {
                    // Remover de agregados
                    delete oAddedPresentaciones[oPresentacion.IdPresentaOK];
                    oFilterModel.setProperty(sPath + "/added", false);
                    oFilterModel.setProperty(sPath + "/locked", false);
                }
                oFilterModel.setProperty("/addedPresentaciones", oAddedPresentaciones);
            }
            // Modo normal: solo permitir selección temporal si no está agregada
            else {
                const isAdded = !!oAddedPresentaciones[oPresentacion.IdPresentaOK];
                
                if (isAdded) {
                    // No permitir deseleccionar presentaciones agregadas
                    if (!bSelected) {
                        oFilterModel.setProperty(sPath + "/selected", true);
                        MessageToast.show("Esta presentación está agregada. Usa el modo Gestión para quitarla.");
                    }
                    return;
                }
                
                // Selección temporal normal
                if (bSelected) {
                    oSelectedPresentaciones[oPresentacion.IdPresentaOK] = oPresentacion;
                } else {
                    delete oSelectedPresentaciones[oPresentacion.IdPresentaOK];
                }
                oFilterModel.setProperty("/selectedPresentaciones", oSelectedPresentaciones);
                oFilterModel.setProperty("/hasTemporarySelections", Object.keys(oSelectedPresentaciones).length > 0);
            }
            
            // Actualizar allSelected y hasAddedPresentations del producto
            const productPath = sPath.substring(0, sPath.lastIndexOf("/presentaciones"));
            const oProduct = oFilterModel.getProperty(productPath);
            
            if (oProduct && oProduct.presentaciones) {
                // Calcular allSelected considerando presentaciones no bloqueadas
                const selectablePresentaciones = oProduct.presentaciones.filter(p => {
                    const isAdded = !!oAddedPresentaciones[p.IdPresentaOK];
                    const isLocked = isAdded && !bIsManaging;
                    return !isLocked;
                });
                
                const selectedPresentaciones = oProduct.presentaciones.filter(p => {
                    const isAdded = !!oAddedPresentaciones[p.IdPresentaOK];
                    const isLocked = isAdded && !bIsManaging;
                    return p.selected && !isLocked;
                });
                
                const allSelected = selectablePresentaciones.length > 0 && 
                                  selectedPresentaciones.length === selectablePresentaciones.length;
                oFilterModel.setProperty(productPath + "/allSelected", allSelected);
                
                // Actualizar hasAddedPresentations
                const hasAdded = oProduct.presentaciones.some(p => !!oAddedPresentaciones[p.IdPresentaOK]);
                oFilterModel.setProperty(productPath + "/hasAddedPresentations", hasAdded);
            }
        },

        onToggleProduct: function(oEvent) {
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const bExpanded = oFilterModel.getProperty(sPath + "/expanded");
            
            oFilterModel.setProperty(sPath + "/expanded", !bExpanded);
        },

        onPreviousPage: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const iCurrentPage = oFilterModel.getProperty("/pagination/currentPage");
            if (iCurrentPage > 1) {
                oFilterModel.setProperty("/pagination/currentPage", iCurrentPage - 1);
                this._updateFilterPagination();
            }
        },

        onNextPage: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const iCurrentPage = oFilterModel.getProperty("/pagination/currentPage");
            const iTotalPages = oFilterModel.getProperty("/pagination/totalPages");
            if (iCurrentPage < iTotalPages) {
                oFilterModel.setProperty("/pagination/currentPage", iCurrentPage + 1);
                this._updateFilterPagination();
            }
        },

        onSelectAllProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aProducts = oFilterModel.getProperty("/paginatedProducts") || [];
            const oSelectedPresentaciones = oFilterModel.getProperty("/selectedPresentaciones") || {};
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            
            let count = 0;
            aProducts.forEach((product, pIdx) => {
                if (product.presentaciones) {
                    let selectableCount = 0;
                    product.presentaciones.forEach((pres, presIdx) => {
                        const isAdded = !!oAddedPresentaciones[pres.IdPresentaOK];
                        const isLocked = isAdded && !bIsManaging;
                        
                        // Solo seleccionar si no está bloqueada
                        if (!isLocked) {
                            if (bIsManaging) {
                                // En modo gestión, agregar a addedPresentaciones
                                oAddedPresentaciones[pres.IdPresentaOK] = pres;
                                oFilterModel.setProperty(`/paginatedProducts/${pIdx}/presentaciones/${presIdx}/added`, true);
                                oFilterModel.setProperty(`/paginatedProducts/${pIdx}/presentaciones/${presIdx}/locked`, false);
                            } else {
                                // En modo normal, agregar a selecciones temporales
                                oSelectedPresentaciones[pres.IdPresentaOK] = pres;
                            }
                            oFilterModel.setProperty(`/paginatedProducts/${pIdx}/presentaciones/${presIdx}/selected`, true);
                            selectableCount++;
                            count++;
                        }
                    });
                    
                    const allSelectable = product.presentaciones.filter(p => {
                        const isAdded = !!oAddedPresentaciones[p.IdPresentaOK];
                        return !(isAdded && !bIsManaging);
                    }).length;
                    
                    oFilterModel.setProperty(`/paginatedProducts/${pIdx}/allSelected`, selectableCount === allSelectable && allSelectable > 0);
                }
            });
            
            if (bIsManaging) {
                oFilterModel.setProperty("/addedPresentaciones", oAddedPresentaciones);
            } else {
                oFilterModel.setProperty("/selectedPresentaciones", oSelectedPresentaciones);
                oFilterModel.setProperty("/hasTemporarySelections", Object.keys(oSelectedPresentaciones).length > 0);
            }
            
            // Actualizar hasAddedPresentations de cada producto
            aProducts.forEach((product, pIdx) => {
                if (product.presentaciones) {
                    const hasAdded = product.presentaciones.some(p => !!oAddedPresentaciones[p.IdPresentaOK]);
                    oFilterModel.setProperty(`/paginatedProducts/${pIdx}/hasAddedPresentations`, hasAdded);
                }
            });
            
            MessageToast.show(`${count} presentación(es) seleccionada(s)`);
        },

        onDeselectAllProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aProducts = oFilterModel.getProperty("/paginatedProducts") || [];
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            
            let count = 0;
            aProducts.forEach((product, pIdx) => {
                if (product.presentaciones) {
                    product.presentaciones.forEach((pres, presIdx) => {
                        const isAdded = !!oAddedPresentaciones[pres.IdPresentaOK];
                        const isLocked = isAdded && !bIsManaging;
                        
                        // Solo deseleccionar si no está bloqueada
                        if (!isLocked) {
                            if (bIsManaging) {
                                // En modo gestión, quitar de addedPresentaciones
                                delete oAddedPresentaciones[pres.IdPresentaOK];
                                oFilterModel.setProperty(`/paginatedProducts/${pIdx}/presentaciones/${presIdx}/added`, false);
                                oFilterModel.setProperty(`/paginatedProducts/${pIdx}/presentaciones/${presIdx}/locked`, false);
                            }
                            oFilterModel.setProperty(`/paginatedProducts/${pIdx}/presentaciones/${presIdx}/selected`, false);
                            count++;
                        }
                    });
                    oFilterModel.setProperty(`/paginatedProducts/${pIdx}/allSelected`, false);
                }
            });
            
            if (bIsManaging) {
                oFilterModel.setProperty("/addedPresentaciones", oAddedPresentaciones);
            } else {
                oFilterModel.setProperty("/selectedPresentaciones", {});
                oFilterModel.setProperty("/hasTemporarySelections", false);
            }
            
            // Actualizar hasAddedPresentations de cada producto
            aProducts.forEach((product, pIdx) => {
                if (product.presentaciones) {
                    const hasAdded = product.presentaciones.some(p => !!oAddedPresentaciones[p.IdPresentaOK]);
                    oFilterModel.setProperty(`/paginatedProducts/${pIdx}/hasAddedPresentations`, hasAdded);
                }
            });
            
            MessageToast.show(`${count} presentación(es) deseleccionada(s)`);
        },

        onFilterSearch: function(oEvent) {
            const sValue = oEvent.getParameter("newValue");
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/searchTerm", sValue);
            this._applyFilters();
        },

        onCategoryChange: function(oEvent) {
            const oSource = oEvent.getSource();
            const aSelectedKeys = oSource.getSelectedKeys();
            const oFilterModel = this.getView().getModel("filterModel");
            const oFilters = oFilterModel.getProperty("/filters") || {};
            
            oFilters.categorias = aSelectedKeys;
            oFilterModel.setProperty("/filters", oFilters);
            this._applyFilters();
        },

        onBrandChange: function(oEvent) {
            const oSource = oEvent.getSource();
            const aSelectedKeys = oSource.getSelectedKeys();
            const oFilterModel = this.getView().getModel("filterModel");
            const oFilters = oFilterModel.getProperty("/filters") || {};
            
            oFilters.marcas = aSelectedKeys;
            oFilterModel.setProperty("/filters", oFilters);
            this._applyFilters();
        },

        onPriceChange: function(oEvent) {
            const oFilterModel = this.getView().getModel("filterModel");
            const oFilters = oFilterModel.getProperty("/filters") || {};
            
            // Los valores se actualizan automáticamente por el binding
            // Solo necesitamos aplicar filtros
            this._applyFilters();
        },

        onPriceShortcut: function(oEvent) {
            const sText = oEvent.getSource().getText();
            const oFilterModel = this.getView().getModel("filterModel");
            
            switch(sText) {
                case "$0-$50":
                    oFilterModel.setProperty("/filters/minPrice", 0);
                    oFilterModel.setProperty("/filters/maxPrice", 50);
                    break;
                case "$50-$100":
                    oFilterModel.setProperty("/filters/minPrice", 50);
                    oFilterModel.setProperty("/filters/maxPrice", 100);
                    break;
                case "$100-$200":
                    oFilterModel.setProperty("/filters/minPrice", 100);
                    oFilterModel.setProperty("/filters/maxPrice", 200);
                    break;
                case "$200+":
                    oFilterModel.setProperty("/filters/minPrice", 200);
                    oFilterModel.setProperty("/filters/maxPrice", null);
                    break;
            }
            
            this._applyFilters();
        },

        onDateShortcut: function(oEvent) {
            const oFilterModel = this.getView().getModel("filterModel");
            const sText = oEvent.getSource().getText();
            const today = new Date();
            let startDate, endDate;
            
            switch (sText) {
                case "Hoy":
                    startDate = new Date(today);
                    endDate = new Date(today);
                    break;
                case "Últimos 7 días":
                    startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 7);
                    endDate = new Date(today);
                    break;
                case "Últimos 30 días":
                    startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 30);
                    endDate = new Date(today);
                    break;
                case "Este mes":
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                    endDate = new Date(today);
                    break;
            }
            
            // Format dates as YYYY-MM-DD for DatePicker
            const formatDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            
            oFilterModel.setProperty("/filters/startDate", formatDate(startDate));
            oFilterModel.setProperty("/filters/endDate", formatDate(endDate));
            
            this._applyFilters();
        },

        onDateChange: function(oEvent) {
            const oFilterModel = this.getView().getModel("filterModel");
            const oFilters = oFilterModel.getProperty("/filters") || {};
            
            this._applyFilters();
        },

        onClearAllFilters: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/searchTerm", "");
            oFilterModel.setProperty("/filters", {
                categorias: [],
                marcas: [],
                minPrice: null,
                maxPrice: null,
                startDate: null,
                endDate: null
            });
            this._applyFilters();
        },

        onSortChange: function(oEvent) {
            const sKey = oEvent.getParameter("selectedItem").getKey();
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/sortBy", sKey);
            this._applyFilters();
        },

        onShowOnlyAddedChange: function(oEvent) {
            const bState = oEvent.getParameter("state");
            const oFilterModel = this.getView().getModel("filterModel");
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            
            if (bState && Object.keys(oAddedPresentaciones).length === 0) {
                MessageToast.show("No hay presentaciones agregadas aún.");
                oFilterModel.setProperty("/showOnlyAdded", false);
                return;
            }
            
            oFilterModel.setProperty("/showOnlyAdded", bState);
            this._applyFilters();
        },

        onToggleManageSelection: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const bIsManaging = oFilterModel.getProperty("/isManagingSelection") || false;
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            
            if (!bIsManaging) {
                // Verificar que haya agregadas
                if (Object.keys(oAddedPresentaciones).length === 0) {
                    MessageToast.show("No hay presentaciones agregadas para gestionar. Selecciona y agrega algunas primero.");
                    return;
                }
                MessageToast.show("Modo Gestión activado. Ahora puedes modificar las presentaciones agregadas.");
                oFilterModel.setProperty("/showOnlyAdded", true);
            } else {
                MessageToast.show("Modo Gestión desactivado.");
                oFilterModel.setProperty("/showOnlyAdded", false);
            }
            
            oFilterModel.setProperty("/isManagingSelection", !bIsManaging);
            this._applyFilters();
        },

        onPreAddSelections: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oSelectedPresentaciones = oFilterModel.getProperty("/selectedPresentaciones") || {};
            const oAddedPresentaciones = oFilterModel.getProperty("/addedPresentaciones") || {};
            
            if (Object.keys(oSelectedPresentaciones).length === 0) {
                MessageToast.show("No hay presentaciones seleccionadas para agregar.");
                return;
            }
            
            // Mover selecciones temporales a agregadas
            let count = 0;
            Object.keys(oSelectedPresentaciones).forEach(presId => {
                oAddedPresentaciones[presId] = oSelectedPresentaciones[presId];
                count++;
            });
            
            oFilterModel.setProperty("/addedPresentaciones", oAddedPresentaciones);
            oFilterModel.setProperty("/selectedPresentaciones", {});
            oFilterModel.setProperty("/hasTemporarySelections", false);
            
            MessageToast.show(`${count} presentación(es) agregada(s). Estas se incluirán en la promoción.`);
            
            // Refrescar para actualizar locked y mostrar indicadores
            this._updateFilterPagination();
        }
    });
});
