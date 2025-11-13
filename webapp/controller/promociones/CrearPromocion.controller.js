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

        onInit: function () {
            this._initializeModel();

            // Inicializar modelo de filtros para esta vista (similar a Promociones)
            const oFilterModel = new JSONModel({
                loading: false,
                errorMessage: '',
                searchTerm: '',
                filters: {
                    categorias: [],
                    marcas: [],
                    precioMin: '',
                    precioMax: '',
                    fechaIngresoDesde: '',
                    fechaIngresoHasta: ''
                },
                filtersExpanded: true,
                activeFiltersCount: 0,
                allProducts: [],
                allCategories: [],
                allBrands: [],
                filteredProducts: [],
                filteredProductsCount: 0,
                selectedPresentacionesCount: 0,
                lockedPresentaciones: []
            });
            this.getView().setModel(oFilterModel, "filterModel");
            
            this.getOwnerComponent().getRouter().getRoute("RouteCrearPromocion")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function(oEvent) {
            this.getView().byId("createPromoWizard").discardProgress(this.getView().byId("InfoStep"));
            this._initializeModel();
        },

        onNavBack: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RoutePromociones", {}, true);
        },

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
                
                // Estado
                errors: {}
            };

            const oModel = new JSONModel(JSON.parse(JSON.stringify(oInitialData)));
            this.getView().setModel(oModel, "createPromo");
        },

        _formatDateForInput: function(oDate) {
            const year = oDate.getFullYear();
            const month = String(oDate.getMonth() + 1).padStart(2, '0');
            const day = String(oDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

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
                console.error(`Error en la llamada ${sRelativeUrl}:`, error);
                throw new Error(`Error al procesar la solicitud: ${error.message || error}`);
            }
        },

        // Formatters
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

        // Event Handlers
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

        onOpenFilterDialog: async function() {
            const oView = this.getView();
            const oFilterModel = this.getView().getModel("filterModel");

            // Asegurar que tengamos las presentaciones ya seleccionadas bloqueadas
            const oCreateModel = this.getView().getModel("createPromo");
            const aSelected = oCreateModel.getProperty("/selectedPresentaciones") || [];
            const lockedIds = aSelected
                .filter(function(p){ return p && p.IdPresentaOK; })
                .map(function(p){ return p.IdPresentaOK; });
            oFilterModel.setProperty("/lockedPresentaciones", lockedIds);
            oFilterModel.setProperty("/selectedPresentacionesCount", 0);
            oFilterModel.setProperty("/errorMessage", "");

            if (!this._filterDialog) {
                this._filterDialog = await Fragment.load({
                    id: oView.getId(),
                    name: "com.invertions.sapfiorimodinv.view.promociones.fragments.FilterDialog",
                    controller: this
                });
                oView.addDependent(this._filterDialog);
            }

            // Cargar datos de productos / categorías / marcas
            await this._loadFilterData();

            this._filterDialog.open();
        },

        _loadFilterData: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/loading", true);
            oFilterModel.setProperty("/errorMessage", "");

            try {
                // Productos
                const oProductsResponse = await this._callApi('/ztproductos/crudProductos', 'POST', {}, {
                    ProcessType: 'GetAll',
                    DBServer: 'MongoDB'
                });

                let aProducts = [];
                if (oProductsResponse?.data?.[0]?.dataRes) {
                    aProducts = oProductsResponse.data[0].dataRes;
                } else if (oProductsResponse?.value?.[0]?.data?.[0]?.dataRes) {
                    aProducts = oProductsResponse.value[0].data[0].dataRes;
                } else if (Array.isArray(oProductsResponse?.data)) {
                    aProducts = oProductsResponse.data;
                } else if (Array.isArray(oProductsResponse)) {
                    aProducts = oProductsResponse;
                }

                const aActiveProducts = aProducts.filter(function(p) {
                    return p.ACTIVED === true && p.DELETED !== true;
                });

                // Categorías
                const oCategoriesResponse = await this._callApi('/ztcategorias/categoriasCRUD', 'POST', {}, {
                    ProcessType: 'GetAll',
                    DBServer: 'MongoDB'
                });

                let aCategories = [];
                if (oCategoriesResponse?.data?.[0]?.dataRes) {
                    aCategories = oCategoriesResponse.data[0].dataRes;
                } else if (oCategoriesResponse?.value?.[0]?.data?.[0]?.dataRes) {
                    aCategories = oCategoriesResponse.value[0].data[0].dataRes;
                } else if (Array.isArray(oCategoriesResponse?.data)) {
                    aCategories = oCategoriesResponse.data;
                } else if (Array.isArray(oCategoriesResponse)) {
                    aCategories = oCategoriesResponse;
                }

                const aActiveCategories = aCategories.filter(function(c) {
                    return c.ACTIVED === true && c.DELETED !== true;
                });

                // Marcas únicas
                const brandsSet = new Set();
                aActiveProducts.forEach(function(p) {
                    if (p.MARCA && p.MARCA.trim() !== '') {
                        brandsSet.add(p.MARCA.trim());
                    }
                });

                const aBrands = Array.from(brandsSet).map(function(marca) {
                    const count = aActiveProducts.filter(function(p) { return p.MARCA === marca; }).length;
                    return {
                        id: marca,
                        name: marca,
                        productos: count
                    };
                }).sort(function(a, b) { return a.name.localeCompare(b.name); });

                oFilterModel.setProperty("/allProducts", aActiveProducts);
                oFilterModel.setProperty("/allCategories", aActiveCategories);
                oFilterModel.setProperty("/allBrands", aBrands);

                // Aplicar filtros iniciales (sin filtros => todos)
                this._applyProductFilters();

            } catch (error) {
                console.error("Error cargando datos de filtros (CrearPromocion):", error);
                oFilterModel.setProperty("/errorMessage", "Error al cargar productos: " + error.message);
            } finally {
                oFilterModel.setProperty("/loading", false);
            }
        },

        onRemovePresentacion: function(oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem.getBindingContext("createPromo");
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop(), 10);

            const oModel = this.getView().getModel("createPromo");
            const aPresentaciones = oModel.getProperty("/selectedPresentaciones");
            aPresentaciones.splice(iIndex, 1);
            oModel.setProperty("/selectedPresentaciones", aPresentaciones);
            oModel.refresh(true);
        },

        // ======== MÉTODOS COMPARTIDOS DE FILTROS (simplificados) ========

        _applyProductFilters: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aAllProducts = oFilterModel.getProperty("/allProducts") || [];
            const oFilters = oFilterModel.getProperty("/filters") || {};
            const sSearchTerm = oFilterModel.getProperty("/searchTerm") || '';

            let aFiltered = aAllProducts.filter(function(product) {
                // Búsqueda
                if (sSearchTerm && sSearchTerm.trim() !== '') {
                    const searchLower = sSearchTerm.toLowerCase();
                    const matchesSearch =
                        (product.PRODUCTNAME && product.PRODUCTNAME.toLowerCase().includes(searchLower)) ||
                        (product.SKUID && product.SKUID.toLowerCase().includes(searchLower)) ||
                        (product.MARCA && product.MARCA.toLowerCase().includes(searchLower));
                    if (!matchesSearch) { return false; }
                }

                // Marcas
                if (oFilters.marcas && oFilters.marcas.length > 0) {
                    if (!product.MARCA || !oFilters.marcas.includes(product.MARCA)) {
                        return false;
                    }
                }

                // Categorías (suponiendo array CATEGORIAS)
                if (oFilters.categorias && oFilters.categorias.length > 0) {
                    if (!product.CATEGORIAS || !Array.isArray(product.CATEGORIAS)) {
                        return false;
                    }
                    const hasCategory = product.CATEGORIAS.some(function(cat) {
                        return oFilters.categorias.includes(cat);
                    });
                    if (!hasCategory) { return false; }
                }

                // Precio
                if (oFilters.precioMin && product.PRECIO < parseFloat(oFilters.precioMin)) {
                    return false;
                }
                if (oFilters.precioMax && product.PRECIO > parseFloat(oFilters.precioMax)) {
                    return false;
                }

                return true;
            });

            aFiltered = aFiltered.map(function(product) {
                return {
                    SKUID: product.SKUID,
                    PRODUCTNAME: product.PRODUCTNAME,
                    MARCA: product.MARCA,
                    PRECIO: product.PRECIO,
                    CATEGORIAS: product.CATEGORIAS,
                    REGDATE: product.REGDATE,
                    ACTIVED: product.ACTIVED,
                    expanded: false,
                    presentaciones: [],
                    presentacionesCount: 0,
                    loadingPresentaciones: false
                };
            });

            oFilterModel.setProperty("/filteredProducts", aFiltered);
            oFilterModel.setProperty("/filteredProductsCount", aFiltered.length);
        },

        onFilterSearch: function(oEvent) {
            const sValue = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/searchTerm", sValue);
            this._applyProductFilters();
        },

        onFilterCategoryChange: function(oEvent) {
            const aSelectedItems = oEvent.getParameter("selectedItems") || [];
            const aKeys = aSelectedItems.map(function(item) { return item.getKey(); });
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/filters/categorias", aKeys);
            this._applyProductFilters();
        },

        onFilterBrandChange: function(oEvent) {
            const aSelectedItems = oEvent.getParameter("selectedItems") || [];
            const aKeys = aSelectedItems.map(function(item) { return item.getKey(); });
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/filters/marcas", aKeys);
            this._applyProductFilters();
        },

        onFilterPriceChange: function() {
            this._applyProductFilters();
        },

        onClearFilters: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/searchTerm", "");
            oFilterModel.setProperty("/filters", {
                categorias: [],
                marcas: [],
                precioMin: '',
                precioMax: '',
                fechaIngresoDesde: '',
                fechaIngresoHasta: ''
            });
            this._applyProductFilters();
        },

        // El resto de manejadores de selección de presentaciones se toma de Promociones.controller
        onPresentacionPress: function(oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("filterModel");
            const oPresentacion = oContext.getObject();

            if (oPresentacion.locked) {
                MessageToast.show("Esta presentación ya está en la promoción");
                return;
            }

            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const bCurrentlySelected = oPresentacion.selected;

            oFilterModel.setProperty(sPath + "/selected", !bCurrentlySelected);
        },

        onConfirmAddProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oCreateModel = this.getView().getModel("createPromo");
            const aProducts = oFilterModel.getProperty("/filteredProducts") || [];
            const aCurrent = oCreateModel.getProperty("/selectedPresentaciones") || [];

            const aNewPresentaciones = [];
            aProducts.forEach(function(product) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres) {
                        if (pres.selected && !pres.locked) {
                            aNewPresentaciones.push({
                                IdPresentaOK: pres.IdPresentaOK,
                                SKUID: product.SKUID,
                                NOMBREPRESENTACION: pres.NOMBREPRESENTACION,
                                Precio: pres.precio,
                                producto: {
                                    SKUID: product.SKUID,
                                    PRODUCTNAME: product.PRODUCTNAME
                                }
                            });
                        }
                    });
                }
            });

            const aCombined = aCurrent.concat(aNewPresentaciones);
            oCreateModel.setProperty("/selectedPresentaciones", aCombined);

            MessageToast.show(aNewPresentaciones.length + " presentación(es) agregada(s) a la promoción");
            if (this._filterDialog) {
                this._filterDialog.close();
            }
        },

        onCancelAddProducts: function() {
            if (this._filterDialog) {
                this._filterDialog.close();
            }
        },

        onStepActivate: function(oEvent) {
            const sStepId = oEvent.getSource().getId();
            if (sStepId.includes("ReviewStep")) {
                this.getView().getModel("createPromo").refresh();
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
                    MessageBox.error("La fecha de fin debe ser posterior a la fecha de inicio.");
                }
            }

            oModel.setProperty("/errors", oErrors);
            if (!bIsValid) {
                MessageBox.error("Por favor, complete todos los campos obligatorios.");
            }
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
                    MessageBox.error("El porcentaje de descuento debe estar entre 1 y 100.");
                }
            } else if (oData.tipoDescuento === "MONTO_FIJO") {
                if (!oData.descuentoMonto || oData.descuentoMonto <= 0) {
                    oErrors.descuentoMonto = "Error";
                    bIsValid = false;
                    MessageBox.error("El monto de descuento debe ser mayor a 0.");
                }
            }

            oModel.setProperty("/errors", oErrors);
            return bIsValid;
        },

        _validateStep3: function() {
            const oModel = this.getView().getModel("createPromo");
            const aPresentaciones = oModel.getProperty("/selectedPresentaciones");
            
            if (!aPresentaciones || aPresentaciones.length === 0) {
                MessageBox.error("Debe seleccionar al menos una presentación para la promoción.");
                return false;
            }
            
            return true;
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

            console.log("📤 Payload a enviar:", oPromoPayload);

            try {
                const oResponse = await this._callApi('/ztpromociones/crudPromociones', 'POST', oPromoPayload, {
                    ProcessType: 'AddOne',
                    DBServer: 'MongoDB'
                });
                
                console.log("✅ Promoción creada exitosamente:", oResponse);
                
                MessageBox.success(`Promoción "${oData.titulo}" creada exitosamente.`, {
                    onClose: () => this.onNavBack()
                });
            } catch (error) {
                console.error("❌ Error al crear promoción:", error);
                MessageBox.error("Error al crear la promoción: " + error.message);
            }
        }
    });
});
