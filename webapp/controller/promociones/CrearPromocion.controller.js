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
                paginatedProducts: [],
                selectedPresentacionesCount: 0,
                lockedPresentaciones: [],
                pagination: {
                    currentPage: 1,
                    itemsPerPage: 5,
                    totalPages: 1,
                    totalItems: 0
                }
            });
            this.getView().setModel(oFilterModel, "filterModel");
            
            this.getOwnerComponent().getRouter().getRoute("RouteCrearPromocion")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function(oEvent) {
            this._initializeModel();
            this._initializeNavContainer();
        },

        _initializeNavContainer: function() {
            const oNavContainer = this.getView().byId("stepNavContainer");
            const oFirstPage = this.getView().byId("InfoStepPage");
            
            // Limpiar contenedor y agregar primera página
            if (oNavContainer && oFirstPage) {
                oNavContainer.removeAllPages();
                oNavContainer.addPage(oFirstPage);
                oNavContainer.addPage(this.getView().byId("DiscountStepPage"));
                oNavContainer.addPage(this.getView().byId("ProductsStepPage"));
                oNavContainer.addPage(this.getView().byId("ReviewStepPage"));
                oNavContainer.to(oFirstPage);
            }
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
                groupedSelectedProducts: [],
                paginatedGroupedProducts: [],
                
                // Navegación de pasos
                currentStep: 1,
                currentStepTitle: "Información General",
                progressPercent: 25,
                
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

        // Función eliminada - Los filtros ahora están integrados directamente en el paso 3

        _loadFilterData: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/loading", true);
            oFilterModel.setProperty("/errorMessage", "");

            try {
                // Cargar productos
                const oProductsResponse = await this._callApi('/ztproducts/crudProducts', 'POST', {}, {
                    ProcessType: 'GetAll'
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

        // ======== MÉTODOS COMPARTIDOS DE FILTROS (simplificados) ========

        _applyProductFilters: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aAllProducts = oFilterModel.getProperty("/allProducts") || [];
            const oFilters = oFilterModel.getProperty("/filters") || {};
            const sSearchTerm = oFilterModel.getProperty("/searchTerm") || '';

            console.log("🔍 Aplicando filtros:", {
                totalProductos: aAllProducts.length,
                filtros: oFilters,
                busqueda: sSearchTerm,
                primerProducto: aAllProducts[0]
            });

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
                    console.log("📂 Filtrando por categorías:", oFilters.categorias, "Producto:", product.SKUID, "CATEGORIAS:", product.CATEGORIAS);
                    if (!product.CATEGORIAS || !Array.isArray(product.CATEGORIAS)) {
                        console.log("❌ Producto sin CATEGORIAS o no es array");
                        return false;
                    }
                    const hasCategory = product.CATEGORIAS.some(function(cat) {
                        return oFilters.categorias.includes(cat);
                    });
                    if (!hasCategory) { 
                        console.log("❌ Producto no tiene categoría seleccionada");
                        return false; 
                    }
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

            console.log("✅ Productos filtrados:", aFiltered.length);

            aFiltered = aFiltered.map(function(product) {
                return {
                    SKUID: product.SKUID,
                    PRODUCTNAME: product.PRODUCTNAME,
                    MARCA: product.MARCA,
                    PRECIO: product.PRECIO,
                    CATEGORIAS: product.CATEGORIAS,
                    REGDATE: product.REGDATE,
                    ACTIVED: product.ACTIVED,
                    expanded: false, // COLAPSADOS POR DEFECTO
                    presentaciones: [],
                    presentacionesCount: 0,
                    loadingPresentaciones: false,
                    allSelected: false
                };
            });

            oFilterModel.setProperty("/filteredProducts", aFiltered);
            oFilterModel.setProperty("/filteredProductsCount", aFiltered.length);
            
            // Resetear a la primera página cuando cambien los filtros
            oFilterModel.setProperty("/pagination/currentPage", 1);
            
            // Cargar presentaciones automáticamente y actualizar el contador
            this._loadAllPresentaciones(aFiltered).then(() => {
                this._updateSelectedPresentacionesCount();
                this._updatePaginatedProducts();
            });
        },

        onFilterSearch: function(oEvent) {
            const sValue = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            const oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setProperty("/searchTerm", sValue);
            this._applyProductFilters();
        },

        onFilterCategoryChange: function(oEvent) {
            const oMultiComboBox = oEvent.getSource();
            const aSelectedKeys = oMultiComboBox.getSelectedKeys();
            const oFilterModel = this.getView().getModel("filterModel");
            console.log("📂 Categorías seleccionadas:", aSelectedKeys);
            oFilterModel.setProperty("/filters/categorias", aSelectedKeys);
            this._applyProductFilters();
        },

        onFilterBrandChange: function(oEvent) {
            const oMultiComboBox = oEvent.getSource();
            const aSelectedKeys = oMultiComboBox.getSelectedKeys();
            const oFilterModel = this.getView().getModel("filterModel");
            console.log("🏷️ Marcas seleccionadas:", aSelectedKeys);
            oFilterModel.setProperty("/filters/marcas", aSelectedKeys);
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
        onProductCheckBoxSelect: function(oEvent) {
            const bSelected = oEvent.getParameter("selected");
            const oContext = oEvent.getSource().getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const aPresentaciones = oFilterModel.getProperty(sPath + "/presentaciones") || [];
            
            // Seleccionar/deseleccionar todas las presentaciones no bloqueadas
            aPresentaciones.forEach(function(pres, index) {
                if (!pres.locked) {
                    oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/selected", bSelected);
                }
            });
            
            oFilterModel.setProperty(sPath + "/allSelected", bSelected);
            this._updateSelectedPresentacionesCount();
        },

        onFilterToggleProduct: async function(oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("filterModel");
            const oProduct = oContext.getObject();
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");

            const bExpanded = !oProduct.expanded;
            oFilterModel.setProperty(sPath + "/expanded", bExpanded);

            if (bExpanded && (!oProduct.presentaciones || oProduct.presentaciones.length === 0)) {
                oFilterModel.setProperty(sPath + "/loadingPresentaciones", true);
                
                try {
                    const oPresentacionesResponse = await this._callApi('/ztproducts-presentaciones/productsPresentacionesCRUD', 'POST', {}, {
                        ProcessType: 'GetBySKUID',
                        skuid: oProduct.SKUID
                    });

                    let aPresentaciones = [];
                    if (oPresentacionesResponse?.data?.[0]?.dataRes) {
                        aPresentaciones = oPresentacionesResponse.data[0].dataRes;
                    } else if (oPresentacionesResponse?.value?.[0]?.data?.[0]?.dataRes) {
                        aPresentaciones = oPresentacionesResponse.value[0].data[0].dataRes;
                    } else if (Array.isArray(oPresentacionesResponse?.data)) {
                        aPresentaciones = oPresentacionesResponse.data;
                    } else if (Array.isArray(oPresentacionesResponse)) {
                        aPresentaciones = oPresentacionesResponse;
                    }

                    // Filtrar solo presentaciones activas (ya vienen filtradas por SKUID)
                    const aProductPresentaciones = aPresentaciones.filter(function(p) {
                        return p.ACTIVED === true;
                    });

                    const aLockedIds = oFilterModel.getProperty("/lockedPresentaciones") || [];
                    const aPresentacionesWithPrice = await Promise.all(aProductPresentaciones.map(async (pres) => {
                        let precio = 0;
                        try {
                            const oPrecioResponse = await this._callApi('/ztprecios-items/preciosItemsCRUD', 'POST', {}, {
                                ProcessType: 'GetByIdPresentaOK',
                                idPresentaOK: pres.IdPresentaOK
                            });

                            let aPrecios = [];
                            if (oPrecioResponse?.data?.[0]?.dataRes) {
                                aPrecios = oPrecioResponse.data[0].dataRes;
                            } else if (oPrecioResponse?.value?.[0]?.data?.[0]?.dataRes) {
                                aPrecios = oPrecioResponse.value[0].data[0].dataRes;
                            } else if (Array.isArray(oPrecioResponse?.data)) {
                                aPrecios = oPrecioResponse.data;
                            } else if (Array.isArray(oPrecioResponse)) {
                                aPrecios = oPrecioResponse;
                            }

                            // Tomar el primer precio activo (ya viene filtrado por IdPresentaOK)
                            const oPrecioItem = aPrecios.find(function(pr) {
                                return pr.ACTIVED === true;
                            });

                            if (oPrecioItem) {
                                precio = oPrecioItem.PRECIO || 0;
                            }
                        } catch (error) {
                            console.error("Error cargando precio para", pres.IdPresentaOK, error);
                        }

                        return {
                            IdPresentaOK: pres.IdPresentaOK,
                            NOMBREPRESENTACION: pres.NOMBREPRESENTACION,
                            precio: precio,
                            selected: false,
                            locked: aLockedIds.includes(pres.IdPresentaOK)
                        };
                    }));

                    oFilterModel.setProperty(sPath + "/presentaciones", aPresentacionesWithPrice);
                    oFilterModel.setProperty(sPath + "/presentacionesCount", aPresentacionesWithPrice.length);

                } catch (error) {
                    console.error("Error cargando presentaciones:", error);
                    MessageToast.show("Error al cargar presentaciones: " + error.message);
                } finally {
                    oFilterModel.setProperty(sPath + "/loadingPresentaciones", false);
                }
            }
        },

        onFilterPresentacionSelect: function(oEvent) {
            const oCheckBox = oEvent.getSource();
            const bSelected = oCheckBox.getSelected();
            const oContext = oCheckBox.getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const oPresentacion = oContext.getObject();
            
            oFilterModel.setProperty(sPath + "/selected", bSelected);
            
            // Actualizar checkbox del producto
            const aPathParts = sPath.split("/");
            const productIndex = parseInt(aPathParts[2]);
            const oProduct = oFilterModel.getProperty("/filteredProducts/" + productIndex);
            this._updateFilterProductCheckBox(productIndex);
            
            // Agregar o quitar de la lista de presentaciones seleccionadas
            const oCreateModel = this.getView().getModel("createPromo");
            const aSelected = oCreateModel.getProperty("/selectedPresentaciones") || [];
            
            if (bSelected) {
                // Agregar presentación
                const newPres = {
                    IdPresentaOK: oPresentacion.IdPresentaOK,
                    SKUID: oProduct.SKUID,
                    NOMBREPRESENTACION: oPresentacion.NOMBREPRESENTACION,
                    Precio: oPresentacion.precio,
                    producto: {
                        SKUID: oProduct.SKUID,
                        PRODUCTNAME: oProduct.PRODUCTNAME
                    }
                };
                aSelected.push(newPres);
            } else {
                // Quitar presentación
                const index = aSelected.findIndex(p => p.IdPresentaOK === oPresentacion.IdPresentaOK);
                if (index > -1) {
                    aSelected.splice(index, 1);
                }
            }
            
            oCreateModel.setProperty("/selectedPresentaciones", aSelected);
            this._updateGroupedSelectedProducts();
            this._updateSelectedPresentacionesCount();
        },

        onFilterTogglePresentacion: function(oEvent) {
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
            this._updateSelectedPresentacionesCount();
            this._updateProductCheckBox(oContext);
        },

        _updateProductCheckBox: function(oPresentacionContext) {
            const sPresPath = oPresentacionContext.getPath();
            const productIndex = sPresPath.split("/")[2];
            const oFilterModel = this.getView().getModel("filterModel");
            const aPresentaciones = oFilterModel.getProperty("/filteredProducts/" + productIndex + "/presentaciones");
            
            if (!aPresentaciones || aPresentaciones.length === 0) return;
            
            const aUnlocked = aPresentaciones.filter(p => !p.locked);
            if (aUnlocked.length === 0) return;
            
            const allSelected = aUnlocked.every(p => p.selected);
            oFilterModel.setProperty("/filteredProducts/" + productIndex + "/allSelected", allSelected);
        },

        _updateSelectedPresentacionesCount: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aProducts = oFilterModel.getProperty("/filteredProducts") || [];
            
            let count = 0;
            aProducts.forEach(function(product) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres) {
                        if (pres.selected && !pres.locked) {
                            count++;
                        }
                    });
                }
            });
            
            oFilterModel.setProperty("/selectedPresentacionesCount", count);
        },

        onSelectAllFilteredProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aProducts = oFilterModel.getProperty("/filteredProducts") || [];
            
            // Verificar si todas están seleccionadas
            let allSelected = true;
            let hasUnlockedPresentaciones = false;
            
            aProducts.forEach(function(product) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres) {
                        if (!pres.locked) {
                            hasUnlockedPresentaciones = true;
                            if (!pres.selected) {
                                allSelected = false;
                            }
                        }
                    });
                }
            });
            
            if (!hasUnlockedPresentaciones) {
                MessageToast.show("No hay presentaciones disponibles para seleccionar");
                return;
            }
            
            // Marcar/desmarcar todas
            const newState = !allSelected;
            
            aProducts.forEach(function(product, productIndex) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    let allPresSelected = true;
                    product.presentaciones.forEach(function(pres, presIndex) {
                        if (!pres.locked) {
                            // Actualizar el objeto directamente
                            pres.selected = newState;
                            // Y también en el modelo
                            oFilterModel.setProperty("/filteredProducts/" + productIndex + "/presentaciones/" + presIndex + "/selected", newState);
                        }
                        // Verificar si todas las no-locked están seleccionadas
                        if (!pres.locked && !pres.selected) {
                            allPresSelected = false;
                        }
                    });
                    // Actualizar el estado del checkbox del producto
                    product.allSelected = allPresSelected;
                    oFilterModel.setProperty("/filteredProducts/" + productIndex + "/allSelected", allPresSelected);
                }
            });
            
            // Forzar actualización completa del modelo
            oFilterModel.refresh(true);
            
            // Actualizar la vista paginada y contador
            this._updatePaginatedProducts();
            this._updateSelectedPresentacionesCount();
            
            MessageToast.show(newState ? "Todas seleccionadas (" + oFilterModel.getProperty("/selectedPresentacionesCount") + ")" : "Todas deseleccionadas");
        },

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
            this._updateSelectedPresentacionesCount();
        },

        onConfirmAddProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oCreateModel = this.getView().getModel("createPromo");
            // Usar filteredProducts (todos los productos filtrados, no solo los paginados)
            const aAllProducts = oFilterModel.getProperty("/filteredProducts") || [];
            const aCurrent = oCreateModel.getProperty("/selectedPresentaciones") || [];

            const aNewPresentaciones = [];
            aAllProducts.forEach(function(product) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres) {
                        console.log("Revisando presentación:", pres.NOMBREPRESENTACION, "selected:", pres.selected, "locked:", pres.locked);
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

            console.log("Total presentaciones encontradas seleccionadas:", aNewPresentaciones.length);

            if (aNewPresentaciones.length === 0) {
                MessageBox.warning("No hay presentaciones seleccionadas para agregar");
                return;
            }

            const aCombined = aCurrent.concat(aNewPresentaciones);
            oCreateModel.setProperty("/selectedPresentaciones", aCombined);
            
            // Agrupar por productos
            this._updateGroupedSelectedProducts();

            MessageToast.show(aNewPresentaciones.length + " presentación(es) agregada(s) a la promoción");
        },

        _updateGroupedSelectedProducts: function() {
            const oCreateModel = this.getView().getModel("createPromo");
            const aPresentaciones = oCreateModel.getProperty("/selectedPresentaciones") || [];
            
            const productMap = new Map();
            
            aPresentaciones.forEach(function(pres) {
                const skuid = pres.SKUID;
                if (!productMap.has(skuid)) {
                    productMap.set(skuid, {
                        SKUID: skuid,
                        PRODUCTNAME: pres.producto?.PRODUCTNAME || 'Sin nombre',
                        presentaciones: [],
                        expanded: false
                    });
                }
                productMap.get(skuid).presentaciones.push(pres);
            });
            
            const grouped = Array.from(productMap.values());
            oCreateModel.setProperty("/groupedSelectedProducts", grouped);
            
            // Actualizar paginación del paso 3
            this._updatePaginatedGroupedProducts();
            
            // Actualizar paginación del paso 4
            this._updatePaginatedSelectedProducts();
        },

        _updatePaginatedSelectedProducts: function() {
            const oCreateModel = this.getView().getModel("createPromo");
            const aGrouped = oCreateModel.getProperty("/groupedSelectedProducts") || [];
            const currentPage = oCreateModel.getProperty("/paginationSelected/currentPage") || 1;
            const itemsPerPage = oCreateModel.getProperty("/paginationSelected/itemsPerPage") || 5;

            const totalItems = aGrouped.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

            oCreateModel.setProperty("/paginationSelected/totalItems", totalItems);
            oCreateModel.setProperty("/paginationSelected/totalPages", totalPages);

            // Ajustar página actual si es necesaria
            if (currentPage > totalPages && totalPages > 0) {
                oCreateModel.setProperty("/paginationSelected/currentPage", totalPages);
            }

            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
            const paginatedSelected = aGrouped.slice(startIndex, endIndex);

            oCreateModel.setProperty("/paginatedSelectedProducts", paginatedSelected);
        },

        onSelectedPreviousPage: function() {
            const oCreateModel = this.getView().getModel("createPromo");
            const currentPage = oCreateModel.getProperty("/paginationSelected/currentPage");
            if (currentPage > 1) {
                oCreateModel.setProperty("/paginationSelected/currentPage", currentPage - 1);
                this._updatePaginatedSelectedProducts();
            }
        },

        onSelectedNextPage: function() {
            const oCreateModel = this.getView().getModel("createPromo");
            const currentPage = oCreateModel.getProperty("/paginationSelected/currentPage");
            const totalPages = oCreateModel.getProperty("/paginationSelected/totalPages");
            if (currentPage < totalPages) {
                oCreateModel.setProperty("/paginationSelected/currentPage", currentPage + 1);
                this._updatePaginatedSelectedProducts();
            }
        },

        onSelectedItemsPerPageChange: function(oEvent) {
            const oCreateModel = this.getView().getModel("createPromo");
            const sKey = oEvent.getParameter("selectedItem").getKey();
            oCreateModel.setProperty("/paginationSelected/itemsPerPage", parseInt(sKey));
            oCreateModel.setProperty("/paginationSelected/currentPage", 1);
            this._updatePaginatedSelectedProducts();
        },

        _updatePaginatedGroupedProducts: function() {
            const oCreateModel = this.getView().getModel("createPromo");
            const aGrouped = oCreateModel.getProperty("/groupedSelectedProducts") || [];
            const currentPage = oCreateModel.getProperty("/groupedPagination/currentPage") || 1;
            const itemsPerPage = oCreateModel.getProperty("/groupedPagination/itemsPerPage") || 5;

            const totalItems = aGrouped.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

            oCreateModel.setProperty("/groupedPagination/totalItems", totalItems);
            oCreateModel.setProperty("/groupedPagination/totalPages", totalPages);

            // Ajustar página actual si es necesaria
            if (currentPage > totalPages) {
                oCreateModel.setProperty("/groupedPagination/currentPage", totalPages);
            }

            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
            const paginatedGrouped = aGrouped.slice(startIndex, endIndex);

            oCreateModel.setProperty("/paginatedGroupedProducts", paginatedGrouped);
        },

        onPreviousGroupedPage: function() {
            const oCreateModel = this.getView().getModel("createPromo");
            const currentPage = oCreateModel.getProperty("/groupedPagination/currentPage");
            if (currentPage > 1) {
                oCreateModel.setProperty("/groupedPagination/currentPage", currentPage - 1);
                this._updatePaginatedGroupedProducts();
            }
        },

        onNextGroupedPage: function() {
            const oCreateModel = this.getView().getModel("createPromo");
            const currentPage = oCreateModel.getProperty("/groupedPagination/currentPage");
            const totalPages = oCreateModel.getProperty("/groupedPagination/totalPages");
            if (currentPage < totalPages) {
                oCreateModel.setProperty("/groupedPagination/currentPage", currentPage + 1);
                this._updatePaginatedGroupedProducts();
            }
        },

        onGroupedItemsPerPageChange: function(oEvent) {
            const oCreateModel = this.getView().getModel("createPromo");
            const newItemsPerPage = parseInt(oEvent.getParameter("selectedItem").getKey());
            oCreateModel.setProperty("/groupedPagination/itemsPerPage", newItemsPerPage);
            oCreateModel.setProperty("/groupedPagination/currentPage", 1);
            this._updatePaginatedGroupedProducts();
        },

        onToggleGroupedProduct: function(oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext("createPromo");
            const sPath = oContext.getPath();
            const oCreateModel = this.getView().getModel("createPromo");
            const bExpanded = oCreateModel.getProperty(sPath + "/expanded");
            
            oCreateModel.setProperty(sPath + "/expanded", !bExpanded);
        },

        // Función eliminada - No se necesita cancelar ya que no hay modal

        onPreviousPage: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const currentPage = oFilterModel.getProperty("/pagination/currentPage");
            if (currentPage > 1) {
                oFilterModel.setProperty("/pagination/currentPage", currentPage - 1);
                this._updatePaginatedProducts();
            }
        },

        onNextPage: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const currentPage = oFilterModel.getProperty("/pagination/currentPage");
            const totalPages = oFilterModel.getProperty("/pagination/totalPages");
            if (currentPage < totalPages) {
                oFilterModel.setProperty("/pagination/currentPage", currentPage + 1);
                this._updatePaginatedProducts();
            }
        },

        onItemsPerPageChange: function(oEvent) {
            const oFilterModel = this.getView().getModel("filterModel");
            const newItemsPerPage = parseInt(oEvent.getParameter("selectedItem").getKey());
            oFilterModel.setProperty("/pagination/itemsPerPage", newItemsPerPage);
            oFilterModel.setProperty("/pagination/currentPage", 1);
            this._updatePaginatedProducts();
        },

        _updatePaginatedProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aFilteredProducts = oFilterModel.getProperty("/filteredProducts") || [];
            const currentPage = oFilterModel.getProperty("/pagination/currentPage");
            const itemsPerPage = oFilterModel.getProperty("/pagination/itemsPerPage");

            const totalItems = aFilteredProducts.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

            oFilterModel.setProperty("/pagination/totalItems", totalItems);
            oFilterModel.setProperty("/pagination/totalPages", totalPages);

            // Ajustar página actual si es necesaria
            if (currentPage > totalPages) {
                oFilterModel.setProperty("/pagination/currentPage", totalPages);
            }

            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
            const paginatedProducts = aFilteredProducts.slice(startIndex, endIndex);

            oFilterModel.setProperty("/paginatedProducts", paginatedProducts);
        },

        onStepActivate: async function(oEvent) {
            const sStepId = oEvent.getSource().getId();
            
            if (sStepId.includes("ProductsStep")) {
                // Cargar datos de filtros cuando se activa el paso 3
                const oFilterModel = this.getView().getModel("filterModel");
                const oCreateModel = this.getView().getModel("createPromo");
                const aSelected = oCreateModel.getProperty("/selectedPresentaciones") || [];
                const lockedIds = aSelected
                    .filter(function(p){ return p && p.IdPresentaOK; })
                    .map(function(p){ return p.IdPresentaOK; });
                oFilterModel.setProperty("/lockedPresentaciones", lockedIds);
                oFilterModel.setProperty("/selectedPresentacionesCount", 0);
                oFilterModel.setProperty("/errorMessage", "");
                
                await this._loadFilterData();
            } else if (sStepId.includes("ReviewStep")) {
                // Actualizar agrupación antes de mostrar el paso de revisión
                this._updateGroupedSelectedProducts();
                this.getView().getModel("createPromo").refresh();
            }
        },

        onNextStep: async function() {
            const oModel = this.getView().getModel("createPromo");
            const currentStep = oModel.getProperty("/currentStep");
            
            // Validar paso actual antes de avanzar
            let bIsValid = true;
            if (currentStep === 1) {
                bIsValid = this._validateStep1();
            } else if (currentStep === 2) {
                bIsValid = this._validateStep2();
            } else if (currentStep === 3) {
                bIsValid = this._validateStep3();
            }
            
            if (!bIsValid) {
                MessageToast.show("Por favor complete todos los campos requeridos");
                return;
            }
            
            // Navegar al siguiente paso
            const oNavContainer = this.getView().byId("stepNavContainer");
            let nextPage;
            let stepTitle;
            let progressPercent;
            
            if (currentStep === 1) {
                nextPage = this.getView().byId("DiscountStepPage");
                stepTitle = "Descuento y Reglas";
                progressPercent = 50;
            } else if (currentStep === 2) {
                nextPage = this.getView().byId("ProductsStepPage");
                stepTitle = "Productos y Presentaciones";
                progressPercent = 75;
                // Cargar datos de filtros
                await this._loadStep3Data();
            } else if (currentStep === 3) {
                nextPage = this.getView().byId("ReviewStepPage");
                stepTitle = "Revisión y Confirmación";
                progressPercent = 100;
                this._updateGroupedSelectedProducts();
            }
            
            if (nextPage && oNavContainer) {
                oNavContainer.to(nextPage);
                oModel.setProperty("/currentStep", currentStep + 1);
                oModel.setProperty("/currentStepTitle", stepTitle);
                oModel.setProperty("/progressPercent", progressPercent);
                console.log("✅ Navegando a paso:", currentStep + 1, "- Título:", stepTitle);
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
                stepTitle = "Información General";
                progressPercent = 25;
            } else if (currentStep === 3) {
                prevPage = this.getView().byId("DiscountStepPage");
                stepTitle = "Descuento y Reglas";
                progressPercent = 50;
            } else if (currentStep === 4) {
                prevPage = this.getView().byId("ProductsStepPage");
                stepTitle = "Productos y Presentaciones";
                progressPercent = 75;
            }
            
            if (prevPage && oNavContainer) {
                oNavContainer.backToPage(prevPage);
                oModel.setProperty("/currentStep", currentStep - 1);
                oModel.setProperty("/currentStepTitle", stepTitle);
                oModel.setProperty("/progressPercent", progressPercent);
                oModel.refresh(true); // Force refresh del modelo
            }
        },

        _loadStep3Data: async function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const oCreateModel = this.getView().getModel("createPromo");
            const aSelected = oCreateModel.getProperty("/selectedPresentaciones") || [];
            const lockedIds = aSelected
                .filter(function(p){ return p && p.IdPresentaOK; })
                .map(function(p){ return p.IdPresentaOK; });
            oFilterModel.setProperty("/lockedPresentaciones", lockedIds);
            oFilterModel.setProperty("/selectedPresentacionesCount", 0);
            oFilterModel.setProperty("/errorMessage", "");
            
            await this._loadFilterData();
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
        },

        _loadAllPresentaciones: async function(aProducts) {
            const oFilterModel = this.getView().getModel("filterModel");
            const lockedIds = oFilterModel.getProperty("/lockedPresentaciones") || [];
            
            for (let i = 0; i < aProducts.length; i++) {
                const product = aProducts[i];
                
                try {
                    const oPresentacionesResponse = await this._callApi('/ztproducts-presentaciones/productsPresentacionesCRUD', 'POST', {}, {
                        ProcessType: 'GetBySKUID',
                        skuid: product.SKUID,
                        DBServer: 'MongoDB'
                    });
                    
                    let aPresentaciones = [];
                    if (oPresentacionesResponse?.data?.[0]?.dataRes) {
                        aPresentaciones = oPresentacionesResponse.data[0].dataRes;
                    } else if (oPresentacionesResponse?.value?.[0]?.data?.[0]?.dataRes) {
                        aPresentaciones = oPresentacionesResponse.value[0].data[0].dataRes;
                    }
                    
                    const aPresentacionesActivas = aPresentaciones
                        .filter(function(p) { return p.ACTIVED === true && p.DELETED !== true; })
                        .map(function(p) {
                            return {
                                ...p,
                                selected: false,
                                locked: lockedIds.includes(p.IdPresentaOK),
                                precio: 0,
                                listaPrecios: ''
                            };
                        });
                    
                    // Cargar precios
                    for (const pres of aPresentacionesActivas) {
                        try {
                            const oPreciosResponse = await this._callApi('/ztprecios-items/preciosItemsCRUD', 'POST', {}, {
                                ProcessType: 'GetByIdPresentaOK',
                                idPresentaOK: pres.IdPresentaOK,
                                DBServer: 'MongoDB'
                            });
                            
                            let aPrecios = [];
                            if (oPreciosResponse?.data?.[0]?.dataRes) {
                                aPrecios = oPreciosResponse.data[0].dataRes;
                            } else if (oPreciosResponse?.value?.[0]?.data?.[0]?.dataRes) {
                                aPrecios = oPreciosResponse.value[0].data[0].dataRes;
                            }
                            
                            if (aPrecios.length > 0) {
                                pres.precio = aPrecios[0].PRECIO || 0;
                                pres.listaPrecios = aPrecios[0].IdListaPreciosOK || '';
                            }
                        } catch (error) {
                            console.error("Error cargando precios:", error);
                        }
                    }
                    
                    oFilterModel.setProperty(`/filteredProducts/${i}/presentaciones`, aPresentacionesActivas);
                    oFilterModel.setProperty(`/filteredProducts/${i}/presentacionesCount`, aPresentacionesActivas.length);
                    
                } catch (error) {
                    console.error(`Error cargando presentaciones para ${product.SKUID}:`, error);
                }
            }
        },

        onFilterProductCheckBoxSelect: function(oEvent) {
            const bSelected = oEvent.getParameter("selected");
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("filterModel");
            const sPath = oContext.getPath();
            const oFilterModel = this.getView().getModel("filterModel");
            const oProduct = oContext.getObject();
            const aPresentaciones = oFilterModel.getProperty(sPath + "/presentaciones");
            const oCreateModel = this.getView().getModel("createPromo");
            const aSelected = oCreateModel.getProperty("/selectedPresentaciones") || [];
            
            if (aPresentaciones && aPresentaciones.length > 0) {
                aPresentaciones.forEach(function(pres, index) {
                    if (!pres.locked) {
                        oFilterModel.setProperty(sPath + "/presentaciones/" + index + "/selected", bSelected);
                        
                        if (bSelected) {
                            // Agregar si no existe
                            const exists = aSelected.some(p => p.IdPresentaOK === pres.IdPresentaOK);
                            if (!exists) {
                                aSelected.push({
                                    IdPresentaOK: pres.IdPresentaOK,
                                    SKUID: oProduct.SKUID,
                                    NOMBREPRESENTACION: pres.NOMBREPRESENTACION,
                                    Precio: pres.precio,
                                    producto: {
                                        SKUID: oProduct.SKUID,
                                        PRODUCTNAME: oProduct.PRODUCTNAME
                                    }
                                });
                            }
                        } else {
                            // Quitar
                            const idx = aSelected.findIndex(p => p.IdPresentaOK === pres.IdPresentaOK);
                            if (idx > -1) {
                                aSelected.splice(idx, 1);
                            }
                        }
                    }
                });
            }
            
            oFilterModel.setProperty(sPath + "/allSelected", bSelected);
            oCreateModel.setProperty("/selectedPresentaciones", aSelected);
            this._updateGroupedSelectedProducts();
            this._updateSelectedPresentacionesCount();
        },

        onSelectAllProducts: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aProducts = oFilterModel.getProperty("/filteredProducts") || [];
            
            let totalSelected = 0;
            
            // Clonar el array para forzar la actualización
            const aUpdatedProducts = JSON.parse(JSON.stringify(aProducts));
            
            aUpdatedProducts.forEach(function(product) {
                if (product.presentaciones && Array.isArray(product.presentaciones) && product.presentaciones.length > 0) {
                    let hasUnlocked = false;
                    product.presentaciones.forEach(function(pres) {
                        if (!pres.locked) {
                            hasUnlocked = true;
                            pres.selected = true;
                            totalSelected++;
                        }
                    });
                    if (hasUnlocked) {
                        product.allSelected = true;
                    }
                }
            });
            
            // Reemplazar todo el array de una vez
            oFilterModel.setProperty("/filteredProducts", aUpdatedProducts);
            this._updatePaginatedProducts();
            this._updateSelectedPresentacionesCount();
            MessageToast.show(totalSelected + " presentación(es) seleccionadas");
        },

        onClearSelection: function() {
            const oFilterModel = this.getView().getModel("filterModel");
            const aProducts = oFilterModel.getProperty("/filteredProducts") || [];
            
            // Clonar el array para forzar la actualización
            const aUpdatedProducts = JSON.parse(JSON.stringify(aProducts));
            
            aUpdatedProducts.forEach(function(product) {
                if (product.presentaciones && Array.isArray(product.presentaciones)) {
                    product.presentaciones.forEach(function(pres) {
                        pres.selected = false;
                    });
                    product.allSelected = false;
                }
            });
            
            // Reemplazar todo el array de una vez
            oFilterModel.setProperty("/filteredProducts", aUpdatedProducts);
            this._updatePaginatedProducts();
            this._updateSelectedPresentacionesCount();
            MessageToast.show("Selección eliminada");
        },

        _updateFilterProductCheckBox: function(productIndex) {
            const oFilterModel = this.getView().getModel("filterModel");
            const oProduct = oFilterModel.getProperty("/filteredProducts/" + productIndex);
            
            if (!oProduct || !oProduct.presentaciones) return;
            
            const totalPresentaciones = oProduct.presentaciones.filter(p => !p.locked).length;
            const selectedPresentaciones = oProduct.presentaciones.filter(p => p.selected && !p.locked).length;
            const bAllSelected = totalPresentaciones > 0 && selectedPresentaciones === totalPresentaciones;
            
            oFilterModel.setProperty("/filteredProducts/" + productIndex + "/allSelected", bAllSelected);
        }
    });
});
